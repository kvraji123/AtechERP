import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import * as repository from "./gauge.repository.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
import { listLocations, validateStorageLocation } from "../inventory/inventory-location.repository.js";
import { completeCalibrationReturnGateEntry } from "../gate-entry/gate-entry.service.js";

const operationalStatuses = ["AVAILABLE", "ISSUED", "COLLECTED_FOR_CALIBRATION", "UNDER_CALIBRATION", "UNDER_SERVICE", "REJECTED", "RETIRED"];
const usableConditions = new Set(["ON_TIME", "DUE_SOON", "DUE_TODAY"]);
const clean = (value) => value === null || value === undefined ? null : String(value).trim() || null;
const today = todayInAppTimeZone;

async function assertCalibrationAgencySupplier(connection, calibrationAgency) {
  if (!calibrationAgency) return;
  if (!(await repository.hasActiveCalibrationSupplier(connection, calibrationAgency))) {
    throw new AppError("Select an active supplier categorized for Calibration as the Calibration Agency.");
  }
}

async function resolveActiveIssueLocation(connection, tenantId, value) {
  const requested = clean(value);
  const location = (await listLocations(tenantId, connection)).find((entry) =>
    String(entry.label || "").toLocaleUpperCase() === String(requested || "").toLocaleUpperCase()
  );
  if (!location) throw new AppError("Select an active Issue Location from Location Master.");
  return location.label;
}

function validDate(value, label, required = false) {
  const normalized = clean(value);
  if (!normalized && required) throw new AppError(`${label} is required.`);
  if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new AppError(`Enter a valid ${label}.`);
  return normalized;
}

function positiveWhole(value, label, fallback = 0, maximum = 1000) {
  const number = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw new AppError(`${label} must be a whole number between 1 and ${maximum}.`);
  return number;
}

function normalizeAbbreviation(value) {
  const abbreviation = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(abbreviation)) {
    throw new AppError("Instrument abbreviation must contain 2 to 12 letters or numbers.");
  }
  return abbreviation;
}

export function calculateCalibrationDueDate(lastCalibrationDate, frequencyMonths) {
  if (!lastCalibrationDate) return null;
  const [year, month, day] = lastCalibrationDate.split("-").map(Number);
  const monthIndex = month - 1 + Number(frequencyMonths);
  const dueYear = year + Math.floor(monthIndex / 12);
  const dueMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
  return `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function normalizeRegistration(data) {
  const lastCalibrationDate = validDate(data.lastCalibrationDate, "Last Calibration Date");
  const calibrationFrequencyMonths = positiveWhole(data.calibrationFrequencyMonths, "Calibration Frequency (Months)", 12, 120);
  const calibrationDueDate = calculateCalibrationDueDate(lastCalibrationDate, calibrationFrequencyMonths);
  const currentLocation = clean(data.currentLocation);
  if (!currentLocation) throw new AppError("Current Location is required.");
  const serialNumbers = Array.isArray(data.serialNumbers) ? data.serialNumbers.map(clean) : [];
  const manufacturerSerialNumberRange = clean(data.manufacturerSerialNumberRange);
  if (manufacturerSerialNumberRange && manufacturerSerialNumberRange.length > 120) {
    throw new AppError("Manufacturer Serial Number Range must be at most 120 characters.");
  }
  return {
    sourceGrnItemId: positiveWhole(data.sourceGrnItemId, "Posted GRN item", 0, Number.MAX_SAFE_INTEGER),
    quantity: positiveWhole(data.quantity, "Quantity", 1),
    instrumentAbbreviation: normalizeAbbreviation(data.instrumentAbbreviation),
    manufacturerSerialNumbers: serialNumbers,
    manufacturerSerialNumberRange,
    makeName: clean(data.makeName),
    modelNumber: clean(data.modelNumber),
    measurementRange: clean(data.measurementRange),
    leastCount: clean(data.leastCount),
    accuracy: clean(data.accuracy),
    calibrationFrequencyMonths,
    lastCalibrationDate,
    calibrationDueDate,
    calibrationAgency: clean(data.calibrationAgency),
    currentLocation,
    remarks: clean(data.remarks),
  };
}

function normalizeUpdate(data, existing) {
  const lastCalibrationDate = validDate(data.lastCalibrationDate ?? existing.lastCalibrationDate, "Last Calibration Date");
  const calibrationFrequencyMonths = positiveWhole(data.calibrationFrequencyMonths ?? existing.calibrationFrequencyMonths, "Calibration Frequency (Months)", 12, 120);
  const calibrationDueDate = calculateCalibrationDueDate(lastCalibrationDate, calibrationFrequencyMonths);
  const currentLocation = clean(data.currentLocation ?? existing.currentLocation);
  if (!currentLocation) throw new AppError("Current Location is required.");
  return {
    manufacturerSerialNumber: clean(data.manufacturerSerialNumber ?? existing.manufacturerSerialNumber),
    makeName: clean(data.makeName ?? existing.makeName),
    modelNumber: clean(data.modelNumber ?? existing.modelNumber),
    measurementRange: clean(data.measurementRange ?? existing.measurementRange),
    leastCount: clean(data.leastCount ?? existing.leastCount),
    accuracy: clean(data.accuracy ?? existing.accuracy),
    calibrationFrequencyMonths,
    lastCalibrationDate,
    calibrationDueDate,
    calibrationAgency: clean(data.calibrationAgency ?? existing.calibrationAgency),
    currentLocation,
    remarks: clean(data.remarks ?? existing.remarks),
  };
}

function assertLifecycle(gauge, expected) {
  if (!expected.includes(gauge.operationalStatus)) {
    throw new AppError(`This action is not available while the gauge is ${gauge.operationalStatus.replaceAll("_", " ").toLowerCase()}.`, 409);
  }
}

function normalizeBatchGaugeIds(value) {
  if (!Array.isArray(value) || value.length === 0) throw new AppError("Select at least one Gauge ID.");
  if (value.length > 100) throw new AppError("A bulk movement can include up to 100 Gauge IDs.");
  const ids = value.map((entry) => Number(entry));
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new AppError("Select valid Gauge IDs.");
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) throw new AppError("A Gauge ID can be selected only once.");
  return uniqueIds.sort((left, right) => left - right);
}

function normalizeCalibrationReturnItems(value, returnDate) {
  if (!Array.isArray(value) || value.length === 0) throw new AppError("Select at least one Gauge ID received from calibration.");
  if (value.length > 100) throw new AppError("A Calibration Return GRN can include up to 100 Gauge IDs.");
  const gaugeMasterIds = new Set();
  return value.map((entry) => {
    const gaugeMasterId = Number(entry?.gaugeMasterId);
    if (!Number.isSafeInteger(gaugeMasterId) || gaugeMasterId < 1) throw new AppError("Select valid Gauge IDs for the Calibration Return GRN.");
    if (gaugeMasterIds.has(gaugeMasterId)) throw new AppError("A Gauge ID can be received only once in the same Calibration Return GRN.");
    gaugeMasterIds.add(gaugeMasterId);
    const calibrationResult = String(entry?.calibrationResult || "").trim().toUpperCase();
    if (!['PASS', 'FAIL'].includes(calibrationResult)) throw new AppError("Calibration Result must be Pass or Fail for every received Gauge ID.");
    const certificateNumber = clean(entry?.certificateNumber);
    const certificateFile = entry?.certificateFile && typeof entry.certificateFile === "object" ? entry.certificateFile : null;
    if (!certificateNumber) throw new AppError("Certificate Number is required for every returned Gauge ID.");
    if (!certificateFile?.fileName || !certificateFile?.filePath || !Number(certificateFile?.fileSizeBytes)) {
      throw new AppError("Upload one certificate PDF for every returned Gauge ID.");
    }
    return {
      gaugeMasterId,
      calibrationResult,
      calibrationDate: validDate(entry?.calibrationDate || returnDate, "Calibration Date", true),
      certificateNumber,
      certificateFile,
      remarks: clean(entry?.remarks),
    };
  });
}

async function loadGaugeForUpdate(connection, gaugeMasterId, user) {
  const gauge = await repository.getGaugeById(Number(gaugeMasterId), user.tenantId, connection, true);
  if (!gauge) throw new AppError("Gauge Master record not found.", 404);
  return gauge;
}

async function addHistory(connection, user, gaugeMasterId, eventType, values = {}) {
  return repository.insertHistory(connection, {
    tenantId: user.tenantId,
    gaugeMasterId: Number(gaugeMasterId),
    gaugeMovementBatchId: values.gaugeMovementBatchId,
    eventType,
    eventDate: values.eventDate || today(),
    operationalStatus: values.operationalStatus,
    locationName: values.locationName,
    assignedTo: values.assignedTo,
    calibrationAgency: values.calibrationAgency,
    calibrationResult: values.calibrationResult,
    calibrationDueDate: values.calibrationDueDate,
    certificateNumber: values.certificateNumber,
    certificateFile: values.certificateFile,
    remarks: values.remarks,
  }, user.userCode);
}

export async function getLookups(user) {
  return {
    storageLocations: await listLocations(user.tenantId),
    registrationSources: await repository.listGaugeRegistrationSources(user.tenantId),
    operationalStatuses: [
      { value: "CALIBRATION_EXPIRED", label: "Blocked - Calibration Expired" },
      ...operationalStatuses.map((value) => ({ value, label: value.toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase()) })),
    ],
    calibrationConditions: [
      { value: "ON_TIME", label: "On Time" }, { value: "DUE_SOON", label: "Due Soon" },
      { value: "DUE_TODAY", label: "Due Today" }, { value: "EXPIRED", label: "Expired" },
      { value: "REJECTED", label: "Rejected" }, { value: "NOT_SCHEDULED", label: "Not Scheduled" },
    ],
  };
}

export function getCalibrationWorkflowSummary(user) {
  return repository.getCalibrationWorkflowSummary(user.tenantId);
}

export async function list(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const result = await repository.listGauges({
    tenantId: user.tenantId,
    search: query.search,
    gaugeId: query.gaugeId,
    instrument: query.instrument,
    grnNumber: query.grnNumber,
    calibrationDueDate: query.calibrationDueDate,
    location: query.location,
    operationalStatus: query.operationalStatus,
    lifecycleStatus: query.lifecycleStatus,
    calibrationCondition: query.calibrationCondition,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, page, pageSize };
}

export async function getCalibrationDispatchLookups(user) {
  return { servicePurchaseOrders: await repository.listCalibrationServicePurchaseOrders(user.tenantId) };
}

export async function listCalibrationDispatches(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const result = await repository.listCalibrationDispatches({ tenantId: user.tenantId, limit: pageSize, offset: (page - 1) * pageSize });
  return { ...result, page, pageSize };
}

export async function getCalibrationDispatch(calibrationDispatchId, user) {
  const dispatch = await repository.getCalibrationDispatch(calibrationDispatchId, user.tenantId);
  if (!dispatch) throw new AppError("Calibration dispatch challan not found.", 404);
  return dispatch;
}

export async function createCalibrationDispatchInTransaction(raw, user, connection, options = {}) {
  const gaugeMasterIds = normalizeBatchGaugeIds(raw.gaugeMasterIds);
  const calibrationAgency = clean(raw.calibrationAgency);
  const dispatchDate = validDate(raw.dispatchDate || today(), "Dispatch Date", true);
  const expectedReturnDate = validDate(raw.expectedReturnDate, "Expected Return Date", true);
  const courierReference = clean(raw.courierReference);
  const dispatchFrom = clean(raw.dispatchFrom);
  const remarks = clean(raw.remarks);
  if (!calibrationAgency) throw new AppError("Calibration Agency is required.");
  await assertCalibrationAgencySupplier(connection, calibrationAgency);
  if (expectedReturnDate < dispatchDate) throw new AppError("Expected Return Date cannot be before Dispatch Date.");

  const gauges = [];
  for (const gaugeMasterId of gaugeMasterIds) gauges.push(await loadGaugeForUpdate(connection, gaugeMasterId, user));
  for (const gauge of gauges) assertLifecycle(gauge, ["COLLECTED_FOR_CALIBRATION"]);
  const agencies = [...new Set(gauges.map((gauge) => String(gauge.calibrationAgency || "").trim()).filter(Boolean).map((agency) => agency.toLocaleLowerCase()))];
  if (agencies.length > 1) throw new AppError("Selected Gauge IDs must have the same Calibration Agency before creating one dispatch challan.", 409);

  if (agencies.length && agencies[0] !== calibrationAgency.toLocaleLowerCase()) {
    throw new AppError(`The selected gauges are assigned to ${gauges[0].calibrationAgency}. Create the dispatch challan for that calibration agency.`, 409);
  }

  let challanNumber = options.challanNumber || null;
  if (!challanNumber) {
    const financialYear = getFinancialYear(new Date(`${dispatchDate}T00:00:00`));
    await ensureDocumentSequence(connection, "GAUGE_CALIBRATION_DISPATCH", financialYear, "GCD");
    challanNumber = await getNextDocumentNumber(connection, "GAUGE_CALIBRATION_DISPATCH", financialYear);
  }
  const calibrationDispatchId = await repository.insertMovementBatch(connection, {
    tenantId: user.tenantId, movementNumber: challanNumber, movementType: "CALIBRATION_DISPATCH", movementDate: dispatchDate,
    calibrationAgency, servicePurchaseOrderId: null, servicePoNumber: null, challanNumber,
    expectedReturnDate, courierReference, materialOutwardDocumentId: options.materialOutwardDocumentId || null,
    locationName: dispatchFrom || calibrationAgency, remarks, createdBy: user.userCode,
  });
  for (const gauge of gauges) {
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, {
      operationalStatus: "UNDER_CALIBRATION", currentLocation: calibrationAgency, assignedTo: null, calibrationAgency,
    }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "CALIBRATION_DISPATCHED", {
      gaugeMovementBatchId: calibrationDispatchId, eventDate: dispatchDate, operationalStatus: "UNDER_CALIBRATION",
      locationName: calibrationAgency, calibrationAgency, remarks,
    });
  }
  await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_CALIBRATION_DISPATCH",
    entityId: calibrationDispatchId, action: "CALIBRATION_DISPATCH_CREATED", newValue: {
      challanNumber, calibrationAgency,
      expectedReturnDate, courierReference, gaugeMasterIds, materialOutwardDocumentId: options.materialOutwardDocumentId || null,
    }, performedBy: user.userCode });
  return repository.getCalibrationDispatch(calibrationDispatchId, user.tenantId, connection);
}

export async function createCalibrationDispatch(raw, user) {
  return withTransaction((connection) => createCalibrationDispatchInTransaction(raw, user, connection));
}

export async function createCalibrationReturnGrn(calibrationDispatchId, raw, user) {
  const returnDate = validDate(raw.returnDate || today(), "Return Date", true);
  const returnLocation = clean(raw.returnLocation);
  const remarks = clean(raw.remarks);
  const gateEntryId = Number(raw.gateEntryId);
  if (!returnLocation) throw new AppError("Return or holding location is required.");
  if (!Number.isSafeInteger(gateEntryId) || gateEntryId < 1) throw new AppError("Select the completed Calibration Return Gate Entry before creating this GRN.");
  const items = normalizeCalibrationReturnItems(raw.items, returnDate);

  return withTransaction(async (connection) => {
    const gate = await completeCalibrationReturnGateEntry(connection, gateEntryId, user);
    const dispatch = await repository.getCalibrationDispatchForUpdate(connection, calibrationDispatchId, user.tenantId);
    if (!dispatch) throw new AppError("Calibration dispatch challan not found.", 404);
    if (dispatch.dispatchStatus === "CANCELLED") throw new AppError("A cancelled calibration dispatch challan cannot receive a return.", 409);
    if (returnDate < dispatch.dispatchDate) throw new AppError("Return Date cannot be before the Dispatch Date.");

    const dispatchedGaugeIds = new Set(await repository.listCalibrationDispatchGaugeIds(connection, calibrationDispatchId, user.tenantId));
    for (const item of items) {
      if (!dispatchedGaugeIds.has(item.gaugeMasterId)) {
        throw new AppError("Every received Gauge ID must belong to the selected calibration dispatch challan.", 409);
      }
    }

    const gauges = [];
    for (const item of items) {
      const gauge = await loadGaugeForUpdate(connection, item.gaugeMasterId, user);
      assertLifecycle(gauge, ["UNDER_CALIBRATION"]);
      gauges.push(gauge);
    }

    const financialYear = getFinancialYear(new Date(`${returnDate}T00:00:00`));
    await ensureDocumentSequence(connection, "GAUGE_CALIBRATION_RETURN_GRN", financialYear, "CGRN");
    const returnGrnNumber = await getNextDocumentNumber(connection, "GAUGE_CALIBRATION_RETURN_GRN", financialYear);
    const calibrationReturnId = await repository.insertMovementBatch(connection, {
      tenantId: user.tenantId,
      movementNumber: returnGrnNumber,
      movementType: "CALIBRATION_RETURN",
      movementDate: returnDate,
      calibrationAgency: dispatch.calibrationAgency,
      challanNumber: returnGrnNumber,
      sourceCalibrationDispatchId: Number(calibrationDispatchId),
      gateEntryId,
      locationName: returnLocation,
      remarks,
      createdBy: user.userCode,
    });

    for (const item of items) {
      const gauge = gauges.find((entry) => entry.gaugeMasterId === item.gaugeMasterId);
      const operationalStatus = item.calibrationResult === "PASS" ? "AVAILABLE" : "REJECTED";
      const calibrationDueDate = item.calibrationResult === "PASS"
        ? calculateCalibrationDueDate(item.calibrationDate, gauge.calibrationFrequencyMonths)
        : null;
      await repository.updateLifecycle(connection, gauge.gaugeMasterId, {
        operationalStatus,
        currentLocation: returnLocation,
        assignedTo: null,
        lastCalibrationDate: item.calibrationDate,
        calibrationDueDate,
        calibrationAgency: dispatch.calibrationAgency,
      }, user.userCode);
      await addHistory(connection, user, gauge.gaugeMasterId, "CALIBRATION_RETURNED", {
        gaugeMovementBatchId: calibrationReturnId,
        eventDate: returnDate,
        operationalStatus,
        locationName: returnLocation,
        calibrationAgency: dispatch.calibrationAgency,
        calibrationResult: item.calibrationResult,
        calibrationDueDate,
        certificateNumber: item.certificateNumber,
        certificateFile: item.certificateFile,
        remarks: item.remarks || remarks,
      });
    }

    const returnedGaugeCount = await repository.countCalibrationDispatchReturnedGauges(connection, calibrationDispatchId, user.tenantId);
    const dispatchStatus = returnedGaugeCount >= dispatchedGaugeIds.size ? "RETURNED" : "PARTIALLY_RETURNED";
    await repository.updateCalibrationDispatchStatus(connection, calibrationDispatchId, user.tenantId, dispatchStatus);
    await recordAudit({
      connection,
      tenantId: user.tenantId,
      module: "GAUGE",
      entityType: "GAUGE_CALIBRATION_RETURN_GRN",
      entityId: calibrationReturnId,
      action: "CALIBRATION_RETURN_GRN_CREATED",
      newValue: { returnGrnNumber, calibrationDispatchId: Number(calibrationDispatchId), gateEntryId, gateEntryNumber: gate.gateEntryNumber, returnDate, returnLocation, dispatchStatus, gaugeMasterIds: items.map((item) => item.gaugeMasterId) },
      performedBy: user.userCode,
    });
    return repository.getCalibrationReturn(calibrationReturnId, user.tenantId, connection);
  });
}

export async function getCalibrationAlerts(user) {
  return repository.getCalibrationAlertSummary(user.tenantId);
}

export async function getGauge(gaugeMasterId, user) {
  const gauge = await repository.getGaugeById(Number(gaugeMasterId), user.tenantId);
  if (!gauge) throw new AppError("Gauge Master record not found.", 404);
  return gauge;
}

export async function register(raw, user) {
  const data = normalizeRegistration(raw);
  return withTransaction(async (connection) => {
    const storageLocationId = await validateStorageLocation(connection, user.tenantId, raw.storageLocationId);
    const source = await repository.getRegistrationSourceForUpdate(connection, user.tenantId, data.sourceGrnItemId);
    if (!source) throw new AppError("Select a posted Instruments & Gauges GRN item with accepted quantity.", 409);
    const registrationData = {
      ...data,
      makeName: raw.makeName === undefined ? clean(source.makeName) : data.makeName,
      modelNumber: raw.modelNumber === undefined ? clean(source.modelNumber) : data.modelNumber,
      calibrationFrequencyMonths: raw.calibrationFrequencyMonths === undefined
        ? positiveWhole(source.calibrationFrequencyMonths, "Calibration Frequency (Months)", 12, 120)
        : data.calibrationFrequencyMonths,
      calibrationAgency: raw.calibrationAgency === undefined ? clean(source.calibrationAgency) : data.calibrationAgency,
    };
    await assertCalibrationAgencySupplier(connection, registrationData.calibrationAgency);
    const registeredQuantity = Number(source.registeredQuantity || 0);
    const inventoryQuantity = await repository.getRegistrationStockForUpdate(connection, source);
    const registrationAvailable = Math.max(Math.floor(inventoryQuantity) - registeredQuantity, 0);
    if (data.quantity > registrationAvailable) {
      throw new AppError(`Only ${registrationAvailable} physical gauge record(s) are available in inventory for this GRN line.`, 409);
    }
    const gaugeIds = await repository.reserveGaugeIds(connection, registrationData.instrumentAbbreviation, registrationData.quantity, user.userCode);
    const records = [];
    for (let index = 0; index < registrationData.quantity; index += 1) {
      const gaugeMasterId = await repository.insertGauge(connection, {
        storageLocationId,
        tenantId: user.tenantId,
        companyId: source.companyId || user.companyId,
        plantId: source.plantId,
        grnId: source.grnId,
        grnItemId: source.grnItemId,
        itemId: source.itemId,
        gaugeId: gaugeIds[index],
        instrumentAbbreviation: registrationData.instrumentAbbreviation,
        instrumentName: source.itemDescription,
        itemCode: source.itemCode,
        manufacturerSerialNumber: registrationData.manufacturerSerialNumberRange || registrationData.manufacturerSerialNumbers[index] || null,
        makeName: registrationData.makeName,
        modelNumber: registrationData.modelNumber,
        measurementRange: registrationData.measurementRange || source.measurementRange || null,
        leastCount: registrationData.leastCount || source.leastCount || null,
        accuracy: registrationData.accuracy || source.accuracy || null,
        calibrationFrequencyMonths: registrationData.calibrationFrequencyMonths,
        lastCalibrationDate: registrationData.lastCalibrationDate,
        calibrationDueDate: registrationData.calibrationDueDate,
        calibrationAgency: registrationData.calibrationAgency,
        currentLocation: registrationData.currentLocation,
        remarks: registrationData.remarks,
      }, user.userCode);
      await addHistory(connection, user, gaugeMasterId, "REGISTERED", {
        operationalStatus: "AVAILABLE", locationName: registrationData.currentLocation,
        calibrationAgency: registrationData.calibrationAgency, calibrationDueDate: registrationData.calibrationDueDate,
        remarks: `Registered from ${source.grnNumber}.${registrationData.remarks ? ` ${registrationData.remarks}` : ""}`,
      });
      records.push({ gaugeMasterId, gaugeId: gaugeIds[index] });
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MASTER",
      entityId: records[0].gaugeMasterId, action: "GAUGE_BATCH_REGISTERED",
      newValue: { sourceGrnItemId: registrationData.sourceGrnItemId, quantity: registrationData.quantity, gaugeIds, manufacturerSerialNumberRange: registrationData.manufacturerSerialNumberRange }, performedBy: user.userCode });
    return { sourceGrnNumber: source.grnNumber, records };
  });
}

export async function updateGauge(gaugeMasterId, raw, user) {
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    const data = normalizeUpdate(raw, gauge);
    await assertCalibrationAgencySupplier(connection, data.calibrationAgency);
    // A gauge’s home storage is set during registration and must not change through Gauge Master edits.
    data.storageLocationId = gauge.storageLocationId;
    await repository.updateGaugeDetails(connection, gauge.gaugeMasterId, data, user.userCode);
    const certificateFile = raw.certificateFile && typeof raw.certificateFile === "object" ? raw.certificateFile : null;
    if (certificateFile?.fileName && certificateFile?.filePath && Number(certificateFile?.fileSizeBytes)) {
      await addHistory(connection, user, gauge.gaugeMasterId, "CALIBRATION_CERTIFICATE_ATTACHED", {
        operationalStatus: gauge.operationalStatus, locationName: data.currentLocation, calibrationAgency: data.calibrationAgency,
        calibrationDueDate: data.calibrationDueDate, certificateNumber: clean(raw.certificateNumber), certificateFile,
        remarks: "Calibration certificate attached through Gauge Master edit.",
      });
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MASTER", entityId: gauge.gaugeMasterId, action: "GAUGE_UPDATED", newValue: { ...data, certificateFileName: certificateFile?.fileName || null }, performedBy: user.userCode });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function issueGauge(gaugeMasterId, raw, user) {
  const issuedTo = clean(raw.issuedTo);
  const requestedIssueLocation = clean(raw.issueLocation);
  const issueDate = validDate(raw.issueDate || today(), "Issue Date", true);
  if (!issuedTo || !requestedIssueLocation) throw new AppError("Issued To and Issue Location are required.");
  return withTransaction(async (connection) => {
    const issueLocation = await resolveActiveIssueLocation(connection, user.tenantId, requestedIssueLocation);
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["AVAILABLE"]);
    if (!usableConditions.has(gauge.calibrationCondition)) throw new AppError("Only calibrated gauges that are on time, due soon, or due today can be issued.", 409);
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "ISSUED", currentLocation: issueLocation, assignedTo: issuedTo }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "ISSUED", { eventDate: issueDate, operationalStatus: "ISSUED", locationName: issueLocation, assignedTo: issuedTo, remarks: clean(raw.remarks) });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function returnGauge(gaugeMasterId, raw, user) {
  const returnLocation = clean(raw.returnLocation);
  // A return records the physical handover happening now; do not allow a backdated or future return.
  const returnDate = today();
  if (!returnLocation) throw new AppError("Return Location is required.");
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["ISSUED"]);
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "AVAILABLE", currentLocation: returnLocation, assignedTo: null }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "RETURNED", { eventDate: returnDate, operationalStatus: "AVAILABLE", locationName: returnLocation, remarks: clean(raw.remarks) });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function retireGauge(gaugeMasterId, raw, user) {
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["AVAILABLE"]);
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, {
      operationalStatus: "RETIRED", currentLocation: gauge.currentLocation, assignedTo: null,
    }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "RETIRED", {
      operationalStatus: "RETIRED", locationName: gauge.currentLocation,
      remarks: clean(raw.remarks) || "Gauge Master record retired.",
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MASTER",
      entityId: gauge.gaugeMasterId, action: "GAUGE_RETIRED", newValue: { gaugeId: gauge.gaugeId }, performedBy: user.userCode });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function bulkIssueGauges(raw, user) {
  const gaugeMasterIds = normalizeBatchGaugeIds(raw.gaugeMasterIds);
  const issuedTo = clean(raw.issuedTo);
  const requestedIssueLocation = clean(raw.issueLocation);
  const issueDate = validDate(raw.issueDate || today(), "Issue Date", true);
  const remarks = clean(raw.remarks);
  if (!issuedTo || !requestedIssueLocation) throw new AppError("Issued To and Issue Location are required.");

  return withTransaction(async (connection) => {
    const issueLocation = await resolveActiveIssueLocation(connection, user.tenantId, requestedIssueLocation);
    const gauges = [];
    for (const gaugeMasterId of gaugeMasterIds) gauges.push(await loadGaugeForUpdate(connection, gaugeMasterId, user));
    for (const gauge of gauges) {
      assertLifecycle(gauge, ["AVAILABLE"]);
      if (!usableConditions.has(gauge.calibrationCondition)) {
        throw new AppError(`${gauge.gaugeId} cannot be issued because its calibration is ${gauge.calibrationCondition.replaceAll("_", " ").toLowerCase()}.`, 409);
      }
    }

    const financialYear = getFinancialYear(new Date(`${issueDate}T00:00:00`));
    await ensureDocumentSequence(connection, "GAUGE_ISSUE", financialYear, "GI");
    const movementNumber = await getNextDocumentNumber(connection, "GAUGE_ISSUE", financialYear);
    const gaugeMovementBatchId = await repository.insertMovementBatch(connection, {
      tenantId: user.tenantId, movementNumber, movementType: "ISSUE", movementDate: issueDate,
      issuedTo, locationName: issueLocation, remarks, createdBy: user.userCode,
    });

    for (const gauge of gauges) {
      await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "ISSUED", currentLocation: issueLocation, assignedTo: issuedTo }, user.userCode);
      await addHistory(connection, user, gauge.gaugeMasterId, "ISSUED", {
        gaugeMovementBatchId, eventDate: issueDate, operationalStatus: "ISSUED", locationName: issueLocation, assignedTo: issuedTo, remarks,
      });
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MOVEMENT_BATCH",
      entityId: gaugeMovementBatchId, action: "GAUGES_BULK_ISSUED", newValue: { movementNumber, gaugeMasterIds, issuedTo, issueLocation, issueDate }, performedBy: user.userCode });
    return { gaugeMovementBatchId, movementNumber, movementType: "ISSUE", gaugeCount: gauges.length, gaugeIds: gauges.map((gauge) => gauge.gaugeId) };
  });
}

export async function bulkReturnGauges(raw, user) {
  const gaugeMasterIds = normalizeBatchGaugeIds(raw.gaugeMasterIds);
  const returnLocation = clean(raw.returnLocation);
  const returnDate = today();
  const remarks = clean(raw.remarks);
  if (!returnLocation) throw new AppError("Return Location is required.");

  return withTransaction(async (connection) => {
    const gauges = [];
    for (const gaugeMasterId of gaugeMasterIds) gauges.push(await loadGaugeForUpdate(connection, gaugeMasterId, user));
    for (const gauge of gauges) assertLifecycle(gauge, ["ISSUED"]);
    const issuedLocations = new Set(gauges.map((gauge) => String(gauge.currentLocation || "").trim()));
    const issuedTo = new Set(gauges.map((gauge) => String(gauge.assignedTo || "").trim()));
    if (issuedLocations.size !== 1 || issuedTo.size !== 1) {
      throw new AppError("Bulk return is allowed only for gauges issued to the same location and user.", 409);
    }

    const financialYear = getFinancialYear(new Date(`${returnDate}T00:00:00`));
    await ensureDocumentSequence(connection, "GAUGE_RETURN", financialYear, "GR");
    const movementNumber = await getNextDocumentNumber(connection, "GAUGE_RETURN", financialYear);
    const gaugeMovementBatchId = await repository.insertMovementBatch(connection, {
      tenantId: user.tenantId, movementNumber, movementType: "RETURN", movementDate: returnDate,
      locationName: returnLocation, remarks, createdBy: user.userCode,
    });

    for (const gauge of gauges) {
      await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "AVAILABLE", currentLocation: returnLocation, assignedTo: null }, user.userCode);
      await addHistory(connection, user, gauge.gaugeMasterId, "RETURNED", {
        gaugeMovementBatchId, eventDate: returnDate, operationalStatus: "AVAILABLE", locationName: returnLocation, remarks,
      });
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MOVEMENT_BATCH",
      entityId: gaugeMovementBatchId, action: "GAUGES_BULK_RETURNED", newValue: { movementNumber, gaugeMasterIds, returnLocation, returnDate }, performedBy: user.userCode });
    return { gaugeMovementBatchId, movementNumber, movementType: "RETURN", gaugeCount: gauges.length, gaugeIds: gauges.map((gauge) => gauge.gaugeId) };
  });
}

export async function bulkCollectForCalibration(raw, user) {
  const gaugeMasterIds = normalizeBatchGaugeIds(raw.gaugeMasterIds);
  const collectionLocation = clean(raw.collectionLocation) || "Collected for Calibration";
  const collectionDate = validDate(raw.collectionDate || today(), "Collection Date", true);
  const remarks = clean(raw.remarks);

  return withTransaction(async (connection) => {
    const gauges = [];
    for (const gaugeMasterId of gaugeMasterIds) gauges.push(await loadGaugeForUpdate(connection, gaugeMasterId, user));
    for (const gauge of gauges) assertLifecycle(gauge, ["AVAILABLE"]);

    for (const gauge of gauges) {
      await repository.updateLifecycle(connection, gauge.gaugeMasterId, {
        operationalStatus: "COLLECTED_FOR_CALIBRATION", currentLocation: collectionLocation, assignedTo: null,
      }, user.userCode);
      await addHistory(connection, user, gauge.gaugeMasterId, "COLLECTED_FOR_CALIBRATION", {
        eventDate: collectionDate, operationalStatus: "COLLECTED_FOR_CALIBRATION", locationName: collectionLocation, remarks,
      });
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MASTER",
      entityId: gauges[0].gaugeMasterId, action: "GAUGES_BULK_COLLECTED_FOR_CALIBRATION",
      newValue: { gaugeMasterIds, collectionLocation, collectionDate, remarks }, performedBy: user.userCode });
    return { gaugeCount: gauges.length, gaugeIds: gauges.map((gauge) => gauge.gaugeId), collectionLocation, collectionDate };
  });
}

export async function collectForCalibration(gaugeMasterId, raw, user) {
  const collectionLocation = clean(raw.collectionLocation) || "Collected for Calibration";
  const collectionDate = validDate(raw.collectionDate || today(), "Collection Date", true);
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["AVAILABLE"]);
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "COLLECTED_FOR_CALIBRATION", currentLocation: collectionLocation, assignedTo: null }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "COLLECTED_FOR_CALIBRATION", { eventDate: collectionDate, operationalStatus: "COLLECTED_FOR_CALIBRATION", locationName: collectionLocation, remarks: clean(raw.remarks) });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function startCalibration(gaugeMasterId, raw, user) {
  const calibrationLocation = clean(raw.calibrationLocation) || "Under Calibration";
  const calibrationAgency = clean(raw.calibrationAgency);
  const startDate = validDate(raw.startDate || today(), "Calibration Start Date", true);
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["COLLECTED_FOR_CALIBRATION"]);
    await assertCalibrationAgencySupplier(connection, calibrationAgency);
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "UNDER_CALIBRATION", currentLocation: calibrationLocation, assignedTo: null }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "CALIBRATION_STARTED", { eventDate: startDate, operationalStatus: "UNDER_CALIBRATION", locationName: calibrationLocation, calibrationAgency, remarks: clean(raw.remarks) });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function recordCalibration(gaugeMasterId, raw, user) {
  const result = String(raw.calibrationResult || "").toUpperCase();
  if (!["PASS", "FAIL"].includes(result)) throw new AppError("Calibration Result must be Pass or Fail.");
  const calibrationDate = validDate(raw.calibrationDate || today(), "Calibration Date", true);
  const returnLocation = clean(raw.returnLocation);
  if (!returnLocation) throw new AppError("Return or holding location is required.");
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["UNDER_CALIBRATION", "UNDER_SERVICE"]);
    const operationalStatus = result === "PASS" ? "AVAILABLE" : "REJECTED";
    const requestedCalibrationAgency = clean(raw.calibrationAgency);
    await assertCalibrationAgencySupplier(connection, requestedCalibrationAgency);
    const calibrationAgency = requestedCalibrationAgency || gauge.calibrationAgency;
    const calibrationDueDate = result === "PASS"
      ? calculateCalibrationDueDate(calibrationDate, gauge.calibrationFrequencyMonths)
      : null;
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus, currentLocation: returnLocation, assignedTo: null, lastCalibrationDate: calibrationDate, calibrationDueDate, calibrationAgency }, user.userCode);
    const certificateFile = raw.certificateFile || null;
    await addHistory(connection, user, gauge.gaugeMasterId, "CALIBRATION_COMPLETED", { eventDate: calibrationDate, operationalStatus, locationName: returnLocation, calibrationAgency, calibrationResult: result, calibrationDueDate, certificateNumber: clean(raw.certificateNumber), certificateFile, remarks: clean(raw.remarks) });
    await recordAudit({ connection, tenantId: user.tenantId, module: "GAUGE", entityType: "GAUGE_MASTER", entityId: gauge.gaugeMasterId, action: `CALIBRATION_${result}`, newValue: { calibrationDate, calibrationDueDate, certificateNumber: clean(raw.certificateNumber), certificateFileName: certificateFile?.fileName || null }, performedBy: user.userCode });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}

export async function startService(gaugeMasterId, raw, user) {
  const serviceLocation = clean(raw.serviceLocation) || "Under Service";
  const serviceDate = validDate(raw.serviceDate || today(), "Service Start Date", true);
  return withTransaction(async (connection) => {
    const gauge = await loadGaugeForUpdate(connection, gaugeMasterId, user);
    assertLifecycle(gauge, ["REJECTED"]);
    await repository.updateLifecycle(connection, gauge.gaugeMasterId, { operationalStatus: "UNDER_SERVICE", currentLocation: serviceLocation, assignedTo: null }, user.userCode);
    await addHistory(connection, user, gauge.gaugeMasterId, "SERVICE_STARTED", { eventDate: serviceDate, operationalStatus: "UNDER_SERVICE", locationName: serviceLocation, remarks: clean(raw.remarks) });
    return repository.getGaugeById(gauge.gaugeMasterId, user.tenantId, connection);
  });
}
