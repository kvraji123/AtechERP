import { db } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { isValidDateOnly, todayInAppTimeZone } from "../../utils/dateTime.js";
import * as enquiryRepository from "../enquiry/enquiry.repository.js";
import { findMarketingDatabaseByEnquiryPartId } from "../marketing/marketing-database.js";
import * as repository from "./workout.repository.js";

const number = (value) => Number(value ?? 0);
const money = (value) => Number(number(value).toFixed(2));
const rate = (value) => Number(number(value).toFixed(4));
const hasPermission = (user, permission) => user?.permissions?.includes(permission);
const MACHINE_RATE_PROCESS_TYPES = new Set(["VMC", "HMC", "TURNING"]);

function ensureNotFutureDate(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return;
  const date = String(value).trim();
  if (!isValidDateOnly(date)) throw new AppError(`${label} must be a valid date.`);
  if (date > todayInAppTimeZone()) throw new AppError(`${label} cannot be a future date.`);
}

function hasEnteredNumber(value) {
  return String(value ?? "").trim() !== "";
}

function usesMachineRateCalculation(processType) {
  return MACHINE_RATE_PROCESS_TYPES.has(String(processType || "").trim().toUpperCase());
}

function subpartUsesMachineRateCalculation(processType, description) {
  return usesMachineRateCalculation(processType) || usesMachineRateCalculation(description);
}

function configuredMachineCost(machineCostByProcess, processType, description) {
  const keys = [processType, description]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
  for (const key of keys) {
    if (machineCostByProcess.has(key)) return machineCostByProcess.get(key);
  }
  return null;
}

function ensureNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new AppError(`${label} must be zero or positive.`);
}

function normalizeProcessCosts(lines, machineCostByProcess) {
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, 50).map((line) => {
    const processType = String(line?.processType || "").trim().toUpperCase().slice(0, 50);
    const description = String(line?.description || "").trim().slice(0, 300);
    if (!processType) throw new AppError("Every machining line requires a process type.");
    if (processType === "OTHER" && !description) throw new AppError("Other machining process requires a description.");
    const calculatedByMachineRate = usesMachineRateCalculation(processType);
    const hasCycleTime = calculatedByMachineRate && hasEnteredNumber(line?.totalCycleTimeSeconds);
    const totalCycleTimeSeconds = hasCycleTime ? number(line.totalCycleTimeSeconds) : null;
    const machineCostInr = calculatedByMachineRate
      ? (hasEnteredNumber(line?.machineCostInr)
        ? number(line.machineCostInr)
        : configuredMachineCost(machineCostByProcess, processType, description))
      : null;
    const costInr = calculatedByMachineRate && hasCycleTime
      ? (machineCostInr === null ? 0 : totalCycleTimeSeconds * machineCostInr / 3600)
      : number(line?.costInr);
    if (totalCycleTimeSeconds !== null) ensureNonNegative(totalCycleTimeSeconds, "Total cycle time");
    if (machineCostInr !== null) ensureNonNegative(machineCostInr, "Machine cost");
    ensureNonNegative(costInr, "Machining process cost");
    return {
      processType,
      description: description || null,
      totalCycleTimeSeconds: totalCycleTimeSeconds === null ? null : rate(totalCycleTimeSeconds),
      machineCostInr: machineCostInr === null ? null : money(machineCostInr),
      costInr: money(costInr),
    };
  });
}

function normalizeSubparts(lines, availableProcessTypes, availableMaterialTypes, machineCostByProcess) {
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, 100).map((line, index) => {
    const materialType = String(line?.materialType || "").trim().toUpperCase();
    const isPurchase = materialType === "PURCHASE";
    const materialPricePerKg = number(line?.materialPricePerKg);
    const rmWeightKg = number(line?.rmWeightKg);
    const development = {
      patternCostInr: isPurchase ? 0 : number(line?.patternCostInr),
      fixtureCostInr: isPurchase ? 0 : number(line?.fixtureCostInr),
      specialToolCostInr: isPurchase ? 0 : number(line?.specialToolCostInr),
      gaugeCostInr: isPurchase ? 0 : number(line?.gaugeCostInr),
      trialCostInr: isPurchase ? 0 : number(line?.trialCostInr),
    };
    ensureNonNegative(materialPricePerKg, `Sub-part ${index + 1} material price`);
    ensureNonNegative(rmWeightKg, `Sub-part ${index + 1} RM weight`);
    Object.entries(development).forEach(([key, value]) => {
      ensureNonNegative(value, `Sub-part ${index + 1} ${key}`);
    });

    const seen = new Set();
    const processCosts = (isPurchase ? [] : (Array.isArray(line?.processCosts) ? line.processCosts : []))
      .slice(0, 50)
      .map((process) => {
        const processType = String(process?.processType || "").trim().toUpperCase().slice(0, 50);
        const description = String(process?.description || "").trim().slice(0, 300);
        const calculatedByMachineRate = subpartUsesMachineRateCalculation(processType, description);
        const hasCycleTime = calculatedByMachineRate && hasEnteredNumber(process?.totalCycleTimeSeconds);
        const totalCycleTimeSeconds = hasCycleTime ? number(process.totalCycleTimeSeconds) : null;
        const machineCostInr = calculatedByMachineRate
          ? (hasEnteredNumber(process?.machineCostInr)
            ? number(process.machineCostInr)
            : configuredMachineCost(machineCostByProcess, processType, description))
          : null;
        const costInr = calculatedByMachineRate && hasCycleTime
          ? (machineCostInr === null ? 0 : totalCycleTimeSeconds * machineCostInr / 3600)
          : number(process?.costInr);
        if (!processType) return null;
        const isCustomProcess = processType.startsWith("CUSTOM_");
        const isGenericMachineCost = processType === "MACHINE_PROCESS_COST";
        if (availableProcessTypes.size && !availableProcessTypes.has(processType) && !isCustomProcess && !isGenericMachineCost) {
          throw new AppError(`Sub-part ${index + 1} has an invalid machining process.`);
        }
        if ((isCustomProcess || isGenericMachineCost) && !description) {
          throw new AppError(`Sub-part ${index + 1} requires a name for every added machining process.`);
        }
        if (seen.has(processType)) {
          throw new AppError(`Sub-part ${index + 1} contains the same machining process more than once.`);
        }
        seen.add(processType);
        if (totalCycleTimeSeconds !== null) {
          ensureNonNegative(totalCycleTimeSeconds, `Sub-part ${index + 1} total cycle time`);
        }
        if (machineCostInr !== null) ensureNonNegative(machineCostInr, `Sub-part ${index + 1} machine cost`);
        ensureNonNegative(costInr, `Sub-part ${index + 1} machining process cost`);
        return {
          processType,
          description: description || null,
          totalCycleTimeSeconds: totalCycleTimeSeconds === null ? null : rate(totalCycleTimeSeconds),
          machineCostInr: machineCostInr === null ? null : money(machineCostInr),
          costInr: money(costInr),
        };
      })
      .filter(Boolean);

    // New requests carry the explicit material cost. Older Workout records only
    // carried unit price and RM weight, so retain that calculation as a fallback
    // when the material-cost field is genuinely absent (not deliberately zero).
    const hasExplicitMaterialCost = Object.hasOwn(line || {}, "materialCostInr");
    const enteredMaterialCost = hasExplicitMaterialCost
      ? number(line?.materialCostInr)
      : materialPricePerKg * rmWeightKg;
    ensureNonNegative(enteredMaterialCost, `Sub-part ${index + 1} material cost`);
    const materialCostInr = money(enteredMaterialCost);
    const totalMachiningCostInr = money(processCosts.reduce((sum, process) => sum + process.costInr, 0));
    const totalDevelopmentCostInr = money(Object.values(development).reduce((sum, value) => sum + value, 0));

    return {
      partName: String(line?.partName || "").trim().slice(0, 200) || null,
      partDrawingNumber: String(line?.partDrawingNumber || "").trim().slice(0, 100) || null,
      materialType: availableMaterialTypes.has(materialType) ? materialType : null,
      materialAndGrade: String(line?.materialAndGrade || "").trim().slice(0, 300) || null,
      materialPricePerKg: money(materialPricePerKg),
      rmWeightKg: money(rmWeightKg),
      materialCostInr,
      totalMachiningCostInr,
      ...Object.fromEntries(Object.entries(development).map(([key, value]) => [key, money(value)])),
      totalDevelopmentCostInr,
      processCosts,
    };
  });
}

function calculate(data, availableProcessTypes = new Set(), availableMaterialTypes = new Set(), machineCostByProcess = new Map()) {
  const currencyRate = number(data.currencyRate);
  if (!(currencyRate > 0)) throw new AppError("Exchange rate must be greater than zero.");
  const assembled = Boolean(data.isAssembledPart);

  const values = {
    weightKg: number(data.weightKg),
    materialRate: number(data.materialRatePerKg),
    additionalMaterialCost: number(data.additionalMaterialCostInr),
    actualMaterialCost: number(data.actualMaterialCostInr),
    assemblyLabour: number(data.assemblyLabourCostInr),
    overheadPercent: number(data.overheadPercent),
    profitValue: number(data.profitValue),
    packing: number(data.packingForwardingCostInr),
    commissionPercent: number(data.commissionPercent),
    pattern: number(data.patternCostInr),
    fixture: number(data.fixtureCostInr),
    specialTool: number(data.specialToolCostInr),
    gauge: number(data.gaugeCostInr),
    trial: number(data.trialCostInr),
    sampleCostPercent: number(data.sampleCostPercent),
  };
  Object.entries(values).forEach(([key, value]) => ensureNonNegative(value, key));
  if (values.overheadPercent > 100 || values.commissionPercent > 100 || values.sampleCostPercent > 100) {
    throw new AppError("Overhead, commission and sample-cost percentages must be between 0 and 100.");
  }

  const profitCalculationType = ["FIXED_AMOUNT", "PERCENTAGE"].includes(data.profitCalculationType)
    ? data.profitCalculationType
    : "FIXED_AMOUNT";
  if (profitCalculationType === "PERCENTAGE" && values.profitValue > 100) {
    throw new AppError("Profit percentage must be between 0 and 100.");
  }

  const processCosts = assembled ? [] : normalizeProcessCosts(data.processCosts, machineCostByProcess);
  const subparts = assembled ? normalizeSubparts(data.subparts, availableProcessTypes, availableMaterialTypes, machineCostByProcess) : [];
  const subpartMaterialCost = money(subparts.reduce((sum, line) => sum + line.materialCostInr, 0));
  const subpartMachiningCost = money(subparts.reduce((sum, line) => sum + line.totalMachiningCostInr, 0));
  const subpartDevelopmentCost = money(subparts.reduce((sum, line) => sum + line.totalDevelopmentCostInr, 0));
  const totalMachining = assembled
    ? money(subpartMachiningCost + values.assemblyLabour)
    : money(processCosts.reduce((sum, line) => sum + line.costInr, 0));
  // Leave the rate-and-weight calculation as the default, but honor the
  // explicitly entered Material Cost from the enquiry Workout form.
  const manuallyEnteredMaterialCost = hasEnteredNumber(data.actualMaterialCostInr)
    ? money(values.actualMaterialCost)
    : null;
  const materialCost = assembled
    ? subpartMaterialCost
    : manuallyEnteredMaterialCost ?? money(values.weightKg * values.materialRate + values.additionalMaterialCost);
  const overheadAmount = money(totalMachining * values.overheadPercent / 100);
  const machiningWithOverhead = totalMachining + overheadAmount;
  const profitAmount = money(
    profitCalculationType === "PERCENTAGE"
      ? machiningWithOverhead * values.profitValue / 100
      : values.profitValue
  );
  const adjustedMachining = money(machiningWithOverhead + profitAmount);
  const partPriceBeforeCommission = money(materialCost + adjustedMachining + values.packing);
  const commissionAmount = money(partPriceBeforeCommission * values.commissionPercent / 100);
  const finalPartPrice = money(partPriceBeforeCommission + commissionAmount);
  const sample = money(finalPartPrice * (1 + values.sampleCostPercent / 100));
  const totalDevelopment = assembled
    ? subpartDevelopmentCost
    : money(values.pattern + values.fixture + values.specialTool + values.gauge + values.trial);
  const foreign = (value) => rate(value / currencyRate);
  const legacy = { TURNING: 0, VMC: 0, KEYWAY_SPLINE: 0, HEAT_TREATMENT: 0, SHAPING_GEAR: 0 };
  processCosts.forEach((line) => {
    if (Object.hasOwn(legacy, line.processType)) legacy[line.processType] += line.costInr;
  });

  return {
    currencyRate: rate(currencyRate),
    processCosts,
    subparts,
    assembled,
    subpartMaterialCost,
    subpartMachiningCost,
    subpartDevelopmentCost,
    legacy,
    ...values,
    sample,
    profitCalculationType,
    materialCost,
    materialCostForeign: foreign(materialCost),
    totalMachining,
    overheadAmount,
    profitAmount,
    adjustedMachining,
    adjustedMachiningForeign: foreign(adjustedMachining),
    packingForeign: foreign(values.packing),
    partPriceBeforeCommission,
    partPriceBeforeCommissionForeign: foreign(partPriceBeforeCommission),
    commissionAmount,
    commissionAmountForeign: foreign(commissionAmount),
    finalPartPrice,
    finalPartPriceForeign: foreign(finalPartPrice),
    totalDevelopment,
    totalDevelopmentForeign: foreign(totalDevelopment),
  };
}

function validate(data, totals, submit) {
  if (!submit) return;

  if (!data.workoutDate) throw new AppError("Workout Date is required.");
  ensureNotFutureDate(data.workoutDate, "Workout Date");
  ensureNotFutureDate(data.exchangeRateEffectiveDate, "Rate Effective Date");
  const moq = number(data.moq);
  ensureNonNegative(moq, "MOQ");
  if (!(moq > 0)) throw new AppError("MOQ must be greater than zero.");
  if (totals.assembled) {
    if (!totals.subparts.length) throw new AppError("Add at least one sub-part for this assembled item.");
    totals.subparts.forEach((subpart, index) => {
      if (!subpart.partName) throw new AppError(`Sub-part Name is required for row ${index + 1}.`);
      if (!subpart.partDrawingNumber) throw new AppError(`Part / Drawing Number is required for sub-part row ${index + 1}.`);
      if (!subpart.materialType) throw new AppError(`Material Type is required for sub-part row ${index + 1}.`);
    });
    if (!(totals.materialCost + totals.totalMachining > 0)) {
      throw new AppError("Enter material, machining, or assembly/labour cost for the assembled item.");
    }
    if (!String(data.currencyCode || "").trim()) throw new AppError("Quotation currency is required.");
    return;
  }
  if (!(totals.weightKg > 0)) throw new AppError("Weight in Kg must be greater than zero.");
  if (!(totals.materialRate > 0)) throw new AppError("Material rate per Kg must be greater than zero.");
  if (!totals.processCosts.length || !(totals.totalMachining > 0)) {
    throw new AppError("Enter at least one machining process cost greater than zero.");
  }
  if (!String(data.currencyCode || "").trim()) throw new AppError("Quotation currency is required.");
}

function masters(rows) {
  return {
    currencies: rows.filter((row) => row.referenceType === "CURRENCY").map((row) => ({
      value: row.valueCode,
      label: row.displayLabel,
      exchangeRate: Number(row.numericValue || 0),
      effectiveDate: row.effectiveDate,
    })),
    machiningProcesses: rows.filter((row) => row.referenceType === "MACHINING_PROCESS").map((row) => ({
      value: row.valueCode,
      label: row.displayLabel,
      machineCostInr: row.numericValue === null || row.numericValue === undefined ? null : number(row.numericValue),
    })),
    subpartMaterialTypes: rows.filter((row) => row.referenceType === "SUBPART_MATERIAL_TYPE").map((row) => ({
      value: row.valueCode,
      label: row.displayLabel,
    })),
  };
}

function workflow(part, workout, user) {
  const completed = workout?.save_status === "COMPLETED";
  const quotationAvailable = ["QUOTATION", "COMPLETED"].includes(part.current_stage);
  const allowedActions = ["CANCEL"];
  if (!completed) {
    allowedActions.push("SAVE_DRAFT");
    if (hasPermission(user, "COMPLETE_WORKOUT")) allowedActions.push("COMPLETE_WORKOUT");
  } else if (hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")) {
    allowedActions.push("UPDATE_WORKOUT");
  }
  return {
    currentStage: part.current_stage,
    allowedStages: quotationAvailable ? ["Enquiry", "Feasibility", "Workout", "Quotation"] : ["Enquiry", "Feasibility", "Workout"],
    completedStages: completed ? ["Enquiry", "Feasibility", "Workout"] : ["Enquiry", "Feasibility"],
    allowedActions,
  };
}

function assertEligible(part) {
  if (!part) throw new AppError("Enquiry item not found.", 404);
  if (part.feasibility_decision !== "FEASIBLE" || !["CLOSED", "SUBMITTED"].includes(part.feasibility_save_status)) {
    throw new AppError("Workout is available only after this item is closed as FEASIBLE.", 409);
  }
}

export async function getWorkout(enquiryPartId, user) {
  const marketingDatabase = await findMarketingDatabaseByEnquiryPartId(enquiryPartId);
  const part = await repository.getPart(enquiryPartId, marketingDatabase.pool);
  assertEligible(part);
  const [workout, items, references, processPlans] = await Promise.all([
    repository.getWorkout(enquiryPartId, marketingDatabase.pool),
    repository.getEnquiryParts(part.enquiry_id, marketingDatabase.pool),
    repository.getReferenceValues(db),
    repository.getPartProcessPlans(part.part_id, db),
  ]);
  return { part, items, workout, processPlans, masters: masters(references), workflow: workflow(part, workout, user) };
}

export async function saveWorkout(enquiryPartId, data, user, submit = false) {
  if (submit && !hasPermission(user, "COMPLETE_WORKOUT")) {
    throw new AppError("You do not have permission to complete Workout.", 403);
  }
  const marketingDatabase = await findMarketingDatabaseByEnquiryPartId(enquiryPartId);
  return marketingDatabase.withTransaction(async (connection) => {
    const part = await repository.getPart(enquiryPartId, connection);
    assertEligible(part);
    const existing = await repository.getWorkout(enquiryPartId, connection);
    const updatingCompleted = existing?.save_status === "COMPLETED";
    if (updatingCompleted && !hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")) {
      throw new AppError("Completed Workout cannot be edited.", 409);
    }
    if (updatingCompleted && submit) {
      throw new AppError("Completed Workout can only be updated, not completed again.", 409);
    }

    const references = await repository.getReferenceValues(db);
    const availableCurrencies = masters(references).currencies;
    const selectedCurrency = availableCurrencies.find((item) => item.value === data.currencyCode);
    if (!selectedCurrency && (submit || updatingCompleted)) {
      throw new AppError("Select a configured quotation currency.");
    }
    const draftCurrency = selectedCurrency || {
      value: String(data.currencyCode || "").trim() || "INR",
      exchangeRate: 1,
      effectiveDate: null,
    };
    const requestedRate = number(data.currencyRate);
    const prepared = {
      ...data,
      isAssembledPart: Boolean(Number(part.is_assembled_part)),
      // Payment terms are owned by the approved Feasibility record, not edited in Workout.
      paymentTerms: part.feasibility_payment_terms || null,
      workoutDate: data.workoutDate || todayInAppTimeZone(),
      currencyCode: draftCurrency.value,
      currencyRate: requestedRate > 0 ? requestedRate : Number(draftCurrency.exchangeRate) || 1,
      exchangeRateEffectiveDate: data.exchangeRateEffectiveDate || draftCurrency.effectiveDate,
    };
    const configuredMasters = masters(references);
    const availableProcessTypes = new Set(configuredMasters.machiningProcesses.map((item) => item.value));
    const availableMaterialTypes = new Set(
      configuredMasters.subpartMaterialTypes.map((item) => item.value)
    );
    const machineCostByProcess = new Map();
    configuredMasters.machiningProcesses.forEach((item) => {
      if (item.machineCostInr === null) return;
      machineCostByProcess.set(String(item.value).toUpperCase(), item.machineCostInr);
      machineCostByProcess.set(String(item.label).toUpperCase(), item.machineCostInr);
    });
    const totals = calculate(prepared, availableProcessTypes, availableMaterialTypes, machineCostByProcess);
    validate(prepared, totals, submit);

    const workoutNo = existing?.workout_no || `${part.doc_no}/${String(part.line_number).padStart(2, "0")}`;
    const saveStatus = updatingCompleted
      ? "COMPLETED"
      : submit
        ? "COMPLETED"
        : "DRAFT";
    await repository.upsertWorkout(connection, part, workoutNo, prepared, totals, user.userCode, saveStatus, db);
    await repository.replaceProcessCosts(connection, enquiryPartId, totals.processCosts, user.userCode);
    await repository.replaceSubparts(connection, enquiryPartId, totals.subparts, user.userCode);
    await repository.replaceNotes(connection, enquiryPartId, Array.isArray(data.notes) ? data.notes : [], user.userCode);
    if (updatingCompleted) {
      await repository.refreshQuotationItemsForWorkout(
        connection,
        enquiryPartId,
        user.userCode
      );
    }
    if (submit) await repository.completeWorkout(connection, part, user);
    const savedWorkout = await repository.getWorkout(enquiryPartId, connection);
    await enquiryRepository.appendEnquiryRevision(connection, {
      enquiryId: part.enquiry_id,
      revisionAction: submit ? "WORKOUT_COMPLETED" : "WORKOUT_SAVED",
      saveStatus: part.enquiry_save_status,
      snapshot: {
        stage: "WORKOUT",
        enquiryPartId: Number(enquiryPartId),
        part: {
          partNumber: part.part_number,
          drawingNumber: part.drawing_number,
          drawingRevisionNumber: part.drawing_revision_number,
        },
        workout: savedWorkout,
      },
      userCode: user.userCode,
    });
    return savedWorkout;
  });
}
