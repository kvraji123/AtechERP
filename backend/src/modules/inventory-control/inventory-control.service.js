import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import * as repository from "./inventory-control.repository.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const transferSourceStatuses = new Set(["AVAILABLE"]);
const returnSourceStatuses = new Set(["AVAILABLE", "ISSUED", "HOLD", "REWORK"]);
const rejectionSourceStatuses = new Set(["AVAILABLE", "ISSUED", "HOLD", "REWORK"]);
const returnTypes = new Set(["MTR", "PRR"]);
const rejectionTypes = new Set(["MATERIAL", "PROCESS"]);
const rejectionDispositions = new Set(["REWORK", "RELEASE", "SCRAP", "RETURN_TO_VENDOR", "RETURN_TO_CUSTOMER"]);
const transferOnlySubinventories = new Set(["WIP", "MTR", "PRR", "MATERIAL_REJECTION", "PROCESS_REJECTION", "SCRAP"]);

const clean = (value, size = 160) => String(value ?? "").trim().slice(0, size);
const required = (value, label, size = 160) => {
  const result = clean(value, size);
  if (!result) throw new AppError(`${label} is required.`, 400);
  return result;
};
const positive = (value, label = "Quantity") => {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new AppError(`${label} must be greater than zero.`, 400);
  return Number(result.toFixed(3));
};
const validDate = (value) => {
  const result = required(value, "Movement date", 10);
  if (!datePattern.test(result)) throw new AppError("Movement date must be a valid YYYY-MM-DD date.", 400);
  return result;
};

function readDestination(raw, defaults = {}) {
  return {
    warehouseCode: required(raw.destinationWarehouseCode ?? raw.warehouseCode ?? defaults.warehouseCode, "Destination warehouse", 80),
    subinventoryCode: required(raw.destinationSubinventoryCode ?? raw.subinventoryCode ?? defaults.subinventoryCode, "Destination sub-inventory", 40).toUpperCase(),
    binLocation: required(raw.destinationBinLocation ?? raw.binLocation ?? defaults.binLocation, "Destination bin location", 80),
    stockStatus: required(raw.destinationStockStatus ?? raw.stockStatus ?? defaults.stockStatus, "Destination stock status", 40).toUpperCase(),
    workOrderReference: clean(raw.destinationWorkOrderReference ?? raw.workOrderReference ?? defaults.workOrderReference, 120),
  };
}

async function validateDestination(connection, tenantId, destination) {
  const [locationOk, subinventoryOk, status] = await Promise.all([
    repository.assertLocation(connection, tenantId, destination.warehouseCode, destination.subinventoryCode, destination.binLocation),
    repository.assertSubinventory(connection, tenantId, destination.subinventoryCode),
    repository.getStockStatus(connection, tenantId, destination.stockStatus),
  ]);
  if (!locationOk) throw new AppError("Choose an active destination warehouse, sub-inventory, and bin from Location Master.", 400);
  if (!subinventoryOk) throw new AppError("Choose an active destination sub-inventory.", 400);
  if (!status) throw new AppError("Choose an active destination stock status.", 400);
}

async function nextNumber(connection, key, prefix, movementDate) {
  const financialYear = getFinancialYear(new Date(`${movementDate}T12:00:00`));
  await ensureDocumentSequence(connection, key, financialYear, prefix);
  return getNextDocumentNumber(connection, key, financialYear);
}

function balanceContext(balance) {
  return {
    itemId: Number(balance.item_id), ownerType: balance.stock_owner_type, ownerId: Number(balance.stock_owner_id || 0),
    batchSerialNumber: balance.batch_serial_number || "", companyId: balance.company_id, plantId: balance.plant_id || "",
  };
}

async function createDocument(connection, user, data) {
  const movementNumber = data.movementNumber || await nextNumber(connection, "INVENTORY_MOVE", "IMV", data.movementDate);
  const documentId = await repository.insertMovementDocument(connection, {
    tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId, movementNumber,
    movementType: data.movementType, movementDate: data.movementDate, workOrderReference: data.workOrderReference,
    sourceReferenceType: data.sourceReferenceType, sourceReferenceNumber: data.sourceReferenceNumber,
    remarks: data.remarks, userCode: user.userCode,
  });
  return { documentId, movementNumber };
}

async function moveFromBalance(connection, user, data) {
  const source = data.source;
  if (!data.allowedStatuses.has(String(source.stock_status || "").toUpperCase())) {
    throw new AppError(`Stock in ${source.stock_status} status cannot be used for ${data.movementType.replaceAll("_", " ").toLowerCase()}.`, 409);
  }
  if (data.destination.warehouseCode === source.warehouse_code
    && data.destination.subinventoryCode === source.sub_inventory_code
    && data.destination.binLocation === source.bin_location
    && data.destination.stockStatus === source.stock_status
    && data.destination.workOrderReference === (source.work_order_reference || "")) {
    throw new AppError("Source and destination inventory controls are identical.", 400);
  }
  const decremented = await repository.decreaseBalance(connection, source.inventory_stock_balance_id, data.quantity, user.userCode);
  if (!decremented) throw new AppError("Insufficient available quantity in the selected source balance.", 409);
  const destination = await repository.increaseBalance(connection, {
    tenantId: user.tenantId, companyId: source.company_id, plantId: source.plant_id || "", itemId: source.item_id,
    warehouseCode: data.destination.warehouseCode, subinventoryCode: data.destination.subinventoryCode,
    binLocation: data.destination.binLocation, stockStatus: data.destination.stockStatus,
    batchSerialNumber: source.batch_serial_number || "", workOrderReference: data.destination.workOrderReference,
    quantity: data.quantity, userCode: user.userCode, ownerType: source.stock_owner_type, ownerId: source.stock_owner_id,
  });
  const sourceAfter = Number(source.quantity_on_hand) - data.quantity;
  await repository.insertMovementLine(connection, {
    documentId: data.documentId, lineNumber: data.lineNumber, ...balanceContext(source), quantity: data.quantity,
    workOrderReference: data.destination.workOrderReference || source.work_order_reference || "",
    fromBalanceId: source.inventory_stock_balance_id, fromWarehouseCode: source.warehouse_code,
    fromSubinventoryCode: source.sub_inventory_code, fromBinLocation: source.bin_location, fromStockStatus: source.stock_status,
    toBalanceId: destination.id, toWarehouseCode: data.destination.warehouseCode,
    toSubinventoryCode: data.destination.subinventoryCode, toBinLocation: data.destination.binLocation,
    toStockStatus: data.destination.stockStatus, remarks: data.remarks,
  });
  await repository.insertLedgerTransaction(connection, {
    tenantId: user.tenantId, companyId: source.company_id, plantId: source.plant_id, documentId: data.documentId,
    transactionType: `${data.movementType}_OUT`, transactionDate: data.movementDate, itemId: source.item_id,
    warehouseCode: source.warehouse_code, subinventoryCode: source.sub_inventory_code, binLocation: source.bin_location,
    stockStatus: source.stock_status, batchSerialNumber: source.batch_serial_number,
    workOrderReference: source.work_order_reference || "", quantityOut: data.quantity, balanceAfter: sourceAfter,
    remarks: data.remarks, userCode: user.userCode, ownerType: source.stock_owner_type, ownerId: source.stock_owner_id,
  });
  await repository.insertLedgerTransaction(connection, {
    tenantId: user.tenantId, companyId: source.company_id, plantId: source.plant_id, documentId: data.documentId,
    transactionType: `${data.movementType}_IN`, transactionDate: data.movementDate, itemId: source.item_id,
    warehouseCode: data.destination.warehouseCode, subinventoryCode: data.destination.subinventoryCode,
    binLocation: data.destination.binLocation, stockStatus: data.destination.stockStatus,
    batchSerialNumber: source.batch_serial_number, workOrderReference: data.destination.workOrderReference,
    quantityIn: data.quantity, balanceAfter: destination.quantityOnHand, remarks: data.remarks, userCode: user.userCode,
    ownerType: source.stock_owner_type, ownerId: source.stock_owner_id,
  });
  return { source, destinationBalanceId: destination.id, destinationQuantity: destination.quantityOnHand };
}

function baseMovement(raw, type) {
  return {
    sourceBalanceId: Number(raw.sourceBalanceId), quantity: positive(raw.quantity), movementDate: validDate(raw.movementDate),
    workOrderReference: clean(raw.workOrderReference, 120), referenceNumber: clean(raw.referenceNumber, 160),
    remarks: required(raw.remarks, "Remarks", 1000), movementType: type,
  };
}

export async function lookups(user) { return repository.listLookups(user.tenantId); }
export async function balances(query, user) {
  return repository.listBalances({ tenantId: user.tenantId, search: clean(query.search, 120),
    ownerType: clean(query.ownerType, 16).toUpperCase(), workOrderReference: clean(query.workOrderReference, 120), limit: query.limit });
}
export async function rejectionCases(query, user) {
  return repository.listRejections({ tenantId: user.tenantId, status: clean(query.status, 30).toUpperCase(), limit: query.limit });
}

export async function transfer(raw, user) {
  const input = baseMovement(raw, "INTERNAL_TRANSFER");
  if (!Number.isSafeInteger(input.sourceBalanceId) || input.sourceBalanceId < 1) throw new AppError("Select a valid source stock balance.", 400);
  const destination = readDestination(raw, { stockStatus: "AVAILABLE" });
  if (destination.stockStatus !== "AVAILABLE" || transferOnlySubinventories.has(destination.subinventoryCode)) {
    throw new AppError("Use the controlled production, return, rejection, or scrap actions for that destination state.", 400);
  }
  return withTransaction(async (connection) => {
    await validateDestination(connection, user.tenantId, destination);
    const source = await repository.getBalanceForUpdate(connection, user.tenantId, input.sourceBalanceId);
    if (!source) throw new AppError("Source stock balance was not found.", 404);
    const document = await createDocument(connection, user, { ...input, ...destination, workOrderReference: destination.workOrderReference,
      sourceReferenceType: "MANUAL_TRANSFER", sourceReferenceNumber: input.referenceNumber });
    const result = await moveFromBalance(connection, user, { ...input, ...document, source, destination, allowedStatuses: transferSourceStatuses, lineNumber: 1 });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "INVENTORY_MOVEMENT",
      entityId: document.documentId, action: "INTERNAL_TRANSFER_POSTED", newValue: { sourceBalanceId: input.sourceBalanceId, quantity: input.quantity, destination }, performedBy: user.userCode });
    return { movementDocumentId: document.documentId, movementNumber: document.movementNumber, destinationBalanceId: result.destinationBalanceId };
  });
}

export async function issueToProduction(raw, user) {
  const input = baseMovement(raw, "PRODUCTION_ISSUE");
  input.workOrderReference = required(raw.workOrderReference, "Work order / job card reference", 120);
  if (!Number.isSafeInteger(input.sourceBalanceId) || input.sourceBalanceId < 1) throw new AppError("Select a valid source stock balance.", 400);
  const destination = readDestination(raw, { subinventoryCode: "WIP", stockStatus: "ISSUED", workOrderReference: input.workOrderReference });
  destination.workOrderReference = input.workOrderReference;
  if (destination.subinventoryCode !== "WIP" || destination.stockStatus !== "ISSUED") {
    throw new AppError("Production issue must post to WIP in ISSUED status.", 400);
  }
  return withTransaction(async (connection) => {
    await validateDestination(connection, user.tenantId, destination);
    const source = await repository.getBalanceForUpdate(connection, user.tenantId, input.sourceBalanceId);
    if (!source) throw new AppError("Source stock balance was not found.", 404);
    const document = await createDocument(connection, user, { ...input, workOrderReference: input.workOrderReference,
      sourceReferenceType: "WORK_ORDER", sourceReferenceNumber: input.referenceNumber || input.workOrderReference });
    const result = await moveFromBalance(connection, user, { ...input, ...document, source, destination, allowedStatuses: transferSourceStatuses, lineNumber: 1 });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "PRODUCTION_ISSUE",
      entityId: document.documentId, action: "ISSUED_TO_WORK_ORDER", newValue: { workOrderReference: input.workOrderReference, sourceBalanceId: input.sourceBalanceId, quantity: input.quantity }, performedBy: user.userCode });
    return { movementDocumentId: document.documentId, movementNumber: document.movementNumber, destinationBalanceId: result.destinationBalanceId };
  });
}

export async function returnFromProduction(raw, user) {
  const returnType = clean(raw.returnType, 10).toUpperCase();
  if (!returnTypes.has(returnType)) throw new AppError("Return type must be MTR or PRR.", 400);
  const input = baseMovement(raw, `${returnType}_RETURN`);
  input.workOrderReference = required(raw.workOrderReference, "Work order / job card reference", 120);
  if (!Number.isSafeInteger(input.sourceBalanceId) || input.sourceBalanceId < 1) throw new AppError("Select a valid source stock balance.", 400);
  const destination = readDestination(raw, { subinventoryCode: returnType, stockStatus: "HOLD", workOrderReference: input.workOrderReference });
  destination.workOrderReference = input.workOrderReference;
  if (destination.subinventoryCode !== returnType || destination.stockStatus !== "HOLD") {
    throw new AppError(`${returnType} return must be posted to the ${returnType} sub-inventory in HOLD status.`, 400);
  }
  return withTransaction(async (connection) => {
    await validateDestination(connection, user.tenantId, destination);
    const source = await repository.getBalanceForUpdate(connection, user.tenantId, input.sourceBalanceId);
    if (!source) throw new AppError("Source stock balance was not found.", 404);
    if (String(source.sub_inventory_code || "").toUpperCase() !== "WIP"
      || !["ISSUED", "REWORK"].includes(String(source.stock_status || "").toUpperCase())) {
      throw new AppError("MTR and PRR can be created only from issued or rework WIP stock.", 409);
    }
    if (String(source.work_order_reference || "") !== input.workOrderReference) {
      throw new AppError("The return work order must match the source WIP balance.", 409);
    }
    const document = await createDocument(connection, user, { ...input, workOrderReference: input.workOrderReference,
      sourceReferenceType: "WORK_ORDER", sourceReferenceNumber: input.referenceNumber || input.workOrderReference });
    const result = await moveFromBalance(connection, user, { ...input, ...document, source, destination, allowedStatuses: returnSourceStatuses, lineNumber: 1 });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: returnType,
      entityId: document.documentId, action: `${returnType}_RETURN_POSTED`, newValue: { workOrderReference: input.workOrderReference, sourceBalanceId: input.sourceBalanceId, quantity: input.quantity }, performedBy: user.userCode });
    return { movementDocumentId: document.documentId, movementNumber: document.movementNumber, destinationBalanceId: result.destinationBalanceId };
  });
}

export async function releaseQualityHold(raw, user) {
  const input = baseMovement(raw, "QUALITY_RELEASE");
  if (!Number.isSafeInteger(input.sourceBalanceId) || input.sourceBalanceId < 1) throw new AppError("Select a valid held stock balance.", 400);
  const destination = readDestination(raw, { stockStatus: "AVAILABLE" });
  if (destination.stockStatus !== "AVAILABLE") throw new AppError("Quality release must post stock in AVAILABLE status.", 400);
  return withTransaction(async (connection) => {
    await validateDestination(connection, user.tenantId, destination);
    const source = await repository.getBalanceForUpdate(connection, user.tenantId, input.sourceBalanceId);
    if (!source) throw new AppError("Held stock balance was not found.", 404);
    if (!["MTR", "PRR", "WIP"].includes(String(source.sub_inventory_code || "").toUpperCase())) {
      throw new AppError("Quality release is reserved for controlled MTR, PRR, or rework WIP stock.", 409);
    }
    const document = await createDocument(connection, user, { ...input, workOrderReference: source.work_order_reference || "",
      sourceReferenceType: "QUALITY_RELEASE", sourceReferenceNumber: input.referenceNumber });
    const result = await moveFromBalance(connection, user, { ...input, ...document, source, destination, allowedStatuses: new Set(["HOLD", "REWORK"]), lineNumber: 1 });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "QUALITY_RELEASE",
      entityId: document.documentId, action: "QUALITY_RELEASED", newValue: { sourceBalanceId: input.sourceBalanceId, quantity: input.quantity, destination }, performedBy: user.userCode });
    return { movementDocumentId: document.documentId, movementNumber: document.movementNumber, destinationBalanceId: result.destinationBalanceId };
  });
}

export async function completeProduction(raw, user) {
  const movementDate = validDate(raw.movementDate);
  const workOrderReference = required(raw.workOrderReference, "Work order / job card reference", 120);
  const remarks = required(raw.remarks, "Completion remarks", 1000);
  const referenceNumber = clean(raw.referenceNumber, 160);
  const inputLines = Array.isArray(raw.inputLines) ? raw.inputLines : [];
  if (!inputLines.length) throw new AppError("Add at least one WIP input line for production completion.", 400);
  const output = raw.finishedGood && typeof raw.finishedGood === "object" ? raw.finishedGood : {};
  const outputItemId = Number(output.itemId);
  const outputQuantity = positive(output.quantity, "Finished-good quantity");
  if (!Number.isSafeInteger(outputItemId) || outputItemId < 1) throw new AppError("Select a valid finished-good item.", 400);
  const destination = readDestination({ ...output, workOrderReference: "" }, { subinventoryCode: "FG", stockStatus: "AVAILABLE" });
  if (destination.subinventoryCode !== "FG" || destination.stockStatus !== "AVAILABLE") {
    throw new AppError("Production completion must post to FG in AVAILABLE status.", 400);
  }
  return withTransaction(async (connection) => {
    await validateDestination(connection, user.tenantId, destination);
    const item = await repository.getActiveItem(connection, outputItemId);
    if (!item) throw new AppError("Finished-good Item Master record is inactive or unavailable.", 409);
    const normalizedInputs = inputLines.map((line) => ({ sourceBalanceId: Number(line?.sourceBalanceId), quantity: positive(line?.quantity, "Consumed quantity") }));
    if (normalizedInputs.some((line) => !Number.isSafeInteger(line.sourceBalanceId) || line.sourceBalanceId < 1)) throw new AppError("Every consumption line needs a valid WIP stock balance.", 400);
    if (new Set(normalizedInputs.map((line) => line.sourceBalanceId)).size !== normalizedInputs.length) throw new AppError("Select each WIP balance only once for completion.", 400);
    const sources = [];
    for (const line of normalizedInputs.sort((left, right) => left.sourceBalanceId - right.sourceBalanceId)) {
      const source = await repository.getBalanceForUpdate(connection, user.tenantId, line.sourceBalanceId);
      if (!source) throw new AppError("A selected WIP balance no longer exists.", 404);
      if (!['ISSUED', 'REWORK'].includes(String(source.stock_status || "").toUpperCase()) || String(source.sub_inventory_code || "").toUpperCase() !== "WIP") {
        throw new AppError("Production completion can consume only WIP stock in ISSUED or REWORK status.", 409);
      }
      if (String(source.work_order_reference || "") !== workOrderReference) throw new AppError("Every WIP input must belong to the selected work order.", 409);
      sources.push({ source, quantity: line.quantity });
    }
    const owner = balanceContext(sources[0].source);
    if (sources.some(({ source }) => source.stock_owner_type !== owner.ownerType || Number(source.stock_owner_id || 0) !== owner.ownerId)) {
      throw new AppError("A completion document cannot mix company-owned and customer-owned WIP.", 409);
    }
    const document = await createDocument(connection, user, { movementType: "PRODUCTION_COMPLETION", movementDate, workOrderReference,
      sourceReferenceType: "WORK_ORDER", sourceReferenceNumber: referenceNumber || workOrderReference, remarks });
    let lineNumber = 1;
    for (const { source, quantity } of sources) {
      const decremented = await repository.decreaseBalance(connection, source.inventory_stock_balance_id, quantity, user.userCode);
      if (!decremented) throw new AppError(`Insufficient WIP quantity for ${source.item_code}.`, 409);
      const balanceAfter = Number(source.quantity_on_hand) - quantity;
      await repository.insertMovementLine(connection, { documentId: document.documentId, lineNumber: lineNumber++, ...balanceContext(source), quantity,
        workOrderReference, fromBalanceId: source.inventory_stock_balance_id, fromWarehouseCode: source.warehouse_code,
        fromSubinventoryCode: source.sub_inventory_code, fromBinLocation: source.bin_location, fromStockStatus: source.stock_status, remarks });
      await repository.insertLedgerTransaction(connection, { tenantId: user.tenantId, companyId: source.company_id, plantId: source.plant_id,
        documentId: document.documentId, transactionType: "PRODUCTION_CONSUMPTION", transactionDate: movementDate, itemId: source.item_id,
        warehouseCode: source.warehouse_code, subinventoryCode: source.sub_inventory_code, binLocation: source.bin_location,
        stockStatus: source.stock_status, batchSerialNumber: source.batch_serial_number, workOrderReference, quantityOut: quantity,
        balanceAfter, remarks, userCode: user.userCode, ownerType: source.stock_owner_type, ownerId: source.stock_owner_id });
    }
    const finishedGood = await repository.increaseBalance(connection, { tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId || "",
      itemId: outputItemId, warehouseCode: destination.warehouseCode, subinventoryCode: "FG", binLocation: destination.binLocation,
      stockStatus: "AVAILABLE", batchSerialNumber: clean(output.batchSerialNumber, 120), workOrderReference: "", quantity: outputQuantity,
      userCode: user.userCode, ownerType: owner.ownerType, ownerId: owner.ownerId });
    await repository.insertMovementLine(connection, { documentId: document.documentId, lineNumber, itemId: outputItemId, ownerType: owner.ownerType,
      ownerId: owner.ownerId, batchSerialNumber: clean(output.batchSerialNumber, 120), workOrderReference, quantity: outputQuantity,
      toBalanceId: finishedGood.id, toWarehouseCode: destination.warehouseCode, toSubinventoryCode: "FG", toBinLocation: destination.binLocation,
      toStockStatus: "AVAILABLE", remarks });
    await repository.insertLedgerTransaction(connection, { tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId,
      documentId: document.documentId, transactionType: "PRODUCTION_COMPLETION", transactionDate: movementDate, itemId: outputItemId,
      warehouseCode: destination.warehouseCode, subinventoryCode: "FG", binLocation: destination.binLocation, stockStatus: "AVAILABLE",
      batchSerialNumber: clean(output.batchSerialNumber, 120), workOrderReference, quantityIn: outputQuantity, balanceAfter: finishedGood.quantityOnHand,
      remarks, userCode: user.userCode, ownerType: owner.ownerType, ownerId: owner.ownerId });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "PRODUCTION_COMPLETION",
      entityId: document.documentId, action: "WORK_ORDER_COMPLETED", newValue: { workOrderReference, finishedGoodItemId: outputItemId, finishedGoodQuantity: outputQuantity, inputLines: normalizedInputs }, performedBy: user.userCode });
    return { movementDocumentId: document.documentId, movementNumber: document.movementNumber, finishedGoodBalanceId: finishedGood.id };
  });
}

export async function reportRejection(raw, user) {
  const rejectionType = clean(raw.rejectionType, 20).toUpperCase();
  const sourceType = clean(raw.sourceType || "WORK_ORDER", 30).toUpperCase();
  if (!rejectionTypes.has(rejectionType)) throw new AppError("Rejection type must be MATERIAL or PROCESS.", 400);
  if (!['GRN','WORK_ORDER','CUSTOMER_RETURN','OUTSOURCE','OTHER'].includes(sourceType)) throw new AppError("Choose a valid rejection source.", 400);
  const input = baseMovement(raw, "PRODUCTION_REJECTION");
  input.workOrderReference = clean(raw.workOrderReference, 120);
  if (rejectionType === "PROCESS" && !input.workOrderReference) throw new AppError("Work order / job card reference is required for process rejection.", 400);
  if (!Number.isSafeInteger(input.sourceBalanceId) || input.sourceBalanceId < 1) throw new AppError("Select a valid rejected stock balance.", 400);
  const destination = readDestination(raw, { warehouseCode: "Rejection Yard", subinventoryCode: `${rejectionType}_REJECTION`,
    binLocation: rejectionType === "MATERIAL" ? "Material Quarantine" : "Process Quarantine", stockStatus: "QUARANTINE", workOrderReference: input.workOrderReference });
  destination.workOrderReference = input.workOrderReference;
  const expectedQuarantineBin = rejectionType === "MATERIAL" ? "Material Quarantine" : "Process Quarantine";
  if (destination.warehouseCode !== "Rejection Yard" || destination.binLocation !== expectedQuarantineBin
    || destination.subinventoryCode !== `${rejectionType}_REJECTION` || destination.stockStatus !== "QUARANTINE") {
    throw new AppError("Rejected stock must be posted to its defined rejection sub-inventory in QUARANTINE status.", 400);
  }
  return withTransaction(async (connection) => {
    await validateDestination(connection, user.tenantId, destination);
    const source = await repository.getBalanceForUpdate(connection, user.tenantId, input.sourceBalanceId);
    if (!source) throw new AppError("Source stock balance was not found.", 404);
    const rejectionNumber = await nextNumber(connection, "PRODUCTION_REJECTION", "PRJ", input.movementDate);
    const caseId = await repository.insertRejectionCase(connection, {
      tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId, rejectionNumber, sourceType, rejectionType,
      workOrderReference: input.workOrderReference, operationReference: clean(raw.operationReference, 160), machineReference: clean(raw.machineReference, 160),
      processCardReference: clean(raw.processCardReference, 160), rejectionReportReference: clean(raw.rejectionReportReference, 160),
      reportedDate: input.movementDate, remarks: input.remarks, userCode: user.userCode,
    });
    const document = await createDocument(connection, user, { ...input, workOrderReference: input.workOrderReference,
      sourceReferenceType: "REJECTION_CASE", sourceReferenceNumber: rejectionNumber, remarks: input.remarks });
    const result = await moveFromBalance(connection, user, { ...input, ...document, source, destination, allowedStatuses: rejectionSourceStatuses, lineNumber: 1 });
    const lineId = await repository.insertRejectionCaseLine(connection, {
      caseId, itemId: source.item_id, itemCode: source.item_code, itemDescription: source.item_description, uomCode: source.uom_code,
      ownerType: source.stock_owner_type, ownerId: source.stock_owner_id, batchSerialNumber: source.batch_serial_number,
      quantity: input.quantity, quarantineBalanceId: result.destinationBalanceId,
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "PRODUCTION_REJECTION",
      entityId: caseId, action: "REJECTION_REPORTED", newValue: { rejectionNumber, lineId, rejectionType, sourceType, workOrderReference: input.workOrderReference, quantity: input.quantity }, performedBy: user.userCode });
    return { rejectionCaseId: caseId, rejectionLineId: lineId, rejectionNumber, movementDocumentId: document.documentId, movementNumber: document.movementNumber };
  });
}

export async function resolveRejection(raw, caseId, user) {
  const lineId = Number(raw.lineId);
  const disposition = clean(raw.disposition, 40).toUpperCase();
  const quantity = positive(raw.quantity);
  const movementDate = validDate(raw.movementDate);
  const referenceNumber = clean(raw.referenceNumber, 160);
  const remarks = required(raw.remarks, "Disposition remarks", 1000);
  if (!Number.isSafeInteger(lineId) || lineId < 1) throw new AppError("Select a valid rejection line.", 400);
  if (!rejectionDispositions.has(disposition)) throw new AppError("Choose a valid rejection disposition.", 400);
  return withTransaction(async (connection) => {
    const line = await repository.getRejectionLineForUpdate(connection, user.tenantId, caseId, lineId);
    if (!line) throw new AppError("Rejection case line was not found.", 404);
    if (Number(line.quantity_open) + 0.0001 < quantity) throw new AppError("Disposition quantity exceeds the open rejected quantity.", 409);
    if (line.stock_owner_type === "CUSTOMER" && disposition === "RETURN_TO_VENDOR") throw new AppError("Customer-owned material cannot be returned to a vendor.", 409);
    if (line.stock_owner_type !== "CUSTOMER" && disposition === "RETURN_TO_CUSTOMER") throw new AppError("Only customer-owned material can be returned to the customer.", 409);
    const defaults = disposition === "REWORK"
      ? { subinventoryCode: "WIP", stockStatus: "REWORK", workOrderReference: line.work_order_reference || "" }
      : disposition === "SCRAP"
        ? { warehouseCode: "Scrap Yard", subinventoryCode: "SCRAP", binLocation: "Scrap", stockStatus: "SCRAP", workOrderReference: "" }
        : disposition.startsWith("RETURN_")
          ? { warehouseCode: "Rejection Yard", subinventoryCode: line.rejection_type === "MATERIAL" ? "MATERIAL_REJECTION" : "PROCESS_REJECTION", binLocation: line.rejection_type === "MATERIAL" ? "Material Return Pending" : "Process Return Pending", stockStatus: "RETURN_PENDING", workOrderReference: line.work_order_reference || "" }
          : { stockStatus: "AVAILABLE", workOrderReference: "" };
    const destination = readDestination(raw, defaults);
    if (disposition === "REWORK" && !destination.workOrderReference) throw new AppError("Work order reference is required before sending stock to rework.", 400);
    if (disposition === "REWORK" && (destination.subinventoryCode !== "WIP" || destination.stockStatus !== "REWORK")) {
      throw new AppError("Rework disposition must post to WIP in REWORK status.", 400);
    }
    if (disposition === "RELEASE" && destination.stockStatus !== "AVAILABLE") throw new AppError("Released stock must be posted in AVAILABLE status.", 400);
    if (disposition === "RELEASE" && transferOnlySubinventories.has(destination.subinventoryCode)) {
      throw new AppError("Released stock must be posted to a standard available sub-inventory.", 400);
    }
    if (disposition === "SCRAP" && (destination.warehouseCode !== "Scrap Yard" || destination.binLocation !== "Scrap"
      || destination.subinventoryCode !== "SCRAP" || destination.stockStatus !== "SCRAP")) {
      throw new AppError("Scrap disposition must post to Scrap Yard / Scrap in SCRAP status.", 400);
    }
    const expectedReturnBin = line.rejection_type === "MATERIAL" ? "Material Return Pending" : "Process Return Pending";
    if (disposition.startsWith("RETURN_") && (destination.warehouseCode !== "Rejection Yard" || destination.binLocation !== expectedReturnBin
      || destination.subinventoryCode !== `${line.rejection_type}_REJECTION` || destination.stockStatus !== "RETURN_PENDING")) {
      throw new AppError("External return disposition must remain in the rejection Return Pending location.", 400);
    }
    await validateDestination(connection, user.tenantId, destination);
    const source = await repository.getBalanceForUpdate(connection, user.tenantId, line.quarantine_inventory_stock_balance_id);
    if (!source || source.stock_status !== "QUARANTINE") throw new AppError("The linked quarantine balance is no longer available.", 409);
    const document = await createDocument(connection, user, { movementType: `REJECTION_${disposition}`, movementDate,
      workOrderReference: destination.workOrderReference || line.work_order_reference, sourceReferenceType: "REJECTION_CASE",
      sourceReferenceNumber: line.rejection_number, remarks, });
    await moveFromBalance(connection, user, { documentId: document.documentId, lineNumber: 1, movementType: `REJECTION_${disposition}`,
      movementDate, quantity, source, destination, remarks, allowedStatuses: new Set(["QUARANTINE"]) });
    const quantityOpen = Number((Number(line.quantity_open) - quantity).toFixed(3));
    await repository.updateRejectionLine(connection, lineId, { quantityOpen, disposition, reference: referenceNumber, remarks, userCode: user.userCode });
    const caseStatus = quantityOpen > 0 ? "OPEN" : disposition === "REWORK" ? "UNDER_REWORK" : disposition.startsWith("RETURN_") ? "RETURN_PENDING" : disposition === "SCRAP" ? "SCRAP_PENDING" : "CLOSED";
    await repository.updateRejectionCaseStatus(connection, caseId, caseStatus, user.userCode);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "PRODUCTION_REJECTION",
      entityId: Number(caseId), action: `REJECTION_${disposition}`, newValue: { lineId, quantity, destination, referenceNumber, caseStatus }, performedBy: user.userCode });
    return { movementDocumentId: document.documentId, movementNumber: document.movementNumber, rejectionCaseId: Number(caseId), rejectionLineId: lineId, quantityOpen, caseStatus };
  });
}
