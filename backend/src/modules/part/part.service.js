import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";

import * as customerRepository from "../customer/customer.repository.js";
import * as repository from "./part.repository.js";
import { calculateProcessCostInr } from "./part-process-cost.js";

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

function validatePart(data) {
  if (!Number(data.customerId)) {
    throw new AppError("Customer is required.");
  }

  if (!clean(data.partName)) {
    throw new AppError("Part Name is required.");
  }

  if (
    !clean(data.partNumber) &&
    data.partNumberMode !== "AUTO"
  ) {
    throw new AppError("Part Number is required.");
  }

  if (
    !["MACHINING", "ASSEMBLY"].includes(
      data.partCategory
    )
  ) {
    throw new AppError(
      "Part Category must be MACHINING or ASSEMBLY."
    );
  }

  if (
    data.partCategory === "MACHINING" &&
    !clean(data.materialSpecification)
  ) {
    throw new AppError(
      "Material Specification is required for Machining parts."
    );
  }

}

function normalizeBomComponents(data) {
  if (!Array.isArray(data.bomComponents)) return [];
  const components = data.bomComponents.map((row, index) => {
    const componentType = String(row.componentType || "").toUpperCase();
    const componentId = Number(row.componentId);
    const quantity = Number(row.quantity);
    if (!["PART", "ITEM"].includes(componentType) || !componentId) {
      throw new AppError(`Select a valid Part or Item for BOM row ${index + 1}.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(`Quantity must be greater than zero for BOM row ${index + 1}.`);
    }
    return { componentType, componentId, quantity };
  });
  const keys = components.map((row) => `${row.componentType}:${row.componentId}`);
  if (new Set(keys).size !== keys.length) {
    throw new AppError("Duplicate Part or Item attachments are not allowed in the Bill of Material.");
  }
  return components;
}

const numberOrNull = (value) => value === "" || value === null || value === undefined
  ? null : Number(value);

const selected = (value) => value === true || value === 1 || String(value).toUpperCase() === "Y";

async function normalizeSingleProcessPlan(connection, data, input, planIndex) {
  const masters = await repository.getProcessMasters(connection);
  const operationMap = new Map(masters.operations.map((row) => [Number(row.operationMasterId), row]));
  const sourceMap = new Map(masters.sources.map((row) => [String(row.sourceCode).toUpperCase(), row]));
  const machineTypeMap = new Map(masters.machineTypes.map((row) => [Number(row.machineTypeId), row]));
  const characteristicIds = new Set(masters.characteristics.map((row) => Number(row.characteristicMasterId)));
  const instrumentIds = new Set(masters.instruments.map((row) => Number(row.instrumentMasterId)));
  const toleranceMap = new Map(masters.toleranceGrades.map((row) => [Number(row.toleranceGradeId), row]));
  const planStatus = String(input.planStatus || "DRAFT").toUpperCase();
  if (!["DRAFT", "APPROVED"].includes(planStatus)) throw new AppError("Invalid Process Plan status.");
  const inputOperations = Array.isArray(input.operations) ? [...input.operations]
    .sort((left,right) => Number(left.operationNumber || 0)-Number(right.operationNumber || 0)) : [];
  const operations = inputOperations.map((row, index) => {
    const operationNumber = Number(row.operationNumber || ((index + 1) * 10));
    const operationMasterId = Number(row.operationMasterId) || null;
    const operationMaster = operationMap.get(operationMasterId);
    if (operationMasterId && !operationMaster) throw new AppError(`Select a valid Operation for process row ${index + 1}.`);
    if (planStatus === "APPROVED" && !operationMaster) throw new AppError(`Select an Operation for process row ${index + 1}.`);
    const sourceType = String(row.sourceType || operationMaster?.defaultSource || masters.sources[0]?.sourceCode || "").toUpperCase();
    const sourceMaster = sourceMap.get(sourceType);
    if (!sourceMaster) throw new AppError(`Select a valid active Source for process row ${index + 1}.`);
    const costingMode = String(sourceMaster.costingMode).toUpperCase();
    const requestedMachineTypeId = numberOrNull(row.machineTypeId);
    const machineTypeId = costingMode === "INHOUSE" ? requestedMachineTypeId : null;
    if (machineTypeId && !machineTypeMap.has(machineTypeId)) {
      throw new AppError(`Select an active Machine Type for process row ${index + 1}.`);
    }
    if (planStatus === "APPROVED" && costingMode === "INHOUSE" && !machineTypeId) {
      throw new AppError(`Select an active Machine Type for in-house process row ${index + 1}.`);
    }
    const cycleTimeSeconds = costingMode === "INHOUSE" ? numberOrNull(row.cycleTimeSeconds) : null;
    const clampingTimeSeconds = costingMode === "INHOUSE" ? numberOrNull(row.clampingTimeSeconds) : null;
    const settingTimeHours = costingMode === "INHOUSE" ? numberOrNull(row.settingTimeHours) : null;
    const outsourceCostInput = row.outsourceCostInr !== "" && row.outsourceCostInr !== null
      && row.outsourceCostInr !== undefined ? row.outsourceCostInr : row.processCostInr;
    const outsourceCostInr = costingMode === "OUTSOURCE" ? numberOrNull(outsourceCostInput) : null;
    for (const [label, value] of [["Cycle Time",cycleTimeSeconds],["Clamping Time",clampingTimeSeconds],
      ["Setting Time",settingTimeHours],["Outsource Cost",outsourceCostInr]]) {
      if (value !== null && (!Number.isFinite(value) || value < 0)) throw new AppError(`${label} must be zero or greater in process row ${index + 1}.`);
    }
    const hourlyCost = costingMode === "INHOUSE" ? Number(machineTypeMap.get(machineTypeId)?.hourlyCostInr || 0) : 0;
    const processCostInr = calculateProcessCostInr({ sourceType:costingMode,hourlyCostInr:hourlyCost,
      cycleTimeSeconds,clampingTimeSeconds,outsourceCostInr });
    let inspectionPlan = null;
    if (row.inspectionPlan) {
      const characteristics = Array.isArray(row.inspectionPlan.characteristics)
        ? row.inspectionPlan.characteristics.map((entry, characteristicIndex) => {
          const characteristicMasterId = Number(entry.characteristicMasterId) || null;
          const characteristicText = characteristicMasterId
            ? null
            : clean(entry.characteristicText ?? entry.characteristicSearch);
          if (characteristicMasterId && !characteristicIds.has(characteristicMasterId)) throw new AppError(`Select a valid Characteristic in inspection row ${characteristicIndex + 1}.`);
          if (characteristicText && characteristicText.length > 150) throw new AppError(`Characteristic text cannot exceed 150 characters in inspection row ${characteristicIndex + 1}.`);
          if (planStatus === "APPROVED" && !characteristicMasterId && !characteristicText) throw new AppError(`Enter or select a Characteristic in inspection row ${characteristicIndex + 1}.`);
          const specifiedDimension = numberOrNull(entry.specifiedDimension);
          const requestedToleranceGradeId = numberOrNull(entry.toleranceGradeId);
          const requestedToleranceGradeText = clean(entry.toleranceGradeText);
          const gradeText = requestedToleranceGradeText?.toUpperCase() || "";
          const gradeFromText = specifiedDimension === null || !gradeText ? null
            : masters.toleranceGrades.find((grade) => String(grade.gradeCode).trim().toUpperCase() === gradeText
              && (Number(grade.basicSizeFrom) === 0
                ? specifiedDimension >= 0
                : specifiedDimension > Number(grade.basicSizeFrom))
              && specifiedDimension <= Number(grade.basicSizeTo));
          const gradeFromId = toleranceMap.get(requestedToleranceGradeId);
          const idGradeInRange = gradeFromId && specifiedDimension !== null
            && (Number(gradeFromId.basicSizeFrom) === 0
              ? specifiedDimension >= 0
              : specifiedDimension > Number(gradeFromId.basicSizeFrom))
            && specifiedDimension <= Number(gradeFromId.basicSizeTo) ? gradeFromId : null;
          const grade = gradeFromText || idGradeInRange || null;
          const toleranceMode = grade ? "GRADE" : "MANUAL";
          let toleranceGradeId = grade ? Number(grade.toleranceGradeId) : null;
          const toleranceGradeText = requestedToleranceGradeText || (grade ? String(grade.gradeCode) : null);
          let toleranceMinus = numberOrNull(entry.toleranceMinus);
          let tolerancePlus = numberOrNull(entry.tolerancePlus);
          let lsl = null; let usl = null;
          if (grade) {
            if (specifiedDimension !== null) {
              toleranceMinus = Math.abs(Number(grade.lowerDeviationMicrons || 0)) / 1000;
              tolerancePlus = Number(grade.upperDeviationMicrons || 0) / 1000;
              lsl = Number((specifiedDimension + (Number(grade.lowerDeviationMicrons || 0) / 1000)).toFixed(4));
              usl = Number((specifiedDimension + tolerancePlus).toFixed(4));
            }
          } else {
            toleranceGradeId = null;
            if (planStatus === "APPROVED" && (!toleranceGradeText || specifiedDimension === null || toleranceMinus === null || tolerancePlus === null
              || toleranceMinus < 0 || tolerancePlus < 0)) {
              throw new AppError(`Enter Tol Grade, Dimension, Tol- and Tol+ for inspection row ${characteristicIndex + 1}.`);
            }
            if (specifiedDimension !== null && toleranceMinus !== null && tolerancePlus !== null) {
              lsl = Number((specifiedDimension - toleranceMinus).toFixed(4));
              usl = Number((specifiedDimension + tolerancePlus).toFixed(4));
            }
          }
          const instrumentMasterId = numberOrNull(entry.instrumentMasterId);
          if (instrumentMasterId && !instrumentIds.has(instrumentMasterId)) throw new AppError("Select a valid Inspection Instrument.");
          return {
            sequenceNumber: characteristicIndex + 1, balloonNumber: clean(entry.balloonNumber),
            characteristicMasterId, characteristicText, specifiedDimension, toleranceMode, toleranceGradeId, toleranceGradeText,
            toleranceMinus, tolerancePlus, lsl, usl, drawingGrid: clean(entry.drawingGrid),
            instrumentMasterId, sampleSize: clean(entry.sampleSize),
            inspectionFrequency: clean(entry.inspectionFrequency),
            scCcIdentification: Boolean(entry.scCcIdentification),
            patrolQaResult: null,
            periodicOperatorRequired: Boolean(entry.periodicOperatorRequired),
            finalInspectionRequired: Boolean(entry.finalInspectionRequired),
          };
        }) : [];
      inspectionPlan = { cmmRequired:selected(row.inspectionPlan.cmmRequired),
        planStatus: characteristics.length && characteristics.every((entry) =>
        entry.scCcIdentification && entry.periodicOperatorRequired && entry.finalInspectionRequired)
        ? "READY" : "DRAFT", characteristics };
    }
    return { processDefinitionId:Number(row.processDefinitionId || 0) || null,
      operationNumber,operationMasterId,operationDescription:clean(row.operationDescription),
      sourceType,machineTypeId,cycleTimeSeconds,clampingTimeSeconds,settingTimeHours,outsourceCostInr,
      processCostInr,inspectionPlan };
  });
  if (new Set(operations.map((row) => row.operationNumber)).size !== operations.length) {
    throw new AppError("Operation numbers must be unique.");
  }
  operations.sort((left,right) => left.operationNumber-right.operationNumber);
  if (planStatus === "APPROVED") {
    if (!operations.length) throw new AppError("Add at least one process before approval.");
    const pending = operations.find((row) => !row.inspectionPlan || !row.inspectionPlan.characteristics.length
      || row.inspectionPlan.planStatus !== "READY");
    if (pending) throw new AppError(`Operation ${pending.operationNumber} requires SC/CC, Periodic Inspection and Final Inspection for every characteristic.`);
  }
  const productionCapacityPerDay = numberOrNull(input.productionCapacityPerDay);
  if (productionCapacityPerDay !== null && (!Number.isFinite(productionCapacityPerDay) || productionCapacityPerDay <= 0)) {
    throw new AppError(`Production Capacity / Day must be greater than zero for Process Plan Variant ${planIndex + 1}.`);
  }
  return { processPlanId:Number(input.processPlanId || 0) || null,
    drawingRevisionNumber:clean(input.drawingRevisionNumber || data.drawingRevisionNumber),
    planCode:clean(input.planCode),routeName:clean(input.routeName) || `Route ${planIndex + 1}`,
    productionCapacityPerDay,planStatus,isDefault:selected(input.isDefault),
    activeFlag:String(input.activeFlag || "Y").toUpperCase() === "N" ? "N" : "Y",operations };
}

async function normalizeProcessPlans(connection, data) {
  const inputs = Array.isArray(data.processPlans)
    ? data.processPlans
    : data.processPlan ? [{ ...data.processPlan,isDefault:true,activeFlag:"Y",
      routeName:data.processPlan.routeName || "Default Route" }] : [];
  const plans = [];
  for (let index=0; index<inputs.length; index+=1) {
    plans.push(await normalizeSingleProcessPlan(connection,data,inputs[index],index));
  }
  const activeDefaults = plans.filter((plan) => plan.activeFlag === "Y" && plan.isDefault);
  if (activeDefaults.length > 1) throw new AppError("Only one active Process Plan Variant can be the default.");
  const activePlans = plans.filter((plan) => plan.activeFlag === "Y");
  if (activePlans.length && !activeDefaults.length) activePlans[0].isDefault = true;
  const codes = plans.map((plan) => plan.planCode).filter(Boolean).map((code) => code.toUpperCase());
  if (new Set(codes).size !== codes.length) throw new AppError("Process Plan Variant codes must be unique for this Part.");
  const sharedDefinitions = new Map();
  for (const plan of plans) for (const operation of plan.operations) {
    if (!operation.processDefinitionId) continue;
    const signature = JSON.stringify({ operationMasterId:operation.operationMasterId,
      operationDescription:operation.operationDescription,sourceType:operation.sourceType,
      machineTypeId:operation.machineTypeId,cycleTimeSeconds:operation.cycleTimeSeconds,
      clampingTimeSeconds:operation.clampingTimeSeconds,settingTimeHours:operation.settingTimeHours,
      outsourceCostInr:operation.outsourceCostInr,processCostInr:operation.processCostInr });
    const previous = sharedDefinitions.get(operation.processDefinitionId);
    if (previous && previous !== signature) {
      throw new AppError(`Shared Process Definition ${operation.processDefinitionId} has conflicting values across variants.`);
    }
    sharedDefinitions.set(operation.processDefinitionId,signature);
  }
  return plans;
}

async function validateBomComponents(connection, parentPartId, components) {
  const validated = [];
  for (const component of components) {
    if (component.componentType === "PART" && component.componentId === Number(parentPartId)) {
      throw new AppError("A Part cannot be attached to its own Bill of Material.");
    }
    if (component.componentType === "PART" && await repository.wouldCreateBomCycle(
      connection, Number(parentPartId), component.componentId
    )) {
      throw new AppError("This Part attachment would create a circular Bill of Material hierarchy.");
    }
    const source = await repository.validateBomComponent(
      connection, component.componentType, component.componentId
    );
    if (!source) {
      throw new AppError("One or more Bill of Material attachments are inactive or invalid.");
    }
    validated.push({ ...component, uomId: source.uomId ? Number(source.uomId) : null });
  }
  return validated;
}

async function validateMaterialSelection(connection, data) {
  if (data.partCategory === "ASSEMBLY") {
    if (!data.uomId) return;
    const result = await repository.validateMaterialSelection(
      connection, null, null, Number(data.uomId)
    );
    if (!result?.uomOk) {
      throw new AppError("Select a valid active Unit of Measurement.");
    }
    return;
  }
  if (!data.materialId && !data.uomId && !data.materialGradeId) return;
  if (!Number(data.materialId) || !Number(data.uomId)) {
    throw new AppError("Material and Unit of Measurement must both be selected from their masters.");
  }
  const result = await repository.validateMaterialSelection(
    connection, Number(data.materialId),
    data.materialGradeId ? Number(data.materialGradeId) : null,
    Number(data.uomId)
  );
  if (!result?.materialOk || !result?.uomOk || !result?.gradeOk) {
    throw new AppError("Select a valid active Material, Grade and Unit of Measurement.");
  }
}

function buildPartValues(
  data,
  partNumber,
  userCode
) {
  return [
    Number(data.customerId),
    data.partCategory,
    clean(data.partName),
    partNumber,
    clean(data.drawingNumber),
    clean(data.drawingRevisionNumber),
    clean(data.drawingRevisionDate),
    data.drawingCodeMode || "AUTO",
    clean(data.drawingCode),
    data.partCategory === "ASSEMBLY"
      ? null
      : clean(data.materialSpecification),
    data.partCategory === "ASSEMBLY" ? null : data.materialId ? Number(data.materialId) : null,
    data.partCategory === "ASSEMBLY" ? null : data.materialGradeId ? Number(data.materialGradeId) : null,
    data.partWeight === "" ||
    data.partWeight === null ||
    data.partWeight === undefined
      ? null
      : Number(data.partWeight),
    clean(data.unitOfMeasurement),
    data.uomId ? Number(data.uomId) : null,
    clean(data.projectName),
    userCode,
  ];
}

export async function listParts(query = {}) {
  const page = Math.max(
    Number(query.page || 1),
    1
  );

  const pageSize = Math.min(
    Math.max(
      Number(query.pageSize || 20),
      1
    ),
    100
  );

  return repository.listParts({
    search: clean(query.search) || "",
    customerId: Number(
      query.customerId || 0
    ),
    activeFlag: clean(
      query.activeFlag
    ) || "",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
}

export async function searchBomOptions(query = {}) {
  return repository.searchBomOptions({
    search: clean(query.search) || "",
    excludePartId: Number(query.excludePartId || 0),
  });
}

export async function getProcessMasters() {
  return repository.getProcessMasters();
}

export async function getPart(partId) {
  const record =
    await repository.getPartById(partId);

  if (!record) {
    throw new AppError(
      "Part not found.",
      404
    );
  }

  return record;
}

export async function getBomHierarchy(partId) {
  const root = await getPart(partId);

  async function loadChildren(parentPartId, ancestors, depth) {
    if (depth >= 20) return [];
    const components = await repository.getBomComponents(parentPartId);
    const children = [];
    for (const component of components) {
      const componentPartId = component.componentType === "PART"
        ? Number(component.componentId)
        : 0;
      const nextAncestors = new Set(ancestors);
      let nestedChildren = [];
      if (componentPartId && !nextAncestors.has(componentPartId)) {
        nextAncestors.add(componentPartId);
        nestedChildren = await loadChildren(componentPartId, nextAncestors, depth + 1);
      }
      children.push({ ...component, children: nestedChildren });
    }
    return children;
  }

  return {
    componentType: "PART",
    componentId: Number(root.part_id),
    componentCode: root.part_number,
    componentDescription: root.part_name,
    uomCode: root.unit_of_measurement || "-",
    quantity: 1,
    children: await loadChildren(Number(root.part_id), new Set([Number(root.part_id)]), 0),
  };
}

export async function createPart(
  data,
  user
) {
  const userCode = user.userCode;
  validatePart(data);
  const bomComponents = normalizeBomComponents(data);

  return withTransaction(
    async (connection) => {
      const customer =
        await customerRepository.getCustomerById(
          Number(data.customerId),
          connection
        );

      if (
        !customer ||
        customer.active_flag !== "Y"
      ) {
        throw new AppError(
          "Select an active customer."
        );
      }

      await validateMaterialSelection(connection, data);
      const processPlans = await normalizeProcessPlans(connection, data);

      const partNumber =
        clean(data.partNumber) ||
        await getNextDocumentNumber(
          connection,
          "PART"
        );

      const partId =
        await repository.insertPart(
          connection,
          buildPartValues(
            data,
            partNumber,
            userCode
          )
        );

      const validBomComponents = await validateBomComponents(
        connection, partId, bomComponents
      );
      await repository.replaceBomComponents(
        connection, partId, validBomComponents, userCode
      );
      await repository.replaceProcessPlans(connection, partId, processPlans, userCode);

      return repository.getPartById(
        partId,
        connection
      );
    }
  );
}

export async function updatePart(
  partId,
  data,
  user
) {
  const userCode = user.userCode;
  validatePart(data);
  const bomComponents = normalizeBomComponents(data);

  return withTransaction(async (connection) => {
    const existing = await repository.getPartById(partId, connection);
    if (!existing) throw new AppError("Part not found.", 404);
    await validateMaterialSelection(connection, data);
    const processPlans = await normalizeProcessPlans(connection, data);
    const partNumber = clean(data.partNumber) || existing.part_number;
    await repository.updatePart(partId, buildPartValues(data, partNumber, userCode), connection);
    const validBomComponents = await validateBomComponents(
      connection, partId, bomComponents
    );
    await repository.replaceBomComponents(
      connection, Number(partId), validBomComponents, userCode
    );
    await repository.replaceProcessPlans(connection, Number(partId), processPlans, userCode);
    return repository.getPartById(partId, connection);
  });
}

export async function changePartStatus(
  partId,
  data,
  userCode
) {
  await getPart(partId);

  if (
    !["ACTIVE", "INACTIVE"].includes(
      data.partStatus
    )
  ) {
    throw new AppError(
      "Invalid part status."
    );
  }

  await repository.updatePartStatus(
    partId,
    [
      data.partStatus,
      data.partStatus === "ACTIVE"
        ? "Y"
        : "N",
      clean(data.deactivationRemarks),
      userCode,
    ]
  );

  return getPart(partId);
}
