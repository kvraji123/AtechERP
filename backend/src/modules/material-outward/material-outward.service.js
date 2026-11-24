import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { appLocalDateTimeToUtc, isValidDateOnly } from "../../utils/dateTime.js";
import * as repository from "./material-outward.repository.js";
import { createCalibrationDispatchInTransaction } from "../gauge/gauge.service.js";
import { createRegrindDispatchInTransaction } from "../tooling/tooling.service.js";

const outwardTypes = new Set(["FINISHED_GOODS", "OUTSOURCE_ISSUE", "CALIBRATION_DISPATCH", "TOOL_REGRIND"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const clean = (value, limit = 1000) => String(value ?? "").trim().slice(0, limit);

function pagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return { page, pageSize };
}

function readDocument(raw) {
  const outwardType = clean(raw.outwardType, 30).toUpperCase();
  const outwardDate = clean(raw.outwardDate, 10);
  // Specialised DC endpoints use supplierId; normal Material Outward uses partyId.
  const partyId = Number(raw.partyId ?? raw.supplierId);
  const lines = Array.isArray(raw.items) ? raw.items.map((line) => ({
    stockBalanceId: Number(line.stockBalanceId),
    quantity: Number(line.quantity),
  })) : [];
  const toolRegrindItems = Array.isArray(raw.items) ? raw.items.map((line) => ({
    itemId: Number(line.itemId),
    quantity: Number(line.quantity),
    sourceStockStatus: clean(line.sourceStockStatus, 30).toUpperCase(),
  })) : [];
  return {
    outwardType,
    outwardDate,
    partyId,
    transportMode: clean(raw.transportMode, 50),
    transportReference: clean(raw.transportReference ?? raw.courierVehicleReference ?? raw.courierReference, 160),
    calibrationAgency: clean(raw.calibrationAgency, 180),
    expectedReturnDate: clean(raw.expectedReturnDate, 10),
    dispatchFrom: clean(raw.dispatchFrom, 150),
    gaugeMasterIds: Array.isArray(raw.gaugeMasterIds) ? raw.gaugeMasterIds.map(Number) : [],
    remarks: clean(raw.remarks, 1000),
    items: lines,
    toolRegrindItems,
  };
}

function assertDocument(input) {
  if (!outwardTypes.has(input.outwardType)) throw new AppError("Select Finished Goods Delivery, Outsource Issue, Calibration Dispatch, or Tool Regrinding.");
  if (!datePattern.test(input.outwardDate)) throw new AppError("Enter a valid outward date.");
  if (input.outwardType === "CALIBRATION_DISPATCH") {
    if (!input.calibrationAgency) throw new AppError("Calibration Agency is required.");
    if (!datePattern.test(input.expectedReturnDate)) throw new AppError("Expected Return Date is required.");
    if (input.expectedReturnDate < input.outwardDate) throw new AppError("Expected Return Date cannot be before Dispatch Date.");
    if (!input.dispatchFrom) throw new AppError("Dispatch From is required.");
    if (!input.gaugeMasterIds.length || input.gaugeMasterIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      throw new AppError("Select at least one valid Gauge ID for calibration dispatch.");
    }
    if (new Set(input.gaugeMasterIds).size !== input.gaugeMasterIds.length) throw new AppError("Select each Gauge ID only once per calibration dispatch.");
    return;
  }
  if (input.outwardType === "TOOL_REGRIND") {
    if (!Number.isSafeInteger(input.partyId) || input.partyId < 1) throw new AppError("Select the regrinding supplier.");
    if (input.expectedReturnDate && (!datePattern.test(input.expectedReturnDate) || input.expectedReturnDate < input.outwardDate)) {
      throw new AppError("Expected Return Date cannot be before the dispatch date.");
    }
    if (!input.toolRegrindItems.length || input.toolRegrindItems.some((line) => !Number.isSafeInteger(line.itemId) || line.itemId < 1 || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      throw new AppError("Add at least one tool item and a positive quantity for regrinding.");
    }
    if (new Set(input.toolRegrindItems.map((line) => line.itemId)).size !== input.toolRegrindItems.length) {
      throw new AppError("Each tool item can be included only once in a regrinding DC.");
    }
    return;
  }
  if (!Number.isSafeInteger(input.partyId) || input.partyId < 1) {
    throw new AppError(`Select the ${input.outwardType === "FINISHED_GOODS" ? "customer" : "outsource supplier"}.`);
  }
  if (!input.transportMode) throw new AppError("Select the transport mode before submitting outward material.");
  if (!input.items.length) throw new AppError("Add at least one available-stock item.");
  const selectedBalances = new Set();
  for (const line of input.items) {
    if (!Number.isSafeInteger(line.stockBalanceId) || line.stockBalanceId < 1 || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new AppError("Every outward line needs an available stock source and a positive quantity.");
    }
    if (selectedBalances.has(line.stockBalanceId)) throw new AppError("Select each stock balance only once per outward document.");
    selectedBalances.add(line.stockBalanceId);
  }
}

function readGateExit(raw) {
  return {
    materialOutwardDocumentId: Number(raw.materialOutwardDocumentId),
    exitDateTime: clean(raw.exitDateTime, 19),
    vehicleNumber: clean(raw.vehicleNumber, 80).toUpperCase(),
    driverName: clean(raw.driverName, 150),
    drivingLicenceNumber: clean(raw.drivingLicenceNumber, 100).toUpperCase(),
    courierName: clean(raw.courierName, 150),
    courierReceiptNumber: clean(raw.courierReceiptNumber, 120).toUpperCase(),
    remarks: clean(raw.remarks, 1000),
  };
}

function assertGateExit(input) {
  if (!Number.isSafeInteger(input.materialOutwardDocumentId) || input.materialOutwardDocumentId < 1) {
    throw new AppError("Select a GRN Outward document for gate exit.");
  }
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(input.exitDateTime);
  if (!match || !isValidDateOnly(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59) {
    throw new AppError("Enter a valid gate exit date and time.");
  }
}

function response(document) {
  return {
    materialOutwardDocumentId: Number(document.material_outward_document_id),
    outwardNumber: document.outward_number,
    outwardDate: document.outward_date,
    outwardType: document.outward_type,
    documentStatus: document.document_status,
    partyName: document.party_name_snapshot,
    partyCode: document.party_code_snapshot || "",
    customerId: document.customer_id ? Number(document.customer_id) : null,
    supplierId: document.supplier_id ? Number(document.supplier_id) : null,
    transportMode: document.transport_mode || "",
    transportReference: document.transport_reference || "",
    gateExitReference: document.gate_exit_reference || "",
    remarks: document.remarks || "",
    approvalRemarks: document.approval_remarks || "",
    items: (document.items || []).map((item) => ({
      materialOutwardDocumentItemId: Number(item.material_outward_document_item_id),
      stockBalanceId: Number(item.inventory_stock_balance_id),
      itemCode: item.item_code_snapshot || "",
      itemDescription: item.item_description_snapshot,
      uomCode: item.uom_code_snapshot || "",
      warehouseCode: item.warehouse_code_snapshot,
      binLocation: item.bin_location_snapshot,
      batchSerialNumber: item.batch_serial_number_snapshot || "",
      quantity: Number(item.outward_quantity),
    })),
  };
}

export async function list(query, user) {
  const { page, pageSize } = pagination(query);
  const type = outwardTypes.has(clean(query.type, 30).toUpperCase()) ? clean(query.type, 30).toUpperCase() : "";
  const status = ["PENDING_APPROVAL", "APPROVED", "DISPATCHED", "CANCELLED"].includes(clean(query.status, 30).toUpperCase())
    ? clean(query.status, 30).toUpperCase() : "";
  const result = await repository.list({ tenantId: user.tenantId, search: clean(query.search, 120), type, status, limit: pageSize, offset: (page - 1) * pageSize });
  return { ...result, page, pageSize };
}

export async function get(documentId, user) {
  if (!Number.isSafeInteger(Number(documentId)) || Number(documentId) < 1) {
    throw new AppError("Material Outward document not found.", 404);
  }
  const document = await repository.get(user.tenantId, documentId);
  if (!document) throw new AppError("Material Outward document not found.", 404);
  return response(document);
}

export async function outsourceWip(query, user) {
  const { page, pageSize } = pagination(query);
  const result = await repository.listOutsourceWip({
    tenantId: user.tenantId,
    search: clean(query.search, 120),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, page, pageSize };
}

export async function gateExitCandidates(query, user) {
  const { page, pageSize } = pagination(query);
  const result = await repository.listGateExitCandidates({
    tenantId: user.tenantId,
    search: clean(query.search, 120),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, page, pageSize };
}

export async function listGateExits(query, user) {
  const { page, pageSize } = pagination(query);
  const result = await repository.listGateExits({
    tenantId: user.tenantId,
    search: clean(query.search, 120),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, page, pageSize };
}

export async function create(raw, user) {
  const input = readDocument(raw);
  assertDocument(input);
  if (input.outwardType === "CALIBRATION_DISPATCH") return createCalibrationDispatch(input, user);
  if (input.outwardType === "TOOL_REGRIND") return createToolRegrindDispatch(input, user);
  return withTransaction(async (connection) => {
    const party = input.outwardType === "FINISHED_GOODS"
      ? await repository.getActiveCustomer(connection, input.partyId)
      : await repository.getActiveSupplier(connection, input.partyId);
    if (!party) throw new AppError(`The selected ${input.outwardType === "FINISHED_GOODS" ? "customer" : "supplier"} is inactive or unavailable.`, 409);

    const stockLines = [];
    for (const line of input.items) {
      const stock = await repository.getCompanyStockForUpdate(connection, user.tenantId, line.stockBalanceId);
      if (!stock || Number(stock.quantity_on_hand) <= 0) throw new AppError("A selected company-stock line is no longer available.", 409);
      if (line.quantity > Number(stock.quantity_on_hand)) {
        throw new AppError(`Requested quantity exceeds available company stock for ${stock.item_description}.`, 409);
      }
      stockLines.push({ stock, quantity: line.quantity });
    }

    const financialYear = getFinancialYear(new Date(`${input.outwardDate}T12:00:00`));
    await ensureDocumentSequence(connection, "MATERIAL_OUTWARD", financialYear, "MOUT",
      await repository.maxDocumentNumber(connection, user.tenantId, financialYear));
    const outwardNumber = await getNextDocumentNumber(connection, "MATERIAL_OUTWARD", financialYear);
    const documentId = await repository.insertHeader(connection, {
      tenantId: user.tenantId, companyId: user.companyId, outwardNumber, outwardDate: input.outwardDate,
      outwardType: input.outwardType, customerId: input.outwardType === "FINISHED_GOODS" ? party.customer_id : null,
      supplierId: input.outwardType === "OUTSOURCE_ISSUE" ? party.supplier_id : null,
      partyCode: party.customer_code || party.supplier_code, partyName: party.customer_name || party.supplier_name,
      transportMode: input.transportMode, transportReference: input.transportReference, remarks: input.remarks, userCode: user.userCode,
    });
    for (const { stock, quantity } of stockLines) {
      await repository.insertItem(connection, {
        documentId, stockBalanceId: stock.inventory_stock_balance_id, itemId: stock.item_id, itemCode: stock.item_code,
        itemDescription: stock.item_description, uomCode: stock.uom_code, warehouseCode: stock.warehouse_code,
        binLocation: stock.bin_location, batchSerialNumber: stock.batch_serial_number, quantity,
      });
    }
    const document = await repository.getForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "MATERIAL_OUTWARD",
      entityId: documentId, action: "MATERIAL_OUTWARD_SUBMITTED", newValue: { outwardNumber, outwardType: input.outwardType, itemCount: input.items.length }, performedBy: user.userCode });
    return response(document);
  });
}

async function createToolRegrindDispatch(input, user) {
  return withTransaction(async (connection) => {
    const supplier = await repository.getActiveSupplier(connection, input.partyId, "TOOLING");
    if (!supplier) throw new AppError("Select an active Supplier Master record categorized for Tooling as the regrinding supplier.", 409);
    const financialYear = getFinancialYear(new Date(`${input.outwardDate}T12:00:00`));
    await ensureDocumentSequence(connection, "TOOL_REGRIND_DC", financialYear, "TDC");
    const outwardNumber = await getNextDocumentNumber(connection, "TOOL_REGRIND_DC", financialYear);
    const documentId = await repository.insertHeader(connection, {
      tenantId: user.tenantId, companyId: user.companyId, plantId: user.plantId, outwardNumber, outwardDate: input.outwardDate,
      outwardType: input.outwardType, documentStatus: "DISPATCHED", supplierId: supplier.supplier_id,
      partyCode: supplier.supplier_code, partyName: supplier.supplier_name, transportMode: null,
      transportReference: input.transportReference || null, gateExitReference: null, remarks: input.remarks, userCode: user.userCode,
    });
    const result = await createRegrindDispatchInTransaction({
      supplierId: input.partyId, dispatchDate: input.outwardDate, expectedReturnDate: input.expectedReturnDate,
      courierVehicleReference: input.transportReference, remarks: input.remarks, items: input.toolRegrindItems,
    }, user, connection, { dcNumber: outwardNumber, materialOutwardDocumentId: documentId });
    for (const item of result.dispatchedItems) {
      await repository.insertItem(connection, {
        documentId, stockBalanceId: item.inventoryStockBalanceId, itemId: item.itemId, itemCode: item.itemCode,
        itemDescription: item.itemDescription, uomCode: item.uomCode, warehouseCode: "Tool Crib", binLocation: "Tooling",
        batchSerialNumber: "", quantity: item.quantity,
      });
    }
    const document = await repository.getForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "MATERIAL_OUTWARD",
      entityId: documentId, action: "TOOL_REGRIND_DISPATCH_CREATED", newValue: { outwardNumber, toolingRegrindBatchId: result.batch.toolingRegrindBatchId, supplierId: input.partyId, itemCount: result.dispatchedItems.length }, performedBy: user.userCode });
    return { ...response(document), toolingRegrindBatchId: result.batch.toolingRegrindBatchId, challanNumber: outwardNumber };
  });
}

async function createCalibrationDispatch(input, user) {
  return withTransaction(async (connection) => {
    const financialYear = getFinancialYear(new Date(`${input.outwardDate}T12:00:00`));
    await ensureDocumentSequence(connection, "GAUGE_CALIBRATION_DISPATCH", financialYear, "GCD");
    const outwardNumber = await getNextDocumentNumber(connection, "GAUGE_CALIBRATION_DISPATCH", financialYear);
    const documentId = await repository.insertHeader(connection, {
      tenantId: user.tenantId, companyId: user.companyId, outwardNumber, outwardDate: input.outwardDate,
      outwardType: input.outwardType, documentStatus: "DISPATCHED", partyCode: null, partyName: input.calibrationAgency,
      transportMode: null, transportReference: input.transportReference || null, gateExitReference: null,
      remarks: input.remarks, userCode: user.userCode,
    });
    const calibrationDispatch = await createCalibrationDispatchInTransaction({
      gaugeMasterIds: input.gaugeMasterIds, calibrationAgency: input.calibrationAgency, dispatchDate: input.outwardDate,
      expectedReturnDate: input.expectedReturnDate, courierReference: input.transportReference,
      dispatchFrom: input.dispatchFrom, remarks: input.remarks,
    }, user, connection, { challanNumber: outwardNumber, materialOutwardDocumentId: documentId });
    const document = await repository.getForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "MATERIAL_OUTWARD",
      entityId: documentId, action: "CALIBRATION_DISPATCH_OUTWARD_CREATED", newValue: {
        outwardNumber, calibrationDispatchId: calibrationDispatch.calibrationDispatchId, calibrationAgency: input.calibrationAgency,
        gaugeMasterIds: input.gaugeMasterIds, expectedReturnDate: input.expectedReturnDate,
      }, performedBy: user.userCode });
    return { ...response(document), calibrationDispatchId: calibrationDispatch.calibrationDispatchId, challanNumber: outwardNumber };
  });
}

export async function approve(documentId, raw, user) {
  const approvalRemarks = clean(raw.approvalRemarks, 1000);
  return withTransaction(async (connection) => {
    const document = await repository.getForUpdate(connection, user.tenantId, documentId);
    if (!document) throw new AppError("Material Outward document not found.", 404);
    if (document.document_status !== "PENDING_APPROVAL") throw new AppError("Only a pending Material Outward document can be approved.", 409);
    await repository.approve(connection, documentId, { approvalRemarks, userCode: user.userCode });
    const approved = await repository.getForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "MATERIAL_OUTWARD",
      entityId: Number(documentId), action: "MATERIAL_OUTWARD_APPROVED", newValue: { outwardNumber: approved.outward_number, approvalRemarks }, performedBy: user.userCode });
    return response(approved);
  });
}

export async function dispatchApprovedDocumentInTransaction(connection, document, { gateExitReference, user, dispatchDate, dispatchedAt = null }) {
  if (document.document_status !== "APPROVED") {
    throw new AppError("Material stock can be dispatched only after approval.", 409);
  }
  for (const item of document.items) {
    const quantity = Number(item.outward_quantity);
    const stock = await repository.getCompanyStockForUpdate(connection, user.tenantId, item.inventory_stock_balance_id);
    if (!stock || quantity > Number(stock.quantity_on_hand)) {
      throw new AppError(`Insufficient available stock to dispatch ${item.item_description_snapshot}.`, 409);
    }
    const balanceAfter = Number(stock.quantity_on_hand) - quantity;
    await repository.decreaseCompanyStock(connection, stock.inventory_stock_balance_id, quantity, user.userCode);
    await repository.insertStockTransaction(connection, {
      tenantId: user.tenantId, companyId: stock.company_id, plantId: stock.plant_id,
      transactionType: document.outward_type === "FINISHED_GOODS" ? "FINISHED_GOODS_DISPATCH" : "OUTSOURCE_ISSUE",
      transactionDate: dispatchDate || document.outward_date, itemId: stock.item_id, warehouseCode: stock.warehouse_code,
      binLocation: stock.bin_location, batchSerialNumber: stock.batch_serial_number, quantity, balanceAfter,
      remarks: `${document.outward_number} dispatched through gate exit ${gateExitReference}.`, userCode: user.userCode,
    });
    if (document.outward_type === "OUTSOURCE_ISSUE") {
      await repository.createOutsourceIssueWip(connection, {
        tenantId: user.tenantId, documentId: document.material_outward_document_id,
        documentItemId: item.material_outward_document_item_id, supplierId: document.supplier_id,
        supplierName: document.party_name_snapshot, itemId: stock.item_id, itemCode: stock.item_code,
        itemDescription: stock.item_description, uomCode: stock.uom_code, warehouseCode: stock.warehouse_code,
        binLocation: stock.bin_location, batchSerialNumber: stock.batch_serial_number, quantity, userCode: user.userCode,
      });
    }
  }
  await repository.dispatch(connection, document.material_outward_document_id, {
    gateExitReference, userCode: user.userCode, dispatchedAt,
  });
  const dispatched = await repository.getForUpdate(connection, user.tenantId, document.material_outward_document_id);
  await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "MATERIAL_OUTWARD",
    entityId: Number(document.material_outward_document_id), action: "MATERIAL_OUTWARD_DISPATCHED", newValue: {
      outwardNumber: dispatched.outward_number, gateExitReference, itemCount: dispatched.items.length,
    }, performedBy: user.userCode });
  return dispatched;
}

export async function createGateExit(raw, user) {
  const input = readGateExit(raw);
  assertGateExit(input);
  return withTransaction(async (connection) => {
    const document = await repository.getForUpdate(connection, user.tenantId, input.materialOutwardDocumentId);
    if (!document) throw new AppError("GRN Outward document not found.", 404);
    if (!["APPROVED", "DISPATCHED"].includes(document.document_status)) {
      throw new AppError("Only an approved GRN Outward document can be sent to Gate Exit.", 409);
    }
    if (await repository.getGateExitForUpdate(connection, user.tenantId, input.materialOutwardDocumentId)) {
      throw new AppError("A gate exit has already been recorded for this GRN Outward document.", 409);
    }

    const isCourier = String(document.transport_mode || "").toUpperCase() === "COURIER";
    if (isCourier && (!input.courierName || !input.courierReceiptNumber)) {
      throw new AppError("Courier name and Courier Receipt number are required for courier gate exits.");
    }
    if (!isCourier && (!input.vehicleNumber || !input.driverName)) {
      throw new AppError("Vehicle number and driver name are required for gate exit.");
    }

    const exitDate = input.exitDateTime.slice(0, 10);
    if (exitDate < String(document.outward_date).slice(0, 10)) {
      throw new AppError("Gate exit date cannot be before the GRN Outward date.");
    }
    const financialYear = getFinancialYear(new Date(`${exitDate}T12:00:00`));
    await ensureDocumentSequence(connection, "GATE_EXIT", financialYear, "GEX",
      await repository.maxGateExitNumber(connection, user.tenantId, financialYear));
    const gateExitNumber = await getNextDocumentNumber(connection, "GATE_EXIT", financialYear);
    const exitDateTime = appLocalDateTimeToUtc(input.exitDateTime);

    if (document.document_status === "APPROVED") {
      await dispatchApprovedDocumentInTransaction(connection, document, {
        gateExitReference: gateExitNumber, user, dispatchDate: exitDate, dispatchedAt: exitDateTime,
      });
    }

    const gateExitId = await repository.insertGateExit(connection, {
      tenantId: user.tenantId, companyId: document.company_id, plantId: document.plant_id,
      gateExitNumber, materialOutwardDocumentId: input.materialOutwardDocumentId, exitDateTime,
      transportMode: document.transport_mode, vehicleNumber: isCourier ? null : input.vehicleNumber,
      driverName: isCourier ? null : input.driverName,
      drivingLicenceNumber: isCourier ? null : input.drivingLicenceNumber,
      courierName: isCourier ? input.courierName : null,
      courierReceiptNumber: isCourier ? input.courierReceiptNumber : null,
      remarks: input.remarks, userCode: user.userCode,
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "GATE_EXIT",
      entityId: gateExitId, action: "GATE_EXIT_RECORDED", newValue: {
        gateExitNumber, outwardNumber: document.outward_number, materialOutwardDocumentId: input.materialOutwardDocumentId,
        exitDateTime, documentWasAlreadyDispatched: document.document_status === "DISPATCHED",
      }, performedBy: user.userCode });
    return { materialGateExitId: gateExitId, gateExitNumber, materialOutwardDocumentId: input.materialOutwardDocumentId };
  });
}

