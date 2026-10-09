import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import * as service from '../src/modules/grn/grn.service.js';
import * as repository from '../src/modules/grn/grn.repository.js';
import * as rejectionRepository from '../src/modules/grn/grn-rejection.repository.js';
import * as inventoryService from '../src/modules/inventory/inventory.service.js';
import * as gateEntryService from '../src/modules/gate-entry/gate-entry.service.js';
import { validateGrn } from '../src/modules/grn/grn.validation.js';

const originalGet = db.getConnection.bind(db);
let connection;
let uploadedEvidencePath;
let generatedRtvPath;
const generatedResolutionPaths = [];
try {
  const base = { receiptType: 'OPEN_PURCHASE', gateEntryId: 1, grnDate: '2026-09-12', supplierId: 1, items: [{ itemId: 1, receivedQuantity: 2 }] };
  assert.throws(() => validateGrn({ ...base, receiptType: 'REGULAR_PURCHASE' }), /purchase order/i);
  assert.throws(() => validateGrn({ ...base, purchaseOrderId: 1 }), /cannot reference/i);
  assert.throws(() => validateGrn({ ...base, items: [{ itemId: 1, receivedQuantity: -1 }] }), /negative/i);
  assert.throws(() => validateGrn({ ...base, items: [{ itemId: 1, receivedQuantity: 1, taxPercent: 101 }] }), /tax/i);
  connection = await originalGet();
  await connection.beginTransaction();
  // Exercise service transactions without persisting test documents or stock.
  db.getConnection = async () => new Proxy(connection, { get(target, key) {
    if (['beginTransaction', 'commit', 'rollback', 'release'].includes(key)) return async () => {};
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  }});
  const [[item]] = await connection.query("SELECT item_id FROM item_master WHERE active_flag='Y' LIMIT 1");
  const [[supplier]] = await connection.query("SELECT supplier_id FROM supplier_master WHERE active_flag='Y' LIMIT 1");
  const [[customer]] = await connection.query("SELECT customer_id,customer_name FROM customer_master WHERE active_flag='Y' AND party_type IN ('CUSTOMER','BOTH') LIMIT 1");
  const [[part]] = await connection.query("SELECT part_id,part_number FROM part_master WHERE active_flag='Y' AND part_status='ACTIVE' LIMIT 1");
  assert.ok(item && supplier && customer && part, 'Active item, supplier, customer and part fixtures required');
  const user = { tenantId: 'DEFAULT', companyId: null, userCode: 'GRN_TYPE_TEST' };
  const createGate = (entryType, referenceNumber, party = {}) => gateEntryService.create({ entryType, referenceNumber, ...party, entryDateTime: '2026-09-12 10:00', vehicleNumber: 'TN01TEST', driverName: 'Test Driver', drivingLicenceNumber: 'TEST-LICENSE', action: 'GATE_ENTERED' }, user);
  const openGate = await createGate('OPEN_PURCHASE', 'ORDER-TEST', { supplierId: supplier.supplier_id });
  const body = { ...base, gateEntryId: openGate.id, supplierId: supplier.supplier_id, supplierInvoiceNumber: 'TEST-INVOICE', supplierInvoiceDate: '2026-09-12', deliveryChallanNumber: 'TEST-DC', inspectionRequired: false, items: [{ itemId: item.item_id, receivedQuantity: 2.5, directRatePerQty: 0, batchSerialNumber: 'TYPE-TEST' }] };
  const draft = await service.create(body, user);
  const reopened = await service.update(draft.grn_id, { ...body, action: 'INWARD' }, user);
  assert.equal(reopened.status, 'ACCEPTED');
  assert.equal(Number(reopened.items[0].direct_rate_per_qty), 0, 'Explicit zero rate must persist');
  assert.equal(reopened.items[0].batch_serial_number, 'TYPE-TEST');
  await assert.rejects(service.update(draft.grn_id, body, user), /Only draft/);
  const customerGate = await createGate('CUSTOMER_PURCHASE', 'ENQ-TEST', { customerId: customer.customer_id });
  const custBody = { ...body, gateEntryId: customerGate.id, receiptType: 'CUSTOMER_SUPPLIED', supplierId: null, customerId: customer.customer_id, customerName: customer.customer_name, customerPlantCode: 'TEST', jobReference: 'JOB-TEST', supplierInvoiceNumber: '', supplierInvoiceDate: '', items: [{ itemId: item.item_id, receivedQuantity: 3, directRatePerQty: 500 }] };
  const customerDraft = await service.create(custBody, user);
  const accepted = await service.update(customerDraft.grn_id, { ...custBody, action: 'INWARD' }, user);
  assert.equal(accepted.purchase_order_id, null);
  assert.equal(accepted.supplier_id, null);
  assert.equal(accepted.supplier_invoice_number, null);
  assert.equal(Number(accepted.items[0].direct_rate_per_qty), 0);
  const posting = grn => ({ stockPostingDate: '2026-09-12', receivedBy: 'Test', items: [{ grnItemId: grn.items[0].grn_item_id, warehouseCode: 'TYPE-TEST', binLocation: 'TYPE-TEST', batchSerialNumber: 'TYPE-TEST' }] });
  await assert.rejects(service.post(reopened.grn_id, posting(reopened), user), /manager approval/i);
  await assert.rejects(service.approveOpenPurchase(reopened.grn_id, user), /permission/i);
  await service.approveOpenPurchase(reopened.grn_id, { ...user, permissions: ['PO_APPROVE'] });
  await service.post(reopened.grn_id, posting(reopened), user);
  await service.post(accepted.grn_id, posting(accepted), user);
  const outsourcingSuffix = String(Date.now());
  const [definitionResult] = await connection.execute(`INSERT INTO part_process_definition
    (part_id,definition_code,operation_description,source_type,process_cost_inr,active_flag,created_by)
    VALUES (?,?,?,'OUTSOURCE',0,'Y',?)`, [part.part_id, `TEST-WIP-${outsourcingSuffix}`, 'Outsource finish and inspect', user.userCode]);
  const [planResult] = await connection.execute(`INSERT INTO part_process_plan
    (part_id,drawing_revision_number,plan_code,route_name,plan_status,is_default,active_flag,created_by)
    VALUES (?,?,?,?, 'APPROVED','N','Y',?)`, [part.part_id, `TEST-WIP-${outsourcingSuffix}`, `TEST-WIP-${outsourcingSuffix}`, 'Outsourcing receipt test', user.userCode]);
  const [operationResult] = await connection.execute(`INSERT INTO part_process_operation
    (process_plan_id,process_definition_id,operation_number,operation_description,source_type,process_cost_inr,inspection_required,created_by)
    VALUES (?,?,990,'Outsource finish and inspect','OUTSOURCE',0,'Y',?)`, [planResult.insertId, definitionResult.insertId, user.userCode]);
  const outsourcingGate = await createGate('OUTSOURCING_PARTS', '', { supplierId: supplier.supplier_id, partId: part.part_id });
  const outsourcingBody = {
    receiptType: 'OUTSOURCING_PRODUCT', gateEntryId: outsourcingGate.id, supplierId: supplier.supplier_id,
    grnDate: '2026-09-12', supplierInvoiceNumber: 'OUTSOURCE-INVOICE', supplierInvoiceDate: '2026-09-12',
    deliveryChallanNumber: 'OUTSOURCE-DC', receivedBy: 'Test receiver', inspectionRequired: false,
    items: [{ receivedQuantity: 4, batchSerialNumber: 'OUTSOURCE-BATCH-01' }],
  };
  const outsourcingDraft = await service.create(outsourcingBody, user);
  const outsourcingInward = await service.update(outsourcingDraft.grn_id, { ...outsourcingBody, action: 'INWARD' }, user);
  assert.equal(outsourcingInward.status, 'OUTSOURCING_WIP');
  assert.equal(outsourcingInward.inspection_status, 'PROCESS_PLAN_PENDING');
  assert.equal(outsourcingInward.outsourcing_part_id, part.part_id);
  assert.equal(outsourcingInward.outsourcing_process_operation_id, operationResult.insertId);
  assert.equal(outsourcingInward.items.length, 1);
  assert.equal(outsourcingInward.items[0].item_id, null);
  const [[outsourcingWip]] = await connection.query(`SELECT quantity_in_wip,wip_status,inspection_status,part_id,process_operation_id,batch_serial_number
    FROM outsourcing_wip_balance WHERE tenant_id=? AND grn_id=?`, [user.tenantId, outsourcingInward.grn_id]);
  assert.equal(Number(outsourcingWip.quantity_in_wip), 4);
  assert.equal(outsourcingWip.wip_status, 'AWAITING_PROCESS_OPERATION');
  assert.equal(outsourcingWip.inspection_status, 'NOT_STARTED');
  assert.equal(Number(outsourcingWip.part_id), Number(part.part_id));
  assert.equal(Number(outsourcingWip.process_operation_id), Number(operationResult.insertId));
  assert.equal(outsourcingWip.batch_serial_number, 'OUTSOURCE-BATCH-01');
  await assert.rejects(service.inspect(outsourcingInward.grn_id, { items: [] }, user), /process plan operation/i);
  const inspectionGate = await createGate('OPEN_PURCHASE', 'ORDER-INSPECTION', { supplierId: supplier.supplier_id });
  const inspectionDraft = await service.create({ ...body, gateEntryId: inspectionGate.id, inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 2, directRatePerQty: 0 }] }, user);
  const inspectionInward = await service.update(inspectionDraft.grn_id, { ...body, gateEntryId: inspectionGate.id, action: 'INWARD', inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 2, directRatePerQty: 0 }] }, user);
  const [reasonRows] = await connection.query("SELECT rejection_reason_id,default_disposition_id FROM rejection_reason_master WHERE reason_code='DIMENSION_OUT' AND active_flag='Y' LIMIT 1");
  assert.ok(reasonRows[0], 'Seeded rejection reason fixture is required');
  const inspected = await service.inspect(inspectionInward.grn_id, { items: inspectionInward.items.map((line) => ({
    grnItemId: line.grn_item_id, acceptedQuantity: 0, rejectedQuantity: 2, onHoldQuantity: 0,
    rejectionReasonId: reasonRows[0].rejection_reason_id,
    rejectionDispositionId: reasonRows[0].default_disposition_id,
    qualityRemarks: 'Test dimensional rejection',
    inspectionCharacteristics: (line.inspectionCharacteristics || []).map((characteristic) => ({ grnInspectionCharacteristicId: characteristic.grn_inspection_characteristic_id, actualValue: '1', inspectionResult: 'PASS', remarks: '' })),
  })) }, user);
  assert.equal(inspected.status, 'REJECTED');
  const rejectionRecords = await rejectionRepository.listByGrn(connection, user.tenantId, inspected.grn_id);
  assert.equal(rejectionRecords.length, 1);
  assert.equal(Number(rejectionRecords[0].rejectedQuantity), 2);
  const [rejectionBalances] = await connection.query("SELECT rejection_inventory_balance_id,quantity_on_hand,status FROM inventory_rejection_balance WHERE tenant_id=? AND grn_id=?", [user.tenantId, inspected.grn_id]);
  assert.equal(rejectionBalances.length, 1);
  assert.equal(Number(rejectionBalances[0].quantity_on_hand), 2);
  const deviationRequest = await inventoryService.resolveRejectionInventory(rejectionBalances[0].rejection_inventory_balance_id, {
    action: 'DEVIATION_RELEASE', quantity: 2, warehouseCode: 'TYPE-TEST', binLocation: 'DEVIATION-TEST', actionReference: 'DVA-TEST-01', remarks: 'Deviation approved for test',
  }, user);
  assert.equal(deviationRequest.resolutionRequest.resolutionStatus, 'PENDING_APPROVAL');
  const approvedDeviation = await inventoryService.approveRejectionResolution(deviationRequest.resolutionRequest.resolutionRequestId, { approvalRemarks: 'Deviation approved for test.' }, user);
  assert.equal(approvedDeviation.resolutionStatus, 'APPROVED');
  generatedResolutionPaths.push(path.resolve(env.uploadRoot, approvedDeviation.filePath));
  const resolved = await inventoryService.executeRejectionResolution(deviationRequest.resolutionRequest.resolutionRequestId, { executionReference: 'DVA-EXEC-01' }, user);
  assert.equal(resolved.resolutionStatus, 'EXECUTED');
  const [[resolvedBalance]] = await connection.query("SELECT quantity_on_hand,status FROM inventory_rejection_balance WHERE rejection_inventory_balance_id=?", [rejectionBalances[0].rejection_inventory_balance_id]);
  assert.equal(Number(resolvedBalance.quantity_on_hand), 0);
  assert.equal(resolvedBalance.status, 'RESOLVED');
  const [[releasedStock]] = await connection.query("SELECT quantity_on_hand FROM inventory_stock_balance WHERE tenant_id=? AND warehouse_code='TYPE-TEST' AND bin_location='DEVIATION-TEST' AND item_id=?", [user.tenantId, item.item_id]);
  assert.equal(Number(releasedStock.quantity_on_hand), 2);
  const rtvGate = await createGate('OPEN_PURCHASE', 'ORDER-RTV', { supplierId: supplier.supplier_id });
  const rtvDraft = await service.create({ ...body, gateEntryId: rtvGate.id, inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 1, directRatePerQty: 0 }] }, user);
  const rtvInward = await service.update(rtvDraft.grn_id, { ...body, gateEntryId: rtvGate.id, action: 'INWARD', inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 1, directRatePerQty: 0 }] }, user);
  const evidenceDirectory = path.resolve(env.uploadRoot, 'marketing', 'grn-rejections');
  const evidenceFile = `rtv-rejection-${Date.now()}.png`;
  uploadedEvidencePath = path.join(evidenceDirectory, evidenceFile);
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await fs.writeFile(uploadedEvidencePath, 'test rejection evidence');
  const uploadedAttachment = await service.uploadRejectionAttachment(rtvInward.grn_id, rtvInward.items[0].grn_item_id, {
    originalname: 'surface-damage-proof.png', filename: evidenceFile, mimetype: 'image/png', size: 23,
  }, user);
  assert.ok(uploadedAttachment.fileUrl.includes('/uploads/marketing/grn-rejections/'));
  const [surfaceDamageReasons] = await connection.query("SELECT rejection_reason_id,default_disposition_id FROM rejection_reason_master WHERE reason_code='SURFACE_DAMAGE' AND active_flag='Y' LIMIT 1");
  assert.ok(surfaceDamageReasons[0], 'Surface-damage rejection reason fixture is required');
  const rtvInspected = await service.inspect(rtvInward.grn_id, { items: rtvInward.items.map((line) => ({
    grnItemId: line.grn_item_id, acceptedQuantity: 0, rejectedQuantity: 1, onHoldQuantity: 0,
    rejectionReasonId: surfaceDamageReasons[0].rejection_reason_id,
    rejectionDispositionId: surfaceDamageReasons[0].default_disposition_id,
    qualityRemarks: 'Surface damage recorded with photo evidence',
    inspectionCharacteristics: (line.inspectionCharacteristics || []).map((characteristic) => ({ grnInspectionCharacteristicId: characteristic.grn_inspection_characteristic_id, actualValue: '1', inspectionResult: 'PASS', remarks: '' })),
  })) }, user);
  const [rtvBalances] = await connection.query("SELECT rejection_inventory_balance_id FROM inventory_rejection_balance WHERE tenant_id=? AND grn_id=?", [user.tenantId, rtvInspected.grn_id]);
  const rtvResolution = await inventoryService.resolveRejectionInventory(rtvBalances[0].rejection_inventory_balance_id, {
    action: 'RETURN_TO_VENDOR', quantity: 1, returnDate: '2026-09-12', dispatchReference: 'RTV-CHALLAN-01', transportReference: 'TN01TEST', remarks: 'Returned to supplier after quality rejection',
  }, user);
  assert.equal(rtvResolution.status, 'OPEN');
  assert.equal(rtvResolution.rtvDocument?.documentStatus, 'PENDING_APPROVAL');
  assert.ok(rtvResolution.rtvDocument?.rtvNumber, 'RTV number must be generated before approval');
  const [[reservedRtvBalance]] = await connection.query("SELECT quantity_on_hand,quantity_reserved,status FROM inventory_rejection_balance WHERE rejection_inventory_balance_id=?", [rtvBalances[0].rejection_inventory_balance_id]);
  assert.equal(Number(reservedRtvBalance.quantity_on_hand), 1);
  assert.equal(Number(reservedRtvBalance.quantity_reserved), 1);
  assert.equal(reservedRtvBalance.status, 'OPEN');
  const approvedRtv = await inventoryService.approveReturnToVendor(rtvResolution.rtvDocument.rtvDocumentId, { approvalRemarks: 'Approved for supplier return.' }, { ...user, permissions: ['PO_APPROVE'] });
  assert.equal(approvedRtv.documentStatus, 'APPROVED');
  generatedRtvPath = path.resolve(env.uploadRoot, approvedRtv.filePath);
  await fs.access(generatedRtvPath);
  const acknowledgedRtv = await inventoryService.acknowledgeReturnToVendor(rtvResolution.rtvDocument.rtvDocumentId, { supplierContact: 'Supplier contact', acknowledgementReference: 'EMAIL-RTV-01' }, user);
  assert.equal(acknowledgedRtv.documentStatus, 'ACKNOWLEDGED');
  const dispatchedRtv = await inventoryService.dispatchReturnToVendor(rtvResolution.rtvDocument.rtvDocumentId, user);
  assert.equal(dispatchedRtv.documentStatus, 'DISPATCHED');
  assert.equal(dispatchedRtv.remainingQuantity, 0);
  const [[rtvDocument]] = await connection.query("SELECT rtv_number,pdf_file_path,document_status,supplier_acknowledgement_reference FROM return_to_vendor_documents WHERE rtv_document_id=?", [rtvResolution.rtvDocument.rtvDocumentId]);
  assert.equal(rtvDocument.rtv_number, rtvResolution.rtvDocument.rtvNumber);
  assert.equal(rtvDocument.pdf_file_path, approvedRtv.filePath);
  assert.equal(rtvDocument.document_status, 'DISPATCHED');
  assert.equal(rtvDocument.supplier_acknowledgement_reference, 'EMAIL-RTV-01');
  const customerInspectionGate = await createGate('CUSTOMER_PURCHASE', 'ENQ-CUSTOMER-RETURN', { customerId: customer.customer_id });
  const customerInspectionDraft = await service.create({ ...custBody, gateEntryId: customerInspectionGate.id, inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 1, directRatePerQty: 0 }] }, user);
  const customerInspectionInward = await service.update(customerInspectionDraft.grn_id, { ...custBody, gateEntryId: customerInspectionGate.id, action: 'INWARD', inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 1, directRatePerQty: 0 }] }, user);
  const customerRejected = await service.inspect(customerInspectionInward.grn_id, { items: customerInspectionInward.items.map((line) => ({
    grnItemId: line.grn_item_id, acceptedQuantity: 0, rejectedQuantity: 1, onHoldQuantity: 0,
    rejectionReasonId: reasonRows[0].rejection_reason_id, rejectionDispositionId: reasonRows[0].default_disposition_id,
    qualityRemarks: 'Customer material rejected for return', inspectionCharacteristics: (line.inspectionCharacteristics || []).map((characteristic) => ({ grnInspectionCharacteristicId: characteristic.grn_inspection_characteristic_id, actualValue: '1', inspectionResult: 'PASS', remarks: '' })),
  })) }, user);
  const [[customerReturnBalance]] = await connection.query("SELECT rejection_inventory_balance_id FROM inventory_rejection_balance WHERE tenant_id=? AND grn_id=?", [user.tenantId, customerRejected.grn_id]);
  const customerReturn = await inventoryService.resolveRejectionInventory(customerReturnBalance.rejection_inventory_balance_id, {
    action: 'RETURN_TO_CUSTOMER', quantity: 1, returnDate: '2026-09-12', dispatchReference: 'RTC-DC-01', transportReference: 'TN01TEST', remarks: 'Return customer supplied material',
  }, user);
  const customerReturnDocument = customerReturn.returnToCustomerDocument;
  assert.equal(customerReturnDocument.documentStatus, 'PENDING_APPROVAL');
  const approvedCustomerReturn = await inventoryService.approveReturnToCustomerDocument(customerReturnDocument.returnToCustomerDocumentId, { approvalRemarks: 'Approved for customer return.' }, user);
  assert.equal(approvedCustomerReturn.documentStatus, 'APPROVED');
  generatedResolutionPaths.push(path.resolve(env.uploadRoot, approvedCustomerReturn.filePath));
  const acknowledgedCustomerReturn = await inventoryService.acknowledgeReturnToCustomerDocument(customerReturnDocument.returnToCustomerDocumentId, { customerContact: 'Customer contact', acknowledgementReference: 'RTC-EMAIL-01' }, user);
  assert.equal(acknowledgedCustomerReturn.documentStatus, 'ACKNOWLEDGED');
  const dispatchedCustomerReturn = await inventoryService.dispatchReturnToCustomerDocument(customerReturnDocument.returnToCustomerDocumentId, { gateExitReference: 'RTC-GATE-EXIT-01' }, user);
  assert.equal(dispatchedCustomerReturn.documentStatus, 'DISPATCHED');
  const reworkGate = await createGate('OPEN_PURCHASE', 'ORDER-REWORK', { supplierId: supplier.supplier_id });
  const reworkDraft = await service.create({ ...body, gateEntryId: reworkGate.id, inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 2, directRatePerQty: 0 }] }, user);
  const reworkInward = await service.update(reworkDraft.grn_id, { ...body, gateEntryId: reworkGate.id, action: 'INWARD', inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 2, directRatePerQty: 0 }] }, user);
  const reworkRejected = await service.inspect(reworkInward.grn_id, { items: reworkInward.items.map((line) => ({
    grnItemId: line.grn_item_id, acceptedQuantity: 0, rejectedQuantity: 2, onHoldQuantity: 0,
    rejectionReasonId: reasonRows[0].rejection_reason_id, rejectionDispositionId: reasonRows[0].default_disposition_id,
    qualityRemarks: 'Rework test rejection', inspectionCharacteristics: (line.inspectionCharacteristics || []).map((characteristic) => ({ grnInspectionCharacteristicId: characteristic.grn_inspection_characteristic_id, actualValue: '1', inspectionResult: 'PASS', remarks: '' })),
  })) }, user);
  const [[reworkBalance]] = await connection.query("SELECT rejection_inventory_balance_id FROM inventory_rejection_balance WHERE tenant_id=? AND grn_id=?", [user.tenantId, reworkRejected.grn_id]);
  const reworkRequest = await inventoryService.resolveRejectionInventory(reworkBalance.rejection_inventory_balance_id, { action: 'REWORK', quantity: 2, actionReference: 'RWR-INSTRUCTION-01', remarks: 'Repair and re-inspect the rejected item' }, user);
  const approvedRework = await inventoryService.approveRejectionResolution(reworkRequest.resolutionRequest.resolutionRequestId, { approvalRemarks: 'Rework authorised.' }, user);
  generatedResolutionPaths.push(path.resolve(env.uploadRoot, approvedRework.filePath));
  const startedRework = await inventoryService.executeRejectionResolution(reworkRequest.resolutionRequest.resolutionRequestId, { executionReference: 'RWR-JOB-01' }, user);
  assert.ok(startedRework.reworkBalanceId);
  const completedRework = await inventoryService.completeRework(startedRework.reworkBalanceId, { remarks: 'Rework complete; return to Quality for re-inspection.' }, user);
  assert.equal(completedRework.resolutionStatus, 'AWAITING_REINSPECTION');
  await assert.rejects(inventoryService.reinspectRework(startedRework.reworkBalanceId, { decision: 'PARTIALLY_ACCEPT', acceptedQuantity: 2, rejectedQuantity: 0, qualityRemarks: 'Invalid partial decision' }, user), /Partial acceptance/);
  const reinspectedRework = await inventoryService.reinspectRework(startedRework.reworkBalanceId, { decision: 'PARTIALLY_ACCEPT', acceptedQuantity: 1, rejectedQuantity: 1, qualityRemarks: 'One reworked unit meets specification.', rejectionReason: 'One unit remains out of tolerance.' }, user);
  assert.equal(reinspectedRework.resolutionStatus, 'READY_FOR_STOCK');
  assert.equal(reinspectedRework.reworkStatus, 'READY_FOR_STOCK');
  assert.equal(reinspectedRework.acceptedQuantity, 1);
  assert.equal(reinspectedRework.rejectedQuantity, 1);
  const postedRework = await inventoryService.postReworkedStock(startedRework.reworkBalanceId, { stockPostingDate: '2026-09-12', warehouseCode: 'REWORK-TEST', binLocation: 'ACCEPTED', batchSerialNumber: 'RWR-BATCH-01' }, user);
  assert.equal(postedRework.resolutionStatus, 'POSTED');
  assert.equal(postedRework.postedQuantity, 1);
  const [[reopenedReworkBalance]] = await connection.query("SELECT quantity_on_hand,status FROM inventory_rejection_balance WHERE rejection_inventory_balance_id=?", [reworkBalance.rejection_inventory_balance_id]);
  assert.equal(Number(reopenedReworkBalance.quantity_on_hand), 1);
  assert.equal(reopenedReworkBalance.status, 'OPEN');
  const [[reworkedStock]] = await connection.query("SELECT quantity_on_hand FROM inventory_stock_balance WHERE tenant_id=? AND warehouse_code='REWORK-TEST' AND bin_location='ACCEPTED' AND item_id=?", [user.tenantId, item.item_id]);
  assert.equal(Number(reworkedStock.quantity_on_hand), 1);
  const scrapGate = await createGate('OPEN_PURCHASE', 'ORDER-SCRAP', { supplierId: supplier.supplier_id });
  const scrapDraft = await service.create({ ...body, gateEntryId: scrapGate.id, inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 1, directRatePerQty: 0 }] }, user);
  const scrapInward = await service.update(scrapDraft.grn_id, { ...body, gateEntryId: scrapGate.id, action: 'INWARD', inspectionRequired: true, items: [{ itemId: item.item_id, receivedQuantity: 1, directRatePerQty: 0 }] }, user);
  const scrapRejected = await service.inspect(scrapInward.grn_id, { items: scrapInward.items.map((line) => ({
    grnItemId: line.grn_item_id, acceptedQuantity: 0, rejectedQuantity: 1, onHoldQuantity: 0,
    rejectionReasonId: reasonRows[0].rejection_reason_id, rejectionDispositionId: reasonRows[0].default_disposition_id,
    qualityRemarks: 'Scrap test rejection', inspectionCharacteristics: (line.inspectionCharacteristics || []).map((characteristic) => ({ grnInspectionCharacteristicId: characteristic.grn_inspection_characteristic_id, actualValue: '1', inspectionResult: 'PASS', remarks: '' })),
  })) }, user);
  const [[scrapBalance]] = await connection.query("SELECT rejection_inventory_balance_id FROM inventory_rejection_balance WHERE tenant_id=? AND grn_id=?", [user.tenantId, scrapRejected.grn_id]);
  const scrapRequest = await inventoryService.resolveRejectionInventory(scrapBalance.rejection_inventory_balance_id, { action: 'SCRAP', quantity: 1, actionReference: 'SCR-APPROVAL-01', remarks: 'Dispose of rejected material as scrap' }, user);
  const approvedScrap = await inventoryService.approveRejectionResolution(scrapRequest.resolutionRequest.resolutionRequestId, { approvalRemarks: 'Scrap authorised.' }, user);
  generatedResolutionPaths.push(path.resolve(env.uploadRoot, approvedScrap.filePath));
  const executedScrap = await inventoryService.executeRejectionResolution(scrapRequest.resolutionRequest.resolutionRequestId, { executionReference: 'SCRAP-CERT-01' }, user);
  assert.equal(executedScrap.resolutionStatus, 'EXECUTED');
  const [balances] = await connection.query("SELECT stock_owner_type,stock_owner_id,quantity_on_hand FROM inventory_stock_balance WHERE tenant_id='DEFAULT' AND warehouse_code='TYPE-TEST' AND bin_location='TYPE-TEST' AND item_id=?", [item.item_id]);
  assert.equal(balances.find(b => b.stock_owner_type === 'COMPANY').quantity_on_hand, 2.5);
  assert.equal(balances.find(b => b.stock_owner_type === 'CUSTOMER').quantity_on_hand, 3);
  const otherCustomerBalance = await repository.upsertInventoryBalance(connection, ['DEFAULT', null, '', item.item_id, 'TYPE-TEST', 'TYPE-TEST', 'TYPE-TEST', 7, 'TEST', 'TEST'], 'CUSTOMER', Number(customer.customer_id) + 100000);
  assert.equal(otherCustomerBalance.quantityOnHand, 7);
  await assert.rejects(service.post(accepted.grn_id, posting(accepted), user), /Only accepted/);
  console.log('GRN receipt types: draft reopen, direct receipt, posting, owner isolation and validation passed (rolled back).');
} finally {
  db.getConnection = originalGet;
  if (connection) { await connection.rollback(); connection.release(); }
  if (uploadedEvidencePath) await fs.unlink(uploadedEvidencePath).catch(() => {});
  if (generatedRtvPath) await fs.unlink(generatedRtvPath).catch(() => {});
  await Promise.all(generatedResolutionPaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
  await db.end();
}
