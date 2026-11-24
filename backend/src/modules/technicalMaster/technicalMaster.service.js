import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./technicalMaster.repository.js";

const clean = (value) => value === null || value === undefined ? "" : String(value).trim();
const code = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const activeFlag = (value) => String(value || "Y").toUpperCase() === "N" ? "N" : "Y";
const receiptTypes = new Set(["REGULAR_PURCHASE","CUSTOMER_SUPPLIED","OPEN_PURCHASE","OUTSOURCING_PRODUCT"]);
const partyActions = new Set(["SUPPLIER","CUSTOMER","INTERNAL"]);
const stockActions = new Set(["QUARANTINE","RETURN","REWORK","SCRAP","RELEASE"]);

function validId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(`Invalid ${label}.`);
  return id;
}

function normalizeOperation(data) {
  const row = { operationCode:code(data.operationCode),operationName:clean(data.operationName),
    defaultSource:code(data.defaultSource),displayOrder:Number(data.displayOrder || 0),
    activeFlag:activeFlag(data.activeFlag) };
  if (!row.operationCode || !row.operationName) throw new AppError("Operation Code and Operation Name are required.");
  if (!Number.isInteger(row.displayOrder) || row.displayOrder < 0) throw new AppError("Display Order must be zero or a positive whole number.");
  return row;
}

function normalizeInstrument(data) {
  const row = { instrumentCode:code(data.instrumentCode),instrumentName:clean(data.instrumentName),
    activeFlag:activeFlag(data.activeFlag) };
  if (!row.instrumentCode || !row.instrumentName) throw new AppError("Instrument Code and Instrument Name are required.");
  return row;
}

function normalizeDepartment(data) {
  const row = { departmentCode:code(data.departmentCode),departmentName:clean(data.departmentName),
    displayOrder:Number(data.displayOrder || 0),activeFlag:activeFlag(data.activeFlag) };
  if (!row.departmentCode || !row.departmentName) throw new AppError("Department Code and Department Name are required.");
  if (!Number.isInteger(row.displayOrder) || row.displayOrder < 0) throw new AppError("Display Order must be zero or a positive whole number.");
  return row;
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new AppError(`${label} must be a valid number.`);
  return number;
}

function normalizeTolerance(data) {
  const row = { gradeCode:code(data.gradeCode),basicSizeFrom:finite(data.basicSizeFrom,"Basic Size From"),
    basicSizeTo:finite(data.basicSizeTo,"Basic Size To"),
    lowerDeviationMicrons:finite(data.lowerDeviationMicrons,"Lower Deviation"),
    upperDeviationMicrons:finite(data.upperDeviationMicrons,"Upper Deviation"),
    activeFlag:activeFlag(data.activeFlag) };
  if (!row.gradeCode) throw new AppError("Tolerance Grade Code is required.");
  if (row.basicSizeFrom < 0 || row.basicSizeTo <= row.basicSizeFrom) {
    throw new AppError("Basic Size To must be greater than Basic Size From.");
  }
  return row;
}

function normalizeInspectionCharacteristic(data) {
  const row = { characteristicCode:code(data.characteristicCode),characteristicName:clean(data.characteristicName),
    characteristicType:String(data.characteristicType || "VARIABLE").toUpperCase(),activeFlag:activeFlag(data.activeFlag) };
  if (!row.characteristicCode || !row.characteristicName) throw new AppError("Characteristic Code and Characteristic Name are required.");
  if (!["VARIABLE","ATTRIBUTE"].includes(row.characteristicType)) throw new AppError("Characteristic Type must be Variable or Attribute.");
  return row;
}

function normalizeInspectionFrequency(data) {
  const row = { frequencyCode:code(data.frequencyCode),frequencyLabel:clean(data.frequencyLabel),
    displayOrder:Number(data.displayOrder || 0),activeFlag:activeFlag(data.activeFlag) };
  if (!row.frequencyCode || !row.frequencyLabel) throw new AppError("Frequency Code and Frequency Label are required.");
  if (!Number.isInteger(row.displayOrder) || row.displayOrder < 0) throw new AppError("Display Order must be zero or a positive whole number.");
  return row;
}

function optionalId(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  return validId(value, label);
}

function normalizeReceiptTypes(value) {
  const supplied = Array.isArray(value) ? value.join(",") : clean(value);
  if (!supplied || supplied.toUpperCase() === "ALL") return "ALL";
  const values = [...new Set(supplied.split(",").map(code).filter(Boolean))];
  if (!values.length || values.some((entry) => !receiptTypes.has(entry))) {
    throw new AppError("Select one or more valid receipt types.");
  }
  return values.join(",");
}

function normalizeRejectionDisposition(data) {
  const row = { dispositionCode:code(data.dispositionCode),dispositionName:clean(data.dispositionName),
    partyAction:code(data.partyAction || "INTERNAL"),stockAction:code(data.stockAction || "QUARANTINE"),
    activeFlag:activeFlag(data.activeFlag) };
  if (!row.dispositionCode || !row.dispositionName) throw new AppError("Disposition Code and Disposition Name are required.");
  if (!partyActions.has(row.partyAction)) throw new AppError("Select a valid responsible party.");
  if (!stockActions.has(row.stockAction)) throw new AppError("Select a valid stock action.");
  return row;
}

function normalizeRejectionReason(data) {
  const row = { reasonCode:code(data.reasonCode),reasonName:clean(data.reasonName),reasonCategory:code(data.reasonCategory),
    applicableReceiptTypes:normalizeReceiptTypes(data.applicableReceiptTypes),
    defaultDispositionId:optionalId(data.defaultDispositionId,"Default Disposition"),
    requireRemarks:activeFlag(data.requireRemarks),requireAttachment:activeFlag(data.requireAttachment),
    activeFlag:activeFlag(data.activeFlag) };
  if (!row.reasonCode || !row.reasonName || !row.reasonCategory) {
    throw new AppError("Reason Code, Reason Name and Category are required.");
  }
  return row;
}

export const listSources = (includeInactive = false) => repository.listSources(undefined, includeInactive);
async function paged(query, fetchRows) {
  const rows = await fetchRows();
  if (query.page === undefined && query.pageSize === undefined) return rows;
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 10);
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export const listOperations = (query) => paged(query, () => repository.listOperations({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listInstruments = (query) => paged(query, () => repository.listInstruments({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listDepartments = (query) => paged(query, () => repository.listDepartments({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listToleranceGrades = (query) => paged(query, () => repository.listToleranceGrades({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listInspectionCharacteristics = (query) => paged(query, () => repository.listInspectionCharacteristics({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listInspectionFrequencies = (query) => paged(query, () => repository.listInspectionFrequencies({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listRejectionDispositions = (query) => paged(query, () => repository.listRejectionDispositions({ search:clean(query.search),status:activeFlagFilter(query.status) }));
export const listRejectionReasons = (query) => paged(query, () => repository.listRejectionReasons({ search:clean(query.search),status:activeFlagFilter(query.status) }));

function activeFlagFilter(value) {
  const normalized = String(value || "").toUpperCase();
  return ["Y","N"].includes(normalized) ? normalized : "";
}

export async function saveOperation(operationMasterId, data) {
  const row = normalizeOperation(data);
  return withTransaction(async (connection) => {
    const source = await repository.getSource(connection,row.defaultSource);
    if (!source || source.activeFlag !== "Y") throw new AppError("Select an active Operation Source.");
    const id = operationMasterId ? validId(operationMasterId,"Operation Master ID") : 0;
    if (await repository.findOperationConflict(connection,{...row,operationMasterId:id})) {
      throw new AppError("Operation Code or Operation Name already exists.");
    }
    if (id) {
      if (!await repository.updateOperation(connection,id,row)) throw new AppError("Operation Master record not found.",404);
      return { operationMasterId:id,...row,sourceName:source.sourceName,costingMode:source.costingMode };
    }
    const createdId = await repository.insertOperation(connection,row);
    return { operationMasterId:createdId,...row,sourceName:source.sourceName,costingMode:source.costingMode };
  });
}

export async function saveInstrument(instrumentMasterId, data) {
  const row = normalizeInstrument(data);
  return withTransaction(async (connection) => {
    const id = instrumentMasterId ? validId(instrumentMasterId,"Instrument Master ID") : 0;
    if (await repository.findInstrumentConflict(connection,{...row,instrumentMasterId:id})) {
      throw new AppError("Instrument Code or Instrument Name already exists.");
    }
    if (id) {
      if (!await repository.updateInstrument(connection,id,row)) throw new AppError("Instrument Master record not found.",404);
      return { instrumentMasterId:id,...row };
    }
    const createdId = await repository.insertInstrument(connection,row);
    return { instrumentMasterId:createdId,...row };
  });
}

export async function saveDepartment(departmentId, data) {
  const row = normalizeDepartment(data);
  return withTransaction(async (connection) => {
    const id = departmentId ? validId(departmentId,"Department ID") : 0;
    if (await repository.findDepartmentConflict(connection,{ ...row,departmentId:id })) {
      throw new AppError("Department Code or Department Name already exists.");
    }
    if (id) {
      if (!await repository.updateDepartment(connection,id,row)) throw new AppError("Department Master record not found.",404);
      return { departmentId:id,...row };
    }
    const createdId = await repository.insertDepartment(connection,row);
    return { departmentId:createdId,...row };
  });
}

export async function saveToleranceGrade(toleranceGradeId, data) {
  const row = normalizeTolerance(data);
  return withTransaction(async (connection) => {
    const id = toleranceGradeId ? validId(toleranceGradeId,"Tolerance Grade Master ID") : 0;
    if (await repository.findToleranceConflict(connection,{...row,toleranceGradeId:id})) {
      throw new AppError("This Tolerance Grade and Basic Size range already exists.");
    }
    if (id) {
      if (!await repository.updateToleranceGrade(connection,id,row)) throw new AppError("Tolerance Grade record not found.",404);
      return { toleranceGradeId:id,...row };
    }
    const createdId = await repository.insertToleranceGrade(connection,row);
    return { toleranceGradeId:createdId,...row };
  });
}

export async function saveInspectionCharacteristic(characteristicMasterId, data) {
  const row = normalizeInspectionCharacteristic(data);
  return withTransaction(async (connection) => {
    const id = characteristicMasterId ? validId(characteristicMasterId,"Inspection Characteristic ID") : 0;
    if (await repository.findInspectionCharacteristicConflict(connection,{ ...row,characteristicMasterId:id })) {
      throw new AppError("Characteristic Code or Characteristic Name already exists.");
    }
    if (id) {
      if (!await repository.updateInspectionCharacteristic(connection,id,row)) throw new AppError("Inspection Characteristic record not found.",404);
      return { characteristicMasterId:id,...row };
    }
    const createdId = await repository.insertInspectionCharacteristic(connection,row);
    return { characteristicMasterId:createdId,...row };
  });
}

export async function saveInspectionFrequency(frequencyId, data) {
  const row = normalizeInspectionFrequency(data);
  return withTransaction(async (connection) => {
    const id = frequencyId ? validId(frequencyId,"Inspection Frequency ID") : 0;
    if (await repository.findInspectionFrequencyConflict(connection,{ ...row,frequencyId:id })) {
      throw new AppError("Frequency Code or Frequency Label already exists.");
    }
    if (id) {
      if (!await repository.updateInspectionFrequency(connection,id,row)) throw new AppError("Inspection Frequency record not found.",404);
      return { frequencyId:id,...row };
    }
    const createdId = await repository.insertInspectionFrequency(connection,row);
    return { frequencyId:createdId,...row };
  });
}

export async function saveRejectionDisposition(rejectionDispositionId, data) {
  const row = normalizeRejectionDisposition(data);
  return withTransaction(async (connection) => {
    const id = rejectionDispositionId ? validId(rejectionDispositionId,"Rejection Disposition ID") : 0;
    if (await repository.findRejectionDispositionConflict(connection,{ ...row,rejectionDispositionId:id })) {
      throw new AppError("Disposition Code or Disposition Name already exists.");
    }
    if (id) {
      if (!await repository.updateRejectionDisposition(connection,id,row)) throw new AppError("Rejection Disposition record not found.",404);
      return { rejectionDispositionId:id,...row };
    }
    const createdId = await repository.insertRejectionDisposition(connection,row);
    return { rejectionDispositionId:createdId,...row };
  });
}

export async function saveRejectionReason(rejectionReasonId, data) {
  const row = normalizeRejectionReason(data);
  return withTransaction(async (connection) => {
    const id = rejectionReasonId ? validId(rejectionReasonId,"Rejection Reason ID") : 0;
    let disposition = null;
    if (row.defaultDispositionId) {
      disposition = await repository.getRejectionDisposition(connection,row.defaultDispositionId);
      if (!disposition || disposition.activeFlag !== "Y") throw new AppError("Select an active default disposition.");
    }
    if (await repository.findRejectionReasonConflict(connection,{ ...row,rejectionReasonId:id })) {
      throw new AppError("Reason Code or Reason Name already exists.");
    }
    if (id) {
      if (!await repository.updateRejectionReason(connection,id,row)) throw new AppError("Rejection Reason record not found.",404);
      return { rejectionReasonId:id,...row,defaultDispositionCode:disposition?.dispositionCode || "",defaultDispositionName:disposition?.dispositionName || "" };
    }
    const createdId = await repository.insertRejectionReason(connection,row);
    return { rejectionReasonId:createdId,...row,defaultDispositionCode:disposition?.dispositionCode || "",defaultDispositionName:disposition?.dispositionName || "" };
  });
}
