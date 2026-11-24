import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { automaticSampleSequences, dueCharacteristicEvents, validateCharacteristicSampling } from "./inspection-frequency.js";
import * as repository from "./in-process-inspection.repository.js";

const clean = (value, length = 160) => String(value ?? "").trim().slice(0, length);
const positiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(`${label} is required.`, 400);
  return id;
};
const positiveWhole = (value, label, maximum = 500) => {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maximum) {
    throw new AppError(`${label} must be a whole number from 1 to ${maximum}.`, 400);
  }
  return quantity;
};

const numericLimit = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const inspectionDateValue = (value) => {
  const date = clean(value, 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError("Inspection date must be a valid date.", 400);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new AppError("Inspection date must be a valid date.", 400);
  }
  return date;
};

function resultFromLimits(requirement, actualValue) {
  const lsl = numericLimit(requirement.lsl_snapshot);
  const usl = numericLimit(requirement.usl_snapshot);
  if (lsl === null || usl === null) {
    throw new AppError("LSL and USL are required to calculate an in-process inspection result automatically.", 409);
  }
  if (lsl > usl) throw new AppError("The inspection LSL cannot be greater than its USL.", 409);
  const observedValue = Number(actualValue);
  if (!Number.isFinite(observedValue)) throw new AppError("Observed value must be numeric for a range-based inspection.", 400);
  return observedValue >= lsl && observedValue <= usl ? "PASS" : "FAIL";
}

function pieceReference(run, sequence) {
  const workOrder = run.work_order_reference.replace(/[^A-Za-z0-9-]+/g, "-").slice(0, 75) || "WO";
  const batch = run.batch_reference.replace(/[^A-Za-z0-9-]+/g, "-").slice(0, 35);
  const batchSegment = batch ? `-${batch}` : "";
  return `${workOrder}${batchSegment}-OP${run.operation_number_snapshot}-${String(sequence).padStart(6, "0")}`;
}

function setupOrThrow(setup) {
  if (!setup) throw new AppError("Choose an active Part, approved Process Plan, and operation with a READY inspection plan.", 409);
  if (!setup.characteristics.length) throw new AppError("The selected operation has no inspection characteristics.", 409);
  for (const characteristic of setup.characteristics) {
    if (!String(characteristic.characteristicName || "").trim()) {
      throw new AppError("Every inspection-plan row must have a characteristic before production can be reported.", 409);
    }
    validateCharacteristicSampling(characteristic);
  }
  return setup;
}

export async function listParts(user) {
  return repository.listAvailableParts(user.tenantId);
}

export async function listProcessPlans(partId) {
  return repository.listPartProcessPlans(positiveId(partId, "Part"));
}

export async function dashboard(user) {
  // Records created before automatic selection was enabled are upgraded the
  // first time their queue is opened. New production records never enter this
  // state because their samples are attached in reportProduction().
  await withTransaction(async (connection) => {
    const waiting = await repository.listAwaitingAutomaticSelectionForUpdate(connection, user.tenantId);
    for (const requirement of waiting) {
      const candidates = await repository.listCandidatePiecesForUpdate(connection, requirement.runId, requirement.windowStart, requirement.windowEnd);
      if (candidates.length < Number(requirement.requiredSampleCount)) continue;
      const sequences = automaticSampleSequences({ start: requirement.windowStart, end: requirement.windowEnd }, requirement.requiredSampleCount);
      const candidateBySequence = new Map(candidates.map((piece) => [Number(piece.pieceSequence), Number(piece.pieceId)]));
      const selectedPieceIds = sequences.map((sequence) => candidateBySequence.get(sequence));
      if (selectedPieceIds.some((pieceId) => !pieceId)) continue;
      await repository.insertSamples(connection, requirement.requirementId, selectedPieceIds);
      await repository.updateRequirementStatus(connection, requirement.requirementId, "PENDING_INSPECTION", "SYSTEM");
      for (const pieceId of selectedPieceIds) await repository.updatePieceStatus(connection, pieceId, "PENDING_INSPECTION", "SYSTEM");
      await recordAudit({ connection, tenantId: user.tenantId, module: "OPERATIONS", entityType: "IN_PROCESS_INSPECTION_REQUIREMENT",
        entityId: requirement.requirementId, action: "IN_PROCESS_SAMPLES_AUTO_SELECTED", newValue: { pieceIds: selectedPieceIds }, performedBy: "SYSTEM" });
    }
  });
  const [runs, queue] = await Promise.all([
    repository.listRuns(user.tenantId),
    repository.listQueueRequirements(user.tenantId),
  ]);
  const samples = await repository.listSamplesForRequirements(queue.map((row) => Number(row.requirementId)));
  const samplesByRequirement = new Map();
  for (const sample of samples) {
    const list = samplesByRequirement.get(Number(sample.requirementId)) || [];
    list.push(sample);
    samplesByRequirement.set(Number(sample.requirementId), list);
  }
  const samplingQueue = [];
  const inspectionQueue = [];
  for (const requirement of queue) {
    const entry = { ...requirement, samples: samplesByRequirement.get(Number(requirement.requirementId)) || [] };
    if (requirement.requirementStatus === "AWAITING_SAMPLE_SELECTION") {
      entry.candidates = await repository.listCandidatePieces(undefined, requirement.runId, requirement.windowStart, requirement.windowEnd);
      samplingQueue.push(entry);
    } else {
      inspectionQueue.push(entry);
    }
  }
  return { runs, samplingQueue, inspectionQueue };
}

export async function reportProduction(raw, user) {
  const workOrderReference = clean(raw.workOrderReference, 120);
  if (!workOrderReference) throw new AppError("Work order / job card reference is required.", 400);
  const batchReference = clean(raw.batchReference, 120);
  const partId = positiveId(raw.partId, "Part");
  const processPlanId = positiveId(raw.processPlanId, "Process Plan");
  const processOperationId = positiveId(raw.processOperationId, "Operation");
  const quantity = positiveWhole(raw.quantity, "Produced quantity");

  return withTransaction(async (connection) => {
    const setup = setupOrThrow(await repository.getOperationSetup(connection, { partId, processPlanId, processOperationId }));
    const run = await repository.getOrCreateRunForUpdate(connection, {
      tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId,
      workOrderReference, batchReference, partId, processPlanId, processOperationId,
      partNumber: setup.partNumber, partName: setup.partName, operationNumber: setup.operationNumber,
      operationName: setup.operationName, userCode: user.userCode,
    });
    if (!run) throw new AppError("Unable to start the in-process inspection run.", 500);
    if (run.run_status !== "ACTIVE") {
      throw new AppError("This operation run is on quality hold. Resolve the failed inspection before reporting more production.", 409, {
        code: "IN_PROCESS_RUN_ON_HOLD",
      });
    }
    if (Number(run.part_id) !== partId || Number(run.process_plan_id) !== processPlanId) {
      throw new AppError("This work order / batch already belongs to a different Part or Process Plan for the selected operation.", 409);
    }

    const startSequence = Number(run.next_piece_sequence);
    let dueRequirementCount = 0;
    const createdPieces = [];
    for (let offset = 0; offset < quantity; offset += 1) {
      const pieceSequence = startSequence + offset;
      const pieceId = await repository.insertPiece(connection, {
        runId: Number(run.in_process_inspection_run_id), pieceSequence,
        pieceReference: pieceReference(run, pieceSequence), userCode: user.userCode,
        pieceStatus: "READY_FOR_TRANSFER",
      });
      createdPieces.push({ pieceId, pieceSequence });
      const events = dueCharacteristicEvents(setup.characteristics, pieceSequence);
      for (const event of events) {
        const requirementId = await repository.insertRequirement(connection, {
          runId: Number(run.in_process_inspection_run_id),
          inspectionCharacteristicId: event.characteristic.inspectionCharacteristicId,
          triggerPieceId: pieceId, triggerPieceSequence: pieceSequence,
          windowStart: event.window.start, windowEnd: event.window.end,
          inspectionFrequency: event.characteristic.inspectionFrequency,
          sampleSize: event.characteristic.sampleSize, requiredSampleCount: event.requiredSampleSize,
          characteristicCode: event.characteristic.characteristicCode,
          characteristicName: event.characteristic.characteristicName,
          characteristicType: event.characteristic.characteristicType,
          specifiedDimension: event.characteristic.specifiedDimension, lsl: event.characteristic.lsl,
          usl: event.characteristic.usl, drawingGrid: event.characteristic.drawingGrid,
          instrumentName: event.characteristic.instrumentName,
          requirementStatus: "PENDING_INSPECTION",
        });
        dueRequirementCount += 1;
        const candidates = await repository.listCandidatePiecesForUpdate(connection, run.in_process_inspection_run_id,
          event.window.start, event.window.end);
        const sampleSequences = automaticSampleSequences(event.window, event.requiredSampleSize);
        const candidateBySequence = new Map(candidates.map((candidate) => [Number(candidate.pieceSequence), Number(candidate.pieceId)]));
        const selectedPieceIds = sampleSequences.map((sequence) => candidateBySequence.get(sequence));
        if (selectedPieceIds.some((selectedPieceId) => !selectedPieceId)) {
          throw new AppError("The required inspection sample pieces could not be created for this production window.", 409);
        }
        await repository.insertSamples(connection, requirementId, selectedPieceIds);
        for (const selectedPieceId of selectedPieceIds) {
          await repository.updatePieceStatus(connection, selectedPieceId, "PENDING_INSPECTION", user.userCode);
        }
      }
    }
    await repository.updateRunNextSequence(connection, run.in_process_inspection_run_id, startSequence + quantity, user.userCode);
    await recordAudit({ connection, tenantId: user.tenantId, module: "OPERATIONS", entityType: "IN_PROCESS_INSPECTION_RUN",
      entityId: run.in_process_inspection_run_id, action: "PRODUCTION_REPORTED", newValue: {
        workOrderReference, batchReference, partId, processPlanId, processOperationId,
        fromPieceSequence: startSequence, toPieceSequence: startSequence + quantity - 1, dueRequirementCount,
      }, performedBy: user.userCode });
    return { runId: Number(run.in_process_inspection_run_id), fromPieceSequence: startSequence,
      toPieceSequence: startSequence + quantity - 1, createdPieces, dueRequirementCount };
  });
}

export async function selectSamples(requirementId, raw, user) {
  const selectedPieceIds = Array.isArray(raw.pieceIds) ? raw.pieceIds.map((value) => positiveId(value, "Sample piece")) : [];
  if (new Set(selectedPieceIds).size !== selectedPieceIds.length) throw new AppError("Select each sample piece only once.", 400);
  return withTransaction(async (connection) => {
    const requirement = await repository.getRequirementForUpdate(connection, user.tenantId, requirementId);
    if (!requirement) throw new AppError("Inspection sampling requirement not found.", 404);
    if (requirement.run_status !== "ACTIVE") throw new AppError("The operation run is on hold and cannot accept a new sample selection.", 409);
    if (requirement.requirement_status !== "AWAITING_SAMPLE_SELECTION") throw new AppError("Samples have already been selected for this requirement.", 409);
    if (selectedPieceIds.length !== Number(requirement.required_sample_count)) {
      throw new AppError(`Select exactly ${requirement.required_sample_count} sample piece(s).`, 400);
    }
    const candidates = await repository.listCandidatePieces(connection, requirement.in_process_inspection_run_id,
      requirement.sample_window_start_sequence, requirement.sample_window_end_sequence);
    const candidateIds = new Set(candidates.map((row) => Number(row.pieceId)));
    if (selectedPieceIds.some((id) => !candidateIds.has(id))) {
      throw new AppError("Every selected sample must belong to this requirement's production window and remain available.", 409);
    }
    await repository.insertSamples(connection, requirementId, selectedPieceIds);
    await repository.updateRequirementStatus(connection, requirementId, "PENDING_INSPECTION", user.userCode);
    for (const pieceId of selectedPieceIds) await repository.updatePieceStatus(connection, pieceId, "PENDING_INSPECTION", user.userCode);
    await recordAudit({ connection, tenantId: user.tenantId, module: "OPERATIONS", entityType: "IN_PROCESS_INSPECTION_REQUIREMENT",
      entityId: requirementId, action: "IN_PROCESS_SAMPLES_SELECTED", newValue: { pieceIds: selectedPieceIds }, performedBy: user.userCode });
    return { requirementId: Number(requirementId), selectedPieceIds };
  });
}

export async function completeInspection(requirementId, raw, user) {
  const submitted = Array.isArray(raw.samples) ? raw.samples : [];
  return withTransaction(async (connection) => {
    const requirement = await repository.getRequirementForUpdate(connection, user.tenantId, requirementId);
    if (!requirement) throw new AppError("Inspection requirement not found.", 404);
    if (requirement.run_status !== "ACTIVE") throw new AppError("The operation run is on hold. Record a quality disposition before further inspection.", 409);
    if (requirement.requirement_status !== "PENDING_INSPECTION") throw new AppError("This inspection requirement is not ready for result entry.", 409);
    const storedSamples = await repository.listRequirementSamplesForUpdate(connection, requirementId);
    if (storedSamples.length !== Number(requirement.required_sample_count)) {
      throw new AppError("The required sample pieces are incomplete for this inspection requirement.", 409);
    }
    const submittedById = new Map(submitted.map((row) => [Number(row.sampleId), row]));
    if (!submitted.length || submittedById.size !== submitted.length) {
      throw new AppError("Enter one result for each piece being inspected.", 400);
    }
    const storedById = new Map(storedSamples.map((sample) => [Number(sample.in_process_inspection_sample_id), sample]));
    const resultById = new Map(storedSamples.map((sample) => [
      Number(sample.in_process_inspection_sample_id), String(sample.inspection_result || "PENDING").toUpperCase(),
    ]));
    let failedPieceReference = "";
    for (const [sampleId, input] of submittedById) {
      const stored = storedById.get(sampleId);
      if (!stored) throw new AppError("Inspection results must match the selected sample pieces.", 409);
      if (String(stored.inspection_result || "PENDING").toUpperCase() !== "PENDING") {
        throw new AppError(`${stored.piece_reference} has already been inspected.`, 409);
      }
      const actualValue = clean(input.actualValue, 500);
      if (!actualValue) throw new AppError(`Enter the actual value for ${stored.piece_reference}.`, 400);
      const inspectionResult = resultFromLimits(requirement, actualValue);
      if (inspectionResult === "FAIL") failedPieceReference = stored.piece_reference;
      await repository.updateSampleResult(connection, sampleId, {
        actualValue, inspectionDate: inspectionDateValue(input.inspectionDate), inspectionResult,
        remarks: clean(input.remarks, 1000), userCode: user.userCode,
      });
      resultById.set(sampleId, inspectionResult);
    }
    const failed = Array.from(resultById.values()).some((result) => result === "FAIL");
    const allSamplesInspected = Array.from(resultById.values()).every((result) => result === "PASS" || result === "FAIL");
    const failureRemarks = clean(raw.failureRemarks, 1000);
    if (failed && !failureRemarks) throw new AppError("Failure remarks are required before the production window is placed on hold.", 400);
    if (failed) {
      await repository.updateRequirementStatus(connection, requirementId, "FAIL", user.userCode, failureRemarks);
      const reason = `${requirement.characteristic_name_snapshot} failed at piece ${failedPieceReference || requirement.trigger_piece_sequence}. ${failureRemarks}`.trim();
      await repository.holdRunAndWindow(connection, { runId: requirement.in_process_inspection_run_id,
        windowStart: requirement.sample_window_start_sequence, windowEnd: requirement.sample_window_end_sequence,
        reason, userCode: user.userCode });
    } else if (allSamplesInspected) {
      await repository.updateRequirementStatus(connection, requirementId, "PASS", user.userCode, null);
      await repository.markSamplePiecesReadyWhenClear(connection, requirementId, user.userCode);
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "OPERATIONS", entityType: "IN_PROCESS_INSPECTION_REQUIREMENT",
      entityId: requirementId, action: failed ? "IN_PROCESS_INSPECTION_FAILED" : allSamplesInspected ? "IN_PROCESS_INSPECTION_PASSED" : "IN_PROCESS_INSPECTION_SAMPLE_RECORDED",
      newValue: { failed, allSamplesInspected, submittedSampleIds: Array.from(submittedById.keys()),
        triggerPieceSequence: requirement.trigger_piece_sequence, sampleWindow: [requirement.sample_window_start_sequence, requirement.sample_window_end_sequence] },
      performedBy: user.userCode, remarks: failureRemarks || null });
    return { requirementId: Number(requirementId), status: failed ? "FAIL" : allSamplesInspected ? "PASS" : "PENDING_INSPECTION", runStatus: failed ? "ON_HOLD" : "ACTIVE" };
  });
}

export async function completeInspections(raw, user) {
  const inspections = Array.isArray(raw?.inspections) ? raw.inspections : [];
  if (!inspections.length) throw new AppError("Enter at least one inspection before saving.", 400);
  if (inspections.length > 100) throw new AppError("Save no more than 100 inspections at a time.", 400);

  const requirementIds = inspections.map((inspection) => positiveId(inspection?.requirementId, "Inspection requirement"));
  if (new Set(requirementIds).size !== requirementIds.length) {
    throw new AppError("Each inspection requirement can be saved only once per request.", 400);
  }

  const completed = [];
  for (let index = 0; index < inspections.length; index += 1) {
    completed.push(await completeInspection(requirementIds[index], inspections[index], user));
  }
  return { completedCount: completed.length, inspections: completed };
}
