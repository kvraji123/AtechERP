import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

import { db, withTransaction } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
import {
  ensureDocumentSequence,
  getNextDocumentNumber,
  getNextRunningSerial,
} from "../../utils/sequence.js";

import * as attachmentRepository from "../attachment/attachment.repository.js";
import * as customerRepository from "../customer/customer.repository.js";
import * as repository from "./part.repository.js";
import { calculateProcessCostInr } from "./part-process-cost.js";
import { signOnlyOfficeToken, verifyOnlyOfficeToken } from "../../utils/onlyOfficeToken.js";
import { validateCharacteristicSampling } from "../in-process-inspection/inspection-frequency.js";

const toolListTemplatePath = fileURLToPath(new URL("../../assets/tool-list-template.xlsx", import.meta.url));
const toolListMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

const toolListField = (value, label, maximumLength = 500) => {
  const text = clean(value);
  if (text && text.length > maximumLength) throw new AppError(`${label} cannot exceed ${maximumLength} characters.`);
  return text;
};

function normalizeToolList(input, processRowNumber) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const rows = Array.isArray(input.toolRows) ? input.toolRows : [];
  const costRows = Array.isArray(input.costRows) ? input.costRows : [];
  if (rows.length > 100 || costRows.length > 100) {
    throw new AppError(`Tool List in process row ${processRowNumber} can contain at most 100 rows per section.`);
  }
  const date = (value, label) => {
    const text = toolListField(value, label, 10);
    if (text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new AppError(`${label} must be a valid date.`);
    return text;
  };
  return {
    documentDate: date(input.documentDate, "Tool List date"),
    fixtureNumber: toolListField(input.fixtureNumber, "Fixture Number", 100),
    material: toolListField(input.material, "Tool List material", 500),
    preparedBy: toolListField(input.preparedBy, "Prepared By", 150),
    checkedBy: toolListField(input.checkedBy, "Checked By", 150),
    approvedBy: toolListField(input.approvedBy, "Approved By", 150),
    lastRevisionDate: date(input.lastRevisionDate, "Last Revision Date"),
    signature: toolListField(input.signature, "Signature", 255),
    remarks: toolListField(input.remarks, "Tool List remarks", 2000),
    toolRows: rows.map((entry, toolIndex) => ({
      toolDiameter: toolListField(entry?.toolDiameter, `Tool List row ${toolIndex + 1} diameter`, 100),
      toolName: toolListField(entry?.toolName, `Tool List row ${toolIndex + 1} name`, 255),
      rpm: toolListField(entry?.rpm, `Tool List row ${toolIndex + 1} RPM`, 100),
      feed: toolListField(entry?.feed, `Tool List row ${toolIndex + 1} feed`, 100),
      holderName: toolListField(entry?.holderName, `Tool List row ${toolIndex + 1} holder`, 255),
      holderLength: toolListField(entry?.holderLength, `Tool List row ${toolIndex + 1} holder length`, 100),
      colletSize: toolListField(entry?.colletSize, `Tool List row ${toolIndex + 1} collet size`, 100),
      toolInsertSpecification: toolListField(entry?.toolInsertSpecification, `Tool List row ${toolIndex + 1} tool or insert specification`, 500),
      toolMake: toolListField(entry?.toolMake, `Tool List row ${toolIndex + 1} make`, 150),
      toolNumber: toolListField(entry?.toolNumber, `Tool List row ${toolIndex + 1} tool number`, 100),
      toolClampingDetail: toolListField(entry?.toolClampingDetail, `Tool List row ${toolIndex + 1} clamping detail`, 500),
      heightOffset: toolListField(entry?.heightOffset, `Tool List row ${toolIndex + 1} height offset`, 100),
      toolFluteLength: toolListField(entry?.toolFluteLength, `Tool List row ${toolIndex + 1} flute length`, 100),
      toolOverhangDetails: toolListField(entry?.toolOverhangDetails, `Tool List row ${toolIndex + 1} overhang detail`, 500),
      toolLife: toolListField(entry?.toolLife, `Tool List row ${toolIndex + 1} life`, 100),
    })),
    costRows: costRows.map((entry, costIndex) => ({
      toolDiameter: toolListField(entry?.toolDiameter, `Tool Cost row ${costIndex + 1} diameter`, 100),
      toolName: toolListField(entry?.toolName, `Tool Cost row ${costIndex + 1} name`, 255),
      insertSpecification: toolListField(entry?.insertSpecification, `Tool Cost row ${costIndex + 1} insert specification`, 500),
      insertOrToolRate: toolListField(entry?.insertOrToolRate, `Tool Cost row ${costIndex + 1} rate`, 100),
      numberOfEdges: toolListField(entry?.numberOfEdges, `Tool Cost row ${costIndex + 1} number of edges`, 100),
      numberOfPockets: toolListField(entry?.numberOfPockets, `Tool Cost row ${costIndex + 1} number of pockets`, 100),
      toolLifePerEdge: toolListField(entry?.toolLifePerEdge, `Tool Cost row ${costIndex + 1} life per edge`, 100),
      lifeOfOverallEdge: toolListField(entry?.lifeOfOverallEdge, `Tool Cost row ${costIndex + 1} overall edge life`, 100),
    })),
  };
}

function hasToolListContent(toolList) {
  if (!toolList) return false;
  const headerFields = [
    toolList.documentDate, toolList.fixtureNumber, toolList.material, toolList.preparedBy, toolList.checkedBy,
    toolList.approvedBy, toolList.lastRevisionDate, toolList.signature, toolList.remarks,
  ];
  return headerFields.some((value) => clean(value))
    || toolList.toolRows.some((row) => Object.values(row).some((value) => clean(value)))
    || toolList.costRows.some((row) => Object.values(row).some((value) => clean(value)));
}

function normalizeProgram(input, legacyProgramNumber, processRowNumber) {
  const legacyNumber = toolListField(legacyProgramNumber, "Program Number", 255);
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const programNumber = toolListField(input.programNumber || legacyNumber, "Program Number", 255);
  const programText = toolListField(input.programText, "Program text", 50000);
  const rawRevision = Number(input.revisionNumber || 0);
  const history = Array.isArray(input.revisionHistory) ? input.revisionHistory : [];

  // A legacy process can have only a Program Number. It is not a saved Program
  // document until the operator enters program text through the Program modal.
  if (!programText && rawRevision === 0 && history.length === 0) return null;
  if (!programNumber || !programText) {
    throw new AppError(`Program Number and Program text are required in process row ${processRowNumber}.`);
  }
  if (!Number.isSafeInteger(rawRevision) || rawRevision < 1) {
    throw new AppError(`Program revision must be a positive whole number in process row ${processRowNumber}.`);
  }
  if (history.length > 200) {
    throw new AppError(`Program revision history in process row ${processRowNumber} can contain at most 200 entries.`);
  }

  const revisionHistory = history.map((entry, historyIndex) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AppError(`Program revision history entry ${historyIndex + 1} is invalid in process row ${processRowNumber}.`);
    }
    const revisionNumber = Number(entry.revisionNumber || 0);
    const changedBy = toolListField(entry.changedBy, "Program revision person", 150);
    const changedOn = toolListField(entry.changedOn, "Program revision date", 40);
    if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1 || !changedBy || !changedOn
      || Number.isNaN(Date.parse(changedOn))) {
      throw new AppError(`Program revision history entry ${historyIndex + 1} is invalid in process row ${processRowNumber}.`);
    }
    return { revisionNumber, changedBy, changedOn };
  });
  if (!revisionHistory.some((entry) => entry.revisionNumber === rawRevision)) {
    throw new AppError(`Program revision history must include revision ${rawRevision} in process row ${processRowNumber}.`);
  }

  return { programNumber, programText, revisionNumber: rawRevision, revisionHistory };
}

function normalizeDocumentApprovals(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    program: source.program === true,
    toolList: source.toolList === true,
    workInstructions: source.workInstructions === true,
  };
}

function displayValue(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function durationInSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? `${seconds} SEC` : "-";
}

function fileNameSegment(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return normalized || fallback;
}

function setToolListTextCell(sheet, address, value) {
  sheet[address] = { ...(sheet[address] || {}), t: "s", v: displayValue(value), z: "@" };
}

function populateToolListTemplate(workbook, context) {
  const sheet = workbook.Sheets["TOOL LIST"];
  if (!sheet) throw new AppError("The Tool List template does not contain the TOOL LIST worksheet.", 500);

  sheet.T1 = {
    ...(sheet.T1 || {}),
    t: "d",
    v: new Date(`${todayInAppTimeZone()}T00:00:00.000Z`),
    z: sheet.T1?.z || "dd/mm/yyyy",
  };
  setToolListTextCell(sheet, "B2", context.drawingNumber || context.partNumber);
  setToolListTextCell(sheet, "E2", context.drawingCode);
  setToolListTextCell(sheet, "I2", context.programNumber);
  setToolListTextCell(sheet, "M2", context.machineTypeCode);
  setToolListTextCell(sheet, "P2", context.customerName);
  setToolListTextCell(sheet, "T2", durationInSeconds(context.cycleTimeSeconds));
  setToolListTextCell(sheet, "B3", context.partName);
  setToolListTextCell(sheet, "E3", context.operationNumber);
  setToolListTextCell(sheet, "I3", "-");
  setToolListTextCell(sheet, "M3", context.material || context.materialSpecification);
  sheet.P3 = { ...(sheet.P3 || {}), t: "n", f: "COUNTA(B6:B28)", v: 0 };
  setToolListTextCell(sheet, "T3", durationInSeconds(context.clampingTimeSeconds));
  workbook.Workbook ||= {};
  workbook.Workbook.CalcPr = {
    ...(workbook.Workbook.CalcPr || {}),
    calcMode: "auto",
    fullCalcOnLoad: true,
    forceFullCalc: true,
  };
}

function validatePart(data, { draft = false } = {}) {
  if (draft) return;

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

const matchesToleranceStandardBand = (dimension, band) => {
  const minimum = numberOrNull(band?.nominalFrom);
  const maximum = numberOrNull(band?.nominalTo);
  const aboveMinimum = minimum === null || (band.minimumInclusive === "Y"
    ? dimension >= minimum : dimension > minimum);
  const belowMaximum = maximum === null || (band.maximumInclusive === "Y"
    ? dimension <= maximum : dimension < maximum);
  return aboveMinimum && belowMaximum;
};

async function normalizeSingleProcessPlan(connection, data, input, planIndex) {
  const masters = await repository.getProcessMasters(connection);
  const operationMap = new Map(masters.operations.map((row) => [Number(row.operationMasterId), row]));
  const sourceMap = new Map(masters.sources.map((row) => [String(row.sourceCode).toUpperCase(), row]));
  const machineTypeMap = new Map(masters.machineTypes.map((row) => [Number(row.machineTypeId), row]));
  const characteristicIds = new Set(masters.characteristics.map((row) => Number(row.characteristicMasterId)));
  const instrumentById = new Map(masters.instruments.map((row) => [Number(row.instrumentMasterId), row]));
  const toleranceMap = new Map(masters.toleranceGrades.map((row) => [Number(row.toleranceGradeId), row]));
  const toleranceStandardMap = new Map(masters.toleranceStandards.map((row) => [Number(row.toleranceStandardId), row]));
  const sampleSizeCodes = new Set(masters.sampleSizes.map((row) => String(row.value).trim().toUpperCase()));
  const inspectionFrequencyCodes = new Set(masters.frequencies.map((row) => String(row.value).trim().toUpperCase()));
  const planStatus = String(input.planStatus || "DRAFT").toUpperCase();
  if (!["DRAFT", "APPROVED"].includes(planStatus)) throw new AppError("Invalid Process Plan status.");
  const inputOperations = Array.isArray(input.operations) ? [...input.operations]
    .sort((left,right) => Number(left.operationNumber || 0)-Number(right.operationNumber || 0)) : [];
  const operations = inputOperations.map((row, index) => {
    const operationNumber = Number(row.operationNumber || ((index + 1) * 10));
    if (!Number.isSafeInteger(operationNumber) || operationNumber < 10 || operationNumber % 10 !== 0) {
      throw new AppError(`Operation Number must be a positive multiple of 10 in process row ${index + 1}.`);
    }
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
      const cmmRequired = selected(row.inspectionPlan.cmmRequired);
      const measurementUnit = String(row.inspectionPlan.measurementUnit || "MM").toUpperCase();
      if (!['MM', 'INCH'].includes(measurementUnit)) {
        throw new AppError(`Select MM or Inch for process row ${index + 1} inspection plan.`);
      }
      const planToleranceStandardId = numberOrNull(row.inspectionPlan.toleranceStandardId);
      const planToleranceStandard = toleranceStandardMap.get(planToleranceStandardId);
      if (planToleranceStandardId && !planToleranceStandard) {
        throw new AppError("Select a valid active Tolerance Standard.");
      }
      if (planToleranceStandardId && measurementUnit !== "MM") {
        throw new AppError("Tolerance Standards from the master can be used only for millimetre inspection plans.");
      }
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
          const requestedToleranceMode = String(entry.toleranceMode || "").toUpperCase();
          let toleranceMinus = numberOrNull(entry.toleranceMinus);
          let tolerancePlus = numberOrNull(entry.tolerancePlus);
          const useToleranceStandard = Boolean(planToleranceStandardId && !requestedToleranceGradeId && !gradeText
            && (requestedToleranceMode === "STANDARD" || (toleranceMinus === null && tolerancePlus === null)));
          const standardBand = useToleranceStandard && specifiedDimension !== null
            ? masters.toleranceStandardBands.find((band) => Number(band.toleranceStandardId) === planToleranceStandardId
              && band.characteristicType === "LINEAR_DIMENSIONS"
              && matchesToleranceStandardBand(specifiedDimension, band))
            : null;
          const gradeFromText = measurementUnit === "INCH" || specifiedDimension === null || !gradeText ? null
            : masters.toleranceGrades.find((grade) => String(grade.gradeCode).trim().toUpperCase() === gradeText
              && (Number(grade.basicSizeFrom) === 0
                ? specifiedDimension >= 0
                : specifiedDimension > Number(grade.basicSizeFrom))
              && specifiedDimension <= Number(grade.basicSizeTo));
          const gradeFromId = toleranceMap.get(requestedToleranceGradeId);
          const idGradeInRange = measurementUnit === "MM" && gradeFromId && specifiedDimension !== null
            && (Number(gradeFromId.basicSizeFrom) === 0
              ? specifiedDimension >= 0
              : specifiedDimension > Number(gradeFromId.basicSizeFrom))
            && specifiedDimension <= Number(gradeFromId.basicSizeTo) ? gradeFromId : null;
          const grade = measurementUnit === "MM" ? gradeFromText || idGradeInRange || null : null;
          const toleranceMode = useToleranceStandard ? "STANDARD" : grade ? "GRADE" : "MANUAL";
          let toleranceGradeId = grade ? Number(grade.toleranceGradeId) : null;
          const toleranceGradeText = !useToleranceStandard && measurementUnit === "MM"
            ? requestedToleranceGradeText || (grade ? String(grade.gradeCode) : null)
            : null;
          let lsl = null; let usl = null;
          if (useToleranceStandard) {
            toleranceGradeId = null;
            if (standardBand?.toleranceMinusMm !== null && standardBand?.toleranceMinusMm !== undefined
              && standardBand?.tolerancePlusMm !== null && standardBand?.tolerancePlusMm !== undefined
              && specifiedDimension !== null) {
              toleranceMinus = Math.abs(Number(standardBand.toleranceMinusMm));
              tolerancePlus = Number(standardBand.tolerancePlusMm);
              lsl = Number((specifiedDimension - toleranceMinus).toFixed(4));
              usl = Number((specifiedDimension + tolerancePlus).toFixed(4));
            } else {
              toleranceMinus = null;
              tolerancePlus = null;
              if (planStatus === "APPROVED") {
                throw new AppError(`No numeric linear-dimension tolerance band is available for inspection row ${characteristicIndex + 1}.`);
              }
            }
          } else if (grade) {
            if (specifiedDimension !== null) {
              toleranceMinus = Math.abs(Number(grade.lowerDeviationMicrons || 0)) / 1000;
              tolerancePlus = Number(grade.upperDeviationMicrons || 0) / 1000;
              lsl = Number((specifiedDimension + (Number(grade.lowerDeviationMicrons || 0) / 1000)).toFixed(4));
              usl = Number((specifiedDimension + tolerancePlus).toFixed(4));
            }
          } else {
            toleranceGradeId = null;
            if (planStatus === "APPROVED" && (specifiedDimension === null || toleranceMinus === null || tolerancePlus === null
              || toleranceMinus < 0 || tolerancePlus < 0)) {
              const values = measurementUnit === "INCH"
                ? "Dimension, Tol- and Tol+ in inches"
                : "Dimension, Tol- and Tol+, or select a matching Tolerance Standard";
              throw new AppError(`Enter ${values} for inspection row ${characteristicIndex + 1}.`);
            }
            if (specifiedDimension !== null && toleranceMinus !== null && tolerancePlus !== null) {
              lsl = Number((specifiedDimension - toleranceMinus).toFixed(4));
              usl = Number((specifiedDimension + tolerancePlus).toFixed(4));
            }
          }
          const instrumentMasterId = numberOrNull(entry.instrumentMasterId);
          const instrument = instrumentById.get(instrumentMasterId);
          if (instrumentMasterId && !instrument) throw new AppError("Select a valid Inspection Instrument.");
          const sampleSize = clean(entry.sampleSize);
          const inspectionFrequency = clean(entry.inspectionFrequency);
          if (planStatus === "APPROVED" && (!sampleSize || !inspectionFrequency)) {
            throw new AppError(`Select Sample Size and Inspection Frequency in inspection row ${characteristicIndex + 1}.`);
          }
          if (sampleSize || inspectionFrequency) {
            if (!sampleSize || !inspectionFrequency) {
              throw new AppError(`Sample Size and Inspection Frequency must both be selected in inspection row ${characteristicIndex + 1}.`);
            }
            if (!sampleSizeCodes.has(sampleSize.toUpperCase()) || !inspectionFrequencyCodes.has(inspectionFrequency.toUpperCase())) {
              throw new AppError(`Use active Sample Size and Inspection Frequency master values in inspection row ${characteristicIndex + 1}.`);
            }
            // Shift/day/lot controls remain valid for legacy patrol plans. The
            // in-process piece counter validates count-based plans again when
            // a production run starts, where 100% and numeric intervals have
            // the stricter per-piece sample-size rules.
            if (/^(100_PERCENT|100%|\d+)$/i.test(inspectionFrequency)) {
              validateCharacteristicSampling({ sampleSize, inspectionFrequency });
            }
          }
          return {
            sequenceNumber: characteristicIndex + 1, balloonNumber: clean(entry.balloonNumber),
            characteristicMasterId, characteristicText, specifiedDimension, toleranceMode, toleranceGradeId, toleranceGradeText,
            toleranceStandardId: useToleranceStandard ? planToleranceStandardId : null,
            toleranceMinus, tolerancePlus, lsl, usl, drawingGrid: clean(entry.drawingGrid),
            instrumentMasterId, sampleSize,
            inspectionFrequency,
            scCcIdentification: Boolean(entry.scCcIdentification),
            patrolInspectionQaRequired: Boolean(entry.patrolInspectionQaRequired),
            patrolQaResult: null,
            periodicOperatorRequired: Boolean(entry.periodicOperatorRequired),
            finalInspectionRequired: Boolean(entry.finalInspectionRequired),
          };
        }) : [];
      const approvalStatus = String(row.inspectionPlan.approvalStatus || "DRAFT").toUpperCase() === "APPROVED"
        ? "APPROVED"
        : "DRAFT";
      inspectionPlan = { cmmRequired, measurementUnit, toleranceStandardId: planToleranceStandardId,
        planStatus: characteristics.length ? "READY" : "DRAFT", approvalStatus, characteristics };
    }
    const toolList = normalizeToolList(row.toolList, index + 1);
    const program = normalizeProgram(row.program, row.programNumber, index + 1);
    const programNumber = program?.programNumber || toolListField(row.programNumber, "Program Number", 255);
    const documentApprovals = normalizeDocumentApprovals(row.documentApprovals);
    const workInstructionCount = Number(row.workInstructionCount || 0);
    if (!Number.isSafeInteger(workInstructionCount) || workInstructionCount < 0) {
      throw new AppError(`Work Instruction count is invalid in process row ${index + 1}.`);
    }
    return { processDefinitionId:Number(row.processDefinitionId || 0) || null,
      operationNumber,operationMasterId,operationDescription:clean(row.operationDescription),toolList,program,programNumber,documentApprovals,
      workInstructionCount,
      sourceType,machineTypeId,cycleTimeSeconds,clampingTimeSeconds,settingTimeHours,outsourceCostInr,
      processCostInr,inspectionPlan };
  });
  if (new Set(operations.map((row) => row.operationNumber)).size !== operations.length) {
    throw new AppError("Operation numbers must be unique.");
  }
  operations.sort((left,right) => left.operationNumber-right.operationNumber);
  if (planStatus === "APPROVED") {
    if (!operations.length) throw new AppError("Add at least one process before approval.");
    const incomplete = [];
    for (const row of operations) {
      const missing = [];
      if (!row.program?.revisionNumber || !row.program.programNumber || !row.program.programText) {
        missing.push("Program Number / Program");
      } else if (!row.documentApprovals.program) missing.push("Program approval");
      if (!hasToolListContent(row.toolList)) missing.push("Tool List");
      else if (!row.documentApprovals.toolList) missing.push("Tool List approval");
      const savedWorkInstructionCount = row.processDefinitionId
        ? await repository.countProcessDefinitionWorkInstructions(row.processDefinitionId, connection)
        : 0;
      if (!row.workInstructionCount && !savedWorkInstructionCount) missing.push("Work Instructions");
      else if (!row.documentApprovals.workInstructions) missing.push("Work Instructions approval");
      if (!row.inspectionPlan || !row.inspectionPlan.characteristics.length || row.inspectionPlan.planStatus !== "READY") {
        missing.push("Inspection Plan");
      } else if (row.inspectionPlan.approvalStatus !== "APPROVED") missing.push("Inspection Plan approval");
      if (missing.length) incomplete.push(`Operation ${row.operationNumber}: ${missing.join(", ")}`);
    }
    if (incomplete.length) {
      throw new AppError(`Cannot approve the Process Plan. ${incomplete.join(". ")}. Complete the listed item(s) and try again.`);
    }
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
  // Material fields are no longer editable in Part Master. Older records may
  // contain only one legacy reference, so do not block an otherwise valid edit.
  // When both values are supplied, still validate them against active masters.
  if (!Number(data.materialId) || !Number(data.uomId)) return;
  const result = await repository.validateMaterialSelection(
    connection, Number(data.materialId),
    data.materialGradeId ? Number(data.materialGradeId) : null,
    Number(data.uomId)
  );
  if (!result?.materialOk || !result?.uomOk || !result?.gradeOk) {
    throw new AppError("Select a valid active Material, Grade and Unit of Measurement.");
  }
}

async function resolveDrawingCode(
  connection,
  data,
  { existingDrawingCode = null, excludePartId = null } = {}
) {
  const drawingCodeMode = String(data.drawingCodeMode || "AUTO_GENERATED").toUpperCase();
  const requestedCode = clean(data.drawingCode);

  if (drawingCodeMode === "MANUAL") {
    if (!requestedCode) throw new AppError("Drawing code is required.");
    const duplicate = await repository.getPartByDrawingCode(requestedCode, {
      excludePartId,
      connection,
    });
    if (duplicate) throw new AppError(`Drawing code ${requestedCode} is already assigned to Part ${duplicate.part_number}.`, 409);
    return requestedCode;
  }

  // An approved Drawing Code is permanent: editing a Part must never clear or
  // replace it just because the form is opened in Auto Generated mode.
  if (clean(existingDrawingCode)) return clean(existingDrawingCode);

  const highestExistingCode = await repository.getHighestNumericDrawingCode(connection);
  await ensureDocumentSequence(
    connection,
    "DRAWING_CODE",
    "GLOBAL",
    "",
    highestExistingCode,
    1
  );

  // The sequence row is locked during increment, so concurrent Part saves
  // receive different serials. Existing numeric codes set its first value.
  return getNextRunningSerial(connection, "DRAWING_CODE", "GLOBAL");
}

function buildPartValues(
  data,
  partNumber,
  userCode,
  drawingCode = clean(data.drawingCode)
) {
  const partCategory = ["MACHINING", "ASSEMBLY"].includes(data.partCategory)
    ? data.partCategory
    : null;
  return [
    Number(data.customerId) || null,
    partCategory,
    clean(data.partName),
    partNumber,
    clean(data.drawingNumber),
    clean(data.drawingRevisionNumber),
    clean(data.drawingRevisionDate),
    data.drawingCodeMode || "AUTO",
    drawingCode,
    partCategory === "ASSEMBLY"
      ? null
      : clean(data.materialSpecification),
    partCategory === "ASSEMBLY" ? null : data.materialId ? Number(data.materialId) : null,
    partCategory === "ASSEMBLY" ? null : data.materialGradeId ? Number(data.materialGradeId) : null,
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

function isRevisionPart(part) {
  return Number(part?.revision_source_part_id ?? part?.revisionSourcePartId ?? 0) > 0;
}

function sameBomComponents(current, next) {
  const key = (entry) => `${String(entry.componentType).toUpperCase()}:${Number(entry.componentId)}:${Number(entry.quantity)}`;
  const currentKeys = (current || []).map(key).sort();
  const nextKeys = (next || []).map(key).sort();
  return currentKeys.length === nextKeys.length
    && currentKeys.every((entry, index) => entry === nextKeys[index]);
}

function revisionCloneProcessPlans(sourcePlans) {
  return (sourcePlans || []).map((plan) => ({
    drawingRevisionNumber: null,
    planCode: null,
    routeName: plan.routeName || "Default Route",
    productionCapacityPerDay: plan.productionCapacityPerDay ?? null,
    planStatus: "DRAFT",
    isDefault: plan.isDefault === "Y" || plan.isDefault === true,
    activeFlag: plan.activeFlag === "N" ? "N" : "Y",
    operations: (plan.operations || []).map((operation) => ({
      operationNumber: operation.operationNumber,
      operationMasterId: operation.operationMasterId,
      operationDescription: operation.operationDescription,
      sourceType: operation.sourceType,
      machineTypeId: operation.machineTypeId,
      cycleTimeSeconds: operation.cycleTimeSeconds,
      clampingTimeSeconds: operation.clampingTimeSeconds,
      settingTimeHours: operation.settingTimeHours,
      outsourceCostInr: operation.outsourceCostInr,
      processCostInr: operation.processCostInr,
      inspectionPlan: operation.inspectionPlan ? {
        cmmRequired: operation.inspectionPlan.cmmRequired === "Y" || operation.inspectionPlan.cmmRequired === true,
        measurementUnit: operation.inspectionPlan.measurementUnit === "INCH" ? "INCH" : "MM",
        toleranceStandardId: operation.inspectionPlan.toleranceStandardId,
        characteristics: (operation.inspectionPlan.characteristics || []).map((characteristic) => ({
          balloonNumber: characteristic.balloonNumber,
          characteristicMasterId: characteristic.characteristicMasterId,
          characteristicText: characteristic.characteristicText,
          specifiedDimension: characteristic.specifiedDimension,
          toleranceMode: characteristic.toleranceMode,
          toleranceGradeId: characteristic.toleranceGradeId,
          toleranceGradeText: characteristic.toleranceGradeText,
          toleranceStandardId: characteristic.toleranceStandardId,
          toleranceMinus: characteristic.toleranceMinus,
          tolerancePlus: characteristic.tolerancePlus,
          lsl: characteristic.lsl,
          usl: characteristic.usl,
          drawingGrid: characteristic.drawingGrid,
          instrumentMasterId: characteristic.instrumentMasterId,
          sampleSize: characteristic.sampleSize,
          inspectionFrequency: characteristic.inspectionFrequency,
          scCcIdentification: characteristic.scCcIdentification === "Y" || characteristic.scCcIdentification === true,
          patrolInspectionQaRequired: characteristic.patrolInspectionQaRequired === "Y" || characteristic.patrolInspectionQaRequired === true,
          periodicOperatorRequired: characteristic.periodicOperatorRequired === "Y" || characteristic.periodicOperatorRequired === true,
          finalInspectionRequired: characteristic.finalInspectionRequired === "Y" || characteristic.finalInspectionRequired === true,
        })),
      } : null,
    })),
  }));
}

function revisionCloneData(source, data) {
  return {
    customerId: Number(source.customer_id ?? source.customerId),
    partCategory: source.part_category ?? source.partCategory,
    partName: source.part_name ?? source.partName,
    partNumber: clean(data.partNumber),
    drawingNumber: clean(data.drawingNumber ?? source.drawing_number ?? source.drawingNumber),
    drawingRevisionNumber: clean(data.drawingRevisionNumber),
    drawingRevisionDate: clean(data.drawingRevisionDate),
    // A revision is a new Part record, therefore it receives its own unique
    // auto-generated Drawing Code instead of reusing the source drawing code.
    drawingCodeMode: "AUTO_GENERATED",
    drawingCode: null,
    materialSpecification: source.material_specification ?? source.materialSpecification,
    materialId: source.material_id ?? source.materialId,
    materialGradeId: source.material_grade_id ?? source.materialGradeId,
    partWeight: source.part_weight ?? source.partWeight,
    unitOfMeasurement: source.unit_of_measurement ?? source.unitOfMeasurement,
    uomId: source.uom_id ?? source.uomId,
    projectName: source.project_name ?? source.projectName,
    bomRequired: selected(source.bom_required ?? source.bomRequired)
      || (source.bomComponents || []).length > 0,
    bomComponents: (source.bomComponents || []).map((component) => ({
      componentType: component.componentType,
      componentId: component.componentId,
      quantity: component.quantity,
    })),
    processPlans: revisionCloneProcessPlans(source.processPlans),
  };
}

function resolveUploadFile(relativePath) {
  const uploadRoot = path.resolve(env.uploadRoot);
  const resolved = path.resolve(uploadRoot, String(relativePath || ""));
  if (resolved === uploadRoot || !resolved.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new AppError("A source attachment path is not valid for cloning.", 400);
  }
  return { uploadRoot, resolved };
}

async function copyRevisionAttachments(sourceAttachments) {
  const copied = [];
  try {
    for (const source of sourceAttachments) {
      const { uploadRoot, resolved: sourceFile } = resolveUploadFile(source.filePath);
      const extension = path.extname(source.fileName || source.storedFileName || "").toLowerCase();
      const storedFileName = `${Date.now()}_${randomUUID()}${extension}`;
      const relativePath = path.posix.join("marketing", "attachments-part-revisions", storedFileName);
      const destination = path.resolve(uploadRoot, relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      try {
        await fs.copyFile(sourceFile, destination);
      } catch (error) {
        if (error?.code === "ENOENT") {
          throw new AppError(`Cannot clone because attachment \"${source.fileName || "file"}\" is missing.`, 400);
        }
        throw error;
      }
      copied.push({
        attachmentType: source.attachmentType,
        attachmentName: source.attachmentName,
        fileName: source.fileName,
        storedFileName,
        filePath: relativePath,
        mimeType: source.mimeType,
        fileSizeBytes: source.fileSizeBytes,
        absolutePath: destination,
      });
    }
    return copied;
  } catch (error) {
    await Promise.all(copied.map((attachment) => fs.unlink(attachment.absolutePath).catch(() => undefined)));
    throw error;
  }
}

async function removeCopiedAttachments(attachments) {
  await Promise.all(attachments.map((attachment) => fs.unlink(attachment.absolutePath).catch(() => undefined)));
}

export async function listParts(query = {}, user) {
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
    partStatus: clean(query.partStatus) || "",
    saveStatus: clean(query.saveStatus) || "",
    includeDraft: query.includeDraft,
    tenantId: String(user?.tenantId || env.defaultTenantId || "DEFAULT"),
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

export async function createToolList(processDefinitionId, user) {
  const definitionId = Number(processDefinitionId);
  if (!Number.isInteger(definitionId) || definitionId < 1) {
    throw new AppError("A valid process operation is required to create a Tool List.");
  }

  const context = await repository.getToolListContext(definitionId);
  if (!context) throw new AppError("The process operation was not found.", 404);

  const tenantId = String(user?.tenantId || env.defaultTenantId || "DEFAULT");
  const existingAttachments = await attachmentRepository.list(
    "PART_PROCESS_DEFINITION",
    definitionId,
    tenantId
  );
  const existing = [...existingAttachments].reverse().find((attachment) => attachment.attachmentType === "TOOL_LIST");
  if (existing) return existing;

  const template = await fs.readFile(toolListTemplatePath).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new AppError("The Tool List template is not available on the server.", 500);
    }
    throw error;
  });
  const workbook = XLSX.read(template, {
    type: "buffer",
    cellDates: true,
    cellNF: true,
    cellStyles: true,
  });
  populateToolListTemplate(workbook, context);
  const fileBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellDates: true,
    cellStyles: true,
  });

  const storedFileName = `${Date.now()}_${randomUUID()}_tool-list.xlsx`;
  const relativePath = path.posix.join("parts", "tool-lists", storedFileName);
  const absolutePath = path.resolve(env.uploadRoot, relativePath);
  const fileName = `Tool List - ${fileNameSegment(context.partNumber, "Part")} - Operation ${fileNameSegment(context.operationNumber, String(definitionId))}.xlsx`;
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  try {
    await fs.writeFile(absolutePath, fileBuffer);
    return await attachmentRepository.insert({
      tenantId,
      entityType: "PART_PROCESS_DEFINITION",
      entityId: definitionId,
      attachmentType: "TOOL_LIST",
      attachmentName: `Tool List - Operation ${displayValue(context.operationNumber, String(definitionId))}`,
      fileName,
      storedFileName,
      filePath: relativePath,
      mimeType: toolListMimeType,
      fileSizeBytes: fileBuffer.length,
      createdBy: user?.userCode || null,
    });
  } catch (error) {
    await fs.unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

function validToolListDefinitionId(processDefinitionId) {
  const definitionId = Number(processDefinitionId);
  if (!Number.isInteger(definitionId) || definitionId < 1) {
    throw new AppError("A valid process operation is required for this Tool List.");
  }
  return definitionId;
}

function findToolListAttachment(attachments) {
  return [...attachments].reverse().find((attachment) => attachment.attachmentType === "TOOL_LIST") || null;
}

async function currentToolListAttachment(definitionId, tenantId, connection = db) {
  const attachments = await attachmentRepository.list(
    "PART_PROCESS_DEFINITION",
    definitionId,
    tenantId,
    connection
  );
  return findToolListAttachment(attachments);
}

function onlyOfficeSession(processDefinitionId, attachment, user) {
  const now = Math.floor(Date.now() / 1000);
  return signOnlyOfficeToken({
    definitionId: processDefinitionId,
    attachmentId: Number(attachment.attachmentId),
    tenantId: String(user?.tenantId || env.defaultTenantId || "DEFAULT"),
    userCode: String(user?.userCode || ""),
    exp: now + env.onlyOffice.sessionMinutes * 60,
  }, env.onlyOffice.jwtSecret);
}

function appendOnlyOfficePath(baseUrl, pathName, session) {
  const url = new URL(pathName, `${baseUrl}/`);
  url.searchParams.set("session", session);
  return url.toString();
}

function onlyOfficeSessionClaims(processDefinitionId, session) {
  if (!env.onlyOffice.enabled) throw new AppError(env.onlyOffice.setupMessage, 503);
  const claims = verifyOnlyOfficeToken(session, env.onlyOffice.jwtSecret);
  if (!claims || Number(claims.definitionId) !== validToolListDefinitionId(processDefinitionId)) {
    throw new AppError("The Tool List editor session is invalid or has expired.", 401);
  }
  if (!Number.isInteger(Number(claims.attachmentId)) || Number(claims.attachmentId) < 1 || !claims.tenantId) {
    throw new AppError("The Tool List editor session is invalid.", 401);
  }
  return claims;
}

function toolListRelativePath(fileUrl) {
  const relativePath = String(fileUrl || "")
    .replace(/^\/?uploads\//i, "")
    .replace(/\\/g, "/");
  if (!relativePath) throw new AppError("The Tool List attachment path is invalid.", 500);
  return relativePath;
}

async function activeEditorAttachment(processDefinitionId, claims, connection = db) {
  const attachment = await currentToolListAttachment(processDefinitionId, String(claims.tenantId), connection);
  if (!attachment || Number(attachment.attachmentId) !== Number(claims.attachmentId)) return null;
  return attachment;
}

function assertOnlyOfficeDownloadUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new AppError("ONLYOFFICE did not return a valid saved Tool List URL.", 502);
  }
  const documentServer = new URL(env.onlyOffice.documentServerUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== documentServer.origin) {
    throw new AppError("ONLYOFFICE returned a saved Tool List from an untrusted server.", 502);
  }
  return url;
}

async function toolListDocumentKey(definitionId, attachment) {
  const { resolved: absolutePath } = resolveUploadFile(toolListRelativePath(attachment.fileUrl));
  const fileStat = await fs.stat(absolutePath).catch(() => null);
  if (!fileStat) throw new AppError("The Tool List file could not be found on the server.", 404);
  // ONLYOFFICE requires a new key when the document changes. The attachment is
  // deliberately retained during an editor session, so its modified time is
  // the version portion of the key used on the next open.
  return `tool-list-${definitionId}-${attachment.attachmentId}-${Math.trunc(fileStat.mtimeMs)}`;
}

export async function getToolListEditorConfig(processDefinitionId, user) {
  const definitionId = validToolListDefinitionId(processDefinitionId);
  if (!env.onlyOffice.enabled) {
    return { enabled: false, message: env.onlyOffice.setupMessage };
  }

  const attachment = await createToolList(definitionId, user);
  const session = onlyOfficeSession(definitionId, attachment, user);
  const basePath = `/api/v1/parts/process-definitions/${definitionId}/tool-list`;
  const fileUrl = appendOnlyOfficePath(env.onlyOffice.publicApiUrl, `${basePath}/editor-file`, session);
  const callbackUrl = appendOnlyOfficePath(env.onlyOffice.publicApiUrl, `${basePath}/editor-callback`, session);
  const document = {
    fileType: "xlsx",
    key: await toolListDocumentKey(definitionId, attachment),
    title: attachment.fileName,
    url: fileUrl,
  };
  const editorConfig = {
    callbackUrl,
    lang: "en",
    mode: "edit",
    user: {
      id: String(user?.userCode || user?.userId || "user"),
      name: String(user?.userName || user?.name || user?.userCode || "User"),
    },
    customization: {
      autosave: true,
      forcesave: false,
    },
  };
  const config = {
    documentType: "cell",
    type: "desktop",
    document,
    editorConfig,
  };

  return {
    enabled: true,
    documentServerUrl: env.onlyOffice.documentServerUrl,
    config: {
      ...config,
      token: signOnlyOfficeToken(config, env.onlyOffice.jwtSecret),
    },
  };
}

export async function getToolListEditorFile(processDefinitionId, session) {
  const definitionId = validToolListDefinitionId(processDefinitionId);
  const claims = onlyOfficeSessionClaims(definitionId, session);
  const attachment = await activeEditorAttachment(definitionId, claims);
  if (!attachment) throw new AppError("This Tool List editor session is no longer current. Reopen the Tool List.", 409);

  const { resolved: absolutePath } = resolveUploadFile(toolListRelativePath(attachment.fileUrl));
  await fs.access(absolutePath).catch(() => {
    throw new AppError("The Tool List file could not be found on the server.", 404);
  });
  return {
    absolutePath,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType || toolListMimeType,
  };
}

export async function saveToolListFromOnlyOffice(processDefinitionId, session, callback = {}) {
  const definitionId = validToolListDefinitionId(processDefinitionId);
  const claims = onlyOfficeSessionClaims(definitionId, session);
  const status = Number(callback?.status);
  if (![2, 6].includes(status)) return { saved: false };

  const current = await activeEditorAttachment(definitionId, claims);
  // A manual replacement already won this race. Tell ONLYOFFICE the callback
  // was accepted but never overwrite the newer file.
  if (!current) return { saved: false, stale: true };

  const savedUrl = assertOnlyOfficeDownloadUrl(callback?.url);
  const response = await fetch(savedUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new AppError("ONLYOFFICE could not provide the saved Tool List file.", 502);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  const maximumSize = env.maxUploadMb * 1024 * 1024;
  if (declaredSize > maximumSize) throw new AppError(`The saved Tool List exceeds the ${env.maxUploadMb} MB limit.`, 413);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new AppError("ONLYOFFICE returned an empty Tool List file.", 502);
  if (buffer.length > maximumSize) throw new AppError(`The saved Tool List exceeds the ${env.maxUploadMb} MB limit.`, 413);

  const { resolved: absolutePath } = resolveUploadFile(toolListRelativePath(current.fileUrl));
  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, buffer);
  try {
    const attachment = await withTransaction(async (connection) => {
      const latest = await activeEditorAttachment(definitionId, claims, connection);
      if (!latest) return null;
      await fs.rename(temporaryPath, absolutePath);
      await attachmentRepository.updateFileMetadata(latest.attachmentId, {
        mimeType: toolListMimeType,
        fileSizeBytes: buffer.length,
      }, connection);
      return latest;
    });
    if (!attachment) {
      await fs.unlink(temporaryPath).catch(() => undefined);
      return { saved: false, stale: true };
    }
    return { saved: true, attachment };
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
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

export async function getRevisionWarnings(query = {}) {
  const rawPartIds = Array.isArray(query.partIds)
    ? query.partIds
    : String(query.partIds || query.partId || "").split(",");
  const partIds = rawPartIds
    .flatMap((partId) => String(partId).split(","))
    .map((partId) => Number.parseInt(partId, 10))
    .filter((partId) => Number.isSafeInteger(partId) && partId > 0);
  const warnings = await repository.findRevisionWarnings(partIds);

  return warnings.map((warning) => ({
    ...warning,
    message: `Drawing revision is under progress for Part ${warning.partNumber}. Contact QA team.`,
  }));
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
  const saveStatus = String(data.action || "SUBMIT").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  validatePart(data, { draft: saveStatus === "DRAFT" });
  const bomComponents = normalizeBomComponents(data);

  return withTransaction(
    async (connection) => {
      const customerId = Number(data.customerId || 0);
      const customer = customerId
        ? await customerRepository.getCustomerById(customerId, connection)
        : null;

      if (
        customerId &&
        (!customer || customer.active_flag !== "Y" || customer.save_status !== "SUBMITTED")
      ) {
        throw new AppError("Select an active, submitted customer.");
      }

      await validateMaterialSelection(connection, data);
      const processPlans = await normalizeProcessPlans(connection, data);

      const partNumber =
        clean(data.partNumber) ||
        await getNextDocumentNumber(
          connection,
          "PART"
        );
      const drawingCode = await resolveDrawingCode(connection, data);

      const partId =
        await repository.insertPart(
          connection,
          buildPartValues(
            data,
            partNumber,
            userCode,
            drawingCode
          ),
          {
            saveStatus,
            activeFlag: "Y",
          bomRequired: selected(data.bomRequired) ? "Y" : "N",
          }
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

  return withTransaction(async (connection) => {
    const existing = await repository.getPartById(partId, connection);
    if (!existing) throw new AppError("Part not found.", 404);
    // Program, Tool List and Work Instruction saves belong to a Process Plan,
    // not to the Part Master header.  Older submitted Parts can legitimately
    // be missing fields that are mandatory on a full Part update, so persist
    // the plan independently and leave the Part, BOM and lifecycle untouched.
    if (data.documentOnly === true) {
      if (!Array.isArray(data.processPlans)) {
        throw new AppError("Process Plan data is required to save this document.");
      }
      const processPlans = await normalizeProcessPlans(connection, data);
      await repository.replaceProcessPlans(connection, Number(partId), processPlans, userCode);
      return repository.getPartById(partId, connection);
    }
    const saveStatus = existing.save_status === "DRAFT"
      && String(data.action || "SUBMIT").toUpperCase() === "DRAFT"
      ? "DRAFT"
      : "SUBMITTED";
    validatePart(data, { draft: saveStatus === "DRAFT" });
    const bomComponents = normalizeBomComponents(data);
    const customerId = Number(data.customerId || 0);
    if (customerId) {
      const customer = await customerRepository.getCustomerById(customerId, connection);
      if (
        !customer ||
        customer.active_flag !== "Y" ||
        customer.save_status !== "SUBMITTED"
      ) {
        throw new AppError("Select an active, submitted customer.");
      }
    }
    await validateMaterialSelection(connection, data);
    const processPlans = await normalizeProcessPlans(connection, data);
    const partNumber = clean(data.partNumber) || existing.part_number;
    const drawingCode = await resolveDrawingCode(connection, data, {
      existingDrawingCode: existing.drawing_code,
      excludePartId: Number(partId),
    });
    await repository.updatePart(partId, buildPartValues(data, partNumber, userCode, drawingCode), connection, {
      saveStatus,
      // Do not reactivate a Part that a user explicitly deactivated.
      // Existing drafts remain active; their usability is governed by
      // save_status and submitted-only operational lookups.
      activeFlag: existing.active_flag === "N" ? "N" : "Y",
      // Keep the prior value for older API clients that do not yet send the
      // checkbox; current Part Master screens always send bomRequired.
      bomRequired: data.bomRequired === undefined
        ? existing.bom_required
        : selected(data.bomRequired) ? "Y" : "N",
    });
    const validBomComponents = await validateBomComponents(
      connection, partId, bomComponents
    );
    const bomChanged = !sameBomComponents(existing.bomComponents, validBomComponents);
    await repository.replaceBomComponents(
      connection, Number(partId), validBomComponents, userCode
    );
    await repository.replaceProcessPlans(connection, Number(partId), processPlans, userCode);
    if (isRevisionPart(existing) && bomChanged) {
      await repository.updateBomReleaseStatus(
        connection,
        partId,
        validBomComponents.length ? "DRAFT" : "NOT_REQUIRED",
        userCode
      );
    }
    if (isRevisionPart(existing)) {
      await repository.activateRevisionWhenReleased(connection, partId, userCode);
    }
    return repository.getPartById(partId, connection);
  });
}

export async function clonePartForRevision(partId, data, user) {
  const requestedPartNumber = clean(data.partNumber);
  const requestedRevision = clean(data.drawingRevisionNumber);
  if (!requestedPartNumber) throw new AppError("New Part Number is required for a drawing revision.");
  if (!requestedRevision) throw new AppError("New Drawing Revision Number is required.");

  const tenantId = String(user?.tenantId || env.defaultTenantId || "DEFAULT");
  const sourceAttachments = await repository.listPartAttachmentsForClone(
    db,
    partId,
    tenantId
  );
  const copiedAttachments = await copyRevisionAttachments(sourceAttachments);

  try {
    return await withTransaction(async (connection) => {
      const source = await repository.getPartById(partId, connection);
      if (!source) throw new AppError("Part not found.", 404);
      if (String(source.part_status).toUpperCase() !== "ACTIVE" || source.active_flag !== "Y") {
        throw new AppError("Only an active Part can be cloned for drawing revision.");
      }

      const existingNumber = await repository.getPartByNumber(requestedPartNumber, connection);
      if (existingNumber) throw new AppError("Part Number already exists. Enter a new Part Number.");

      const cloneData = revisionCloneData(source, data);
      validatePart(cloneData);
      await validateMaterialSelection(connection, cloneData);
      const bomComponents = normalizeBomComponents(cloneData);
      const processPlans = await normalizeProcessPlans(connection, cloneData);
      const customer = await customerRepository.getCustomerById(Number(cloneData.customerId), connection);
      if (!customer || customer.active_flag !== "Y") {
        throw new AppError("The source Part customer is inactive.");
      }
      const drawingCode = await resolveDrawingCode(connection, cloneData);

      const newPartId = await repository.insertPart(
        connection,
        buildPartValues(cloneData, requestedPartNumber, user.userCode, drawingCode),
        {
          partStatus: "DRAWING_UNDER_REVISION",
          activeFlag: "Y",
          revisionSourcePartId: Number(partId),
          bomReleaseStatus: bomComponents.length ? "DRAFT" : "NOT_REQUIRED",
          bomRequired: selected(cloneData.bomRequired) ? "Y" : "N",
        }
      );
      const validBomComponents = await validateBomComponents(connection, newPartId, bomComponents);
      await repository.replaceBomComponents(connection, newPartId, validBomComponents, user.userCode);
      await repository.replaceProcessPlans(connection, newPartId, processPlans, user.userCode);
      await repository.insertClonedPartAttachments(
        connection,
        newPartId,
        tenantId,
        copiedAttachments,
        user.userCode
      );
      await repository.updatePartStatus(
        partId,
        ["INACTIVE", "N", `Superseded by drawing revision ${requestedPartNumber}.`, user.userCode],
        connection
      );

      return repository.getPartById(newPartId, connection);
    });
  } catch (error) {
    await removeCopiedAttachments(copiedAttachments);
    throw error;
  }
}

export async function releaseRevisionBom(partId, user) {
  return withTransaction(async (connection) => {
    const part = await repository.getPartById(partId, connection);
    if (!part) throw new AppError("Part not found.", 404);
    if (!isRevisionPart(part)) {
      throw new AppError("BOM release is available only for a drawing revision.");
    }
    if (String(part.part_status).toUpperCase() !== "DRAWING_UNDER_REVISION") {
      throw new AppError("This drawing revision is already released.");
    }
    const status = part.bomComponents.length ? "RELEASED" : "NOT_REQUIRED";
    await repository.updateBomReleaseStatus(connection, partId, status, user.userCode);
    await repository.activateRevisionWhenReleased(connection, partId, user.userCode);
    return repository.getPartById(partId, connection);
  });
}

export async function changePartStatus(
  partId,
  data,
  userCode
) {
  const existing = await getPart(partId);

  if (
    !["ACTIVE", "INACTIVE"].includes(
      data.partStatus
    )
  ) {
    throw new AppError(
      "Invalid part status."
    );
  }

  if (isRevisionPart(existing) && existing.part_status === "DRAWING_UNDER_REVISION" && data.partStatus === "ACTIVE") {
    throw new AppError("Release the BOM and default Process Plan before activating a drawing revision.");
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
