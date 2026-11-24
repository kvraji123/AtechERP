import { withTransaction } from "../../config/db.js";
import { recordGrnToolReceipt } from "../tooling/tooling.service.js";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { transitionOrThrow } from "../../shared/services/workflow.service.js";
import { GRN_TRANSITIONS } from "../../shared/constants/purchase.js";
import * as repository from "./grn.repository.js";
import * as rejectionRepository from "./grn-rejection.repository.js";
import * as inventoryRepository from "../inventory/inventory.repository.js";
import * as locationMasterRepository from "../location-master/location-master.repository.js";
import { validateGrn, validateGrnStockPosting } from "./grn.validation.js";
import { markGrnCreated, markOutsourcingWip, markStockPosted } from "../gate-entry/gate-entry.service.js";

const inspectionDispositions = new Set(["HOLD", "FULL_INSPECTION", "REJECT_LOT", "PARTIAL_ACCEPT", "DEVIATION_ACCEPT"]);
const inspectionResults = new Set(["PENDING", "PASS", "FAIL"]);
const inspectionLineResults = new Set(["PENDING", "ACCEPTED", "PARTIAL", "REJECTED", "ON_HOLD"]);
const storageLocationKey = (warehouseName, subinventoryCode, locationName) => `${String(warehouseName || "").trim().toUpperCase()}\u0000${String(subinventoryCode || "").trim().toUpperCase()}\u0000${String(locationName || "").trim().toUpperCase()}`;

async function addInspectionPlanSnapshot(connection, tenantId, grnItemId, itemId, userCode) {
  const plan = await repository.getItemInspectionPlan(connection, itemId);
  if (plan.length) await repository.insertInspectionCharacteristics(connection, tenantId, grnItemId, plan, userCode);
}

export async function list(query, user) { const page = Math.max(Number(query.page || 1), 1); const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100); const result = await repository.list({ tenantId: user.tenantId, status: String(query.status || "").toUpperCase(), search: String(query.search || "").trim(), receiptType: String(query.receiptType || "").trim().toUpperCase(), supplier: String(query.supplier || "").trim(), rejectedInspection: String(query.rejectedInspection || "").trim().toLowerCase() === "true", limit: pageSize, offset: (page - 1) * pageSize }); return { ...result, page, pageSize }; }
export async function summary(user) { return repository.summary(user.tenantId); }
export async function pendingPoReceipts(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const result = await repository.listPendingPoReceipts({ tenantId: user.tenantId, search: String(query.search || "").trim(), limit: pageSize, offset: (page - 1) * pageSize });
  return { ...result, page, pageSize };
}
export async function listSupplierOptions(user) { return repository.listSupplierOptions(user.tenantId); }
export async function get(id, user) { const result = await repository.get(id, user.tenantId); if (!result) throw new AppError("GRN not found.", 404); return result; }

async function saveReceipt(id, raw, user) {
  const data = validateGrn(raw);
  return withTransaction(async connection => {
    let existing = null;
    if (id) {
      existing = await repository.get(id, user.tenantId, connection, true);
      if (!existing) throw new AppError('GRN not found.', 404);
      if (existing.status !== 'DRAFT') throw new AppError('Only draft GRNs can be updated.', 409);
      if (Number(existing.gate_entry_id) !== data.gateEntryId) throw new AppError('The gate entry cannot be changed after saving a GRN draft.', 409);
    }
    const customerSupplied = data.receiptType === 'CUSTOMER_SUPPLIED';
    const outsourcing = data.receiptType === 'OUTSOURCING_PRODUCT';
    const direct = customerSupplied || data.receiptType === 'OPEN_PURCHASE' || outsourcing;
    const expectedGateType = { REGULAR_PURCHASE: 'REGULAR_PURCHASE', CUSTOMER_SUPPLIED: 'CUSTOMER_PURCHASE', OPEN_PURCHASE: 'OPEN_PURCHASE', OUTSOURCING_PRODUCT: 'OUTSOURCING_PARTS' }[data.receiptType];
    const gate = await repository.getGateEntry(connection, user.tenantId, data.gateEntryId, true);
    if (!gate || !['GATE_ENTERED', 'GRN_CREATED'].includes(gate.status)) throw new AppError('The selected gate entry is not ready for GRN inward.', 409);
    if (gate.entry_type !== expectedGateType) throw new AppError('Receipt type must match the type selected on the gate entry.', 409);
    if (!id && gate.status !== 'GATE_ENTERED') throw new AppError('A GRN has already been created for this gate entry.', 409);
    if (!direct && Number(gate.purchase_order_id) !== data.purchaseOrderId) throw new AppError('The selected purchase order must match the gate entry.', 409);
    if (customerSupplied && Number(gate.customer_id) !== data.customerId) throw new AppError('The selected customer must match the gate entry.', 409);
    if (['OPEN_PURCHASE', 'OUTSOURCING_PRODUCT'].includes(data.receiptType) && Number(gate.supplier_id) !== data.supplierId) throw new AppError('The selected supplier must match the gate entry.', 409);
    const order = direct ? null : await repository.getApprovedOrder(connection, user.tenantId, data.purchaseOrderId) || await repository.getReceivableOrder(connection, user.tenantId, data.purchaseOrderId);
    if (!direct && !order) throw new AppError('Only approved or partially received purchase orders can have an inward entry.', 409);
    const supplier = ['OPEN_PURCHASE', 'OUTSOURCING_PRODUCT'].includes(data.receiptType) ? await repository.getOpenPurchaseSupplier(connection, data.supplierId) : null;
    if (['OPEN_PURCHASE', 'OUTSOURCING_PRODUCT'].includes(data.receiptType) && !supplier) throw new AppError('The selected supplier is not active.', 409);
    const customer = customerSupplied ? await repository.getReceiptCustomer(connection, data.customerId) : null;
    if (customerSupplied && !customer) throw new AppError('The selected customer is not active.', 409);
    if (customer) data.customerName = customer.customer_name;
    const outsourcingPart = outsourcing ? await repository.getActiveOutsourcingPart(connection, gate.part_id) : null;
    if (outsourcing && !outsourcingPart) throw new AppError('The gate entry must contain an active Part Master part for an outsourced receipt.', 409);
    const processOperation = outsourcing ? await repository.getOutsourcingProcessOperation(connection, gate.part_id) : null;
    if (outsourcing && data.action === 'INWARD' && !processOperation) throw new AppError('Approve a Process Plan with an outsourced operation for the selected part before submitting GRN inward.', 409);
    const directItems = direct && !outsourcing ? await repository.getOpenPurchaseItems(connection, data.items.map(item => item.itemId)) : [];
    if (direct && !outsourcing && directItems.length !== data.items.length) throw new AppError('Every direct receipt line must use an active Item Master item.', 409);
    const byId = new Map((order?.items || []).map(item => [Number(item.purchase_order_item_id), item]));
    const reservedByPoItem = new Map((!direct && order
      ? await repository.getInFlightGrnQuantities(connection, user.tenantId, order.purchase_order_id, id)
      : []).map((row) => [Number(row.purchaseOrderItemId), Number(row.reservedQuantity || 0)]));
    const directById = new Map(directItems.map(item => [Number(item.item_id), item]));
    if (!outsourcing && data.action === 'INWARD') {
      const inspectedItems = data.items.filter((row) => row.inspectionRequired).map((row) => direct ? directById.get(row.itemId) : byId.get(row.purchaseOrderItemId));
      const missingSetup = [];
      for (const item of inspectedItems) {
        const itemId = Number(item?.item_id);
        const inspectionRequired = String(item?.inspection_required ?? item?.item_inspection_required ?? 'N').toUpperCase() === 'Y';
        const plan = inspectionRequired ? await repository.getItemInspectionPlan(connection, itemId) : [];
        if (!inspectionRequired || !plan.length) missingSetup.push(item);
      }
      if (missingSetup.length) {
        const names = missingSetup.map((item) => item?.item_description || item?.item_description_snapshot || 'selected item').join(', ');
        throw new AppError(`Update Item Master inspection details for ${names} before proceeding with GRN Inward.`, 409, { code: 'ITEM_MASTER_INSPECTION_SETUP_REQUIRED' });
      }
    }
    const status = data.action === 'INWARD' ? (outsourcing ? 'OUTSOURCING_WIP' : data.inspectionRequired === false ? 'ACCEPTED' : 'INSPECTION_PENDING') : 'DRAFT';
    const inspectionStatus = outsourcing ? 'PROCESS_PLAN_PENDING' : data.inspectionRequired === false ? 'NOT_REQUIRED' : 'PENDING';
    const supplierId = order?.supplier_id || supplier?.supplier_id || null;
    const supplierName = order?.supplier_name_snapshot || supplier?.supplier_name || '';
    let grnId = id;
    let grnNumber = existing?.grn_number || null;
    if (id) {
      await repository.updateDraftHeader(connection, id, user.tenantId, [data.grnDate, data.receiptType, data.customerId, outsourcingPart?.part_id || null, outsourcingPart?.part_number || null, outsourcingPart?.part_name || null, outsourcingPart?.unit_of_measurement || null, processOperation?.process_plan_id || null, processOperation?.process_operation_id || null, data.customerName, data.customerPlantCode, data.gateEntryNumber || null, data.gateEntryId, data.supplierInvoiceNumber || null, data.supplierInvoiceDate || null, data.deliveryChallanNumber || null, data.receivedBy || null, inspectionStatus, status, data.remarks || null, user.userCode]);
      await repository.replaceItems(connection, id, user.tenantId);
    } else {
      const number = await getNextDocumentNumber(connection, 'GRN', getFinancialYear());
      grnNumber = number;
      grnId = await repository.insertHeader(connection, [user.tenantId, user.companyId, order?.plant_id || gate.plant_id || null, number, data.grnDate, data.receiptType, order?.purchase_order_id || null, gate.gate_entry_number, data.gateEntryId, supplierId, data.customerId, outsourcingPart?.part_id || null, outsourcingPart?.part_number || null, outsourcingPart?.part_name || null, outsourcingPart?.unit_of_measurement || null, processOperation?.process_plan_id || null, processOperation?.process_operation_id || null, data.customerName, data.customerPlantCode, supplierName, data.supplierInvoiceNumber || null, data.supplierInvoiceDate || null, data.deliveryChallanNumber || null, data.receivedBy || null, inspectionStatus, status, data.remarks || null, user.userCode]);
    }
    await repository.updateReceiptReferences(connection, grnId, user.tenantId, [order?.purchase_order_id || null, order?.plant_id || gate.plant_id || null, supplierId, supplierName, null, data.jobReference || null]);
    for (const row of data.items) {
      const item = outsourcing ? null : direct ? directById.get(row.itemId) : byId.get(row.purchaseOrderItemId);
      if (!outsourcing && !item) throw new AppError('A GRN line does not belong to the selected purchase order.', 409);
      const previous = direct ? 0 : Number(item.received_quantity || 0) + Number(reservedByPoItem.get(Number(item.purchase_order_item_id)) || 0);
      if (!direct && previous + row.receivedQuantity > Number(item.ordered_quantity) + 0.0001) throw new AppError('Received quantity exceeds the remaining PO quantity after other GRN inwards.', 409);
      const mtcApplicable = !outsourcing && String(direct ? item.mtc_applicable : item.item_mtc_applicable || 'N').toUpperCase() === 'Y' ? 'Y' : 'N';
      const grnItemId = await repository.insertItem(connection, [user.tenantId, grnId, direct ? null : item.purchase_order_item_id, outsourcing ? null : item.item_id, outsourcing ? outsourcingPart.part_name : direct ? item.item_description : item.item_description_snapshot, outsourcing ? outsourcingPart.unit_of_measurement || '' : direct ? item.uom_code : item.uom_code_snapshot, direct ? row.receivedQuantity : item.ordered_quantity, previous, row.receivedQuantity, outsourcing ? null : direct ? row.directRatePerQty : null, outsourcing ? null : direct ? row.taxPercent : null, status === 'ACCEPTED' ? row.receivedQuantity : 0, 0, null, 'N', mtcApplicable]);
      await repository.updateStockReceiptItem(connection, user.tenantId, grnItemId, [null, 'GENERAL', null, String(row.batchSerialNumber || '').trim() || null]);
      if (outsourcing && data.action === 'INWARD') await repository.createOutsourcingWipBalance(connection, { tenantId:user.tenantId, companyId:user.companyId, plantId:order?.plant_id || gate.plant_id || null, grnId, grnItemId, gateEntryId:data.gateEntryId, supplierId, partId:outsourcingPart.part_id, partNumber:outsourcingPart.part_number, partName:outsourcingPart.part_name, uomCode:outsourcingPart.unit_of_measurement || '', batchSerialNumber:row.batchSerialNumber, processPlanId:processOperation.process_plan_id, processOperationId:processOperation.process_operation_id, processPlanCode:processOperation.plan_code || null, operationNumber:processOperation.operation_number, operationName:processOperation.operation_name, inspectionRequired:processOperation.inspection_required || 'N', quantity:row.receivedQuantity, grnNumber, userCode:user.userCode });
      if (!outsourcing && row.inspectionRequired) await addInspectionPlanSnapshot(connection, user.tenantId, grnItemId, item.item_id, user.userCode);
    }
    if (data.gateEntryId && data.action === 'INWARD') {
      if (outsourcing) await markOutsourcingWip(connection, data.gateEntryId, user);
      else await markGrnCreated(connection, data.gateEntryId, user);
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: 'PURCHASE', entityType: 'GRN', entityId: grnId, action: id ? 'GRN_UPDATED' : 'GRN_CREATED', newValue: { receiptType: data.receiptType, status }, performedBy: user.userCode });
    return repository.get(grnId, user.tenantId, connection);
  });
}
export async function create(raw, user) { return saveReceipt(null, raw, user); }
export async function update(id, raw, user) { return saveReceipt(id, raw, user); }

export async function approveOpenPurchase(id, user) {
  if (!(user.permissions || []).some(p => p === '*' || p === 'PO_APPROVE')) throw new AppError('Purchase approval permission is required.', 403);
  return withTransaction(async connection => {
    const grn = await repository.get(id, user.tenantId, connection, true);
    if (!grn) throw new AppError('GRN not found.', 404);
    if (grn.receipt_type !== 'OPEN_PURCHASE' || !['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(grn.status)) throw new AppError('Only accepted open purchases can be approved.', 409);
    if (!grn.purchase_approved_by) {
      await connection.execute('UPDATE goods_receipt_notes SET purchase_approved_by=?,purchase_approved_at=CURRENT_TIMESTAMP WHERE grn_id=? AND tenant_id=?', [user.userCode, id, user.tenantId]);
      await recordAudit({ connection, tenantId: user.tenantId, module: 'PURCHASE', entityType: 'GRN', entityId: id, action: 'OPEN_PURCHASE_APPROVED', performedBy: user.userCode });
    }
    return repository.get(id, user.tenantId, connection);
  });
}

function appliesToReceiptType(reason, receiptType) {
  const types = String(reason.applicableReceiptTypes || "ALL").split(",").map((entry) => entry.trim()).filter(Boolean);
  return !types.length || types.includes("ALL") || types.includes(receiptType);
}

async function resolveRejection(connection, input, grn, item, rejectedQuantity) {
  if (rejectedQuantity <= 0) return null;
  const reasonId = Number(input.rejectionReasonId || 0);
  if (!Number.isInteger(reasonId) || reasonId < 1) {
    throw new AppError(`Select a rejection reason for ${item.item_description_snapshot}.`, 400);
  }
  const reason = await rejectionRepository.getActiveReason(connection, reasonId);
  if (!reason) throw new AppError("The selected rejection reason is inactive or unavailable.", 409);
  if (!appliesToReceiptType(reason, grn.receipt_type)) {
    throw new AppError(`The selected rejection reason does not apply to ${grn.receipt_type.replaceAll("_"," ").toLowerCase()}.`, 409);
  }
  const qualityRemarks = String(input.qualityRemarks || "").trim();
  if (reason.requireRemarks === "Y" && !qualityRemarks) {
    throw new AppError(`Quality remarks are required for the selected rejection reason on ${item.item_description_snapshot}.`, 400);
  }
  const attachmentCount = await rejectionRepository.countAttachments(connection,grn.tenant_id || grn.tenantId || "",grn.grn_id,item.grn_item_id);
  if (reason.requireAttachment === "Y" && attachmentCount === 0) {
    throw new AppError(`Upload rejection evidence for ${item.item_description_snapshot}.`, 400);
  }
  const dispositionId = Number(input.rejectionDispositionId || reason.defaultDispositionId || 0);
  if (!Number.isInteger(dispositionId) || dispositionId < 1) {
    throw new AppError(`Select a rejection follow-up action for ${item.item_description_snapshot}.`, 400);
  }
  const disposition = await rejectionRepository.getActiveDisposition(connection, dispositionId);
  if (!disposition) throw new AppError("The selected rejection follow-up action is inactive or unavailable.", 409);
  const responsibleParty = grn.receipt_type === "CUSTOMER_SUPPLIED" ? "CUSTOMER" : "SUPPLIER";
  if (!["INTERNAL",responsibleParty].includes(disposition.partyAction)) {
    throw new AppError(`The selected follow-up action is not valid for ${responsibleParty.toLowerCase()}-owned material.`, 409);
  }
  return { reason, disposition, qualityRemarks, attachmentReference: null, responsibleParty };
}

export async function uploadRejectionAttachment(grnId, grnItemId, file, user) {
  if (!file) throw new AppError("Select a rejection evidence file to upload.",400);
  return withTransaction(async connection => {
    const grn = await repository.get(grnId,user.tenantId,connection,true);
    if (!grn) throw new AppError("GRN not found.",404);
    if (!["INWARD","INSPECTION_PENDING","INSPECTION_HOLD"].includes(grn.status)) throw new AppError("Rejection evidence can only be changed while the GRN is under inspection.",409);
    const item = grn.items.find(row => Number(row.grn_item_id) === Number(grnItemId));
    if (!item) throw new AppError("The selected GRN item was not found.",404);
    const attachment = await rejectionRepository.insertAttachment(connection,{tenantId:user.tenantId,grnId:Number(grnId),grnItemId:Number(grnItemId),file,userCode:user.userCode});
    await recordAudit({connection,tenantId:user.tenantId,module:"PURCHASE",entityType:"GRN_REJECTION_ATTACHMENT",entityId:attachment.rejectionAttachmentId,action:"REJECTION_EVIDENCE_UPLOADED",newValue:{grnId:Number(grnId),grnItemId:Number(grnItemId),fileName:attachment.fileName},performedBy:user.userCode});
    return attachment;
  });
}

export async function deleteRejectionAttachment(grnId, grnItemId, attachmentId, user) {
  let attachment;
  await withTransaction(async connection => {
    const grn = await repository.get(grnId,user.tenantId,connection,true);
    if (!grn) throw new AppError("GRN not found.",404);
    if (!["INWARD","INSPECTION_PENDING","INSPECTION_HOLD"].includes(grn.status)) throw new AppError("Rejection evidence can only be changed while the GRN is under inspection.",409);
    attachment = await rejectionRepository.getAttachment(connection,user.tenantId,grnId,grnItemId,attachmentId);
    if (!attachment) throw new AppError("Rejection evidence file not found.",404);
    await rejectionRepository.deleteAttachment(connection,attachmentId);
    await recordAudit({connection,tenantId:user.tenantId,module:"PURCHASE",entityType:"GRN_REJECTION_ATTACHMENT",entityId:Number(attachmentId),action:"REJECTION_EVIDENCE_DELETED",oldValue:{fileName:attachment.file_name},performedBy:user.userCode});
  });
  await fs.unlink(path.resolve(env.uploadRoot,attachment.file_path)).catch(error => { if (error.code !== "ENOENT") throw error; });
}

export async function inspect(id, data, user) {
  return withTransaction(async (connection) => {
    const grn = await repository.get(id, user.tenantId, connection, true); if (!grn) throw new AppError("GRN not found.", 404);
    if (grn.receipt_type === 'OUTSOURCING_PRODUCT') throw new AppError('Outsourced parts are inspected at their linked Process Plan operation, not during GRN inward.', 409);
    if (!["INWARD", "INSPECTION_PENDING", "INSPECTION_HOLD"].includes(grn.status)) throw new AppError("This GRN is not awaiting inspection.", 409);
    if (!Array.isArray(data.items) || data.items.length !== grn.items.length) throw new AppError("Submit an inspection decision for every GRN line.", 400);
    let accepted = 0; let rejected = 0; let onHold = 0; let failedSample = false;
    for (const input of data.items) {
      const item = grn.items.find((row) => Number(row.grn_item_id) === Number(input.grnItemId));
      if (!item) throw new AppError("Inspection line does not belong to this GRN.", 409);
      const planned = item.inspectionCharacteristics || [];
      const submittedCharacteristics = input.inspectionCharacteristics || [];
      if (planned.length && submittedCharacteristics.length !== planned.length) throw new AppError(`Complete every inspection characteristic for ${item.item_description_snapshot}.`, 400);
      let itemFailed = false;
      for (const characteristic of submittedCharacteristics) {
        const stored = planned.find((row) => Number(row.grn_inspection_characteristic_id) === Number(characteristic.grnInspectionCharacteristicId));
        if (!stored) throw new AppError("Inspection characteristic does not belong to this GRN item.", 409);
        const result = String(characteristic.inspectionResult || "PENDING").toUpperCase();
        if (!inspectionResults.has(result)) throw new AppError("Inspection result must be Pass, Fail or Pending.", 400);
        if (result === "PENDING") throw new AppError(`Complete every inspection characteristic for ${item.item_description_snapshot}.`, 400);
        if (!String(characteristic.actualValue || "").trim()) throw new AppError(`Enter the actual value for every inspection characteristic of ${item.item_description_snapshot}.`, 400);
        if (result === "FAIL") itemFailed = true;
        await repository.updateInspectionCharacteristic(connection, user.tenantId, stored.grn_inspection_characteristic_id, [String(characteristic.actualValue || "").trim() || null, result, String(characteristic.remarks || "").trim() || null], user.userCode);
      }
      const received = Number(item.received_quantity);
      let a = Number(input.acceptedQuantity || 0); let r = Number(input.rejectedQuantity || 0); let h = Number(input.onHoldQuantity || 0);
      let disposition = String(input.inspectionDisposition || "").toUpperCase();
      const qualityRemarks = String(input.qualityRemarks || "").trim(); const rejectionReason = String(input.rejectionReason || "").trim();
      const inspectionResult = String(input.inspectionResult || (h > 0 ? "ON_HOLD" : r > 0 ? (a > 0 ? "PARTIAL" : "REJECTED") : a > 0 ? "ACCEPTED" : "PENDING")).toUpperCase();
      if (itemFailed) {
        failedSample = true;
        if (!disposition || disposition === "PENDING") disposition = "HOLD";
        if (!inspectionDispositions.has(disposition)) throw new AppError("Choose a Quality disposition for a failed sample.", 400);
        if (["HOLD", "FULL_INSPECTION"].includes(disposition)) { a = 0; r = 0; h = received; if (!qualityRemarks) throw new AppError(`Quality remarks are required when ${item.item_description_snapshot} is held.`, 400); }
        if (disposition === "REJECT_LOT") { a = 0; r = received; h = 0; }
        if (disposition === "DEVIATION_ACCEPT") { a = received; r = 0; h = 0; if (!qualityRemarks) throw new AppError(`Authorisation remarks are required for deviation acceptance of ${item.item_description_snapshot}.`, 400); }
        if (disposition === "PARTIAL_ACCEPT") { h = 0; if (a <= 0 || r <= 0 || a + r !== received) throw new AppError(`Partial acceptance for ${item.item_description_snapshot} requires accepted and rejected quantities.`, 400); }
      } else {
        if (!inspectionLineResults.has(inspectionResult) || (!planned.length && inspectionResult === "PENDING")) throw new AppError(`Select the inspection result for ${item.item_description_snapshot}.`, 400);
        disposition = "PENDING";
        if (inspectionResult === "ON_HOLD") { a = 0; r = 0; h = received; }
        else if (a < 0 || r < 0 || h < 0 || h > 0 || a + r !== received) throw new AppError("Accepted plus rejected quantity must equal received quantity.", 409);
      }
      const rejection = await resolveRejection(connection, input, grn, item, r);
      accepted += a; rejected += r; onHold += h;
      await repository.updateInspectionItem(connection, user.tenantId, item.grn_item_id, [a, r, h, rejection?.reason.reasonName || rejectionReason || null, input.replacementRequired ? "Y" : "N", disposition, qualityRemarks || null]);
      if (rejection) {
        const rejectionRecord = await rejectionRepository.upsertRecord(connection, { tenantId:user.tenantId,grnId:id,grnItemId:item.grn_item_id,
          receiptType:grn.receipt_type,responsibleParty:rejection.responsibleParty,supplierId:grn.supplier_id,
          customerId:grn.customer_id,rejectedQuantity:r,uomCode:item.uom_code_snapshot,
          qualityRemarks:rejection.qualityRemarks,attachmentReference:rejection.attachmentReference,
          reason:rejection.reason,disposition:rejection.disposition,userCode:user.userCode });
        await inventoryRepository.syncRejectionInventory(connection, { tenantId:user.tenantId,
          grnRejectionId:rejectionRecord.grnRejectionId,grnId:id,grnItemId:item.grn_item_id,itemId:item.item_id,
          itemDescription:item.item_description_snapshot,uomCode:item.uom_code_snapshot,batchSerialNumber:item.batch_serial_number,
          stockOwnerType:rejection.responsibleParty === "CUSTOMER" ? "CUSTOMER" : "COMPANY",
          stockOwnerId:rejection.responsibleParty === "CUSTOMER" ? Number(grn.customer_id) : 0,
          rejectedQuantity:r,userCode:user.userCode });
      } else {
        await rejectionRepository.cancelOpenRecord(connection,user.tenantId,item.grn_item_id,user.userCode);
        await inventoryRepository.cancelRejectionInventoryForItem(connection,user.tenantId,item.grn_item_id,user.userCode);
      }
    }
    const next = onHold > 0 ? "INSPECTION_HOLD" : accepted > 0 && rejected > 0 ? "PARTIALLY_ACCEPTED" : accepted > 0 ? "ACCEPTED" : "REJECTED";
    if (next !== grn.status) transitionOrThrow(GRN_TRANSITIONS, grn.status, next);
    const inspectionStatus = onHold > 0 ? "HOLD" : rejected > 0 ? (accepted > 0 ? "PARTIAL" : "FAILED") : "PASSED";
    await repository.updateStatus(connection, user.tenantId, id, next, inspectionStatus, user.userCode);
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "GRN", entityId: id, action: `GRN_${next}`, newValue: { accepted, rejected, onHold, failedSample }, performedBy: user.userCode }); return repository.get(id, user.tenantId, connection);
  });
}

export async function listRejections(id, user) {
  const grn = await repository.get(id, user.tenantId);
  if (!grn) throw new AppError("GRN not found.",404);
  return rejectionRepository.listByGrn(undefined, user.tenantId, id);
}

export async function post(id, raw, user) {
  const data = validateGrnStockPosting(raw);
  return withTransaction(async (connection) => {
    const grn = await repository.get(id, user.tenantId, connection, true); if (!grn) throw new AppError("GRN not found.", 404); if (!["ACCEPTED", "PARTIALLY_ACCEPTED"].includes(grn.status)) throw new AppError("Only accepted GRNs can be posted.", 409);
    if (grn.receipt_type === 'OUTSOURCING_PRODUCT') throw new AppError('Outsourced parts remain in Outsourcing WIP until their Process Plan operation is completed.', 409);
    if (grn.receipt_type === 'OPEN_PURCHASE' && !grn.purchase_approved_by) throw new AppError('Purchase manager approval is required before posting an open purchase.', 409);
    const isOpenPurchase = ['OPEN_PURCHASE', 'CUSTOMER_SUPPLIED', 'OUTSOURCING_PRODUCT'].includes(grn.receipt_type);
    const ownerType = grn.receipt_type === 'CUSTOMER_SUPPLIED' ? 'CUSTOMER' : 'COMPANY';
    const ownerId = ownerType === 'CUSTOMER' ? Number(grn.customer_id) : 0;
    if (ownerType === 'CUSTOMER' && !ownerId) throw new AppError('Customer ownership is missing. Correct the receipt before posting.', 409);
    const order = isOpenPurchase ? null : await repository.getApprovedOrder(connection, user.tenantId, grn.purchase_order_id) || await repository.getReceivableOrder(connection, user.tenantId, grn.purchase_order_id); if (!isOpenPurchase && !order) throw new AppError("Purchase order is not available for receipt posting.", 409);
    const acceptedItems = grn.items.filter((item) => Number(item.accepted_quantity || 0) > 0);
    if (!acceptedItems.length || data.items.length !== acceptedItems.length) throw new AppError("Provide one stock receipt location for every accepted GRN line.", 400);
    const missingMtcCertificates = acceptedItems.filter((item) =>
      String(item.item_mtc_applicable || "N").toUpperCase() === "Y" && !(item.mtc_certificates || []).length
    );
    if (missingMtcCertificates.length) {
      const itemNames = missingMtcCertificates
        .map((item) => item.item_description_snapshot || item.item_code_snapshot || `GRN line ${item.grn_item_id}`)
        .join(", ");
      throw new AppError(`Upload an MTC certificate for ${itemNames} before posting the receipt to stock.`, 409, {
        code: "MTC_CERTIFICATE_REQUIRED",
      });
    }
    const locations = new Map(data.items.map((item) => [item.grnItemId, item]));
    const activeStorageLocations = new Set((await locationMasterRepository.listLocations({ tenantId: user.tenantId, status: "Y" }, connection)).map((location) => storageLocationKey(location.warehouseName, location.subinventoryCode, location.locationName)));
    for (const item of acceptedItems) {
      const selectedLocation = locations.get(Number(item.grn_item_id)); if (!selectedLocation) throw new AppError("A stock location is missing for an accepted GRN line.", 400);
      // Tools are normal Item Master purchases, but their accepted GRN quantity always starts at Tool Crib / Tooling.
      const isToolingItem = String(item.item_group_code || "").toUpperCase() === "TL";
      // The quantity-based tooling ledger is intentionally not batch/serial based.
      // Keep every TL receipt in the single Tool Crib balance used by issue, return and regrinding.
      const location = isToolingItem
        ? { ...selectedLocation, warehouseCode: "Tool Crib", subinventoryCode: "TOOLS", binLocation: "Tooling", batchSerialNumber: "" }
        : selectedLocation;
      if (!activeStorageLocations.has(storageLocationKey(location.warehouseCode, location.subinventoryCode, location.binLocation))) throw new AppError(`Choose an active Warehouse, Sub-inventory, and Bin Location Master value for ${item.item_description_snapshot}.`, 400);
      if (ownerType === "CUSTOMER" && String(location.warehouseCode).trim().toUpperCase() !== "CUSTOMER MATERIAL STORES") throw new AppError("Customer-supplied material must be posted to Customer Material Stores.", 400);
      const poItem = isOpenPurchase ? null : order.items.find((row) => Number(row.purchase_order_item_id) === Number(item.purchase_order_item_id)); if (!isOpenPurchase && !poItem) throw new AppError("PO line is no longer open.", 409);
      const accepted = Number(item.accepted_quantity || 0); const received = Number(poItem?.received_quantity || 0) + accepted;
      if (!isOpenPurchase && received > Number(poItem.ordered_quantity) + 0.0001) throw new AppError(`Posting exceeds the PO quantity for ${item.item_description_snapshot}.`, 409);
      const lineStatus = !isOpenPurchase && received >= Number(poItem.ordered_quantity) - 0.0001 ? "RECEIVED" : "PARTIALLY_RECEIVED";
      await repository.updateStockReceiptItem(connection, user.tenantId, item.grn_item_id, [location.warehouseCode, location.subinventoryCode, location.binLocation, location.batchSerialNumber || null]);
      const balance = await repository.upsertInventoryBalance(connection, [user.tenantId, grn.company_id, grn.plant_id || "", item.item_id, location.warehouseCode, location.subinventoryCode, location.binLocation, "AVAILABLE", location.batchSerialNumber || "", "", accepted, user.userCode, user.userCode], ownerType, ownerId);
      await repository.insertInventoryTransaction(connection, [user.tenantId, grn.company_id, grn.plant_id, "GRN_RECEIPT", data.stockPostingDate, item.item_id, id, item.grn_item_id, location.warehouseCode, location.subinventoryCode, location.binLocation, "AVAILABLE", location.batchSerialNumber || "", "", accepted, 0, balance.quantityOnHand, `Accepted GRN receipt ${grn.grn_number}`, user.userCode], ownerType, ownerId);
      if (isToolingItem) await recordGrnToolReceipt(connection, { grn, item, location, quantity: accepted, postingDate: data.stockPostingDate, user });
      if (!isOpenPurchase) await repository.updatePoItem(connection, user.tenantId, poItem.purchase_order_item_id, received, lineStatus);
    }
    let poStatus = null;
    if (!isOpenPurchase) { const [openRows] = await connection.execute(`SELECT COUNT(*) AS openCount FROM purchase_order_items WHERE purchase_order_id=? AND tenant_id=? AND line_status IN ('OPEN','PARTIALLY_RECEIVED')`, [grn.purchase_order_id, user.tenantId]); poStatus = Number(openRows[0]?.openCount || 0) ? "PARTIALLY_RECEIVED" : "COMPLETED"; await repository.updatePoStatus(connection, user.tenantId, grn.purchase_order_id, poStatus, user.userCode); }
    await repository.updateStockReceiptHeader(connection, user.tenantId, id, [data.stockPostingDate, data.receivedBy, user.userCode, user.userCode]); transitionOrThrow(GRN_TRANSITIONS, grn.status, "POSTED"); await repository.updateStatus(connection, user.tenantId, id, "POSTED", grn.inspection_status, user.userCode); if (grn.gate_entry_id) await markStockPosted(connection, grn.gate_entry_id, user); const gaugeRegistrationItemCount = await repository.countGaugeRegistrationItems(connection, user.tenantId, id); await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "GRN", entityId: id, action: "GRN_POSTED", newValue: { purchaseOrderStatus: poStatus, stockPostingDate: data.stockPostingDate, acceptedItems: acceptedItems.length, gaugeRegistrationItemCount }, performedBy: user.userCode }); return { ...(await repository.get(id, user.tenantId, connection)), gaugeRegistrationItemCount };
  });
}
