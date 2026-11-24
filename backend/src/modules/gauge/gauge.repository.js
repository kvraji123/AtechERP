import { db } from "../../config/db.js";

const integer = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

function gaugeConditionSql() {
  return `CASE
    WHEN GM.operational_status='REJECTED' THEN 'REJECTED'
    WHEN GM.calibration_due_date IS NULL THEN 'NOT_SCHEDULED'
    WHEN DATEDIFF(GM.calibration_due_date,CURDATE()) < 0 THEN 'EXPIRED'
    WHEN DATEDIFF(GM.calibration_due_date,CURDATE()) = 0 THEN 'DUE_TODAY'
    WHEN DATEDIFF(GM.calibration_due_date,CURDATE()) <= 10 THEN 'DUE_SOON'
    ELSE 'ON_TIME'
  END`;
}

function effectiveOperationalStatusSql() {
  return `CASE
    WHEN GM.operational_status IN ('AVAILABLE','ISSUED')
      AND DATEDIFF(GM.calibration_due_date,CURDATE()) < 0 THEN 'CALIBRATION_EXPIRED'
    ELSE GM.operational_status
  END`;
}

function listWhere(filters) {
  const search = String(filters.search || "").trim();
  const gaugeId = String(filters.gaugeId || "").trim();
  const instrument = String(filters.instrument || "").trim();
  const grnNumber = String(filters.grnNumber || "").trim();
  const calibrationDueDate = String(filters.calibrationDueDate || "").trim();
  const location = String(filters.location || "").trim();
  const operationalStatus = String(filters.operationalStatus || "").trim().toUpperCase();
  const lifecycleStatus = String(filters.lifecycleStatus || "").trim().toUpperCase();
  const calibrationCondition = String(filters.calibrationCondition || "").trim().toUpperCase();
  const clauses = ["GM.tenant_id=?"];
  const params = [filters.tenantId];
  if (search) {
    const term = `%${search}%`;
    clauses.push("(GM.gauge_id LIKE ? OR GM.instrument_name_snapshot LIKE ? OR GM.item_code_snapshot LIKE ? OR GM.manufacturer_serial_number LIKE ? OR G.grn_number LIKE ? OR GM.current_location LIKE ?)");
    params.push(term, term, term, term, term, term);
  }
  if (gaugeId) {
    clauses.push("GM.gauge_id LIKE ?");
    params.push(`%${gaugeId}%`);
  }
  if (instrument) {
    clauses.push("(GM.instrument_name_snapshot LIKE ? OR GM.item_code_snapshot LIKE ?)");
    params.push(`%${instrument}%`, `%${instrument}%`);
  }
  if (grnNumber) {
    clauses.push("G.grn_number LIKE ?");
    params.push(`%${grnNumber}%`);
  }
  if (calibrationDueDate) {
    clauses.push("GM.calibration_due_date=?");
    params.push(calibrationDueDate);
  }
  if (location) {
    clauses.push("(GM.current_location LIKE ? OR GM.assigned_to LIKE ?)");
    params.push(`%${location}%`, `%${location}%`);
  }
  if (operationalStatus) {
    clauses.push(`${effectiveOperationalStatusSql()}=?`);
    params.push(operationalStatus);
  }
  if (lifecycleStatus) {
    clauses.push("GM.operational_status=?");
    params.push(lifecycleStatus);
  }
  if (calibrationCondition) {
    clauses.push(`${gaugeConditionSql()}=?`);
    params.push(calibrationCondition);
  }
  return { clauses, params };
}

export async function listGaugeRegistrationSources(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT GI.grn_item_id AS grnItemId,GI.grn_id AS grnId,
    G.grn_number AS grnNumber,G.grn_date AS grnDate,G.plant_id AS plantId,
    GI.item_id AS itemId,I.item_code AS itemCode,GI.item_description_snapshot AS itemDescription,
    IT.type_name AS itemTypeName,IT.item_code_prefix AS itemTypePrefix,
    I.make_name AS makeName,I.model_name AS modelNumber,
    I.measurement_range AS measurementRange,I.least_count AS leastCount,I.accuracy,
    I.calibration_frequency AS calibrationFrequency,I.calibration_required AS calibrationRequired,
    CASE I.calibration_frequency WHEN 'MONTHLY' THEN 1 WHEN 'QUARTERLY' THEN 3
      WHEN 'HALF_YEARLY' THEN 6 WHEN 'YEARLY' THEN 12 ELSE 12 END AS calibrationFrequencyMonths,
    CA.supplier_name AS calibrationAgency,
    GI.warehouse_code AS warehouseCode,GI.bin_location AS binLocation,
    GI.accepted_quantity AS acceptedQuantity,COUNT(GM.gauge_master_id) AS registeredQuantity,
    COALESCE((SELECT SUM(B.quantity_on_hand) FROM inventory_stock_balance B
      WHERE B.tenant_id=GI.tenant_id AND B.item_id=GI.item_id
        AND COALESCE(B.plant_id,'')=COALESCE(G.plant_id,'')
        AND B.warehouse_code=GI.warehouse_code AND B.bin_location=GI.bin_location
        AND B.stock_owner_type='COMPANY'),0) AS inventoryQuantity,
    GREATEST(FLOOR(COALESCE((SELECT SUM(B.quantity_on_hand) FROM inventory_stock_balance B
      WHERE B.tenant_id=GI.tenant_id AND B.item_id=GI.item_id
        AND COALESCE(B.plant_id,'')=COALESCE(G.plant_id,'')
        AND B.warehouse_code=GI.warehouse_code AND B.bin_location=GI.bin_location
        AND B.stock_owner_type='COMPANY'),0))-COUNT(GM.gauge_master_id),0) AS registrationAvailable
    FROM goods_receipt_note_items GI
    JOIN goods_receipt_notes G ON G.grn_id=GI.grn_id AND G.tenant_id=GI.tenant_id
    JOIN item_master I ON I.item_id=GI.item_id
    JOIN item_group_master IG ON IG.item_group_id=I.item_group_id AND IG.group_code='IG'
    LEFT JOIN item_type_master IT ON IT.item_type_id=I.item_type_id
    LEFT JOIN supplier_master CA ON CA.supplier_id=I.calibration_agency_id AND CA.active_flag='Y'
    LEFT JOIN gauge_master GM ON GM.grn_item_id=GI.grn_item_id AND GM.tenant_id=GI.tenant_id
    WHERE GI.tenant_id=? AND G.status='POSTED' AND GI.accepted_quantity > 0
    GROUP BY GI.grn_item_id,GI.grn_id,G.grn_number,G.grn_date,G.plant_id,GI.item_id,I.item_code,
      GI.item_description_snapshot,IT.type_name,IT.item_code_prefix,I.make_name,I.model_name,
      I.measurement_range,I.least_count,I.accuracy,I.calibration_frequency,I.calibration_required,
      I.calibration_agency_id,CA.supplier_name,GI.warehouse_code,GI.bin_location,
    GI.accepted_quantity
    HAVING registrationAvailable > 0
    ORDER BY G.grn_date DESC,GI.grn_item_id DESC`, [tenantId]);
  return rows;
}

export async function getRegistrationStockForUpdate(connection, source) {
  const [rows] = await connection.execute(`SELECT quantity_on_hand AS quantityOnHand
    FROM inventory_stock_balance
    WHERE tenant_id=? AND item_id=? AND COALESCE(plant_id,'')=COALESCE(?, '')
      AND warehouse_code=? AND bin_location=? AND stock_owner_type='COMPANY'
    FOR UPDATE`, [source.tenantId,source.itemId,source.plantId || '',source.warehouseCode,source.binLocation]);
  return rows.reduce((total, row) => total + Number(row.quantityOnHand || 0), 0);
}

export async function hasActiveCalibrationSupplier(connection, supplierName) {
  const [rows] = await connection.execute(`SELECT COUNT(*) AS total
    FROM supplier_master
    WHERE supplier_name=?
      AND active_flag='Y'
      AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'
      AND supplier_category='CALIBRATION'`, [String(supplierName).trim()]);
  return Number(rows[0]?.total || 0) > 0;
}

export async function getRegistrationSourceForUpdate(connection, tenantId, grnItemId) {
  const [rows] = await connection.execute(`SELECT GI.grn_item_id AS grnItemId,GI.grn_id AS grnId,
    G.grn_number AS grnNumber,G.plant_id AS plantId,G.company_id AS companyId,
    GI.item_id AS itemId,I.item_code AS itemCode,GI.item_description_snapshot AS itemDescription,
    IT.item_code_prefix AS itemTypePrefix,I.make_name AS makeName,I.model_name AS modelNumber,
    I.measurement_range AS measurementRange,
    I.least_count AS leastCount,I.accuracy,I.calibration_frequency AS calibrationFrequency,
    CASE I.calibration_frequency WHEN 'MONTHLY' THEN 1 WHEN 'QUARTERLY' THEN 3
      WHEN 'HALF_YEARLY' THEN 6 WHEN 'YEARLY' THEN 12 ELSE 12 END AS calibrationFrequencyMonths,
    CA.supplier_name AS calibrationAgency,
    GI.warehouse_code AS warehouseCode,GI.bin_location AS binLocation,GI.accepted_quantity AS acceptedQuantity
    FROM goods_receipt_note_items GI
    JOIN goods_receipt_notes G ON G.grn_id=GI.grn_id AND G.tenant_id=GI.tenant_id
    JOIN item_master I ON I.item_id=GI.item_id
    JOIN item_group_master IG ON IG.item_group_id=I.item_group_id AND IG.group_code='IG'
    LEFT JOIN item_type_master IT ON IT.item_type_id=I.item_type_id
    LEFT JOIN supplier_master CA ON CA.supplier_id=I.calibration_agency_id AND CA.active_flag='Y'
    WHERE GI.tenant_id=? AND GI.grn_item_id=? AND G.status='POSTED' AND GI.accepted_quantity > 0
    FOR UPDATE`, [tenantId, Number(grnItemId)]);
  if (!rows[0]) return null;
  const [registeredRows] = await connection.execute(`SELECT gauge_master_id AS gaugeMasterId
    FROM gauge_master WHERE tenant_id=? AND grn_item_id=? FOR UPDATE`, [tenantId, Number(grnItemId)]);
  return { ...rows[0], tenantId, registeredQuantity: registeredRows.length };
}

export async function reserveGaugeIds(connection, instrumentAbbreviation, quantity, userCode) {
  await connection.execute(`INSERT INTO gauge_id_sequence (instrument_abbreviation,last_number,updated_by)
    VALUES (?,0,?) ON DUPLICATE KEY UPDATE updated_by=VALUES(updated_by)`, [instrumentAbbreviation, userCode]);
  const [rows] = await connection.execute(`SELECT last_number AS lastNumber FROM gauge_id_sequence
    WHERE instrument_abbreviation=? FOR UPDATE`, [instrumentAbbreviation]);
  const start = Number(rows[0]?.lastNumber || 0) + 1;
  await connection.execute(`UPDATE gauge_id_sequence SET last_number=?,updated_by=?
    WHERE instrument_abbreviation=?`, [start + quantity - 1, userCode, instrumentAbbreviation]);
  return Array.from({ length: quantity }, (_, index) => `ATA-${instrumentAbbreviation}-${String(start + index).padStart(4, "0")}`);
}

export async function insertGauge(connection, gauge, userCode) {
  const [result] = await connection.execute(`INSERT INTO gauge_master
    (tenant_id,company_id,plant_id,grn_id,grn_item_id,item_id,gauge_id,instrument_abbreviation,
     instrument_name_snapshot,item_code_snapshot,manufacturer_serial_number,make_name,model_number,
     measurement_range,least_count,accuracy,calibration_frequency_months,last_calibration_date,
     calibration_due_date,calibration_agency,current_location,assigned_to,operational_status,remarks,created_by,storage_location_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    gauge.tenantId,gauge.companyId,gauge.plantId,gauge.grnId,gauge.grnItemId,gauge.itemId,gauge.gaugeId,
    gauge.instrumentAbbreviation,gauge.instrumentName,gauge.itemCode,gauge.manufacturerSerialNumber,
    gauge.makeName,gauge.modelNumber,gauge.measurementRange,gauge.leastCount,gauge.accuracy,
    gauge.calibrationFrequencyMonths,gauge.lastCalibrationDate,gauge.calibrationDueDate,
    gauge.calibrationAgency,gauge.currentLocation,null,"AVAILABLE",gauge.remarks,userCode,gauge.storageLocationId ?? null,
  ]);
  return Number(result.insertId);
}

export async function insertHistory(connection, history, userCode) {
  const [result] = await connection.execute(`INSERT INTO gauge_history
    (tenant_id,gauge_master_id,gauge_movement_batch_id,event_type,event_date,operational_status,location_name,assigned_to,
     calibration_agency,calibration_result,calibration_due_date,certificate_number,certificate_file_name,certificate_file_path,
     certificate_file_size_bytes,remarks,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    history.tenantId,history.gaugeMasterId,history.gaugeMovementBatchId || null,history.eventType,history.eventDate,history.operationalStatus || null,
    history.locationName || null,history.assignedTo || null,history.calibrationAgency || null,
    history.calibrationResult || null,history.calibrationDueDate || null,history.certificateNumber || null,
    history.certificateFile?.fileName || null,history.certificateFile?.filePath || null,
    history.certificateFile?.fileSizeBytes || null,history.remarks || null,userCode,
  ]);
  return Number(result.insertId);
}

export async function getCalibrationAlertSummary(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT
    SUM(CASE WHEN GM.operational_status NOT IN ('REJECTED','RETIRED')
      AND DATEDIFF(GM.calibration_due_date,CURDATE()) BETWEEN 1 AND 10 THEN 1 ELSE 0 END) AS dueSoonCount,
    SUM(CASE WHEN GM.operational_status NOT IN ('REJECTED','RETIRED')
      AND DATEDIFF(GM.calibration_due_date,CURDATE()) = 0 THEN 1 ELSE 0 END) AS dueTodayCount,
    SUM(CASE WHEN GM.operational_status NOT IN ('REJECTED','RETIRED')
      AND DATEDIFF(GM.calibration_due_date,CURDATE()) < 0 THEN 1 ELSE 0 END) AS expiredCount
    FROM gauge_master GM
    WHERE GM.tenant_id=? AND GM.active_flag='Y'`, [tenantId]);
  const summary = rows[0] || {};
  const dueSoonCount = Number(summary.dueSoonCount || 0);
  const dueTodayCount = Number(summary.dueTodayCount || 0);
  const expiredCount = Number(summary.expiredCount || 0);
  return { dueSoonCount, dueTodayCount, expiredCount, dueWithinTenDays: dueSoonCount + dueTodayCount };
}

export async function getCalibrationWorkflowSummary(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT
    SUM(CASE WHEN GM.operational_status='AVAILABLE'
      AND DATEDIFF(GM.calibration_due_date,CURDATE()) <= 10 THEN 1 ELSE 0 END) AS collectionCount,
    SUM(CASE WHEN GM.operational_status='AVAILABLE'
      AND DATEDIFF(GM.calibration_due_date,CURDATE()) < 0 THEN 1 ELSE 0 END) AS collectionOverdueCount,
    SUM(CASE WHEN GM.operational_status='COLLECTED_FOR_CALIBRATION' THEN 1 ELSE 0 END) AS dispatchQueueCount,
    SUM(CASE WHEN GM.operational_status='UNDER_CALIBRATION' THEN 1 ELSE 0 END) AS underCalibrationCount,
    SUM(CASE WHEN GM.operational_status IN ('REJECTED','UNDER_SERVICE') THEN 1 ELSE 0 END) AS serviceCount
    FROM gauge_master GM
    WHERE GM.tenant_id=? AND GM.active_flag='Y'`, [tenantId]);
  const summary = rows[0] || {};
  return {
    collection: Number(summary.collectionCount || 0),
    collectionOverdue: Number(summary.collectionOverdueCount || 0),
    ready: Number(summary.dispatchQueueCount || 0),
    calibration: Number(summary.underCalibrationCount || 0),
    service: Number(summary.serviceCount || 0),
  };
}

export async function insertMovementBatch(connection, batch) {
  const [result] = await connection.execute(`INSERT INTO gauge_movement_batches
    (tenant_id,movement_number,movement_type,movement_date,issued_to,calibration_agency,service_purchase_order_id,
     service_po_number_snapshot,challan_number,expected_return_date,courier_reference,source_calibration_dispatch_id,
     material_outward_document_id,gate_entry_id,location_name,remarks,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    batch.tenantId,batch.movementNumber,batch.movementType,batch.movementDate,batch.issuedTo || null,
    batch.calibrationAgency || null,batch.servicePurchaseOrderId || null,batch.servicePoNumber || null,
    batch.challanNumber || null,batch.expectedReturnDate || null,batch.courierReference || null,
    batch.sourceCalibrationDispatchId || null,batch.materialOutwardDocumentId || null,batch.gateEntryId || null,batch.locationName,batch.remarks || null,batch.createdBy,
  ]);
  return Number(result.insertId);
}

export async function listCalibrationServicePurchaseOrders(tenantId) {
  const [rows] = await db.execute(`SELECT PO.purchase_order_id AS purchaseOrderId,PO.po_number AS poNumber,
    PO.po_date AS poDate,PO.supplier_id AS supplierId,PO.supplier_name_snapshot AS supplierName,
    PO.grand_total_amount AS grandTotalAmount,PO.status
    FROM purchase_orders PO
    WHERE PO.tenant_id=? AND PO.status='APPROVED'
    ORDER BY PO.po_date DESC,PO.purchase_order_id DESC`, [tenantId]);
  return rows;
}

export async function getCalibrationServicePurchaseOrder(connection, tenantId, purchaseOrderId) {
  const [rows] = await connection.execute(`SELECT PO.purchase_order_id AS purchaseOrderId,PO.po_number AS poNumber,
    PO.supplier_id AS supplierId,PO.supplier_name_snapshot AS supplierName,PO.status
    FROM purchase_orders PO
    WHERE PO.tenant_id=? AND PO.purchase_order_id=? AND PO.status='APPROVED'
    FOR UPDATE`, [tenantId, Number(purchaseOrderId)]);
  return rows[0] || null;
}

export async function listCalibrationDispatches(filters = {}) {
  const limit = integer(filters.limit, 20, 1, 100);
  const offset = integer(filters.offset, 0);
  const [rows] = await db.execute(`SELECT B.gauge_movement_batch_id AS calibrationDispatchId,
    B.movement_number AS dispatchNumber,B.challan_number AS challanNumber,B.movement_date AS dispatchDate,
    B.calibration_agency AS calibrationAgency,B.service_purchase_order_id AS servicePurchaseOrderId,
    B.service_po_number_snapshot AS servicePoNumber,B.expected_return_date AS expectedReturnDate,
    B.courier_reference AS courierReference,B.dispatch_status AS dispatchStatus,
    B.location_name AS dispatchLocation,B.remarks,
    B.created_at AS lastUpdated,
    COUNT(DISTINCT H.gauge_history_id) AS gaugeCount,
    COUNT(DISTINCT RH.gauge_master_id) AS returnedGaugeCount,
    GROUP_CONCAT(DISTINCT GM.gauge_id ORDER BY GM.gauge_id SEPARATOR ', ') AS gaugeIds
    FROM gauge_movement_batches B
    LEFT JOIN gauge_history H ON H.gauge_movement_batch_id=B.gauge_movement_batch_id
      AND H.tenant_id=B.tenant_id AND H.event_type='CALIBRATION_DISPATCHED'
    LEFT JOIN gauge_master GM ON GM.gauge_master_id=H.gauge_master_id AND GM.tenant_id=B.tenant_id
    LEFT JOIN gauge_movement_batches RB ON RB.source_calibration_dispatch_id=B.gauge_movement_batch_id
      AND RB.tenant_id=B.tenant_id AND RB.movement_type='CALIBRATION_RETURN'
    LEFT JOIN gauge_history RH ON RH.gauge_movement_batch_id=RB.gauge_movement_batch_id
      AND RH.tenant_id=B.tenant_id AND RH.event_type='CALIBRATION_RETURNED'
    WHERE B.tenant_id=? AND B.movement_type='CALIBRATION_DISPATCH'
    GROUP BY B.gauge_movement_batch_id
    ORDER BY B.created_at DESC,B.gauge_movement_batch_id DESC
    LIMIT ${limit} OFFSET ${offset}`, [filters.tenantId]);
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM gauge_movement_batches
    WHERE tenant_id=? AND movement_type='CALIBRATION_DISPATCH'`, [filters.tenantId]);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getCalibrationDispatch(calibrationDispatchId, tenantId, connection = db) {
  const [headers] = await connection.execute(`SELECT B.gauge_movement_batch_id AS calibrationDispatchId,
    B.movement_number AS dispatchNumber,B.challan_number AS challanNumber,B.movement_date AS dispatchDate,
    B.calibration_agency AS calibrationAgency,B.service_purchase_order_id AS servicePurchaseOrderId,
    B.service_po_number_snapshot AS servicePoNumber,B.expected_return_date AS expectedReturnDate,
    B.courier_reference AS courierReference,B.dispatch_status AS dispatchStatus,
    B.location_name AS dispatchLocation,B.remarks,B.created_by AS createdBy,
    B.created_at AS createdAt
    FROM gauge_movement_batches B
    WHERE B.tenant_id=? AND B.gauge_movement_batch_id=? AND B.movement_type='CALIBRATION_DISPATCH'`,
  [tenantId, Number(calibrationDispatchId)]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT H.gauge_history_id AS gaugeHistoryId,H.gauge_master_id AS gaugeMasterId,
    GM.gauge_id AS gaugeId,GM.instrument_name_snapshot AS instrumentName,
    GM.manufacturer_serial_number AS manufacturerSerialNumber,H.location_name AS dispatchedTo,
    H.event_date AS dispatchDate,GM.operational_status AS operationalStatus,
    CR.gaugeHistoryId AS calibrationReturnHistoryId,CR.calibrationReturnId,
    CR.returnGrnNumber,CR.returnDate,CR.returnLocation,CR.calibrationResult,CR.calibrationDueDate,
    CR.certificateNumber,CR.returnRemarks
    FROM gauge_history H
    JOIN gauge_master GM ON GM.gauge_master_id=H.gauge_master_id AND GM.tenant_id=H.tenant_id
    LEFT JOIN (
      SELECT RH.tenant_id AS tenantId,RH.gauge_master_id AS gaugeMasterId,
        RB.source_calibration_dispatch_id AS calibrationDispatchId,
        RH.gauge_history_id AS gaugeHistoryId,RB.gauge_movement_batch_id AS calibrationReturnId,
        RB.movement_number AS returnGrnNumber,RB.movement_date AS returnDate,RB.location_name AS returnLocation,
        RH.calibration_result AS calibrationResult,RH.calibration_due_date AS calibrationDueDate,
        RH.certificate_number AS certificateNumber,RH.remarks AS returnRemarks
      FROM gauge_history RH
      JOIN gauge_movement_batches RB ON RB.tenant_id=RH.tenant_id AND RB.gauge_movement_batch_id=RH.gauge_movement_batch_id
      WHERE RH.event_type='CALIBRATION_RETURNED' AND RB.movement_type='CALIBRATION_RETURN'
    ) CR ON CR.tenantId=H.tenant_id AND CR.gaugeMasterId=H.gauge_master_id
      AND CR.calibrationDispatchId=H.gauge_movement_batch_id
    WHERE H.tenant_id=? AND H.gauge_movement_batch_id=? AND H.event_type='CALIBRATION_DISPATCHED'
    ORDER BY GM.gauge_id`, [tenantId, Number(calibrationDispatchId)]);
  const [returns] = await connection.execute(`SELECT RB.gauge_movement_batch_id AS calibrationReturnId,
    RB.movement_number AS returnGrnNumber,RB.movement_date AS returnDate,RB.location_name AS returnLocation,
    RB.remarks,COUNT(RH.gauge_history_id) AS gaugeCount
    FROM gauge_movement_batches RB
    LEFT JOIN gauge_history RH ON RH.tenant_id=RB.tenant_id AND RH.gauge_movement_batch_id=RB.gauge_movement_batch_id
      AND RH.event_type='CALIBRATION_RETURNED'
    WHERE RB.tenant_id=? AND RB.source_calibration_dispatch_id=? AND RB.movement_type='CALIBRATION_RETURN'
    GROUP BY RB.gauge_movement_batch_id
    ORDER BY RB.movement_date,RB.gauge_movement_batch_id`, [tenantId, Number(calibrationDispatchId)]);
  return { ...headers[0], items, returns };
}

export async function getCalibrationDispatchForUpdate(connection, calibrationDispatchId, tenantId) {
  const [rows] = await connection.execute(`SELECT gauge_movement_batch_id AS calibrationDispatchId,
    movement_number AS dispatchNumber,challan_number AS challanNumber,movement_date AS dispatchDate,
    calibration_agency AS calibrationAgency,dispatch_status AS dispatchStatus
    FROM gauge_movement_batches
    WHERE tenant_id=? AND gauge_movement_batch_id=? AND movement_type='CALIBRATION_DISPATCH'
    FOR UPDATE`, [tenantId, Number(calibrationDispatchId)]);
  return rows[0] || null;
}

export async function listCalibrationDispatchGaugeIds(connection, calibrationDispatchId, tenantId) {
  const [rows] = await connection.execute(`SELECT gauge_master_id AS gaugeMasterId
    FROM gauge_history
    WHERE tenant_id=? AND gauge_movement_batch_id=? AND event_type='CALIBRATION_DISPATCHED'`,
  [tenantId, Number(calibrationDispatchId)]);
  return rows.map((row) => Number(row.gaugeMasterId));
}

export async function countCalibrationDispatchReturnedGauges(connection, calibrationDispatchId, tenantId) {
  const [rows] = await connection.execute(`SELECT COUNT(DISTINCT H.gauge_master_id) AS returnedGaugeCount
    FROM gauge_movement_batches RB
    JOIN gauge_history H ON H.tenant_id=RB.tenant_id AND H.gauge_movement_batch_id=RB.gauge_movement_batch_id
      AND H.event_type='CALIBRATION_RETURNED'
    WHERE RB.tenant_id=? AND RB.source_calibration_dispatch_id=? AND RB.movement_type='CALIBRATION_RETURN'`,
  [tenantId, Number(calibrationDispatchId)]);
  return Number(rows[0]?.returnedGaugeCount || 0);
}

export async function updateCalibrationDispatchStatus(connection, calibrationDispatchId, tenantId, dispatchStatus) {
  await connection.execute(`UPDATE gauge_movement_batches SET dispatch_status=?
    WHERE tenant_id=? AND gauge_movement_batch_id=? AND movement_type='CALIBRATION_DISPATCH'`,
  [dispatchStatus, tenantId, Number(calibrationDispatchId)]);
}

export async function getCalibrationReturn(calibrationReturnId, tenantId, connection = db) {
  const [headers] = await connection.execute(`SELECT RB.gauge_movement_batch_id AS calibrationReturnId,
    RB.movement_number AS returnGrnNumber,RB.movement_date AS returnDate,RB.location_name AS returnLocation,
    RB.calibration_agency AS calibrationAgency,RB.remarks,RB.source_calibration_dispatch_id AS calibrationDispatchId,
    DB.movement_number AS dispatchNumber,DB.challan_number AS challanNumber
    FROM gauge_movement_batches RB
    JOIN gauge_movement_batches DB ON DB.tenant_id=RB.tenant_id
      AND DB.gauge_movement_batch_id=RB.source_calibration_dispatch_id
    WHERE RB.tenant_id=? AND RB.gauge_movement_batch_id=? AND RB.movement_type='CALIBRATION_RETURN'`,
  [tenantId, Number(calibrationReturnId)]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT H.gauge_history_id AS gaugeHistoryId,H.gauge_master_id AS gaugeMasterId,
    GM.gauge_id AS gaugeId,GM.instrument_name_snapshot AS instrumentName,H.calibration_result AS calibrationResult,
    H.event_date AS calibrationDate,H.calibration_due_date AS calibrationDueDate,H.certificate_number AS certificateNumber,
    H.certificate_file_name AS certificateFileName,H.certificate_file_path AS certificateFilePath,
    H.certificate_file_size_bytes AS certificateFileSizeBytes,
    CASE WHEN H.certificate_file_path IS NULL THEN NULL ELSE CONCAT('/uploads/',REPLACE(H.certificate_file_path,'\\\\','/')) END AS certificateFileUrl,
    H.remarks
    FROM gauge_history H
    JOIN gauge_master GM ON GM.gauge_master_id=H.gauge_master_id AND GM.tenant_id=H.tenant_id
    WHERE H.tenant_id=? AND H.gauge_movement_batch_id=? AND H.event_type='CALIBRATION_RETURNED'
    ORDER BY GM.gauge_id`, [tenantId, Number(calibrationReturnId)]);
  return { ...headers[0], items };
}

export async function listGauges(filters = {}) {
  const limit = integer(filters.limit, 20, 1, 100);
  const offset = integer(filters.offset, 0);
  const { clauses, params } = listWhere(filters);
  const where = clauses.join(" AND ");
  const [rows] = await db.execute(`SELECT GM.gauge_master_id AS gaugeMasterId,GM.gauge_id AS gaugeId,
    GM.instrument_name_snapshot AS instrumentName,GM.item_code_snapshot AS itemCode,
    GM.manufacturer_serial_number AS manufacturerSerialNumber,GM.measurement_range AS measurementRange,
    GM.calibration_due_date AS calibrationDueDate,GM.current_location AS currentLocation,
    GM.assigned_to AS assignedTo,GM.calibration_agency AS calibrationAgency,GM.operational_status AS operationalStatus,
    ${effectiveOperationalStatusSql()} AS effectiveOperationalStatus,
    GM.storage_location_id AS storageLocationId,
    COALESCE(CONCAT(L.warehouse_code,' / ',L.bin_location),'') AS storageLocation,
    COALESCE(GM.updated_at,GM.created_at) AS lastUpdated,
    DATEDIFF(GM.calibration_due_date,CURDATE()) AS daysLeft,${gaugeConditionSql()} AS calibrationCondition,
    G.grn_number AS grnNumber,GI.warehouse_code AS warehouseCode,GI.bin_location AS binLocation
    FROM gauge_master GM
    JOIN goods_receipt_notes G ON G.grn_id=GM.grn_id AND G.tenant_id=GM.tenant_id
    JOIN goods_receipt_note_items GI ON GI.grn_item_id=GM.grn_item_id AND GI.tenant_id=GM.tenant_id
    LEFT JOIN inventory_locations L ON L.tenant_id=GM.tenant_id AND L.location_id=GM.storage_location_id
    WHERE ${where}
    ORDER BY COALESCE(GM.updated_at,GM.created_at) DESC,GM.gauge_master_id DESC
    LIMIT ${limit} OFFSET ${offset}`, params);
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM gauge_master GM
    JOIN goods_receipt_notes G ON G.grn_id=GM.grn_id AND G.tenant_id=GM.tenant_id
    WHERE ${where}`, params);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getGaugeById(gaugeMasterId, tenantId, connection = db, lock = false) {
  const [rows] = await connection.execute(`SELECT GM.gauge_master_id AS gaugeMasterId,GM.tenant_id AS tenantId,
    GM.company_id AS companyId,GM.plant_id AS plantId,GM.grn_id AS grnId,GM.grn_item_id AS grnItemId,
    GM.item_id AS itemId,GM.gauge_id AS gaugeId,GM.instrument_abbreviation AS instrumentAbbreviation,
    GM.instrument_name_snapshot AS instrumentName,GM.item_code_snapshot AS itemCode,
    GM.manufacturer_serial_number AS manufacturerSerialNumber,GM.make_name AS makeName,GM.model_number AS modelNumber,
    GM.measurement_range AS measurementRange,GM.least_count AS leastCount,GM.accuracy,
    GM.calibration_frequency_months AS calibrationFrequencyMonths,GM.last_calibration_date AS lastCalibrationDate,
    GM.calibration_due_date AS calibrationDueDate,GM.calibration_agency AS calibrationAgency,
    GM.current_location AS currentLocation,GM.assigned_to AS assignedTo,GM.operational_status AS operationalStatus,
    ${effectiveOperationalStatusSql()} AS effectiveOperationalStatus,
    GM.active_flag AS activeFlag,GM.remarks,G.grn_number AS grnNumber,G.grn_date AS grnDate,
    GI.warehouse_code AS receiptWarehouseCode,GI.bin_location AS receiptBinLocation,
    DATEDIFF(GM.calibration_due_date,CURDATE()) AS daysLeft,${gaugeConditionSql()} AS calibrationCondition,
    GM.created_at AS createdAt,GM.updated_at AS updatedAt,GM.storage_location_id AS storageLocationId,
    (SELECT CONCAT(L.warehouse_code,' / ',L.bin_location) FROM inventory_locations L
      WHERE L.tenant_id=GM.tenant_id AND L.location_id=GM.storage_location_id) AS storageLocation
    FROM gauge_master GM
    JOIN goods_receipt_notes G ON G.grn_id=GM.grn_id AND G.tenant_id=GM.tenant_id
    JOIN goods_receipt_note_items GI ON GI.grn_item_id=GM.grn_item_id AND GI.tenant_id=GM.tenant_id
    WHERE GM.gauge_master_id=? AND GM.tenant_id=? ${lock ? "FOR UPDATE" : ""}`,
  [Number(gaugeMasterId), tenantId]);
  if (!rows[0]) return null;
  const gauge = rows[0];
  const [history] = await connection.execute(`SELECT gauge_history_id AS gaugeHistoryId,event_type AS eventType,
    event_date AS eventDate,operational_status AS operationalStatus,location_name AS locationName,
    assigned_to AS assignedTo,calibration_agency AS calibrationAgency,calibration_result AS calibrationResult,
    calibration_due_date AS calibrationDueDate,certificate_number AS certificateNumber,
    certificate_file_name AS certificateFileName,certificate_file_path AS certificateFilePath,
    certificate_file_size_bytes AS certificateFileSizeBytes,
    CASE WHEN certificate_file_path IS NULL THEN NULL ELSE CONCAT('/uploads/',REPLACE(certificate_file_path,'\\\\','/')) END AS certificateFileUrl,remarks,
    created_by AS createdBy,created_at AS createdAt
    FROM gauge_history WHERE gauge_master_id=? AND tenant_id=? AND event_type <> 'UPDATED'
    ORDER BY event_date DESC,gauge_history_id DESC`, [Number(gaugeMasterId), tenantId]);
  return { ...gauge, history };
}

export async function updateGaugeDetails(connection, gaugeMasterId, data, userCode) {
  await connection.execute(`UPDATE gauge_master SET manufacturer_serial_number=?,make_name=?,model_number=?,
    measurement_range=?,least_count=?,accuracy=?,calibration_frequency_months=?,last_calibration_date=?,
    calibration_due_date=?,calibration_agency=?,current_location=?,remarks=?,updated_by=?,storage_location_id=?
    WHERE gauge_master_id=?`, [
    data.manufacturerSerialNumber,data.makeName,data.modelNumber,data.measurementRange,data.leastCount,
    data.accuracy,data.calibrationFrequencyMonths,data.lastCalibrationDate,data.calibrationDueDate,
    data.calibrationAgency,data.currentLocation,data.remarks,userCode,data.storageLocationId ?? null,Number(gaugeMasterId),
  ]);
}

export async function updateLifecycle(connection, gaugeMasterId, data, userCode) {
  await connection.execute(`UPDATE gauge_master SET operational_status=?,current_location=?,assigned_to=?,
    last_calibration_date=COALESCE(?,last_calibration_date),
    calibration_due_date=COALESCE(?,calibration_due_date),
    calibration_agency=COALESCE(?,calibration_agency),updated_by=? WHERE gauge_master_id=?`, [
    data.operationalStatus,data.currentLocation,data.assignedTo || null,data.lastCalibrationDate || null,
    data.calibrationDueDate || null,data.calibrationAgency || null,userCode,Number(gaugeMasterId),
  ]);
}
