import { db } from "../../config/db.js";

export async function list({ tenantId, search = "", type = "", status = "", limit = 100, offset = 0 }) {
  const term = `%${search}%`;
  const pageLimit = Math.min(Math.max(Math.floor(Number(limit) || 100), 1), 100);
  const pageOffset = Math.max(Math.floor(Number(offset) || 0), 0);
  const [rows] = await db.execute(
    `SELECT D.material_outward_document_id AS materialOutwardDocumentId,
            D.outward_number AS outwardNumber,D.outward_date AS outwardDate,D.outward_type AS outwardType,
            D.document_status AS documentStatus,D.customer_id AS customerId,D.supplier_id AS supplierId,
            D.party_code_snapshot AS partyCode,D.party_name_snapshot AS partyName,
            D.transport_mode AS transportMode,D.transport_reference AS transportReference,
            D.gate_exit_reference AS gateExitReference,D.remarks,D.approval_remarks AS approvalRemarks,
            D.approved_by AS approvedBy,D.approved_at AS approvedAt,D.dispatched_by AS dispatchedBy,
            D.dispatched_at AS dispatchedAt,COALESCE(D.updated_at,D.created_at) AS lastUpdatedAt,
            MAX(CD.gauge_movement_batch_id) AS calibrationDispatchId,
            MAX(CD.calibration_agency) AS calibrationAgency,MAX(CD.expected_return_date) AS expectedReturnDate,
            MAX(CD.location_name) AS dispatchFrom,MAX(CD.courier_reference) AS courierReference,
            COUNT(DISTINCT GH.gauge_history_id) AS calibrationGaugeCount,
            GROUP_CONCAT(DISTINCT GM.gauge_id ORDER BY GM.gauge_id SEPARATOR ', ') AS gaugeIds,
            COUNT(DISTINCT DI.material_outward_document_item_id) AS itemCount,
            COALESCE(SUM(DI.outward_quantity),0) AS totalQuantity,
            GROUP_CONCAT(CONCAT(COALESCE(DI.item_code_snapshot,''),' · ',DI.outward_quantity,' ',COALESCE(DI.uom_code_snapshot,''))
              ORDER BY DI.material_outward_document_item_id SEPARATOR ' | ') AS itemSummary
       FROM material_outward_documents D
       LEFT JOIN material_outward_document_items DI ON DI.material_outward_document_id=D.material_outward_document_id
       LEFT JOIN gauge_movement_batches CD ON CD.material_outward_document_id=D.material_outward_document_id
       LEFT JOIN gauge_history GH ON GH.gauge_movement_batch_id=CD.gauge_movement_batch_id
         AND GH.tenant_id=D.tenant_id AND GH.event_type='CALIBRATION_DISPATCHED'
       LEFT JOIN gauge_master GM ON GM.gauge_master_id=GH.gauge_master_id AND GM.tenant_id=D.tenant_id
      WHERE D.tenant_id=?
        AND (?='' OR D.outward_type=?)
        AND (?='' OR D.document_status=?)
        AND (?='' OR D.outward_number LIKE ? OR D.party_name_snapshot LIKE ? OR DI.item_code_snapshot LIKE ? OR DI.item_description_snapshot LIKE ?)
      GROUP BY D.material_outward_document_id
      ORDER BY D.outward_date DESC,D.material_outward_document_id DESC
      LIMIT ${pageLimit} OFFSET ${pageOffset}`,
    [tenantId, type, type, status, status, search, term, term, term, term]
  );
  const [[count]] = await db.execute(
    `SELECT COUNT(DISTINCT D.material_outward_document_id) AS total
       FROM material_outward_documents D
       LEFT JOIN material_outward_document_items DI ON DI.material_outward_document_id=D.material_outward_document_id
      WHERE D.tenant_id=?
        AND (?='' OR D.outward_type=?)
        AND (?='' OR D.document_status=?)
        AND (?='' OR D.outward_number LIKE ? OR D.party_name_snapshot LIKE ? OR DI.item_code_snapshot LIKE ? OR DI.item_description_snapshot LIKE ?)`,
    [tenantId, type, type, status, status, search, term, term, term, term]
  );
  return { rows, total: Number(count?.total || 0) };
}

export async function getForUpdate(connection, tenantId, documentId) {
  const [headers] = await connection.execute(
    `SELECT * FROM material_outward_documents
      WHERE tenant_id=? AND material_outward_document_id=? FOR UPDATE`,
    [tenantId, Number(documentId)]
  );
  const header = headers[0];
  if (!header) return null;
  const [items] = await connection.execute(
    `SELECT * FROM material_outward_document_items
      WHERE material_outward_document_id=? ORDER BY material_outward_document_item_id FOR UPDATE`,
    [Number(documentId)]
  );
  return { ...header, items };
}

export async function get(tenantId, documentId) {
  const [headers] = await db.execute(
    `SELECT * FROM material_outward_documents
      WHERE tenant_id=? AND material_outward_document_id=?`,
    [tenantId, Number(documentId)]
  );
  const header = headers[0];
  if (!header) return null;
  const [items] = await db.execute(
    `SELECT * FROM material_outward_document_items
      WHERE material_outward_document_id=? ORDER BY material_outward_document_item_id`,
    [Number(documentId)]
  );
  return { ...header, items };
}

export async function listOutsourceWip({ tenantId, search = "", limit = 100, offset = 0 }) {
  const term = `%${search}%`;
  const pageLimit = Math.min(Math.max(Math.floor(Number(limit) || 100), 1), 100);
  const pageOffset = Math.max(Math.floor(Number(offset) || 0), 0);
  const [rows] = await db.execute(
    `SELECT W.outsourcing_issue_wip_balance_id AS outsourcingIssueWipBalanceId,
            D.outward_number AS outwardNumber,D.outward_date AS outwardDate,D.gate_exit_reference AS gateExitReference,
            W.supplier_name_snapshot AS supplierName,W.item_code_snapshot AS itemCode,
            W.item_description_snapshot AS itemDescription,W.uom_code_snapshot AS uomCode,
            W.batch_serial_number AS batchSerialNumber,W.quantity_issued AS quantityIssued,
            W.quantity_returned AS quantityReturned,(W.quantity_issued-W.quantity_returned) AS quantityInWip,
            W.wip_status AS wipStatus,W.updated_at AS lastUpdatedAt
       FROM outsourcing_issue_wip_balance W
       JOIN material_outward_documents D ON D.material_outward_document_id=W.material_outward_document_id
      WHERE W.tenant_id=?
        AND (?='' OR D.outward_number LIKE ? OR W.supplier_name_snapshot LIKE ?
          OR W.item_code_snapshot LIKE ? OR W.item_description_snapshot LIKE ? OR W.batch_serial_number LIKE ?)
      ORDER BY D.outward_date DESC,W.outsourcing_issue_wip_balance_id DESC
      LIMIT ${pageLimit} OFFSET ${pageOffset}`,
    [tenantId, search, term, term, term, term, term]
  );
  const [[count]] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM outsourcing_issue_wip_balance W
       JOIN material_outward_documents D ON D.material_outward_document_id=W.material_outward_document_id
      WHERE W.tenant_id=?
        AND (?='' OR D.outward_number LIKE ? OR W.supplier_name_snapshot LIKE ?
          OR W.item_code_snapshot LIKE ? OR W.item_description_snapshot LIKE ? OR W.batch_serial_number LIKE ?)`,
    [tenantId, search, term, term, term, term, term]
  );
  return { rows, total: Number(count?.total || 0) };
}

export async function getCompanyStockForUpdate(connection, tenantId, stockBalanceId) {
  const [rows] = await connection.execute(
    `SELECT B.*,I.item_code,I.item_description,U.uom_code
       FROM inventory_stock_balance B
       JOIN item_master I ON I.item_id=B.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE B.tenant_id=? AND B.inventory_stock_balance_id=?
        AND B.stock_owner_type='COMPANY'
        AND B.stock_status='AVAILABLE'
        AND B.sub_inventory_code NOT IN ('MATERIAL_REJECTION','PROCESS_REJECTION','SCRAP') FOR UPDATE`,
    [tenantId, Number(stockBalanceId)]
  );
  return rows[0] || null;
}

export async function getActiveCustomer(connection, customerId) {
  const [rows] = await connection.execute(
    `SELECT customer_id,customer_code,customer_name FROM customer_master
      WHERE customer_id=?
        AND active_flag='Y'
        AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'
        AND party_type IN ('CUSTOMER','BOTH')`,
    [Number(customerId)]
  );
  return rows[0] || null;
}

export async function getActiveSupplier(connection, supplierId, supplierCategory = null) {
  const [rows] = await connection.execute(
    `SELECT supplier_id,supplier_code,supplier_name,supplier_category FROM supplier_master
      WHERE supplier_id=?
        AND active_flag='Y'
        AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'
        AND (? IS NULL OR supplier_category=?)`,
    [Number(supplierId), supplierCategory, supplierCategory]
  );
  return rows[0] || null;
}

export async function maxDocumentNumber(connection, tenantId, financialYear) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(outward_number,'/',-1) AS UNSIGNED)),0) AS currentNumber
       FROM material_outward_documents
      WHERE tenant_id=? AND outward_number LIKE ?`,
    [tenantId, `MOUT/${financialYear}/%`]
  );
  return Number(rows[0]?.currentNumber || 0);
}

export async function maxGateExitNumber(connection, tenantId, financialYear) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(gate_exit_number,'/',-1) AS UNSIGNED)),0) AS currentNumber
       FROM material_gate_exits
      WHERE tenant_id=? AND gate_exit_number LIKE ?`,
    [tenantId, `GEX/${financialYear}/%`]
  );
  return Number(rows[0]?.currentNumber || 0);
}

export async function listGateExitCandidates({ tenantId, search = "", limit = 100, offset = 0 }) {
  const term = `%${search}%`;
  const pageLimit = Math.min(Math.max(Math.floor(Number(limit) || 100), 1), 100);
  const pageOffset = Math.max(Math.floor(Number(offset) || 0), 0);
  const [rows] = await db.execute(
    `SELECT D.material_outward_document_id AS materialOutwardDocumentId,
            D.outward_number AS outwardNumber,D.outward_date AS outwardDate,D.outward_type AS outwardType,
            D.document_status AS documentStatus,D.party_code_snapshot AS partyCode,D.party_name_snapshot AS partyName,
            D.transport_mode AS transportMode,D.transport_reference AS transportReference,D.remarks,
            COUNT(DI.material_outward_document_item_id) AS itemCount,
            COALESCE(SUM(DI.outward_quantity),0) AS totalQuantity,
            GROUP_CONCAT(CONCAT(COALESCE(DI.item_code_snapshot,''),' · ',DI.outward_quantity,' ',COALESCE(DI.uom_code_snapshot,''))
              ORDER BY DI.material_outward_document_item_id SEPARATOR ' | ') AS itemSummary
       FROM material_outward_documents D
       LEFT JOIN material_outward_document_items DI ON DI.material_outward_document_id=D.material_outward_document_id
       LEFT JOIN material_gate_exits E ON E.material_outward_document_id=D.material_outward_document_id
         AND E.tenant_id=D.tenant_id
      WHERE D.tenant_id=? AND D.document_status IN ('APPROVED','DISPATCHED')
        AND E.material_gate_exit_id IS NULL
        AND (?='' OR D.outward_number LIKE ? OR D.party_name_snapshot LIKE ? OR DI.item_code_snapshot LIKE ? OR DI.item_description_snapshot LIKE ?)
      GROUP BY D.material_outward_document_id
      ORDER BY FIELD(D.document_status,'APPROVED','DISPATCHED'),D.outward_date DESC,D.material_outward_document_id DESC
      LIMIT ${pageLimit} OFFSET ${pageOffset}`,
    [tenantId, search, term, term, term, term]
  );
  const [[count]] = await db.execute(
    `SELECT COUNT(DISTINCT D.material_outward_document_id) AS total
       FROM material_outward_documents D
       LEFT JOIN material_outward_document_items DI ON DI.material_outward_document_id=D.material_outward_document_id
       LEFT JOIN material_gate_exits E ON E.material_outward_document_id=D.material_outward_document_id
         AND E.tenant_id=D.tenant_id
      WHERE D.tenant_id=? AND D.document_status IN ('APPROVED','DISPATCHED') AND E.material_gate_exit_id IS NULL
        AND (?='' OR D.outward_number LIKE ? OR D.party_name_snapshot LIKE ? OR DI.item_code_snapshot LIKE ? OR DI.item_description_snapshot LIKE ?)` ,
    [tenantId, search, term, term, term, term]
  );
  return { rows, total: Number(count?.total || 0) };
}

export async function listGateExits({ tenantId, search = "", limit = 100, offset = 0 }) {
  const term = `%${search}%`;
  const pageLimit = Math.min(Math.max(Math.floor(Number(limit) || 100), 1), 100);
  const pageOffset = Math.max(Math.floor(Number(offset) || 0), 0);
  const [rows] = await db.execute(
    `SELECT E.material_gate_exit_id AS materialGateExitId,E.gate_exit_number AS gateExitNumber,
            E.exit_datetime AS exitDateTime,E.transport_mode AS transportMode,E.vehicle_number AS vehicleNumber,
            E.driver_name AS driverName,E.driving_licence_number AS drivingLicenceNumber,
            E.courier_name AS courierName,E.courier_receipt_number AS courierReceiptNumber,E.remarks,E.created_by AS createdBy,
            D.material_outward_document_id AS materialOutwardDocumentId,D.outward_number AS outwardNumber,
            D.outward_date AS outwardDate,D.outward_type AS outwardType,D.document_status AS documentStatus,
            D.party_code_snapshot AS partyCode,D.party_name_snapshot AS partyName,
            COUNT(DI.material_outward_document_item_id) AS itemCount,COALESCE(SUM(DI.outward_quantity),0) AS totalQuantity,
            GROUP_CONCAT(CONCAT(COALESCE(DI.item_code_snapshot,''),' · ',DI.outward_quantity,' ',COALESCE(DI.uom_code_snapshot,''))
              ORDER BY DI.material_outward_document_item_id SEPARATOR ' | ') AS itemSummary
       FROM material_gate_exits E
       JOIN material_outward_documents D ON D.material_outward_document_id=E.material_outward_document_id
       LEFT JOIN material_outward_document_items DI ON DI.material_outward_document_id=D.material_outward_document_id
      WHERE E.tenant_id=?
        AND (?='' OR E.gate_exit_number LIKE ? OR D.outward_number LIKE ? OR D.party_name_snapshot LIKE ? OR E.vehicle_number LIKE ?)
      GROUP BY E.material_gate_exit_id
      ORDER BY E.exit_datetime DESC,E.material_gate_exit_id DESC
      LIMIT ${pageLimit} OFFSET ${pageOffset}`,
    [tenantId, search, term, term, term, term]
  );
  const [[count]] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM material_gate_exits E
       JOIN material_outward_documents D ON D.material_outward_document_id=E.material_outward_document_id
      WHERE E.tenant_id=?
        AND (?='' OR E.gate_exit_number LIKE ? OR D.outward_number LIKE ? OR D.party_name_snapshot LIKE ? OR E.vehicle_number LIKE ?)` ,
    [tenantId, search, term, term, term, term]
  );
  return { rows, total: Number(count?.total || 0) };
}

export async function getGateExitForUpdate(connection, tenantId, materialOutwardDocumentId) {
  const [rows] = await connection.execute(
    `SELECT * FROM material_gate_exits
      WHERE tenant_id=? AND material_outward_document_id=? FOR UPDATE`,
    [tenantId, Number(materialOutwardDocumentId)]
  );
  return rows[0] || null;
}

export async function insertGateExit(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO material_gate_exits
      (tenant_id,company_id,plant_id,gate_exit_number,material_outward_document_id,exit_datetime,transport_mode,
       vehicle_number,driver_name,driving_licence_number,courier_name,courier_receipt_number,remarks,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [data.tenantId,data.companyId || null,data.plantId || null,data.gateExitNumber,data.materialOutwardDocumentId,
      data.exitDateTime,data.transportMode || null,data.vehicleNumber || null,data.driverName || null,
      data.drivingLicenceNumber || null,data.courierName || null,data.courierReceiptNumber || null,
      data.remarks || null,data.userCode,data.userCode]
  );
  return Number(result.insertId);
}

export async function insertHeader(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO material_outward_documents
      (tenant_id,company_id,plant_id,outward_number,outward_date,outward_type,document_status,
       customer_id,supplier_id,party_code_snapshot,party_name_snapshot,transport_mode,transport_reference,
       gate_exit_reference,remarks,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [data.tenantId,data.companyId || null,data.plantId || null,data.outwardNumber,data.outwardDate,data.outwardType,data.documentStatus || "PENDING_APPROVAL",
      data.customerId || null,data.supplierId || null,data.partyCode || null,data.partyName,data.transportMode || null,
      data.transportReference || null,data.gateExitReference || null,data.remarks || null,data.userCode,data.userCode]
  );
  return Number(result.insertId);
}

export async function insertItem(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO material_outward_document_items
      (material_outward_document_id,inventory_stock_balance_id,item_id,item_code_snapshot,item_description_snapshot,
       uom_code_snapshot,warehouse_code_snapshot,bin_location_snapshot,batch_serial_number_snapshot,outward_quantity)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [data.documentId,data.stockBalanceId,data.itemId,data.itemCode || null,data.itemDescription,data.uomCode || null,
      data.warehouseCode,data.binLocation,data.batchSerialNumber || "",data.quantity]
  );
  return Number(result.insertId);
}

export async function approve(connection, documentId, data) {
  await connection.execute(
    `UPDATE material_outward_documents
        SET document_status='APPROVED',approval_remarks=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_by=?
      WHERE material_outward_document_id=?`,
    [data.approvalRemarks || null,data.userCode,data.userCode,Number(documentId)]
  );
}

export async function decreaseCompanyStock(connection, stockBalanceId, quantity, userCode) {
  await connection.execute(
    `UPDATE inventory_stock_balance
        SET quantity_on_hand=quantity_on_hand-?,updated_by=?
      WHERE inventory_stock_balance_id=?`,
    [quantity,userCode,Number(stockBalanceId)]
  );
}

export async function insertStockTransaction(connection, data) {
  await connection.execute(
    `INSERT INTO inventory_stock_transaction
      (tenant_id,company_id,plant_id,transaction_type,transaction_date,item_id,grn_id,grn_item_id,
       warehouse_code,bin_location,batch_serial_number,quantity_in,quantity_out,balance_after_quantity,
       remarks,created_by,stock_owner_type,stock_owner_id)
     VALUES (?,?,?,?,?,?,NULL,NULL,?,?,?,?,?,?,?,?,'COMPANY',0)`,
    [data.tenantId,data.companyId || null,data.plantId || null,data.transactionType,data.transactionDate,
      data.itemId,data.warehouseCode,data.binLocation,data.batchSerialNumber || "",0,data.quantity,
      data.balanceAfter,data.remarks || null,data.userCode]
  );
}

export async function createOutsourceIssueWip(connection, data) {
  await connection.execute(
    `INSERT INTO outsourcing_issue_wip_balance
      (tenant_id,material_outward_document_id,material_outward_document_item_id,supplier_id,supplier_name_snapshot,
       item_id,item_code_snapshot,item_description_snapshot,uom_code_snapshot,source_warehouse_code,
       source_bin_location,batch_serial_number,quantity_issued,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [data.tenantId,data.documentId,data.documentItemId,data.supplierId,data.supplierName,data.itemId,
      data.itemCode || null,data.itemDescription,data.uomCode || null,data.warehouseCode,data.binLocation,
      data.batchSerialNumber || "",data.quantity,data.userCode,data.userCode]
  );
}

export async function dispatch(connection, documentId, data) {
  await connection.execute(
    `UPDATE material_outward_documents
        SET document_status='DISPATCHED',gate_exit_reference=?,dispatched_by=?,dispatched_at=COALESCE(?,CURRENT_TIMESTAMP),updated_by=?
      WHERE material_outward_document_id=?`,
    [data.gateExitReference,data.userCode,data.dispatchedAt || null,data.userCode,Number(documentId)]
  );
}
