import { db } from "../../config/db.js";

const asNumber = (value) => Number(value || 0);

export async function listLookups(tenantId) {
  const [locations, subinventories, statuses, items] = await Promise.all([
    db.execute(`SELECT location_master_id AS locationMasterId,warehouse_name AS warehouseCode,
      sub_inventory_code AS subinventoryCode,location_name AS binLocation FROM location_master
      WHERE tenant_id=? AND active_flag='Y' ORDER BY warehouse_name,location_name`, [tenantId]),
    db.execute(`SELECT subinventory_code AS subinventoryCode,subinventory_name AS subinventoryName,
      inventory_purpose AS inventoryPurpose FROM inventory_subinventory_master
      WHERE tenant_id=? AND active_flag='Y' ORDER BY subinventory_name`, [tenantId]),
    db.execute(`SELECT stock_status_code AS stockStatus,stock_status_name AS stockStatusName,
      available_for_issue_flag AS availableForIssue FROM inventory_stock_status_master
      WHERE tenant_id=? AND active_flag='Y' ORDER BY stock_status_name`, [tenantId]),
    db.execute(`SELECT I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,U.uom_code AS uomCode
      FROM item_master I LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE I.active_flag='Y' ORDER BY I.item_code LIMIT 1000`),
  ]);
  return { locations: locations[0], subinventories: subinventories[0], statuses: statuses[0], items: items[0] };
}

export async function listBalances({ tenantId, search = "", ownerType = "", workOrderReference = "", limit = 200 }) {
  const clauses = ["B.tenant_id=?", "B.quantity_on_hand<>0"];
  const params = [tenantId];
  if (search) {
    const term = `%${search}%`;
    clauses.push("(I.item_code LIKE ? OR I.item_description LIKE ? OR B.warehouse_code LIKE ? OR B.sub_inventory_code LIKE ? OR B.bin_location LIKE ? OR B.work_order_reference LIKE ? OR B.batch_serial_number LIKE ?)");
    params.push(term, term, term, term, term, term, term);
  }
  if (ownerType) { clauses.push("B.stock_owner_type=?"); params.push(ownerType); }
  if (workOrderReference) { clauses.push("B.work_order_reference=?"); params.push(workOrderReference); }
  const [rows] = await db.execute(`SELECT B.inventory_stock_balance_id AS id,B.item_id AS itemId,
      I.item_code AS itemCode,I.item_description AS itemDescription,U.uom_code AS uomCode,
      B.warehouse_code AS warehouseCode,B.sub_inventory_code AS subinventoryCode,B.bin_location AS binLocation,
      B.stock_status AS stockStatus,B.batch_serial_number AS batchSerialNumber,B.work_order_reference AS workOrderReference,
      B.stock_owner_type AS stockOwnerType,B.stock_owner_id AS stockOwnerId,B.quantity_on_hand AS quantityOnHand,
      B.quantity_reserved AS quantityReserved,GREATEST(B.quantity_on_hand-B.quantity_reserved,0) AS quantityAvailable,
      C.customer_name AS customerName,B.updated_at AS lastUpdatedAt
    FROM inventory_stock_balance B
    JOIN item_master I ON I.item_id=B.item_id
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    LEFT JOIN customer_master C ON C.customer_id=B.stock_owner_id AND B.stock_owner_type='CUSTOMER'
    WHERE ${clauses.join(" AND ")}
    ORDER BY B.updated_at DESC,B.inventory_stock_balance_id DESC LIMIT ${Math.min(Math.max(Number(limit) || 200, 1), 500)}`, params);
  return rows;
}

export async function getBalanceForUpdate(connection, tenantId, balanceId) {
  const [rows] = await connection.execute(`SELECT B.*,I.item_code,I.item_description,U.uom_code
    FROM inventory_stock_balance B
    JOIN item_master I ON I.item_id=B.item_id
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    WHERE B.tenant_id=? AND B.inventory_stock_balance_id=? FOR UPDATE`, [tenantId, Number(balanceId)]);
  return rows[0] || null;
}

export async function getActiveItem(connection, itemId) {
  const [rows] = await connection.execute(`SELECT I.item_id,I.item_code,I.item_description,U.uom_code
    FROM item_master I LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    WHERE I.item_id=? AND I.active_flag='Y'`, [Number(itemId)]);
  return rows[0] || null;
}

export async function assertLocation(connection, tenantId, warehouseCode, subinventoryCode, binLocation) {
  const [rows] = await connection.execute(`SELECT location_master_id FROM location_master
    WHERE tenant_id=? AND warehouse_name=? AND sub_inventory_code=? AND location_name=? AND active_flag='Y'`, [tenantId, warehouseCode, subinventoryCode, binLocation]);
  return Boolean(rows[0]);
}

export async function assertSubinventory(connection, tenantId, subinventoryCode) {
  const [rows] = await connection.execute(`SELECT inventory_subinventory_master_id FROM inventory_subinventory_master
    WHERE tenant_id=? AND subinventory_code=? AND active_flag='Y'`, [tenantId, subinventoryCode]);
  return Boolean(rows[0]);
}

export async function getStockStatus(connection, tenantId, stockStatus) {
  const [rows] = await connection.execute(`SELECT stock_status_code AS stockStatus,available_for_issue_flag AS availableForIssue
    FROM inventory_stock_status_master
    WHERE tenant_id=? AND stock_status_code=? AND active_flag='Y'`, [tenantId, stockStatus]);
  return rows[0] || null;
}

export async function insertMovementDocument(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inventory_movement_documents
    (tenant_id,company_id,plant_id,movement_number,movement_type,movement_date,work_order_reference,
     source_reference_type,source_reference_number,remarks,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
    data.tenantId,data.companyId || null,data.plantId || null,data.movementNumber,data.movementType,
    data.movementDate,data.workOrderReference || null,data.sourceReferenceType || null,
    data.sourceReferenceNumber || null,data.remarks || null,data.userCode,
  ]);
  return Number(result.insertId);
}

export async function insertMovementLine(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inventory_movement_lines
    (inventory_movement_document_id,line_number,item_id,stock_owner_type,stock_owner_id,batch_serial_number,
     work_order_reference,quantity,from_inventory_stock_balance_id,from_warehouse_code,from_sub_inventory_code,
     from_bin_location,from_stock_status,to_inventory_stock_balance_id,to_warehouse_code,to_sub_inventory_code,
     to_bin_location,to_stock_status,remarks)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    data.documentId,data.lineNumber,data.itemId,data.ownerType,data.ownerId,data.batchSerialNumber || "",
    data.workOrderReference || "",data.quantity,data.fromBalanceId || null,data.fromWarehouseCode || null,
    data.fromSubinventoryCode || null,data.fromBinLocation || null,data.fromStockStatus || null,
    data.toBalanceId || null,data.toWarehouseCode || null,data.toSubinventoryCode || null,
    data.toBinLocation || null,data.toStockStatus || null,data.remarks || null,
  ]);
  return Number(result.insertId);
}

export async function decreaseBalance(connection, balanceId, quantity, userCode) {
  const [result] = await connection.execute(`UPDATE inventory_stock_balance
    SET quantity_on_hand=quantity_on_hand-?,updated_by=?
    WHERE inventory_stock_balance_id=? AND quantity_on_hand-quantity_reserved>=?`,
  [quantity,userCode,Number(balanceId),quantity]);
  return result.affectedRows === 1;
}

export async function increaseBalance(connection, data) {
  await connection.execute(`INSERT INTO inventory_stock_balance
    (tenant_id,company_id,plant_id,item_id,warehouse_code,sub_inventory_code,bin_location,stock_status,
     batch_serial_number,work_order_reference,quantity_on_hand,quantity_reserved,created_by,updated_by,
     stock_owner_type,stock_owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE quantity_on_hand=quantity_on_hand+VALUES(quantity_on_hand),updated_by=VALUES(updated_by),
      inventory_stock_balance_id=LAST_INSERT_ID(inventory_stock_balance_id)`, [
    data.tenantId,data.companyId || null,data.plantId || "",data.itemId,data.warehouseCode,data.subinventoryCode,
    data.binLocation,data.stockStatus,data.batchSerialNumber || "",data.workOrderReference || "",data.quantity,0,
    data.userCode,data.userCode,data.ownerType,data.ownerId || 0,
  ]);
  const [rows] = await connection.execute(`SELECT inventory_stock_balance_id AS id,quantity_on_hand AS quantityOnHand
    FROM inventory_stock_balance WHERE tenant_id=? AND plant_id <=> ? AND item_id=? AND warehouse_code=?
      AND sub_inventory_code=? AND bin_location=? AND stock_status=? AND batch_serial_number=?
      AND work_order_reference=? AND stock_owner_type=? AND stock_owner_id=? FOR UPDATE`, [
    data.tenantId,data.plantId || "",data.itemId,data.warehouseCode,data.subinventoryCode,data.binLocation,
    data.stockStatus,data.batchSerialNumber || "",data.workOrderReference || "",data.ownerType,data.ownerId || 0,
  ]);
  return { id: Number(rows[0]?.id), quantityOnHand: asNumber(rows[0]?.quantityOnHand) };
}

export async function insertLedgerTransaction(connection, data) {
  await connection.execute(`INSERT INTO inventory_stock_transaction
    (tenant_id,company_id,plant_id,transaction_type,transaction_date,item_id,grn_id,grn_item_id,
     inventory_movement_document_id,warehouse_code,sub_inventory_code,bin_location,stock_status,batch_serial_number,
     work_order_reference,quantity_in,quantity_out,balance_after_quantity,remarks,created_by,stock_owner_type,stock_owner_id)
    VALUES (?,?,?,?,?, ?,NULL,NULL, ?,?,?,?,?, ?,?,?,?,?,?,?,?,?)`, [
    data.tenantId,data.companyId || null,data.plantId || null,data.transactionType,data.transactionDate,data.itemId,
    data.documentId,data.warehouseCode,data.subinventoryCode,data.binLocation,data.stockStatus,
    data.batchSerialNumber || "",data.workOrderReference || "",data.quantityIn || 0,data.quantityOut || 0,
    data.balanceAfter,data.remarks || null,data.userCode,data.ownerType,data.ownerId || 0,
  ]);
}

export async function insertRejectionCase(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inventory_rejection_cases
    (tenant_id,company_id,plant_id,rejection_number,source_type,rejection_type,work_order_reference,
     operation_reference,machine_reference,process_card_reference,rejection_report_reference,reported_date,remarks,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    data.tenantId,data.companyId || null,data.plantId || null,data.rejectionNumber,data.sourceType,data.rejectionType,
    data.workOrderReference || null,data.operationReference || null,data.machineReference || null,
    data.processCardReference || null,data.rejectionReportReference || null,data.reportedDate,data.remarks,data.userCode,
  ]);
  return Number(result.insertId);
}

export async function insertRejectionCaseLine(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inventory_rejection_case_lines
    (inventory_rejection_case_id,item_id,item_code_snapshot,item_description_snapshot,uom_code_snapshot,
     stock_owner_type,stock_owner_id,batch_serial_number,reported_quantity,quantity_open,
     quarantine_inventory_stock_balance_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
    data.caseId,data.itemId,data.itemCode || null,data.itemDescription,data.uomCode || null,data.ownerType,
    data.ownerId || 0,data.batchSerialNumber || "",data.quantity,data.quantity,data.quarantineBalanceId,
  ]);
  return Number(result.insertId);
}

export async function getRejectionLineForUpdate(connection, tenantId, caseId, lineId) {
  const [rows] = await connection.execute(`SELECT C.*,L.inventory_rejection_case_line_id AS line_id,L.item_id,
      L.item_code_snapshot,L.item_description_snapshot,L.uom_code_snapshot,L.stock_owner_type,L.stock_owner_id,
      L.batch_serial_number,L.quantity_open,L.quarantine_inventory_stock_balance_id
    FROM inventory_rejection_cases C
    JOIN inventory_rejection_case_lines L ON L.inventory_rejection_case_id=C.inventory_rejection_case_id
    WHERE C.tenant_id=? AND C.inventory_rejection_case_id=? AND L.inventory_rejection_case_line_id=? FOR UPDATE`,
  [tenantId,Number(caseId),Number(lineId)]);
  return rows[0] || null;
}

export async function updateRejectionLine(connection, lineId, data) {
  await connection.execute(`UPDATE inventory_rejection_case_lines SET quantity_open=?,final_disposition=?,
    disposition_reference=?,disposition_remarks=?,resolved_by=?,resolved_at=CURRENT_TIMESTAMP
    WHERE inventory_rejection_case_line_id=?`, [data.quantityOpen,data.disposition,data.reference || null,
      data.remarks || null,data.userCode,Number(lineId)]);
}

export async function updateRejectionCaseStatus(connection, caseId, caseStatus, userCode) {
  await connection.execute(`UPDATE inventory_rejection_cases SET case_status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP
    WHERE inventory_rejection_case_id=?`, [caseStatus,userCode,Number(caseId)]);
}

export async function listRejections({ tenantId, status = "", limit = 200 }) {
  const clauses = ["C.tenant_id=?"];
  const params = [tenantId];
  if (status) { clauses.push("C.case_status=?"); params.push(status); }
  const [rows] = await db.execute(`SELECT C.inventory_rejection_case_id AS caseId,C.rejection_number AS rejectionNumber,
      C.source_type AS sourceType,C.rejection_type AS rejectionType,C.case_status AS caseStatus,
      C.work_order_reference AS workOrderReference,C.operation_reference AS operationReference,
      C.machine_reference AS machineReference,C.process_card_reference AS processCardReference,
      C.rejection_report_reference AS rejectionReportReference,C.reported_date AS reportedDate,C.remarks,
      L.inventory_rejection_case_line_id AS lineId,L.item_id AS itemId,L.item_code_snapshot AS itemCode,
      L.item_description_snapshot AS itemDescription,L.uom_code_snapshot AS uomCode,L.batch_serial_number AS batchSerialNumber,
      L.reported_quantity AS reportedQuantity,L.quantity_open AS quantityOpen,L.final_disposition AS finalDisposition,
      L.quarantine_inventory_stock_balance_id AS quarantineBalanceId,L.stock_owner_type AS stockOwnerType,
      L.stock_owner_id AS stockOwnerId,C.created_at AS createdAt
    FROM inventory_rejection_cases C
    JOIN inventory_rejection_case_lines L ON L.inventory_rejection_case_id=C.inventory_rejection_case_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY C.reported_date DESC,C.inventory_rejection_case_id DESC,L.inventory_rejection_case_line_id DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 200, 1), 500)}`, params);
  return rows;
}
