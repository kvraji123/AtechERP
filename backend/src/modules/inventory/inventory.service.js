import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import * as repository from "./inventory.repository.js";
import { generateRtvPdf } from "./rtv-pdf.service.js";
import { generateResolutionPdf } from "./rejection-resolution-pdf.service.js";
import { generateReturnToCustomerPdf } from "./return-to-customer-pdf.service.js";
import { assertPartyTransportMode } from "../../utils/transport-modes.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";

function readFilters(query) {
  return {
    search: String(query.search || "").trim().slice(0, 120),
    warehouse: String(query.warehouse || "").trim().slice(0, 80),
    binLocation: String(query.binLocation || "").trim().slice(0, 80),
    status: String(query.status || "").trim().toUpperCase(),
    stockOwnerType: String(query.stockOwnerType || query.ownerType || "").trim().toUpperCase(),
  };
}

function readLimit(query) {
  const supplied = Number(query.limit || 200);
  return Number.isFinite(supplied) ? Math.min(Math.max(Math.floor(supplied), 1), 500) : 200;
}

function pagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return { page, pageSize };
}

function pageRows(rows, { page, pageSize }) {
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export function dashboard(user) { return repository.getDashboard(user.tenantId); }
export async function stock(query, user) { const p = pagination(query); return pageRows(await repository.listStock({ tenantId: user.tenantId, filters: readFilters(query), limit: readLimit(query) }), p); }
export async function transactions(query, user) { const p = pagination(query); return pageRows(await repository.listTransactions({ tenantId: user.tenantId, filters: readFilters(query), limit: readLimit(query) }), p); }
export async function qualityHold(query, user) { const p = pagination(query); return pageRows(await repository.listQualityHold({ tenantId: user.tenantId, limit: readLimit(query) }), p); }
export async function outsourcingWip(query, user) { const p = pagination(query); return pageRows(await repository.listOutsourcingWip({ tenantId: user.tenantId, filters: readFilters(query), limit: readLimit(query) }), p); }
export async function rejectionInventory(query, user) { const p = pagination(query); return pageRows(await repository.listRejectionInventory({ tenantId:user.tenantId, filters:readFilters(query), limit:readLimit(query) }), p); }
export async function reorderAlerts(query, user) { const p = pagination(query); return pageRows(await repository.listReorderAlerts({ tenantId: user.tenantId, filters: readFilters(query), limit: readLimit(query) }), p); }
export async function customerStock(query, user) {
  const filters = readFilters(query);
  const limit = readLimit(query);
  const p = pagination(query);
  const [stock, jobs] = await Promise.all([
    repository.listCustomerStock({ tenantId: user.tenantId, filters, limit }),
    repository.listCustomerMaterialJobs({ tenantId: user.tenantId, filters, limit }),
  ]);
  const stockPage = pageRows(stock, p);
  const jobsPage = pageRows(jobs, p);
  return { stock: stockPage.rows, jobs: jobsPage.rows, stockTotal: stockPage.total, jobsTotal: jobsPage.total, page: p.page, pageSize: p.pageSize };
}
export async function customerReturnDocuments(query, user) { const p = pagination(query); return pageRows(await repository.listReturnToCustomerDocuments({ tenantId: user.tenantId, filters: readFilters(query), limit: readLimit(query) }), p); }

const resolutionActions = new Set(["RETURN_TO_VENDOR","RETURN_TO_CUSTOMER","REWORK","SCRAP","DEVIATION_RELEASE"]);
const controlledResolutionActions = new Set(["RETURN_TO_CUSTOMER","REWORK","SCRAP","DEVIATION_RELEASE"]);
const reinspectionDecisions = new Set(["ACCEPT_ALL","PARTIALLY_ACCEPT","REJECT_ALL"]);
const validDate = /^\d{4}-\d{2}-\d{2}$/;
const resolutionPrefix = { RETURN_TO_CUSTOMER:"RTC", REWORK:"RWR", SCRAP:"SCR", DEVIATION_RELEASE:"DVR" };

const rtvFile = (document) => document?.pdf_file_path ? {
  fileName: document.pdf_file_name,
  filePath: document.pdf_file_path,
  fileSizeBytes: Number(document.pdf_file_size_bytes || 0),
  fileUrl: `/uploads/${String(document.pdf_file_path).replace(/\\/g, "/")}`,
} : null;

const rtvResponse = (document) => document ? {
  rtvDocumentId: Number(document.rtv_document_id), rtvNumber: document.rtv_number, rtvDate: document.rtv_date,
  documentStatus: document.document_status, dispatchReference: document.dispatch_reference || "",
  transportMode: document.transport_mode || "", transportReference: document.transport_reference || "", approvalRemarks: document.approval_remarks || "",
  supplierContact: document.supplier_contact || "", supplierAcknowledgementReference: document.supplier_acknowledgement_reference || "",
  supplierAcknowledgedAt: document.supplier_acknowledged_at || null, approvedAt: document.approved_at || null,
  ...rtvFile(document),
} : null;

const resolutionFile = (request) => request?.pdf_file_path ? {
  fileName:request.pdf_file_name,filePath:request.pdf_file_path,fileSizeBytes:Number(request.pdf_file_size_bytes || 0),
  fileUrl:`/uploads/${String(request.pdf_file_path).replace(/\\/g,"/")}`,
} : null;

const resolutionResponse = (request) => request ? {
  resolutionRequestId:Number(request.rejection_resolution_request_id),resolutionNumber:request.resolution_number,
  resolutionAction:request.resolution_action,resolutionStatus:request.resolution_status,resolutionDate:request.resolution_date,
  quantity:Number(request.quantity),warehouseCode:request.warehouse_code || "",binLocation:request.bin_location || "",
  dispatchReference:request.dispatch_reference || "",transportMode:request.transport_mode || "",transportReference:request.transport_reference || "",
  actionReference:request.action_reference || "",partyContact:request.party_contact || "",
  acknowledgementReference:request.acknowledgement_reference || "",executionReference:request.execution_reference || "",
  ...resolutionFile(request),
} : null;

const returnToCustomerDocumentResponse = (document) => document ? {
  returnToCustomerDocumentId: Number(document.return_to_customer_document_id), rtcNumber: document.rtc_number,
  rtcDate: document.rtc_date, documentStatus: document.document_status, customerId: Number(document.customer_id),
  customerName: document.customer_name_snapshot, customerCode: document.customer_code_snapshot || "",
  dispatchReference: document.dispatch_reference || "", transportMode: document.transport_mode || "", transportReference: document.transport_reference || "",
  gateExitReference: document.gate_exit_reference || "", customerContact: document.customer_contact || "",
  acknowledgementReference: document.customer_acknowledgement_reference || "", approvalRemarks: document.approval_remarks || "",
  remarks: document.remarks || "", items: (document.items || []).map((item) => ({
    returnToCustomerDocumentItemId: Number(item.return_to_customer_document_item_id), balanceId: Number(item.rejection_inventory_balance_id),
    grnNumber: item.grn_number_snapshot, itemCode: item.item_code_snapshot, itemDescription: item.item_description_snapshot,
    uomCode: item.uom_code_snapshot, quantity: Number(item.returned_quantity), rejectionReason: item.rejection_reason_snapshot || "",
  })),
  ...resolutionFile(document),
} : null;

function readResolution(raw) {
  return {
    action: String(raw.action || "").trim().toUpperCase(),
    quantity: Number(raw.quantity),
    remarks: String(raw.remarks || "").trim().slice(0,1000),
    warehouseCode: String(raw.warehouseCode || "").trim().slice(0,80),
    binLocation: String(raw.binLocation || "").trim().slice(0,80),
    returnDate: String(raw.returnDate || todayInAppTimeZone()).trim(),
    dispatchReference: String(raw.dispatchReference || "").trim().slice(0,160),
    transportMode: String(raw.transportMode || "").trim().toUpperCase(),
    transportReference: String(raw.transportReference || "").trim().slice(0,160),
    actionReference: String(raw.actionReference || "").trim().slice(0,250),
  };
}

function assertResolutionInput(input) {
  if (!resolutionActions.has(input.action)) throw new AppError("Select a valid rejection inventory action.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new AppError("Resolution quantity must be greater than zero.");
  if (input.action === "DEVIATION_RELEASE" && (!input.warehouseCode || !input.binLocation)) {
    throw new AppError("Warehouse and bin location are required when releasing material to available stock.");
  }
  if (["RETURN_TO_VENDOR","RETURN_TO_CUSTOMER"].includes(input.action) && !validDate.test(input.returnDate)) {
    throw new AppError("Enter a valid planned return date.");
  }
  if (["RETURN_TO_VENDOR","RETURN_TO_CUSTOMER"].includes(input.action) && !input.transportMode) {
    throw new AppError("Select the actual transport mode for the return shipment.");
  }
  if (["REWORK","SCRAP","DEVIATION_RELEASE"].includes(input.action) && !input.actionReference) throw new AppError("Enter the action reference.");
  if (!input.remarks) throw new AppError("Resolution remarks are required.");
}

export async function resolveRejectionInventory(balanceId, raw, user) {
  const input = readResolution(raw);
  assertResolutionInput(input);
  if (input.action === "RETURN_TO_CUSTOMER") {
    const document = await createReturnToCustomerDocument({
      returnDate: input.returnDate, dispatchReference: input.dispatchReference, transportMode: input.transportMode, transportReference: input.transportReference,
      remarks: input.remarks, items: [{ balanceId: Number(balanceId), quantity: input.quantity }],
    }, user);
    return { balanceId: Number(balanceId), action: input.action, quantity: input.quantity, returnToCustomerDocument: document };
  }
  return withTransaction(async (connection) => {
    const balance = await repository.getRejectionInventoryForUpdate(connection,user.tenantId,balanceId);
    if (!balance) throw new AppError("Rejection inventory record not found.",404);
    if (balance.status !== "OPEN" || Number(balance.quantity_on_hand) <= 0) throw new AppError("This rejection inventory record is already resolved.",409);
    const availableQuantity = Number(balance.quantity_on_hand) - Number(balance.quantity_reserved || 0);
    if (input.quantity > availableQuantity) throw new AppError("Resolution quantity exceeds the available rejected inventory balance.");
    if (input.action === "RETURN_TO_VENDOR" && balance.responsible_party !== "SUPPLIER") throw new AppError("Return to vendor is only available for supplier-owned receipts.",409);
    if (input.action === "RETURN_TO_CUSTOMER" && balance.responsible_party !== "CUSTOMER") throw new AppError("Return to customer is only available for customer-supplied receipts.",409);

    if (input.action === "RETURN_TO_VENDOR") {
      const transportMode = await assertPartyTransportMode({ selectedMode: input.transportMode, allowedModes: balance.supplier_allowed_transport_modes || balance.supplier_transport_mode, partyLabel: "Supplier", connection });
      const financialYear = getFinancialYear(new Date(`${input.returnDate}T00:00:00`));
      await ensureDocumentSequence(connection,"RTV",financialYear,"RTV");
      const rtvNumber = await getNextDocumentNumber(connection,"RTV",financialYear);
      const rtvDocumentId = await repository.insertRtvDocument(connection,{
        tenantId:user.tenantId,rtvNumber,rtvDate:input.returnDate,balanceId:Number(balanceId),
        grnRejectionId:balance.grn_rejection_id,grnId:balance.grn_id,supplierId:balance.supplier_id,
        dispatchReference:input.dispatchReference,transportMode,transportReference:input.transportReference,remarks:input.remarks,userCode:user.userCode,
      });
      await repository.insertRtvDocumentItem(connection,{
        rtvDocumentId,grnItemId:balance.grn_item_id,itemId:balance.item_id,itemCode:balance.item_code,
        itemDescription:balance.item_description_snapshot,uomCode:balance.uom_code_snapshot,quantity:input.quantity,
        rejectionReason:balance.rejection_reason_name_snapshot,
      });
      await repository.reserveRejectionBalance(connection,balanceId,input.quantity,user.userCode);
      await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId,grnRejectionId:balance.grn_rejection_id,
        transactionType:"RTV_SUBMITTED",quantityIn:0,quantityOut:0,balanceAfter:Number(balance.quantity_on_hand),
        remarks:`RTV ${rtvNumber} submitted for purchase approval. ${input.remarks}`,userCode:user.userCode });
      await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"RETURN_TO_VENDOR",
        entityId:rtvDocumentId,action:"RTV_SUBMITTED",newValue:{ balanceId:Number(balanceId),quantity:input.quantity,rtvNumber,rtvDate:input.returnDate },performedBy:user.userCode });
      return { balanceId:Number(balanceId),action:input.action,quantity:input.quantity,remainingQuantity:Number(balance.quantity_on_hand),
        reservedQuantity:Number(balance.quantity_reserved || 0) + input.quantity,status:"OPEN",
        rtvDocument:{ rtvDocumentId,rtvNumber,rtvDate:input.returnDate,documentStatus:"PENDING_APPROVAL",fileName:null,filePath:null,fileSizeBytes:null,fileUrl:null } };
    }

    if (!controlledResolutionActions.has(input.action)) throw new AppError("Unsupported rejection resolution action.");
    const financialYear = getFinancialYear(new Date(`${input.returnDate}T00:00:00`));
    const prefix = resolutionPrefix[input.action];
    await ensureDocumentSequence(connection,prefix,financialYear,prefix);
    const resolutionNumber = await getNextDocumentNumber(connection,prefix,financialYear);
    const requestId = await repository.insertRejectionResolutionRequest(connection,{
      tenantId:user.tenantId,resolutionNumber,action:input.action,resolutionDate:input.returnDate,balanceId:Number(balanceId),
      grnRejectionId:balance.grn_rejection_id,grnId:balance.grn_id,grnItemId:balance.grn_item_id,itemId:balance.item_id,
      customerId:input.action === "RETURN_TO_CUSTOMER" ? balance.customer_id : null,quantity:input.quantity,itemCode:balance.item_code,
      itemDescription:balance.item_description_snapshot,uomCode:balance.uom_code_snapshot,rejectionReason:balance.rejection_reason_name_snapshot,
      warehouseCode:input.warehouseCode,binLocation:input.binLocation,dispatchReference:input.dispatchReference,
      transportReference:input.transportReference,actionReference:input.actionReference,remarks:input.remarks,userCode:user.userCode,
    });
    await repository.reserveRejectionBalance(connection,balanceId,input.quantity,user.userCode);
    await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId,grnRejectionId:balance.grn_rejection_id,
      transactionType:"RESOLUTION_SUBMITTED",quantityIn:0,quantityOut:0,balanceAfter:Number(balance.quantity_on_hand),
      remarks:`${resolutionNumber} submitted for approval. ${input.remarks}`,userCode:user.userCode });
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REJECTION_RESOLUTION",
      entityId:requestId,action:"RESOLUTION_SUBMITTED",newValue:{ balanceId:Number(balanceId),action:input.action,quantity:input.quantity,resolutionNumber },performedBy:user.userCode });
    return { balanceId:Number(balanceId),action:input.action,quantity:input.quantity,remainingQuantity:Number(balance.quantity_on_hand),
      reservedQuantity:Number(balance.quantity_reserved || 0) + input.quantity,status:"OPEN",
      resolutionRequest:{ resolutionRequestId:requestId,resolutionNumber,resolutionAction:input.action,resolutionStatus:"PENDING_APPROVAL",resolutionDate:input.returnDate } };
  });
}

export async function approveReturnToVendor(rtvDocumentId, raw, user) {
  const approvalRemarks = String(raw.approvalRemarks || "").trim().slice(0,1000);
  return withTransaction(async (connection) => {
    const document = await repository.getRtvDocumentForUpdate(connection,user.tenantId,rtvDocumentId);
    if (!document) throw new AppError("RTV document not found.",404);
    if (document.document_status !== "PENDING_APPROVAL") throw new AppError("Only an RTV awaiting approval can be approved.",409);
    const pdf = await generateRtvPdf({
      rtvNumber:document.rtv_number,rtvDate:document.rtv_date,supplierName:document.supplier_name,supplierCode:document.supplier_code,
      grnNumber:document.grn_number,gateEntryNumber:document.gate_entry_number,itemCode:document.item_code_snapshot,
      itemDescription:document.item_description_snapshot,uomCode:document.uom_code_snapshot,quantity:document.returned_quantity,
      rejectionReason:document.rejection_reason_snapshot,dispatchReference:document.dispatch_reference,transportMode:document.transport_mode,transportReference:document.transport_reference,
      remarks:document.remarks,createdBy:document.created_by,approvedBy:user.userCode,approvedAt:new Date(),approvalRemarks,
    });
    await repository.approveRtvDocument(connection,rtvDocumentId,{ approvalRemarks,userCode:user.userCode,pdf });
    const approved = await repository.getRtvDocumentForUpdate(connection,user.tenantId,rtvDocumentId);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"RETURN_TO_VENDOR",entityId:rtvDocumentId,
      action:"RTV_APPROVED",newValue:{ rtvNumber:approved.rtv_number,approvalRemarks,pdfFilePath:pdf.filePath },performedBy:user.userCode });
    return rtvResponse(approved);
  });
}

export async function acknowledgeReturnToVendor(rtvDocumentId, raw, user) {
  const supplierContact = String(raw.supplierContact || "").trim().slice(0,160);
  const acknowledgementReference = String(raw.acknowledgementReference || "").trim().slice(0,250);
  if (!supplierContact || !acknowledgementReference) throw new AppError("Supplier contact and acknowledgement reference are required.");
  return withTransaction(async (connection) => {
    const document = await repository.getRtvDocumentForUpdate(connection,user.tenantId,rtvDocumentId);
    if (!document) throw new AppError("RTV document not found.",404);
    if (document.document_status !== "APPROVED") throw new AppError("Supplier acknowledgement can be recorded only after RTV approval.",409);
    await repository.acknowledgeRtvDocument(connection,rtvDocumentId,{ supplierContact,acknowledgementReference,userCode:user.userCode });
    const acknowledged = await repository.getRtvDocumentForUpdate(connection,user.tenantId,rtvDocumentId);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"RETURN_TO_VENDOR",entityId:rtvDocumentId,
      action:"RTV_SUPPLIER_ACKNOWLEDGED",newValue:{ rtvNumber:acknowledged.rtv_number,supplierContact,acknowledgementReference },performedBy:user.userCode });
    return rtvResponse(acknowledged);
  });
}

export async function dispatchReturnToVendor(rtvDocumentId, user) {
  return withTransaction(async (connection) => {
    const document = await repository.getRtvDocumentForUpdate(connection,user.tenantId,rtvDocumentId);
    if (!document) throw new AppError("RTV document not found.",404);
    if (document.document_status !== "ACKNOWLEDGED") throw new AppError("Supplier acknowledgement is required before RTV dispatch.",409);
    const quantity = Number(document.returned_quantity);
    if (quantity > Number(document.quantity_on_hand) || quantity > Number(document.quantity_reserved || 0)) {
      throw new AppError("Reserved RTV quantity is no longer available in rejection inventory.",409);
    }
    const remaining = Number(document.quantity_on_hand) - quantity;
    const reservedAfter = Number(document.quantity_reserved || 0) - quantity;
    await repository.consumeReservedRejectionBalance(connection,document.rejection_inventory_balance_id,remaining,reservedAfter,remaining > 0 ? "OPEN" : "RESOLVED",user.userCode);
    await repository.dispatchRtvDocument(connection,rtvDocumentId,user.userCode);
    await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId:document.rejection_inventory_balance_id,grnRejectionId:document.grn_rejection_id,
      transactionType:"RETURN_TO_VENDOR",quantityIn:0,quantityOut:quantity,balanceAfter:remaining,
      remarks:`RTV ${document.rtv_number} dispatched. ${document.dispatch_reference || ""}`.trim(),userCode:user.userCode });
    if (remaining === 0) await repository.closeGrnRejectionRecord(connection,user.tenantId,document.grn_rejection_id,user.userCode);
    const dispatched = await repository.getRtvDocumentForUpdate(connection,user.tenantId,rtvDocumentId);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"RETURN_TO_VENDOR",entityId:rtvDocumentId,
      action:"RTV_DISPATCHED",newValue:{ rtvNumber:dispatched.rtv_number,quantity,remaining },performedBy:user.userCode });
    return { ...rtvResponse(dispatched), quantity, remainingQuantity:remaining };
  });
}

export async function approveRejectionResolution(requestId, raw, user) {
  const approvalRemarks = String(raw.approvalRemarks || "").trim().slice(0,1000);
  return withTransaction(async (connection) => {
    const request = await repository.getRejectionResolutionForUpdate(connection,user.tenantId,requestId);
    if (!request) throw new AppError("Rejection resolution request not found.",404);
    if (request.resolution_status !== "PENDING_APPROVAL") throw new AppError("Only a pending rejection resolution can be approved.",409);
    const pdf = await generateResolutionPdf({
      resolutionNumber:request.resolution_number,action:request.resolution_action,resolutionDate:request.resolution_date,
      stockOwnerName:request.customer_name || "Company internal",grnNumber:request.grn_number,gateEntryNumber:request.gate_entry_number,
      actionReference:request.action_reference,warehouseCode:request.warehouse_code,binLocation:request.bin_location,
      itemCode:request.item_code_snapshot,itemDescription:request.item_description_snapshot,uomCode:request.uom_code_snapshot,
      quantity:request.quantity,rejectionReason:request.rejection_reason_snapshot,remarks:request.remarks,createdBy:request.created_by,
      approvedBy:user.userCode,approvedAt:new Date(),approvalRemarks,
    });
    await repository.approveRejectionResolution(connection,requestId,{ approvalRemarks,userCode:user.userCode,pdf });
    const approved = await repository.getRejectionResolutionForUpdate(connection,user.tenantId,requestId);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REJECTION_RESOLUTION",entityId:requestId,
      action:"RESOLUTION_APPROVED",newValue:{ resolutionNumber:approved.resolution_number,action:approved.resolution_action,approvalRemarks,pdfFilePath:pdf.filePath },performedBy:user.userCode });
    return resolutionResponse(approved);
  });
}

export async function acknowledgeReturnToCustomer(requestId, raw, user) {
  const partyContact = String(raw.partyContact || "").trim().slice(0,160);
  const acknowledgementReference = String(raw.acknowledgementReference || "").trim().slice(0,250);
  if (!partyContact || !acknowledgementReference) throw new AppError("Customer contact and acknowledgement reference are required.");
  return withTransaction(async (connection) => {
    const request = await repository.getRejectionResolutionForUpdate(connection,user.tenantId,requestId);
    if (!request) throw new AppError("Rejection resolution request not found.",404);
    if (request.resolution_action !== "RETURN_TO_CUSTOMER" || request.resolution_status !== "APPROVED") {
      throw new AppError("Customer acknowledgement can be recorded only for an approved customer return.",409);
    }
    await repository.acknowledgeCustomerReturn(connection,requestId,{ partyContact,acknowledgementReference,userCode:user.userCode });
    const acknowledged = await repository.getRejectionResolutionForUpdate(connection,user.tenantId,requestId);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REJECTION_RESOLUTION",entityId:requestId,
      action:"RETURN_TO_CUSTOMER_ACKNOWLEDGED",newValue:{ resolutionNumber:acknowledged.resolution_number,partyContact,acknowledgementReference },performedBy:user.userCode });
    return resolutionResponse(acknowledged);
  });
}

export async function executeRejectionResolution(requestId, raw, user) {
  const executionReference = String(raw.executionReference || "").trim().slice(0,250);
  return withTransaction(async (connection) => {
    const request = await repository.getRejectionResolutionForUpdate(connection,user.tenantId,requestId);
    if (!request) throw new AppError("Rejection resolution request not found.",404);
    const action = request.resolution_action;
    const quantity = Number(request.quantity);
    if (action === "RETURN_TO_CUSTOMER" && request.resolution_status !== "ACKNOWLEDGED") throw new AppError("Customer acknowledgement is required before dispatch.",409);
    if (["REWORK","SCRAP","DEVIATION_RELEASE"].includes(action) && request.resolution_status !== "APPROVED") throw new AppError("Approval is required before executing this resolution.",409);
    if (["SCRAP","DEVIATION_RELEASE"].includes(action) && !executionReference) throw new AppError("Enter the execution reference.");
    if (quantity > Number(request.quantity_on_hand) || quantity > Number(request.quantity_reserved || 0)) throw new AppError("Reserved resolution quantity is no longer available in rejection inventory.",409);
    const remaining = Number(request.quantity_on_hand) - quantity;
    const reservedAfter = Number(request.quantity_reserved || 0) - quantity;

    if (action === "REWORK") {
      const workReference = executionReference || request.action_reference;
      await repository.consumeReservedRejectionBalance(connection,request.rejection_inventory_balance_id,remaining,reservedAfter,remaining > 0 ? "OPEN" : "IN_REWORK",user.userCode);
      const reworkBalanceId = await repository.insertReworkBalance(connection,{ tenantId:user.tenantId,requestId:Number(requestId),balanceId:request.rejection_inventory_balance_id,
        grnRejectionId:request.grn_rejection_id,itemId:request.item_id,quantity,workReference,userCode:user.userCode });
      await repository.setResolutionExecution(connection,requestId,"IN_PROGRESS",{ executionReference:workReference,userCode:user.userCode });
      await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId:request.rejection_inventory_balance_id,grnRejectionId:request.grn_rejection_id,
        transactionType:"REWORK",quantityIn:0,quantityOut:quantity,balanceAfter:remaining,remarks:`${request.resolution_number} started. ${workReference}`,userCode:user.userCode });
      await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REJECTION_RESOLUTION",entityId:requestId,
        action:"REWORK_STARTED",newValue:{ resolutionNumber:request.resolution_number,reworkBalanceId,quantity,remaining,workReference },performedBy:user.userCode });
      return { ...resolutionResponse({ ...request,resolution_status:"IN_PROGRESS",execution_reference:workReference }),reworkBalanceId,remainingQuantity:remaining };
    }

    if (action === "DEVIATION_RELEASE") await repository.releaseRejectionToAvailableStock(connection,{
      tenantId:user.tenantId,companyId:request.company_id,plantId:request.plant_id,itemId:request.item_id,grnId:request.grn_id,
      grnItemId:request.grn_item_id,warehouseCode:request.warehouse_code,binLocation:request.bin_location,batchSerialNumber:request.balance_batch_serial_number,
      quantity,remarks:`${request.resolution_number}. ${request.remarks}`,userCode:user.userCode,stockOwnerType:request.balance_stock_owner_type,stockOwnerId:request.balance_stock_owner_id,
    });
    await repository.consumeReservedRejectionBalance(connection,request.rejection_inventory_balance_id,remaining,reservedAfter,remaining > 0 ? "OPEN" : "RESOLVED",user.userCode);
    await repository.setResolutionExecution(connection,requestId,"EXECUTED",{ executionReference,userCode:user.userCode });
    await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId:request.rejection_inventory_balance_id,grnRejectionId:request.grn_rejection_id,
      transactionType:action,quantityIn:0,quantityOut:quantity,balanceAfter:remaining,
      remarks:`${request.resolution_number} executed. ${executionReference || request.dispatch_reference || ""}`.trim(),userCode:user.userCode });
    if (remaining === 0) await repository.closeGrnRejectionRecord(connection,user.tenantId,request.grn_rejection_id,user.userCode);
    const executed = await repository.getRejectionResolutionForUpdate(connection,user.tenantId,requestId);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REJECTION_RESOLUTION",entityId:requestId,
      action:`${action}_EXECUTED`,newValue:{ resolutionNumber:executed.resolution_number,quantity,remaining,executionReference },performedBy:user.userCode });
    return { ...resolutionResponse(executed),remainingQuantity:remaining };
  });
}

export async function completeRework(reworkBalanceId, raw, user) {
  const remarks = String(raw.remarks || "").trim().slice(0,1000);
  if (!remarks) throw new AppError("Completion remarks are required before rework can move to re-inspection.");
  return withTransaction(async (connection) => {
    const rework = await repository.getReworkBalanceForUpdate(connection,user.tenantId,reworkBalanceId);
    if (!rework) throw new AppError("Rework record not found.",404);
    if (rework.status !== "IN_PROGRESS") throw new AppError("Only an in-progress rework record can be completed.",409);
    const quantity = Number(rework.quantity_in_process);
    await repository.completeReworkBalance(connection,reworkBalanceId,{ remarks,userCode:user.userCode });
    await repository.returnReworkedQuantityToQuarantine(connection,rework.rejection_inventory_balance_id,quantity,user.userCode);
    await repository.setResolutionStatus(connection,rework.rejection_resolution_request_id,"AWAITING_REINSPECTION",user.userCode);
    const balanceAfter = Number(rework.quantity_on_hand) + quantity;
    await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId:rework.rejection_inventory_balance_id,grnRejectionId:rework.grn_rejection_id,
      transactionType:"REWORK_RETURN",quantityIn:quantity,quantityOut:0,balanceAfter,remarks:`${rework.resolution_number} completed and returned for re-inspection. ${remarks}`,userCode:user.userCode });
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REJECTION_RESOLUTION",entityId:rework.rejection_resolution_request_id,
      action:"REWORK_COMPLETED",newValue:{ reworkBalanceId:Number(reworkBalanceId),quantity,balanceAfter,remarks },performedBy:user.userCode });
    return { reworkBalanceId:Number(reworkBalanceId),resolutionRequestId:Number(rework.rejection_resolution_request_id),resolutionNumber:rework.resolution_number,
      resolutionStatus:"AWAITING_REINSPECTION",quantity,quarantineQuantity:balanceAfter };
  });
}

export async function reinspectRework(reworkBalanceId, raw, user) {
  const decision = String(raw.decision || "").trim().toUpperCase();
  const acceptedQuantity = Number(raw.acceptedQuantity || 0);
  const rejectedQuantity = Number(raw.rejectedQuantity || 0);
  const qualityRemarks = String(raw.qualityRemarks || "").trim().slice(0,1000);
  const rejectionReason = String(raw.rejectionReason || "").trim().slice(0,500);
  if (!reinspectionDecisions.has(decision)) throw new AppError("Select the re-inspection decision.");
  if (!qualityRemarks) throw new AppError("Quality re-inspection remarks are required.");
  return withTransaction(async (connection) => {
    const rework = await repository.getReworkBalanceForUpdate(connection,user.tenantId,reworkBalanceId);
    if (!rework) throw new AppError("Rework record not found.",404);
    if (rework.status !== "AWAITING_REINSPECTION") throw new AppError("Only completed rework awaiting Quality re-inspection can be inspected.",409);
    const reworkQuantity = Number(rework.quantity_in_process);
    if (!Number.isFinite(acceptedQuantity) || !Number.isFinite(rejectedQuantity) || acceptedQuantity < 0 || rejectedQuantity < 0 || Math.abs(acceptedQuantity + rejectedQuantity - reworkQuantity) > 0.0001) {
      throw new AppError("Accepted and rejected quantities must exactly equal the completed rework quantity.");
    }
    if (decision === "ACCEPT_ALL" && (Math.abs(acceptedQuantity - reworkQuantity) > 0.0001 || rejectedQuantity > 0.0001)) throw new AppError("Accept all requires the complete rework quantity as accepted.");
    if (decision === "REJECT_ALL" && (acceptedQuantity > 0.0001 || Math.abs(rejectedQuantity - reworkQuantity) > 0.0001)) throw new AppError("Reject all requires the complete rework quantity as rejected.");
    if (decision === "PARTIALLY_ACCEPT" && (acceptedQuantity <= 0 || rejectedQuantity <= 0)) throw new AppError("Partial acceptance requires both accepted and rejected quantities.");
    if (rejectedQuantity > 0 && !rejectionReason) throw new AppError("Enter the rejection reason for material that fails re-inspection.");
    if (acceptedQuantity > Number(rework.quantity_on_hand)) throw new AppError("Accepted quantity is no longer available in rejection inventory.",409);

    const balanceAfter = Number(rework.quantity_on_hand) - acceptedQuantity;
    const reworkStatus = acceptedQuantity > 0 ? "READY_FOR_STOCK" : "REINSPECTED_REJECTED";
    const resolutionStatus = acceptedQuantity > 0 ? "READY_FOR_STOCK" : "REINSPECTED_REJECTED";
    await repository.recordReworkReinspection(connection,reworkBalanceId,{ status:reworkStatus,acceptedQuantity,rejectedQuantity,qualityRemarks,rejectionReason,userCode:user.userCode });
    await repository.updateRejectionBalance(connection,rework.rejection_inventory_balance_id,balanceAfter,balanceAfter > 0 ? "OPEN" : "RESOLVED",user.userCode);
    await repository.setResolutionStatus(connection,rework.rejection_resolution_request_id,resolutionStatus,user.userCode);
    await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId:rework.rejection_inventory_balance_id,grnRejectionId:rework.grn_rejection_id,
      transactionType:"REWORK_REINSPECTION",quantityIn:0,quantityOut:acceptedQuantity,balanceAfter,
      remarks:`${rework.resolution_number} re-inspected: ${decision}. Accepted ${acceptedQuantity}; rejected ${rejectedQuantity}. ${qualityRemarks}`,userCode:user.userCode });
    if (balanceAfter === 0) await repository.closeGrnRejectionRecord(connection,user.tenantId,rework.grn_rejection_id,user.userCode);
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REWORK_REINSPECTION",entityId:Number(reworkBalanceId),
      action:"REWORK_REINSPECTED",newValue:{ resolutionNumber:rework.resolution_number,decision,acceptedQuantity,rejectedQuantity,balanceAfter,qualityRemarks,rejectionReason },performedBy:user.userCode });
    return { reworkBalanceId:Number(reworkBalanceId),reworkStatus,resolutionRequestId:Number(rework.rejection_resolution_request_id),
      resolutionNumber:rework.resolution_number,resolutionStatus,acceptedQuantity,rejectedQuantity,remainingRejectedQuantity:balanceAfter };
  });
}

export async function postReworkedStock(reworkBalanceId, raw, user) {
  const stockPostingDate = String(raw.stockPostingDate || "").trim();
  const warehouseCode = String(raw.warehouseCode || "").trim().slice(0,80);
  const binLocation = String(raw.binLocation || "").trim().slice(0,80);
  const batchSerialNumber = String(raw.batchSerialNumber || "").trim().slice(0,120);
  if (!validDate.test(stockPostingDate)) throw new AppError("Enter a valid stock posting date.");
  if (!warehouseCode || !binLocation) throw new AppError("Warehouse and bin location are required to post reworked stock.");
  return withTransaction(async (connection) => {
    const rework = await repository.getReworkBalanceForUpdate(connection,user.tenantId,reworkBalanceId);
    if (!rework) throw new AppError("Rework record not found.",404);
    if (rework.status !== "READY_FOR_STOCK" || Number(rework.accepted_quantity) <= 0) throw new AppError("Only accepted rework ready for stock can be posted.",409);
    const quantity = Number(rework.accepted_quantity);
    const balanceAfter = await repository.releaseRejectionToAvailableStock(connection,{
      tenantId:user.tenantId,companyId:rework.company_id,plantId:rework.plant_id,itemId:rework.item_id,grnId:rework.grn_id,
      grnItemId:rework.grn_item_id,warehouseCode,binLocation,batchSerialNumber:batchSerialNumber || rework.balance_batch_serial_number,
      quantity,remarks:`Reworked material posted from ${rework.resolution_number}. ${rework.reinspection_remarks || ""}`.trim(),userCode:user.userCode,
      stockOwnerType:rework.balance_stock_owner_type,stockOwnerId:rework.balance_stock_owner_id,transactionType:"REWORK_RECEIPT",transactionDate:stockPostingDate,
    });
    await repository.recordReworkStockPosting(connection,reworkBalanceId,{ stockPostingDate,warehouseCode,binLocation,batchSerialNumber,userCode:user.userCode });
    await repository.setResolutionStatus(connection,rework.rejection_resolution_request_id,"POSTED",user.userCode);
    await repository.insertRejectionTransaction(connection,{ tenantId:user.tenantId,balanceId:rework.rejection_inventory_balance_id,grnRejectionId:rework.grn_rejection_id,
      transactionType:"REWORK_STOCK_RECEIPT",quantityIn:0,quantityOut:0,balanceAfter:Number(rework.quantity_on_hand),
      remarks:`${rework.resolution_number} accepted rework quantity ${quantity} posted to ${warehouseCode} / ${binLocation}.`,userCode:user.userCode });
    await recordAudit({ connection,tenantId:user.tenantId,module:"INVENTORY",entityType:"REWORK_REINSPECTION",entityId:Number(reworkBalanceId),
      action:"REWORK_STOCK_POSTED",newValue:{ resolutionNumber:rework.resolution_number,quantity,stockPostingDate,warehouseCode,binLocation,batchSerialNumber },performedBy:user.userCode });
    return { reworkBalanceId:Number(reworkBalanceId),reworkStatus:"POSTED",resolutionRequestId:Number(rework.rejection_resolution_request_id),
      resolutionNumber:rework.resolution_number,resolutionStatus:"POSTED",postedQuantity:quantity,warehouseCode,binLocation,batchSerialNumber:batchSerialNumber || rework.balance_batch_serial_number,inventoryBalanceAfter:balanceAfter };
  });
}

function readCustomerJobInput(raw) {
  return {
    stockBalanceId: Number(raw.stockBalanceId),
    customerMaterialJobBalanceId: Number(raw.customerMaterialJobBalanceId),
    enquiryId: raw.enquiryId === undefined || raw.enquiryId === null || raw.enquiryId === "" ? null : Number(raw.enquiryId),
    jobReference: String(raw.jobReference || "").trim().slice(0, 120),
    quantity: Number(raw.quantity),
    transactionDate: String(raw.transactionDate || todayInAppTimeZone()).trim(),
    referenceNumber: String(raw.referenceNumber || "").trim().slice(0, 160),
    remarks: String(raw.remarks || "").trim().slice(0, 1000),
  };
}

function assertCustomerJobInput(input, mode) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new AppError("Quantity must be greater than zero.");
  if (!validDate.test(input.transactionDate)) throw new AppError("Enter a valid transaction date.");
  if (!input.remarks) throw new AppError("Remarks are required for customer material movement.");
  if (mode === "ISSUE" && (!Number.isFinite(input.stockBalanceId) || input.stockBalanceId <= 0)) throw new AppError("Select the customer-owned stock line.");
  if (mode === "ISSUE" && !input.jobReference) throw new AppError("Job or process reference is required.");
  if (input.enquiryId !== null && (!Number.isInteger(input.enquiryId) || input.enquiryId <= 0)) throw new AppError("Select a valid customer enquiry.");
  if (mode !== "ISSUE" && (!Number.isFinite(input.customerMaterialJobBalanceId) || input.customerMaterialJobBalanceId <= 0)) {
    throw new AppError("Customer job material record not found.");
  }
}

export async function issueCustomerMaterialToJob(raw, user) {
  const input = readCustomerJobInput(raw);
  assertCustomerJobInput(input, "ISSUE");
  return withTransaction(async (connection) => {
    const stock = await repository.getCustomerStockBalanceForUpdate(connection, user.tenantId, input.stockBalanceId);
    if (!stock) throw new AppError("Customer-owned stock record not found.", 404);
    if (input.quantity > Number(stock.quantity_on_hand)) throw new AppError("Issue quantity exceeds the available customer-owned stock.", 409);
    let enquiry = null;
    if (input.enquiryId !== null) {
      enquiry = await repository.getEnquiryForCustomer(connection, input.enquiryId, stock.customer_id);
      if (!enquiry) throw new AppError("The selected enquiry does not belong to this customer.", 409);
    }
    const balanceAfter = Number(stock.quantity_on_hand) - input.quantity;
    await repository.reduceCustomerStockBalance(connection, input.stockBalanceId, input.quantity, user.userCode);
    const jobBalanceId = await repository.insertCustomerMaterialJobBalance(connection, {
      tenantId: user.tenantId, customerId: stock.customer_id, enquiryId: input.enquiryId, jobReference: input.jobReference,
      inventoryStockBalanceId: input.stockBalanceId, itemId: stock.item_id, quantity: input.quantity, userCode: user.userCode,
    });
    await repository.insertCustomerMaterialJobTransaction(connection, {
      tenantId: user.tenantId, customerMaterialJobBalanceId: jobBalanceId, transactionType: "ISSUE_TO_JOB",
      quantityIn: input.quantity, quantityOut: 0, balanceAfter: input.quantity, referenceNumber: input.referenceNumber,
      remarks: input.remarks, userCode: user.userCode,
    });
    await repository.insertCustomerStockTransaction(connection, {
      tenantId: user.tenantId, companyId: stock.company_id, plantId: stock.plant_id, transactionType: "CUSTOMER_JOB_ISSUE",
      transactionDate: input.transactionDate, itemId: stock.item_id, warehouseCode: stock.warehouse_code, binLocation: stock.bin_location,
      batchSerialNumber: stock.batch_serial_number, quantityIn: 0, quantityOut: input.quantity, balanceAfter,
      remarks: `Issued to ${input.jobReference}${enquiry ? ` (${enquiry.doc_no})` : ""}. ${input.remarks}`, userCode: user.userCode,
      customerId: stock.customer_id,
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "CUSTOMER_MATERIAL_JOB",
      entityId: jobBalanceId, action: "CUSTOMER_MATERIAL_ISSUED_TO_JOB", newValue: {
        customerId: Number(stock.customer_id), stockBalanceId: input.stockBalanceId, enquiryId: input.enquiryId,
        jobReference: input.jobReference, quantity: input.quantity, balanceAfter,
      }, performedBy: user.userCode });
    return { customerMaterialJobBalanceId: jobBalanceId, customerId: Number(stock.customer_id), customerName: stock.customer_name,
      enquiryId: input.enquiryId, enquiryNumber: enquiry?.doc_no || null, jobReference: input.jobReference,
      issuedQuantity: input.quantity, remainingCustomerStock: balanceAfter };
  });
}

async function getCustomerJobAndSourceStock(connection, user, customerMaterialJobBalanceId) {
  const job = await repository.getCustomerMaterialJobBalanceForUpdate(connection, user.tenantId, customerMaterialJobBalanceId);
  if (!job) throw new AppError("Customer job material record not found.", 404);
  if (job.status !== "OPEN" || Number(job.quantity_in_process) <= 0) throw new AppError("This customer job material record is already closed.", 409);
  const stock = await repository.getCustomerStockBalanceForUpdate(connection, user.tenantId, job.inventory_stock_balance_id);
  if (!stock || Number(stock.customer_id) !== Number(job.customer_id)) throw new AppError("The source customer stock record is unavailable.", 409);
  return { job, stock };
}

export async function returnCustomerMaterialFromJob(raw, user) {
  const input = readCustomerJobInput(raw);
  assertCustomerJobInput(input, "RETURN");
  return withTransaction(async (connection) => {
    const { job, stock } = await getCustomerJobAndSourceStock(connection, user, input.customerMaterialJobBalanceId);
    if (input.quantity > Number(job.quantity_in_process)) throw new AppError("Return quantity exceeds the material held by this job.", 409);
    const jobBalanceAfter = Number(job.quantity_in_process) - input.quantity;
    const stockBalanceAfter = Number(stock.quantity_on_hand) + input.quantity;
    await repository.restoreCustomerStockBalance(connection, stock.inventory_stock_balance_id, input.quantity, user.userCode);
    await repository.updateCustomerMaterialJobBalance(connection, job.customer_material_job_balance_id, jobBalanceAfter, user.userCode);
    await repository.insertCustomerMaterialJobTransaction(connection, {
      tenantId: user.tenantId, customerMaterialJobBalanceId: job.customer_material_job_balance_id, transactionType: "RETURN_FROM_JOB",
      quantityIn: 0, quantityOut: input.quantity, balanceAfter: jobBalanceAfter, referenceNumber: input.referenceNumber,
      remarks: input.remarks, userCode: user.userCode,
    });
    await repository.insertCustomerStockTransaction(connection, {
      tenantId: user.tenantId, companyId: stock.company_id, plantId: stock.plant_id, transactionType: "CUSTOMER_JOB_RETURN",
      transactionDate: input.transactionDate, itemId: stock.item_id, warehouseCode: stock.warehouse_code, binLocation: stock.bin_location,
      batchSerialNumber: stock.batch_serial_number, quantityIn: input.quantity, quantityOut: 0, balanceAfter: stockBalanceAfter,
      remarks: `Returned from ${job.job_reference}. ${input.remarks}`, userCode: user.userCode, customerId: stock.customer_id,
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "CUSTOMER_MATERIAL_JOB",
      entityId: job.customer_material_job_balance_id, action: "CUSTOMER_MATERIAL_RETURNED_FROM_JOB", newValue: {
        customerId: Number(job.customer_id), quantity: input.quantity, jobBalanceAfter, stockBalanceAfter,
      }, performedBy: user.userCode });
    return { customerMaterialJobBalanceId: Number(job.customer_material_job_balance_id), returnedQuantity: input.quantity,
      remainingJobQuantity: jobBalanceAfter, customerStockQuantity: stockBalanceAfter };
  });
}

export async function consumeCustomerMaterialForJob(raw, user) {
  const input = readCustomerJobInput(raw);
  assertCustomerJobInput(input, "CONSUME");
  return withTransaction(async (connection) => {
    const { job } = await getCustomerJobAndSourceStock(connection, user, input.customerMaterialJobBalanceId);
    if (input.quantity > Number(job.quantity_in_process)) throw new AppError("Consumed quantity exceeds the material held by this job.", 409);
    const jobBalanceAfter = Number(job.quantity_in_process) - input.quantity;
    await repository.updateCustomerMaterialJobBalance(connection, job.customer_material_job_balance_id, jobBalanceAfter, user.userCode);
    await repository.insertCustomerMaterialJobTransaction(connection, {
      tenantId: user.tenantId, customerMaterialJobBalanceId: job.customer_material_job_balance_id, transactionType: "CONSUMED_IN_JOB",
      quantityIn: 0, quantityOut: input.quantity, balanceAfter: jobBalanceAfter, referenceNumber: input.referenceNumber,
      remarks: input.remarks, userCode: user.userCode,
    });
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "CUSTOMER_MATERIAL_JOB",
      entityId: job.customer_material_job_balance_id, action: "CUSTOMER_MATERIAL_CONSUMED_IN_JOB", newValue: {
        customerId: Number(job.customer_id), quantity: input.quantity, jobBalanceAfter, referenceNumber: input.referenceNumber,
      }, performedBy: user.userCode });
    return { customerMaterialJobBalanceId: Number(job.customer_material_job_balance_id), consumedQuantity: input.quantity,
      remainingJobQuantity: jobBalanceAfter };
  });
}

function readReturnToCustomerInput(raw) {
  const items = Array.isArray(raw.items) ? raw.items.map((item) => ({ balanceId: Number(item.balanceId), quantity: Number(item.quantity) })) : [];
  return {
    returnDate: String(raw.returnDate || todayInAppTimeZone()).trim(),
    dispatchReference: String(raw.dispatchReference || "").trim().slice(0, 160),
    transportMode: String(raw.transportMode || "").trim().toUpperCase(),
    transportReference: String(raw.transportReference || "").trim().slice(0, 160),
    remarks: String(raw.remarks || "").trim().slice(0, 1000),
    items,
  };
}

function assertReturnToCustomerInput(input) {
  if (!validDate.test(input.returnDate)) throw new AppError("Enter a valid planned return date.");
  if (!input.transportMode) throw new AppError("Select the actual transport mode for the return shipment.");
  if (!input.remarks) throw new AppError("Return remarks are required.");
  if (!input.items.length || input.items.length > 50) throw new AppError("Select between one and fifty rejected customer-material lines.");
  const seen = new Set();
  for (const item of input.items) {
    if (!Number.isInteger(item.balanceId) || item.balanceId <= 0 || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new AppError("Each customer-return line requires a valid rejected inventory record and quantity.");
    }
    if (seen.has(item.balanceId)) throw new AppError("A rejected inventory line can appear only once in a Return-to-Customer document.");
    seen.add(item.balanceId);
  }
}

export async function createReturnToCustomerDocument(raw, user) {
  const input = readReturnToCustomerInput(raw);
  assertReturnToCustomerInput(input);
  return withTransaction(async (connection) => {
    const balances = [];
    for (const line of input.items) {
      const balance = await repository.getRejectionInventoryForUpdate(connection, user.tenantId, line.balanceId);
      if (!balance) throw new AppError("A selected rejected inventory record no longer exists.", 404);
      const available = Number(balance.quantity_on_hand) - Number(balance.quantity_reserved || 0);
      if (balance.responsible_party !== "CUSTOMER" || balance.stock_owner_type !== "CUSTOMER") {
        throw new AppError("Only customer-owned rejected material can be added to a Return-to-Customer document.", 409);
      }
      if (balance.status !== "OPEN" || line.quantity > available) throw new AppError("A selected return quantity exceeds its available quarantined balance.", 409);
      balances.push({ balance, quantity: line.quantity });
    }
    const customerId = Number(balances[0].balance.customer_id);
    if (!customerId || balances.some(({ balance }) => Number(balance.customer_id) !== customerId)) {
      throw new AppError("A Return-to-Customer document can contain items for one customer only.", 409);
    }
    const financialYear = getFinancialYear(new Date(`${input.returnDate}T00:00:00`));
    const transportMode = await assertPartyTransportMode({ selectedMode: input.transportMode, allowedModes: balances[0].balance.customer_allowed_transport_modes || balances[0].balance.customer_transport_mode, partyLabel: "Customer", connection });
    await ensureDocumentSequence(connection, "RTC", financialYear, "RTC");
    const rtcNumber = await getNextDocumentNumber(connection, "RTC", financialYear);
    const first = balances[0].balance;
    const documentId = await repository.insertReturnToCustomerDocument(connection, {
      tenantId: user.tenantId, rtcNumber, rtcDate: input.returnDate, customerId, customerCode: first.customer_code,
      customerName: first.customer_name, dispatchReference: input.dispatchReference, transportMode, transportReference: input.transportReference,
      remarks: input.remarks, userCode: user.userCode,
    });
    for (const { balance, quantity } of balances) {
      await repository.insertReturnToCustomerDocumentItem(connection, {
        documentId, balanceId: balance.rejection_inventory_balance_id, grnRejectionId: balance.grn_rejection_id,
        grnId: balance.grn_id, grnItemId: balance.grn_item_id, itemId: balance.item_id, grnNumber: balance.grn_number,
        itemCode: balance.item_code, itemDescription: balance.item_description_snapshot, uomCode: balance.uom_code_snapshot,
        quantity, rejectionReason: balance.rejection_reason_name_snapshot,
      });
      await repository.reserveRejectionBalance(connection, balance.rejection_inventory_balance_id, quantity, user.userCode);
      await repository.insertRejectionTransaction(connection, {
        tenantId: user.tenantId, balanceId: balance.rejection_inventory_balance_id, grnRejectionId: balance.grn_rejection_id,
        transactionType: "RTC_SUBMITTED", quantityIn: 0, quantityOut: 0, balanceAfter: Number(balance.quantity_on_hand),
        remarks: `${rtcNumber} submitted for approval. ${input.remarks}`, userCode: user.userCode,
      });
    }
    const document = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "RETURN_TO_CUSTOMER",
      entityId: documentId, action: "RTC_SUBMITTED", newValue: { rtcNumber, customerId, itemCount: balances.length,
        totalQuantity: balances.reduce((total, line) => total + line.quantity, 0) }, performedBy: user.userCode });
    return returnToCustomerDocumentResponse(document);
  });
}

export async function approveReturnToCustomerDocument(documentId, raw, user) {
  const approvalRemarks = String(raw.approvalRemarks || "").trim().slice(0, 1000);
  return withTransaction(async (connection) => {
    const document = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    if (!document) throw new AppError("Return-to-Customer document not found.", 404);
    if (document.document_status !== "PENDING_APPROVAL") throw new AppError("Only a Return-to-Customer document awaiting approval can be approved.", 409);
    const pdf = await generateReturnToCustomerPdf({
      rtcNumber: document.rtc_number, rtcDate: document.rtc_date, customerName: document.customer_name_snapshot,
      customerCode: document.customer_code_snapshot, dispatchReference: document.dispatch_reference, transportMode: document.transport_mode, transportReference: document.transport_reference,
      remarks: document.remarks, createdBy: document.created_by, approvedBy: user.userCode, approvedAt: new Date(), approvalRemarks,
      items: document.items.map((item) => ({ grnNumber: item.grn_number_snapshot, itemCode: item.item_code_snapshot,
        itemDescription: item.item_description_snapshot, uomCode: item.uom_code_snapshot, quantity: item.returned_quantity,
        rejectionReason: item.rejection_reason_snapshot })),
    });
    await repository.approveReturnToCustomerDocument(connection, documentId, { approvalRemarks, userCode: user.userCode, pdf });
    const approved = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "RETURN_TO_CUSTOMER",
      entityId: Number(documentId), action: "RTC_APPROVED", newValue: { rtcNumber: approved.rtc_number, approvalRemarks, pdfFilePath: pdf.filePath }, performedBy: user.userCode });
    return returnToCustomerDocumentResponse(approved);
  });
}

export async function acknowledgeReturnToCustomerDocument(documentId, raw, user) {
  const customerContact = String(raw.customerContact || "").trim().slice(0, 160);
  const acknowledgementReference = String(raw.acknowledgementReference || "").trim().slice(0, 250);
  if (!customerContact || !acknowledgementReference) throw new AppError("Customer contact and acknowledgement reference are required.");
  return withTransaction(async (connection) => {
    const document = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    if (!document) throw new AppError("Return-to-Customer document not found.", 404);
    if (document.document_status !== "APPROVED") throw new AppError("Customer acknowledgement can be recorded only after Return-to-Customer approval.", 409);
    await repository.acknowledgeReturnToCustomerDocument(connection, documentId, { customerContact, acknowledgementReference, userCode: user.userCode });
    const acknowledged = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "RETURN_TO_CUSTOMER",
      entityId: Number(documentId), action: "RTC_CUSTOMER_ACKNOWLEDGED", newValue: { rtcNumber: acknowledged.rtc_number, customerContact, acknowledgementReference }, performedBy: user.userCode });
    return returnToCustomerDocumentResponse(acknowledged);
  });
}

export async function dispatchReturnToCustomerDocument(documentId, raw, user) {
  const gateExitReference = String(raw.gateExitReference || "").trim().slice(0, 160);
  if (!gateExitReference) throw new AppError("Gate exit or delivery challan reference is required before dispatch.");
  return withTransaction(async (connection) => {
    const document = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    if (!document) throw new AppError("Return-to-Customer document not found.", 404);
    if (document.document_status !== "ACKNOWLEDGED") throw new AppError("Customer acknowledgement is required before dispatch.", 409);
    for (const item of document.items) {
      const quantity = Number(item.returned_quantity);
      if (quantity > Number(item.quantity_on_hand) || quantity > Number(item.quantity_reserved || 0)) {
        throw new AppError("A reserved Return-to-Customer quantity is no longer available in quarantine.", 409);
      }
      const remaining = Number(item.quantity_on_hand) - quantity;
      const reservedAfter = Number(item.quantity_reserved || 0) - quantity;
      await repository.consumeReservedRejectionBalance(connection, item.rejection_inventory_balance_id, remaining, reservedAfter,
        remaining > 0 ? "OPEN" : "RESOLVED", user.userCode);
      await repository.insertRejectionTransaction(connection, {
        tenantId: user.tenantId, balanceId: item.rejection_inventory_balance_id, grnRejectionId: item.grn_rejection_id,
        transactionType: "RETURN_TO_CUSTOMER", quantityIn: 0, quantityOut: quantity, balanceAfter: remaining,
        remarks: `${document.rtc_number} dispatched through gate exit ${gateExitReference}.`, userCode: user.userCode,
      });
      if (remaining === 0) await repository.closeGrnRejectionRecord(connection, user.tenantId, item.grn_rejection_id, user.userCode);
    }
    await repository.dispatchReturnToCustomerDocument(connection, documentId, { gateExitReference, userCode: user.userCode });
    const dispatched = await repository.getReturnToCustomerDocumentForUpdate(connection, user.tenantId, documentId);
    await recordAudit({ connection, tenantId: user.tenantId, module: "INVENTORY", entityType: "RETURN_TO_CUSTOMER",
      entityId: Number(documentId), action: "RTC_DISPATCHED", newValue: { rtcNumber: dispatched.rtc_number, gateExitReference,
        itemCount: dispatched.items.length }, performedBy: user.userCode });
    return returnToCustomerDocumentResponse(dispatched);
  });
}
