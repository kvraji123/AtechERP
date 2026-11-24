import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { completeToolReturnGateEntry } from "../gate-entry/gate-entry.service.js";
import * as repository from "./tooling.repository.js";

const TOOL_CRIB = { warehouseCode: "Tool Crib", binLocation: "Tooling" };
const productionWarehouse = "Production Stores";
const stockStatuses = new Set(["AVAILABLE", "HOLD", "REGRIND_REQUIRED"]);
const returnConditions = new Set(["AVAILABLE", "DAMAGED_REGRIND", "LOST", "SCRAP"]);
const rejectionActions = new Set(["SCRAP", "REGRIND_AGAIN", "RETURN_TO_TOOL_CRIB"]);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const clean = (value, max = 160) => String(value ?? "").trim().slice(0, max);
const positive = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new AppError(`${label} must be greater than zero.`);
  return Number(number.toFixed(3));
};
const numericOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : null;
};
const dateOrToday = (value) => {
  const date = clean(value || todayInAppTimeZone(), 10);
  if (!isoDate.test(date)) throw new AppError("Enter a valid transaction date.");
  return date;
};

function movementContext(user) {
  return { tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId || "", userCode: user.userCode };
}

async function assertLocation(connection, tenantId, warehouseCode, binLocation, requiredWarehouse = "") {
  const locations = await repository.listToolingLocations(tenantId, connection);
  const matching = locations.find((row) => row.warehouseName === warehouseCode && row.locationName === binLocation);
  if (!matching || (requiredWarehouse && warehouseCode !== requiredWarehouse)) {
    throw new AppError(`Choose an active ${requiredWarehouse || "Tooling"} Location Master value.`, 400);
  }
  return matching;
}

async function assertToolItem(connection, tenantId, itemId) {
  const item = await repository.getToolItem(connection, tenantId, itemId);
  if (!item) throw new AppError("Choose an active Tools & Fixtures tool item.", 400);
  return item;
}

async function decreaseAvailableToolStock(connection, context, itemId, quantity, source, reference, movementType, extra = {}) {
  const controlBalance = await repository.decreaseToolBalance(connection, {
    ...context, itemId, quantity, warehouseCode: source.warehouseCode, binLocation: source.binLocation,
    stockStatus: extra.sourceStockStatus || "AVAILABLE",
  });
  if (!controlBalance) throw new AppError("Insufficient available Tooling quantity at the selected source location.", 409);
  const inventoryBalance = await repository.decreaseInventoryBalance(connection, {
    ...context, itemId, quantity, warehouseCode: source.warehouseCode, binLocation: source.binLocation,
  });
  if (inventoryBalance === null) throw new AppError("The linked inventory balance is insufficient. Reconcile Tooling stock before continuing.", 409);
  await repository.insertInventoryTransaction(connection, {
    ...context, itemId, transactionType: movementType, movementDate: extra.movementDate,
    warehouseCode: source.warehouseCode, binLocation: source.binLocation, quantityOut: quantity,
    balanceAfter: inventoryBalance.balanceAfter, remarks: extra.remarks || reference,
  });
  const movementId = extra.recordToolingMovement === false ? null : await repository.insertMovement(connection, {
    ...context, itemId, movementType, movementDate: extra.movementDate, quantity,
    fromWarehouseCode: source.warehouseCode, fromBinLocation: source.binLocation,
    referenceNumber: reference, ...extra,
  });
  return { inventoryStockBalanceId: inventoryBalance.inventoryStockBalanceId, movementId };
}

async function increaseToolStock(connection, context, itemId, quantity, destination, reference, movementType, extra = {}) {
  const controlBalance = await repository.increaseToolBalance(connection, {
    ...context, itemId, quantity, warehouseCode: destination.warehouseCode, binLocation: destination.binLocation,
    stockStatus: extra.destinationStockStatus || "AVAILABLE",
  });
  const inventoryBalanceAfter = await repository.increaseInventoryBalance(connection, {
    ...context, itemId, quantity, warehouseCode: destination.warehouseCode, binLocation: destination.binLocation,
  });
  await repository.insertInventoryTransaction(connection, {
    ...context, itemId, transactionType: movementType, movementDate: extra.movementDate,
    warehouseCode: destination.warehouseCode, binLocation: destination.binLocation, quantityIn: quantity,
    balanceAfter: inventoryBalanceAfter, remarks: extra.remarks || reference,
  });
  return repository.insertMovement(connection, {
    ...context, itemId, movementType, movementDate: extra.movementDate, quantity,
    toWarehouseCode: destination.warehouseCode, toBinLocation: destination.binLocation,
    referenceNumber: reference, ...extra,
  });
}

function normalizeTransferLines(raw, quantityLabel) {
  const sourceLines = Array.isArray(raw.items) ? raw.items : [{ itemId: raw.itemId, quantity: raw.quantity }];
  if (!sourceLines.length) throw new AppError("Add at least one tool item and quantity.", 400);
  const itemIds = new Set();
  const lines = sourceLines.map((line) => {
    const itemId = Number(line?.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) throw new AppError("Choose a valid tool item.", 400);
    if (itemIds.has(itemId)) throw new AppError("Each tool item can be entered only once in a transaction.", 400);
    itemIds.add(itemId);
    return { itemId, quantity: positive(line?.quantity, quantityLabel) };
  });

  // Always lock and update balances in item order. This keeps concurrent bulk
  // transactions from locking the same tools in opposite orders.
  return lines.sort((left, right) => left.itemId - right.itemId);
}

async function nextToolReference(connection, sequenceKey, prefix, movementDate) {
  const financialYear = getFinancialYear(new Date(`${movementDate}T00:00:00`));
  await ensureDocumentSequence(connection, sequenceKey, financialYear, prefix);
  return getNextDocumentNumber(connection, sequenceKey, financialYear);
}

export async function getDashboard(user) { return repository.dashboard(user.tenantId); }
export async function listToolItems(query, user) { return repository.listToolItems(user.tenantId, { search: clean(query.search, 120), stockOnly: String(query.stockOnly || "").toUpperCase() === "Y" }); }
export async function listMovements(query, user) { return repository.listMovements(user.tenantId, { search: clean(query.search, 120), limit: Number(query.limit || 100) }); }
export async function listIssuedTools(query, user) {
  return repository.listIssuedTools(user.tenantId, { search: clean(query.search, 120) });
}
export async function listRegrindBatches(user) { return repository.listRegrindBatches(user.tenantId); }

export async function getRegrindBatch(id, user) {
  const batch = await repository.findRegrindBatch(undefined, user.tenantId, Number(id));
  if (!batch) throw new AppError("Tool regrinding DC was not found.", 404);
  return batch;
}

export async function getLookups(user) {
  const [locations, machines, operations, suppliers] = await Promise.all([
    repository.listToolingLocations(user.tenantId), repository.listMachines(), repository.listOperations(),
    repository.listActiveSuppliers(),
  ]);
  return {
    toolCribLocations: locations.filter((row) => row.warehouseName === "Tool Crib"),
    productionLocations: locations.filter((row) => row.warehouseName === productionWarehouse),
    machines, operations, suppliers,
  };
}

export async function listIssuedReturnOptions(itemId, user) {
  const normalizedItemId = Number(itemId);
  if (!Number.isInteger(normalizedItemId) || normalizedItemId <= 0) {
    throw new AppError("Choose a tool item to load its issued locations and machines.", 400);
  }

  const [issuedRows, locations, machines] = await Promise.all([
    repository.listIssuedReturnOptions(user.tenantId, normalizedItemId),
    repository.listToolingLocations(user.tenantId),
    repository.listMachines(),
  ]);
  const activeProductionLocations = locations.filter((location) =>
    location.warehouseName === productionWarehouse
  );
  const issuedLocationNames = new Set(issuedRows.map((row) => row.locationName));
  const activeLocations = activeProductionLocations.filter((location) =>
    issuedLocationNames.has(location.locationName)
  );
  const machineNames = new Map(machines.map((machine) => [machine.machineCode, machine.machineName]));
  const visibleLocationNames = new Set(activeLocations.map((location) => location.locationName));
  const visibleRows = issuedRows.filter((row) => visibleLocationNames.has(row.locationName));
  const locationQuantities = new Map();
  for (const row of visibleRows) {
    locationQuantities.set(
      row.locationName,
      Number(locationQuantities.get(row.locationName) || 0) + Number(row.issuedQuantity || 0)
    );
  }

  return {
    locations: activeLocations.map((location) => ({
      ...location,
      issuedQuantity: locationQuantities.get(location.locationName) || 0,
    })),
    machines: visibleRows.map((row) => ({
      machineCode: row.machineReference,
      machineName: machineNames.get(row.machineReference) || row.machineReference,
      locationName: row.locationName,
      issuedQuantity: row.issuedQuantity,
    })),
  };
}

export async function recordGrnToolReceipt(connection, { grn, item, location, quantity, postingDate, user }) {
  if (String(item.item_group_code || "").toUpperCase() !== "TL") return false;
  const context = movementContext(user);
  if (await repository.hasGrnReceiptMovement(connection, user.tenantId, item.grn_item_id)) return true;
  await repository.increaseToolBalance(connection, {
    ...context, itemId: item.item_id, quantity, warehouseCode: location.warehouseCode, binLocation: location.binLocation,
    stockStatus: "AVAILABLE",
  });
  await repository.insertMovement(connection, {
    ...context, itemId: item.item_id, movementType: "GRN_RECEIPT", movementDate: postingDate, quantity,
    toWarehouseCode: location.warehouseCode, toBinLocation: location.binLocation,
    referenceNumber: grn.grn_number, grnId: grn.grn_id, grnItemId: item.grn_item_id,
    remarks: `Tool quantity received through ${grn.grn_number}`,
  });
  return true;
}

export async function issue(raw, user) {
  const lines = normalizeTransferLines(raw, "Issue quantity");
  const movementDate = dateOrToday(raw.movementDate);
  const destination = { warehouseCode: clean(raw.warehouseCode), binLocation: clean(raw.binLocation) };
  const machineReference = clean(raw.machineReference);
  const employeeReference = clean(raw.employeeReference);
  const operationReference = clean(raw.operationReference);
  const remarks = clean(raw.remarks, 1000);
  if (!machineReference || !employeeReference || !operationReference) throw new AppError("Machine, employee and operation are required for a tool issue.");
  return withTransaction(async (connection) => {
    const context = movementContext(user);
    await assertLocation(connection, user.tenantId, TOOL_CRIB.warehouseCode, TOOL_CRIB.binLocation, TOOL_CRIB.warehouseCode);
    await assertLocation(connection, user.tenantId, destination.warehouseCode, destination.binLocation, productionWarehouse);
    for (const line of lines) await assertToolItem(connection, user.tenantId, line.itemId);
    const reference = clean(raw.referenceNumber) || await nextToolReference(connection, "TOOL_ISSUE", "TIS", movementDate);
    for (const line of lines) {
      await decreaseAvailableToolStock(connection, context, line.itemId, line.quantity, TOOL_CRIB, reference, "ISSUE_TO_PRODUCTION", {
        movementDate, machineReference, employeeReference, operationReference, remarks, recordToolingMovement: false,
      });
      await increaseToolStock(connection, context, line.itemId, line.quantity, destination, reference, "ISSUE_TO_PRODUCTION", {
        movementDate, machineReference, employeeReference, operationReference, remarks,
        fromWarehouseCode: TOOL_CRIB.warehouseCode, fromBinLocation: TOOL_CRIB.binLocation,
      });
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "TOOLING", entityType: "TOOL_ISSUE", entityId: lines[0].itemId,
      action: "ISSUED_TO_PRODUCTION", newValue: { lines, destination, machineReference, employeeReference, operationReference, reference }, performedBy: user.userCode });
    return { referenceNumber: reference, itemCount: lines.length, totalQuantity: lines.reduce((total, line) => total + line.quantity, 0) };
  });
}

export async function returnFromProduction(raw, user) {
  const lines = normalizeTransferLines(raw, "Return quantity");
  const movementDate = dateOrToday(raw.movementDate);
  const returnCondition = clean(raw.returnCondition || "AVAILABLE").toUpperCase();
  const source = { warehouseCode: clean(raw.warehouseCode), binLocation: clean(raw.binLocation) };
  const machineReference = clean(raw.machineReference);
  const employeeReference = clean(raw.employeeReference);
  const remarks = clean(raw.remarks, 1000);
  if (!machineReference || !employeeReference) throw new AppError("Machine and employee are required for a tool return.");
  if (!returnConditions.has(returnCondition)) throw new AppError("Choose a valid tool return condition.");
  if (["LOST", "SCRAP"].includes(returnCondition) && !remarks) {
    throw new AppError("Remarks are required when recording a lost or scrapped tool.");
  }
  return withTransaction(async (connection) => {
    const context = movementContext(user);
    await assertLocation(connection, user.tenantId, source.warehouseCode, source.binLocation, productionWarehouse);
    await assertLocation(connection, user.tenantId, TOOL_CRIB.warehouseCode, TOOL_CRIB.binLocation, TOOL_CRIB.warehouseCode);
    for (const line of lines) {
      await assertToolItem(connection, user.tenantId, line.itemId);
      const issuedMachine = (await repository.listIssuedReturnOptions(user.tenantId, line.itemId, connection))
        .find((row) => row.locationName === source.binLocation && row.machineReference === machineReference);
      if (!issuedMachine || Number(issuedMachine.issuedQuantity) + 0.0001 < line.quantity) {
        throw new AppError("Return quantity exceeds the issued quantity for this machine and production location.", 409);
      }
    }
    const reference = clean(raw.referenceNumber) || await nextToolReference(connection, "TOOL_RETURN", "TRT", movementDate);
    const movementType = {
      AVAILABLE: "RETURN_FROM_PRODUCTION",
      DAMAGED_REGRIND: "RETURN_DAMAGED_REGRIND",
      LOST: "RETURN_LOST",
      SCRAP: "RETURN_SCRAP",
    }[returnCondition];
    const returnsToToolCrib = ["AVAILABLE", "DAMAGED_REGRIND"].includes(returnCondition);
    for (const line of lines) {
      await decreaseAvailableToolStock(connection, context, line.itemId, line.quantity, source, reference, movementType, {
        movementDate, machineReference, employeeReference, remarks, recordToolingMovement: !returnsToToolCrib,
      });
      if (returnsToToolCrib) {
        await increaseToolStock(connection, context, line.itemId, line.quantity, TOOL_CRIB, reference, movementType, {
          movementDate, machineReference, employeeReference, remarks,
          destinationStockStatus: returnCondition === "DAMAGED_REGRIND" ? "REGRIND_REQUIRED" : "AVAILABLE",
          fromWarehouseCode: source.warehouseCode, fromBinLocation: source.binLocation,
        });
      }
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "TOOLING", entityType: "TOOL_RETURN", entityId: lines[0].itemId,
      action: movementType, newValue: { lines, source, machineReference, employeeReference, returnCondition, reference, remarks }, performedBy: user.userCode });
    return { referenceNumber: reference, returnCondition, itemCount: lines.length, totalQuantity: lines.reduce((total, line) => total + line.quantity, 0) };
  });
}

function normalizeRegrindDispatch(raw) {
  const dispatchDate = dateOrToday(raw.dispatchDate);
  const supplierId = Number(raw.supplierId);
  const lines = Array.isArray(raw.items) ? raw.items : [];
  if (!supplierId) throw new AppError("Select a regrinding supplier.");
  if (!lines.length) throw new AppError("Add at least one tool item to the regrinding DC.");
  const uniqueItems = new Set();
  const normalizedItems = lines.map((line) => {
    const itemId = Number(line.itemId);
    const quantity = positive(line.quantity, "Dispatched quantity");
    const sourceStockStatus = clean(line.sourceStockStatus || "AVAILABLE").toUpperCase();
    if (!itemId || uniqueItems.has(itemId)) throw new AppError("Each tool item can be included only once in a regrinding DC.");
    if (!stockStatuses.has(sourceStockStatus) || sourceStockStatus === "HOLD") throw new AppError("Only available or regrind-required tools can be dispatched.");
    uniqueItems.add(itemId);
    return { itemId, quantity, sourceStockStatus };
  });
  const expectedReturnDate = clean(raw.expectedReturnDate, 10);
  if (expectedReturnDate && (!isoDate.test(expectedReturnDate) || expectedReturnDate < dispatchDate)) throw new AppError("Expected return date cannot be before the dispatch date.");
  return { dispatchDate, supplierId, normalizedItems, expectedReturnDate };
}

export async function createRegrindDispatchInTransaction(raw, user, connection, options = {}) {
  const { dispatchDate, supplierId, normalizedItems, expectedReturnDate } = normalizeRegrindDispatch(raw);
  const context = movementContext(user);
  const supplier = await repository.getActiveSupplier(connection, supplierId);
  if (!supplier) throw new AppError("Select an active Supplier Master record categorized for Tooling as the regrinding supplier.", 400);
  await assertLocation(connection, user.tenantId, TOOL_CRIB.warehouseCode, TOOL_CRIB.binLocation, TOOL_CRIB.warehouseCode);
  const financialYear = getFinancialYear(new Date(`${dispatchDate}T00:00:00`));
  await ensureDocumentSequence(connection, "TOOL_REGRIND_DC", financialYear, "TDC");
  const dcNumber = options.dcNumber || clean(raw.dcNumber, 80) || await getNextDocumentNumber(connection, "TOOL_REGRIND_DC", financialYear);
  const remarks = clean(raw.remarks, 1000);
  const batchId = await repository.insertRegrindBatch(connection, {
    ...context, dcNumber, dispatchDate, supplierName: supplier.supplierName, expectedReturnDate,
    courierVehicleReference: clean(raw.courierVehicleReference), dispatchWarehouseCode: TOOL_CRIB.warehouseCode,
    dispatchBinLocation: TOOL_CRIB.binLocation, materialOutwardDocumentId: options.materialOutwardDocumentId || null,
    remarks, userCode: user.userCode,
  });
  const dispatchedItems = [];
  for (const line of normalizedItems) {
    const item = await assertToolItem(connection, user.tenantId, line.itemId);
    const batchItemId = await repository.insertRegrindBatchItem(connection, { ...context, batchId, itemId: line.itemId, uomCode: item.uomCode, quantity: line.quantity });
    const source = await decreaseAvailableToolStock(connection, context, line.itemId, line.quantity, TOOL_CRIB, dcNumber, "REGRIND_DISPATCH", {
      movementDate: dispatchDate, sourceStockStatus: line.sourceStockStatus, toolingRegrindBatchId: batchId,
      toolingRegrindBatchItemId: batchItemId, remarks,
    });
    dispatchedItems.push({ ...item, quantity: line.quantity, inventoryStockBalanceId: source.inventoryStockBalanceId });
  }
  await recordAudit({ connection, tenantId: user.tenantId, module: "TOOLING", entityType: "TOOL_REGRIND_DC", entityId: batchId,
    action: "REGRIND_DISPATCHED", newValue: { dcNumber, supplierId, supplierName: supplier.supplierName, itemCount: normalizedItems.length, materialOutwardDocumentId: options.materialOutwardDocumentId || null }, performedBy: user.userCode });
  return { batch: await repository.findRegrindBatch(connection, user.tenantId, batchId), dispatchedItems };
}

export async function dispatchRegrind() {
  throw new AppError("Create Tool Regrinding DCs from GRN Outward so the dispatch document can be viewed and printed.", 409);
}

export async function receiveRegrind(id, raw, user) {
  const receiptDate = dateOrToday(raw.receiptDate);
  const lines = Array.isArray(raw.items) ? raw.items : [];
  const gateEntryId = Number(raw.gateEntryId);
  const returnRemarks = clean(raw.remarks, 1000);
  if (!Number.isSafeInteger(gateEntryId) || gateEntryId < 1) {
    throw new AppError("Select the completed Tool Return Gate Entry before receiving a regrinding DC.");
  }
  return withTransaction(async (connection) => {
    await completeToolReturnGateEntry(connection, gateEntryId, user);
    const batch = await repository.findRegrindBatch(connection, user.tenantId, Number(id), true);
    if (!batch) throw new AppError("Tool regrinding DC was not found.", 404);
    if (batch.status !== "DISPATCHED") throw new AppError("Only dispatched regrinding DCs can be received.", 409);
    if (lines.length !== batch.items.length) throw new AppError("Enter received quantity for every dispatched tool item.");
    const submitted = new Map(lines.map((line) => [Number(line.batchItemId), positive(line.receivedQuantity, "Received quantity")]));
    for (const item of batch.items) {
      const quantity = submitted.get(Number(item.toolingRegrindBatchItemId));
      if (!quantity || quantity > Number(item.dispatchedQuantity) + 0.0001) throw new AppError(`Received quantity cannot exceed dispatched quantity for ${item.itemCode}.`);
    }
    const financialYear = getFinancialYear(new Date(`${receiptDate}T00:00:00`));
    await ensureDocumentSequence(connection, "TOOL_REGRIND_RETURN_GRN", financialYear, "TRGN");
    const returnGrnNumber = clean(raw.returnGrnNumber, 80) || await getNextDocumentNumber(connection, "TOOL_REGRIND_RETURN_GRN", financialYear);
    await repository.updateRegrindReceipt(connection, { tenantId: user.tenantId, batchId: Number(id), receiptDate,
      receiptReference: clean(raw.receiptReference), returnGrnNumber, gateEntryId, userCode: user.userCode,
      items: batch.items.map((item) => ({ batchItemId: item.toolingRegrindBatchItemId, receivedQuantity: submitted.get(Number(item.toolingRegrindBatchItemId)) })),
    });
    const context = movementContext(user);
    for (const item of batch.items) await repository.insertMovement(connection, {
      ...context, itemId: item.itemId, movementType: "REGRIND_RECEIPT", movementDate: receiptDate,
      quantity: submitted.get(Number(item.toolingRegrindBatchItemId)), referenceNumber: clean(raw.receiptReference) || batch.dcNumber,
      toolingRegrindBatchId: Number(id), toolingRegrindBatchItemId: item.toolingRegrindBatchItemId,
      remarks: returnRemarks || `Received against regrinding DC ${batch.dcNumber}`,
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "TOOLING", entityType: "TOOL_REGRIND_DC", entityId: Number(id),
      action: "REGRIND_RECEIVED", newValue: { receiptDate, returnGrnNumber, gateEntryId, remarks: returnRemarks }, performedBy: user.userCode });
    return repository.findRegrindBatch(connection, user.tenantId, Number(id));
  });
}

function normalizeMeasurements(raw, plan, itemCode) {
  if (!plan.length) return [];
  const submitted = Array.isArray(raw) ? raw : [];
  if (submitted.length !== plan.length) throw new AppError(`Enter every inspection parameter for ${itemCode}.`);
  return plan.map((parameter) => {
    const input = submitted.find((row) => Number(row.itemInspectionCharacteristicId) === Number(parameter.itemInspectionCharacteristicId));
    if (!input || !clean(input.actualValue, 160)) throw new AppError(`Enter the measured value for ${parameter.characteristicName} on ${itemCode}.`);
    const numeric = numericOrNull(input.actualValue);
    const hasNumericLimit = parameter.lsl !== null || parameter.usl !== null;
    if (hasNumericLimit && numeric === null) throw new AppError(`${parameter.characteristicName} on ${itemCode} requires a numeric measured value.`);
    const passed = !hasNumericLimit || ((parameter.lsl === null || numeric >= Number(parameter.lsl)) && (parameter.usl === null || numeric <= Number(parameter.usl)));
    return { ...parameter, actualValue: clean(input.actualValue, 160), inspectionResult: passed ? "PASS" : "FAIL", remarks: clean(input.remarks, 1000) };
  });
}

export async function inspectRegrind(id, raw, user) {
  const inspectionDate = dateOrToday(raw.inspectionDate);
  const lines = Array.isArray(raw.items) ? raw.items : [];
  return withTransaction(async (connection) => {
    const batch = await repository.findRegrindBatch(connection, user.tenantId, Number(id), true);
    if (!batch) throw new AppError("Tool regrinding DC was not found.", 404);
    if (batch.status !== "RECEIVED_PENDING_INSPECTION") throw new AppError("Receive the regrinding DC before inspection.", 409);
    if (lines.length !== batch.items.length) throw new AppError("Complete inspection for every received tool item.");
    await assertLocation(connection, user.tenantId, TOOL_CRIB.warehouseCode, TOOL_CRIB.binLocation, TOOL_CRIB.warehouseCode);
    const context = movementContext(user);
    for (const batchItem of batch.items) {
      const input = lines.find((line) => Number(line.batchItemId) === Number(batchItem.toolingRegrindBatchItemId));
      if (!input) throw new AppError("A regrinding inspection item is missing.");
      const acceptedQuantity = Number(Number(input.acceptedQuantity || 0).toFixed(3));
      const rejectedQuantity = Number(Number(input.rejectedQuantity || 0).toFixed(3));
      if (acceptedQuantity < 0 || rejectedQuantity < 0 || Math.abs(acceptedQuantity + rejectedQuantity - Number(batchItem.receivedQuantity)) > 0.0001) {
        throw new AppError(`Accepted and rejected quantities must equal the received quantity for ${batchItem.itemCode}.`);
      }
      const plan = await repository.listItemInspectionPlan(connection, batchItem.itemId);
      if (!plan.length) throw new AppError(`Define an inspection parameter before inspecting ${batchItem.itemCode}.`);
      const measurements = normalizeMeasurements(input.measurements, plan, batchItem.itemCode);
      const measurementFailed = measurements.some((measurement) => measurement.inspectionResult === "FAIL");
      if (measurementFailed && acceptedQuantity > 0) throw new AppError(`${batchItem.itemCode} has a measured value outside its specified tolerance and cannot be accepted.`);
      const rejectionAction = rejectedQuantity > 0 ? clean(input.rejectionAction).toUpperCase() : "";
      if (rejectedQuantity > 0 && !rejectionActions.has(rejectionAction)) throw new AppError(`Choose the action for rejected ${batchItem.itemCode} quantity.`);
      await repository.replaceInspectionMeasurements(connection, { tenantId: user.tenantId, batchItemId: batchItem.toolingRegrindBatchItemId, measurements, userCode: user.userCode });
      await repository.updateRegrindInspectionItem(connection, { tenantId: user.tenantId, batchItemId: batchItem.toolingRegrindBatchItemId,
        acceptedQuantity, rejectedQuantity, measuredValue: numericOrNull(input.measuredValue ?? measurements[0]?.actualValue),
        inspectionRemarks: clean(input.inspectionRemarks, 1000), rejectionAction: rejectionAction || null, userCode: user.userCode });
      if (acceptedQuantity > 0) {
        await increaseToolStock(connection, context, batchItem.itemId, acceptedQuantity, TOOL_CRIB, batch.dcNumber, "REGRIND_ACCEPTED", {
          movementDate: inspectionDate, toolingRegrindBatchId: Number(id), toolingRegrindBatchItemId: batchItem.toolingRegrindBatchItemId,
          remarks: clean(input.inspectionRemarks, 1000),
        });
        await repository.incrementRegrindMetric(connection, { tenantId: user.tenantId, itemId: batchItem.itemId, quantity: acceptedQuantity, regrindDate: inspectionDate, userCode: user.userCode });
      }
      if (rejectedQuantity > 0) {
        const actionMap = {
          SCRAP: { movementType: "REGRIND_REJECTED_SCRAP", status: null },
          REGRIND_AGAIN: { movementType: "REGRIND_REJECTED_REPEAT", status: "REGRIND_REQUIRED" },
          RETURN_TO_TOOL_CRIB: { movementType: "REGRIND_REJECTED_RETURN", status: "HOLD" },
        };
        const action = actionMap[rejectionAction];
        if (action.status) await increaseToolStock(connection, context, batchItem.itemId, rejectedQuantity, TOOL_CRIB, batch.dcNumber, action.movementType, {
          movementDate: inspectionDate, destinationStockStatus: action.status, toolingRegrindBatchId: Number(id),
          toolingRegrindBatchItemId: batchItem.toolingRegrindBatchItemId, remarks: clean(input.inspectionRemarks, 1000),
        });
        else await repository.insertMovement(connection, { ...context, itemId: batchItem.itemId, movementType: action.movementType,
          movementDate: inspectionDate, quantity: rejectedQuantity, referenceNumber: batch.dcNumber, toolingRegrindBatchId: Number(id),
          toolingRegrindBatchItemId: batchItem.toolingRegrindBatchItemId, remarks: clean(input.inspectionRemarks, 1000) });
      }
    }
    await repository.closeRegrindBatch(connection, user.tenantId, Number(id), user.userCode);
    await recordAudit({ connection, tenantId: user.tenantId, module: "TOOLING", entityType: "TOOL_REGRIND_DC", entityId: Number(id),
      action: "REGRIND_INSPECTED", newValue: { inspectionDate }, performedBy: user.userCode });
    return repository.findRegrindBatch(connection, user.tenantId, Number(id));
  });
}
