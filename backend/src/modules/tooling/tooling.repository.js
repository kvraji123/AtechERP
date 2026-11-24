import { db } from "../../config/db.js";

const TOOL_GROUP = "TL";

const toolingItemJoin = `
  JOIN item_master I ON I.item_id=B.item_id
  JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='${TOOL_GROUP}'
  LEFT JOIN uom_master U ON U.uom_id=I.uom_id
`;

export async function listToolingLocations(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT location_master_id AS locationMasterId,
    warehouse_name AS warehouseName,location_name AS locationName
    FROM location_master
    WHERE tenant_id=? AND active_flag='Y' AND warehouse_name IN ('Tool Crib','Production Stores')
    ORDER BY warehouse_name,location_name`, [tenantId]);
  return rows;
}

export async function listMachines(connection = db) {
  const [rows] = await connection.execute(`SELECT MU.machine_unit_id AS machineUnitId,
    MU.machine_code AS machineCode,I.item_description AS machineName
    FROM machine_unit MU
    JOIN machine_master MM ON MM.machine_master_id=MU.machine_master_id
    JOIN item_master I ON I.item_id=MM.item_id
    WHERE MU.unit_status='ACTIVE' AND MM.machine_status='ACTIVE'
    ORDER BY MU.machine_code`);
  return rows;
}

export async function listIssuedReturnOptions(tenantId, itemId, connection = db) {
  const [rows] = await connection.execute(`
    SELECT issued.locationName,issued.machineReference,
      SUM(issued.quantityDelta) AS issuedQuantity
    FROM (
      SELECT to_bin_location AS locationName,machine_reference AS machineReference,
        quantity AS quantityDelta
      FROM tooling_stock_movements
      WHERE tenant_id=? AND item_id=? AND movement_type='ISSUE_TO_PRODUCTION'
        AND to_warehouse_code='Production Stores'
        AND COALESCE(machine_reference,'')<>''

      UNION ALL

      SELECT from_bin_location AS locationName,machine_reference AS machineReference,
        -quantity AS quantityDelta
      FROM tooling_stock_movements
      WHERE tenant_id=? AND item_id=?
        AND movement_type IN ('RETURN_FROM_PRODUCTION','RETURN_DAMAGED_REGRIND','RETURN_LOST','RETURN_SCRAP')
        AND from_warehouse_code='Production Stores'
        AND COALESCE(machine_reference,'')<>''
    ) issued
    WHERE COALESCE(issued.locationName,'')<>''
    GROUP BY issued.locationName,issued.machineReference
    HAVING SUM(issued.quantityDelta)>0
    ORDER BY issued.locationName,issued.machineReference
  `, [tenantId,Number(itemId),tenantId,Number(itemId)]);
  return rows;
}

export async function listIssuedTools(tenantId, { search = "" } = {}, connection = db) {
  const searchText = String(search).trim();
  const term = `%${searchText}%`;
  const [rows] = await connection.execute(`
    SELECT I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
      I.item_specification AS specification,U.uom_code AS uomCode,
      issued.locationName,issued.machineReference,
      SUM(issued.quantityDelta) AS issuedQuantity,
      MAX(issued.issueDate) AS lastIssueDate,
      GROUP_CONCAT(DISTINCT NULLIF(issued.issueEmployeeReference,'') ORDER BY issued.issueEmployeeReference SEPARATOR ', ') AS issuedToEmployees,
      GROUP_CONCAT(DISTINCT NULLIF(issued.issueOperationReference,'') ORDER BY issued.issueOperationReference SEPARATOR ', ') AS issuedForOperations,
      GROUP_CONCAT(DISTINCT NULLIF(issued.issueReferenceNumber,'') ORDER BY issued.issueReferenceNumber SEPARATOR ', ') AS issueReferences
    FROM (
      SELECT item_id,to_bin_location AS locationName,machine_reference AS machineReference,
        quantity AS quantityDelta,movement_date AS issueDate,
        employee_reference AS issueEmployeeReference,operation_reference AS issueOperationReference,
        reference_number AS issueReferenceNumber
      FROM tooling_stock_movements
      WHERE tenant_id=? AND movement_type='ISSUE_TO_PRODUCTION'
        AND to_warehouse_code='Production Stores' AND COALESCE(machine_reference,'')<>''

      UNION ALL

      SELECT item_id,from_bin_location AS locationName,machine_reference AS machineReference,
        -quantity AS quantityDelta,NULL AS issueDate,NULL AS issueEmployeeReference,
        NULL AS issueOperationReference,NULL AS issueReferenceNumber
      FROM tooling_stock_movements
      WHERE tenant_id=? AND movement_type IN ('RETURN_FROM_PRODUCTION','RETURN_DAMAGED_REGRIND','RETURN_LOST','RETURN_SCRAP')
        AND from_warehouse_code='Production Stores' AND COALESCE(machine_reference,'')<>''
    ) issued
    JOIN item_master I ON I.item_id=issued.item_id
    JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='${TOOL_GROUP}'
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    WHERE COALESCE(issued.locationName,'')<>''
      AND (?='' OR I.item_code LIKE ? OR I.item_description LIKE ? OR issued.locationName LIKE ? OR issued.machineReference LIKE ?)
    GROUP BY I.item_id,I.item_code,I.item_description,I.item_specification,U.uom_code,issued.locationName,issued.machineReference
    HAVING SUM(issued.quantityDelta)>0
    ORDER BY I.item_code,issued.locationName,issued.machineReference
  `, [tenantId,tenantId,searchText,term,term,term,term]);
  return rows;
}

export async function listOperations(connection = db) {
  const [rows] = await connection.execute(`SELECT operation_master_id AS operationMasterId,
    operation_code AS operationCode,operation_name AS operationName
    FROM operation_master WHERE active_flag='Y' ORDER BY operation_name`);
  return rows;
}

export async function listActiveSuppliers(connection = db) {
  const [rows] = await connection.execute(`SELECT supplier_id AS supplierId,supplier_code AS supplierCode,supplier_name AS supplierName
    FROM supplier_master
    WHERE active_flag='Y'
      AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'
      AND supplier_category='TOOLING'
    ORDER BY supplier_name,supplier_code`);
  return rows;
}

export async function getActiveSupplier(connection, supplierId) {
  const [rows] = await connection.execute(`SELECT supplier_id AS supplierId,supplier_code AS supplierCode,supplier_name AS supplierName
    FROM supplier_master
    WHERE supplier_id=?
      AND active_flag='Y'
      AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'
      AND supplier_category='TOOLING'`, [Number(supplierId)]);
  return rows[0] || null;
}

export async function listToolItems(tenantId, { search = "", stockOnly = false } = {}, connection = db) {
  const term = `%${String(search).trim()}%`;
  const [rows] = await connection.execute(`
    SELECT I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
      I.item_specification AS specification,U.uom_code AS uomCode,
      COALESCE(SUM(CASE WHEN B.warehouse_code='Tool Crib' AND B.stock_status='AVAILABLE' THEN B.quantity_on_hand ELSE 0 END),0) AS toolCribQuantity,
      COALESCE(SUM(CASE WHEN B.warehouse_code='Production Stores' AND B.stock_status='AVAILABLE' THEN B.quantity_on_hand ELSE 0 END),0) AS issuedQuantity,
      COALESCE(SUM(CASE WHEN B.stock_status='HOLD' THEN B.quantity_on_hand ELSE 0 END),0) AS holdQuantity,
      COALESCE(SUM(CASE WHEN B.stock_status='REGRIND_REQUIRED' THEN B.quantity_on_hand ELSE 0 END),0) AS regrindRequiredQuantity,
      COALESCE(M.regrind_event_count,0) AS regrindEventCount,
      COALESCE(M.regrind_quantity_total,0) AS regrindQuantityTotal,
      M.last_regrind_date AS lastRegrindDate,
      EXISTS(SELECT 1 FROM item_incoming_inspection_characteristic IC WHERE IC.item_id=I.item_id) AS inspectionPlanDefined
    FROM item_master I
    JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='${TOOL_GROUP}'
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    LEFT JOIN tooling_stock_balance B ON B.tenant_id=? AND B.item_id=I.item_id
    LEFT JOIN tooling_item_metrics M ON M.tenant_id=? AND M.item_id=I.item_id
    WHERE I.active_flag='Y'
      AND (?='' OR I.item_code LIKE ? OR I.item_description LIKE ? OR COALESCE(I.item_specification,'') LIKE ?)
      ${stockOnly ? "AND EXISTS (SELECT 1 FROM inventory_stock_balance IB WHERE IB.tenant_id=? AND IB.item_id=I.item_id AND IB.quantity_on_hand>0 AND IB.stock_owner_type='COMPANY' AND IB.stock_owner_id=0)" : ""}
    GROUP BY I.item_id,I.item_code,I.item_description,I.item_specification,U.uom_code,
      M.regrind_event_count,M.regrind_quantity_total,M.last_regrind_date
    ${stockOnly ? "HAVING toolCribQuantity>0 OR issuedQuantity>0 OR holdQuantity>0 OR regrindRequiredQuantity>0" : ""}
    ORDER BY I.item_code`, [tenantId, tenantId, String(search).trim(), term, term, term, ...(stockOnly ? [tenantId] : [])]);
  return rows;
}

export async function getToolItem(connection, tenantId, itemId) {
  const [rows] = await connection.execute(`SELECT I.item_id AS itemId,I.item_code AS itemCode,
    I.item_description AS itemDescription,I.item_specification AS specification,U.uom_code AS uomCode
    FROM item_master I JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='${TOOL_GROUP}'
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    WHERE I.item_id=? AND I.active_flag='Y'`, [Number(itemId)]);
  return rows[0] || null;
}

export async function listItemInspectionPlan(connection, itemId) {
  const [rows] = await connection.execute(`SELECT IC.item_inspection_characteristic_id AS itemInspectionCharacteristicId,
    IC.sequence_number AS sequenceNumber,
    COALESCE(NULLIF(IC.characteristic_text,''),CM.characteristic_name,'Inspection characteristic') AS characteristicName,
    IC.specified_dimension AS specifiedDimension,IC.lsl,IC.usl,IM.instrument_name AS instrumentName
    FROM item_incoming_inspection_characteristic IC
    LEFT JOIN inspection_characteristic_master CM ON CM.characteristic_master_id=IC.characteristic_master_id
    LEFT JOIN inspection_instrument_master IM ON IM.instrument_master_id=IC.instrument_master_id
    WHERE IC.item_id=? ORDER BY IC.sequence_number`, [Number(itemId)]);
  return rows;
}

export async function getToolBalanceForUpdate(connection, { tenantId, plantId = "", itemId, warehouseCode, binLocation, stockStatus = "AVAILABLE" }) {
  const [rows] = await connection.execute(`SELECT tooling_stock_balance_id AS toolingStockBalanceId,
    quantity_on_hand AS quantityOnHand FROM tooling_stock_balance
    WHERE tenant_id=? AND plant_id=? AND item_id=? AND warehouse_code=? AND bin_location=? AND stock_status=? FOR UPDATE`,
  [tenantId, plantId || "", Number(itemId), warehouseCode, binLocation, stockStatus]);
  return rows[0] || null;
}

export async function increaseToolBalance(connection, data) {
  await connection.execute(`INSERT INTO tooling_stock_balance
    (tenant_id,company_id,plant_id,item_id,warehouse_code,bin_location,stock_status,quantity_on_hand,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE quantity_on_hand=quantity_on_hand+VALUES(quantity_on_hand),updated_by=VALUES(updated_by)`,
  [data.tenantId,data.companyId || null,data.plantId || "",Number(data.itemId),data.warehouseCode,data.binLocation,
    data.stockStatus || "AVAILABLE",Number(data.quantity),data.userCode,data.userCode]);
  return getToolBalanceForUpdate(connection, data);
}

export async function decreaseToolBalance(connection, data) {
  const balance = await getToolBalanceForUpdate(connection, data);
  if (!balance || Number(balance.quantityOnHand) + 0.0001 < Number(data.quantity)) return null;
  await connection.execute(`UPDATE tooling_stock_balance SET quantity_on_hand=quantity_on_hand-?,updated_by=?
    WHERE tooling_stock_balance_id=?`, [Number(data.quantity),data.userCode,Number(balance.toolingStockBalanceId)]);
  return { ...balance, quantityOnHand: Number(balance.quantityOnHand) - Number(data.quantity) };
}

async function getInventoryBalanceForUpdate(connection, data) {
  const [rows] = await connection.execute(`SELECT inventory_stock_balance_id AS inventoryStockBalanceId,
    quantity_on_hand AS quantityOnHand
    FROM inventory_stock_balance
    WHERE tenant_id=? AND plant_id=? AND item_id=? AND warehouse_code=? AND bin_location=?
      AND batch_serial_number='' AND stock_owner_type='COMPANY' AND stock_owner_id=0 FOR UPDATE`,
  [data.tenantId,data.plantId || "",Number(data.itemId),data.warehouseCode,data.binLocation]);
  return rows[0] || null;
}

export async function decreaseInventoryBalance(connection, data) {
  const balance = await getInventoryBalanceForUpdate(connection, data);
  if (!balance || Number(balance.quantityOnHand) + 0.0001 < Number(data.quantity)) return null;
  await connection.execute(`UPDATE inventory_stock_balance SET quantity_on_hand=quantity_on_hand-?,updated_by=?
    WHERE inventory_stock_balance_id=?`, [Number(data.quantity),data.userCode,Number(balance.inventoryStockBalanceId)]);
  return {
    inventoryStockBalanceId: Number(balance.inventoryStockBalanceId),
    balanceAfter: Number(balance.quantityOnHand) - Number(data.quantity),
  };
}

export async function increaseInventoryBalance(connection, data) {
  await connection.execute(`INSERT INTO inventory_stock_balance
    (tenant_id,company_id,plant_id,item_id,warehouse_code,bin_location,batch_serial_number,quantity_on_hand,created_by,updated_by,stock_owner_type,stock_owner_id)
    VALUES (?,?,?,?,?,?, '',?,?,?,'COMPANY',0)
    ON DUPLICATE KEY UPDATE quantity_on_hand=quantity_on_hand+VALUES(quantity_on_hand),updated_by=VALUES(updated_by)`,
  [data.tenantId,data.companyId || null,data.plantId || "",Number(data.itemId),data.warehouseCode,data.binLocation,Number(data.quantity),data.userCode,data.userCode]);
  const balance = await getInventoryBalanceForUpdate(connection, data);
  return Number(balance?.quantityOnHand || 0);
}

export async function insertInventoryTransaction(connection, data) {
  await connection.execute(`INSERT INTO inventory_stock_transaction
    (tenant_id,company_id,plant_id,transaction_type,transaction_date,item_id,grn_id,grn_item_id,
     warehouse_code,bin_location,batch_serial_number,quantity_in,quantity_out,balance_after_quantity,
     remarks,created_by,stock_owner_type,stock_owner_id)
    VALUES (?,?,?,?,?,?,NULL,NULL,?,?, '',?,?,?,?,?,'COMPANY',0)`,
  [data.tenantId,data.companyId || null,data.plantId || "",data.transactionType,data.movementDate,Number(data.itemId),
    data.warehouseCode,data.binLocation,Number(data.quantityIn || 0),Number(data.quantityOut || 0),
    Number(data.balanceAfter),data.remarks || null,data.userCode]);
}

export async function insertMovement(connection, data) {
  const [result] = await connection.execute(`INSERT INTO tooling_stock_movements
    (tenant_id,company_id,plant_id,item_id,movement_type,movement_date,quantity,from_warehouse_code,from_bin_location,
     to_warehouse_code,to_bin_location,reference_number,grn_id,grn_item_id,tooling_regrind_batch_id,
     tooling_regrind_batch_item_id,machine_reference,employee_reference,operation_reference,remarks,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [data.tenantId,data.companyId || null,data.plantId || "",Number(data.itemId),data.movementType,data.movementDate,
    Number(data.quantity),data.fromWarehouseCode || null,data.fromBinLocation || null,data.toWarehouseCode || null,
    data.toBinLocation || null,data.referenceNumber || null,data.grnId || null,data.grnItemId || null,
    data.toolingRegrindBatchId || null,data.toolingRegrindBatchItemId || null,data.machineReference || null,
    data.employeeReference || null,data.operationReference || null,data.remarks || null,data.userCode]);
  return Number(result.insertId);
}

export async function hasGrnReceiptMovement(connection, tenantId, grnItemId) {
  const [rows] = await connection.execute(`SELECT tooling_stock_movement_id FROM tooling_stock_movements
    WHERE tenant_id=? AND grn_item_id=? AND movement_type='GRN_RECEIPT' LIMIT 1`, [tenantId,Number(grnItemId)]);
  return Boolean(rows[0]);
}

export async function insertRegrindBatch(connection, data) {
  const [result] = await connection.execute(`INSERT INTO tooling_regrind_batches
    (tenant_id,company_id,plant_id,dc_number,dispatch_date,supplier_name,expected_return_date,courier_vehicle_reference,
     dispatch_warehouse_code,dispatch_bin_location,material_outward_document_id,status,remarks,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'DISPATCHED',?,?,?)`,
  [data.tenantId,data.companyId || null,data.plantId || "",data.dcNumber,data.dispatchDate,data.supplierName,
    data.expectedReturnDate || null,data.courierVehicleReference || null,data.dispatchWarehouseCode,data.dispatchBinLocation,
    data.materialOutwardDocumentId || null,data.remarks || null,data.userCode,data.userCode]);
  return Number(result.insertId);
}

export async function insertRegrindBatchItem(connection, data) {
  const [result] = await connection.execute(`INSERT INTO tooling_regrind_batch_items
    (tenant_id,tooling_regrind_batch_id,item_id,uom_code_snapshot,dispatched_quantity,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?)`, [data.tenantId,Number(data.batchId),Number(data.itemId),data.uomCode || null,
      Number(data.quantity),data.userCode,data.userCode]);
  return Number(result.insertId);
}

export async function findRegrindBatch(connection = db, tenantId, batchId, lock = false) {
  const [headers] = await connection.execute(`SELECT tooling_regrind_batch_id AS toolingRegrindBatchId,
    dc_number AS dcNumber,dispatch_date AS dispatchDate,supplier_name AS supplierName,
    expected_return_date AS expectedReturnDate,courier_vehicle_reference AS courierVehicleReference,
    dispatch_warehouse_code AS dispatchWarehouseCode,dispatch_bin_location AS dispatchBinLocation,
    material_outward_document_id AS materialOutwardDocumentId,return_grn_number AS returnGrnNumber,
    return_gate_entry_id AS returnGateEntryId,receipt_reference AS receiptReference,receipt_date AS receiptDate,status,remarks
    FROM tooling_regrind_batches WHERE tenant_id=? AND tooling_regrind_batch_id=? ${lock ? "FOR UPDATE" : ""}`,
  [tenantId,Number(batchId)]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT BI.tooling_regrind_batch_item_id AS toolingRegrindBatchItemId,
    BI.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,I.item_specification AS specification,
    BI.uom_code_snapshot AS uomCode,BI.dispatched_quantity AS dispatchedQuantity,BI.received_quantity AS receivedQuantity,
    BI.accepted_quantity AS acceptedQuantity,BI.rejected_quantity AS rejectedQuantity,BI.measured_value AS measuredValue,
    BI.inspection_remarks AS inspectionRemarks,BI.rejection_action AS rejectionAction,BI.line_status AS lineStatus
    FROM tooling_regrind_batch_items BI JOIN item_master I ON I.item_id=BI.item_id
    WHERE BI.tenant_id=? AND BI.tooling_regrind_batch_id=? ORDER BY BI.tooling_regrind_batch_item_id`,
  [tenantId,Number(batchId)]);
  const details = await Promise.all(items.map(async (item) => {
    const [rows] = await connection.execute(`SELECT tooling_regrind_inspection_measurement_id AS toolingRegrindInspectionMeasurementId,
      item_inspection_characteristic_id AS itemInspectionCharacteristicId,sequence_number AS sequenceNumber,
      characteristic_name_snapshot AS characteristicName,specified_dimension AS specifiedDimension,lsl,usl,
      actual_value AS actualValue,inspection_result AS inspectionResult,remarks
      FROM tooling_regrind_inspection_measurements WHERE tooling_regrind_batch_item_id=? ORDER BY sequence_number`,
    [Number(item.toolingRegrindBatchItemId)]);
    const inspectionPlan = await listItemInspectionPlan(connection, item.itemId);
    return [Number(item.toolingRegrindBatchItemId), { measurements: rows, inspectionPlan }];
  }));
  const detailsMap = new Map(details);
  return { ...headers[0], items: items.map((item) => ({ ...item, ...(detailsMap.get(Number(item.toolingRegrindBatchItemId)) || { measurements: [], inspectionPlan: [] }) })) };
}

export async function listRegrindBatches(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT B.tooling_regrind_batch_id AS toolingRegrindBatchId,
    B.dc_number AS dcNumber,B.dispatch_date AS dispatchDate,B.supplier_name AS supplierName,
    B.expected_return_date AS expectedReturnDate,B.material_outward_document_id AS materialOutwardDocumentId,
    B.return_grn_number AS returnGrnNumber,B.receipt_date AS receiptDate,B.status,
    COUNT(I.tooling_regrind_batch_item_id) AS itemCount,
    COALESCE(SUM(I.dispatched_quantity),0) AS dispatchedQuantity,
    COALESCE(SUM(I.received_quantity),0) AS receivedQuantity
    FROM tooling_regrind_batches B
    LEFT JOIN tooling_regrind_batch_items I ON I.tooling_regrind_batch_id=B.tooling_regrind_batch_id AND I.tenant_id=B.tenant_id
    WHERE B.tenant_id=? GROUP BY B.tooling_regrind_batch_id
    ORDER BY CASE B.status WHEN 'RECEIVED_PENDING_INSPECTION' THEN 0 WHEN 'DISPATCHED' THEN 1 ELSE 2 END,
      B.dispatch_date DESC,B.tooling_regrind_batch_id DESC`, [tenantId]);
  return rows;
}

export async function updateRegrindReceipt(connection, data) {
  await connection.execute(`UPDATE tooling_regrind_batches
    SET return_grn_number=?,return_gate_entry_id=?,receipt_reference=?,receipt_date=?,status='RECEIVED_PENDING_INSPECTION',updated_by=?
    WHERE tenant_id=? AND tooling_regrind_batch_id=?`,
  [data.returnGrnNumber || null,data.gateEntryId || null,data.receiptReference || null,data.receiptDate,data.userCode,data.tenantId,Number(data.batchId)]);
  for (const item of data.items) await connection.execute(`UPDATE tooling_regrind_batch_items
    SET received_quantity=?,line_status='RECEIVED_PENDING_INSPECTION',updated_by=?
    WHERE tenant_id=? AND tooling_regrind_batch_item_id=?`,
  [Number(item.receivedQuantity),data.userCode,data.tenantId,Number(item.batchItemId)]);
}

export async function replaceInspectionMeasurements(connection, data) {
  await connection.execute(`DELETE FROM tooling_regrind_inspection_measurements WHERE tooling_regrind_batch_item_id=?`, [Number(data.batchItemId)]);
  for (const measurement of data.measurements) await connection.execute(`INSERT INTO tooling_regrind_inspection_measurements
    (tenant_id,tooling_regrind_batch_item_id,item_inspection_characteristic_id,sequence_number,characteristic_name_snapshot,
     specified_dimension,lsl,usl,actual_value,inspection_result,remarks,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  [data.tenantId,Number(data.batchItemId),measurement.itemInspectionCharacteristicId || null,measurement.sequenceNumber,
    measurement.characteristicName,measurement.specifiedDimension,measurement.lsl,measurement.usl,measurement.actualValue,
    measurement.inspectionResult,measurement.remarks || null,data.userCode]);
}

export async function updateRegrindInspectionItem(connection, data) {
  await connection.execute(`UPDATE tooling_regrind_batch_items SET accepted_quantity=?,rejected_quantity=?,measured_value=?,
    inspection_remarks=?,rejection_action=?,line_status='CLOSED',updated_by=?
    WHERE tenant_id=? AND tooling_regrind_batch_item_id=?`,
  [Number(data.acceptedQuantity),Number(data.rejectedQuantity),data.measuredValue || null,data.inspectionRemarks || null,
    data.rejectionAction || null,data.userCode,data.tenantId,Number(data.batchItemId)]);
}

export async function closeRegrindBatch(connection, tenantId, batchId, userCode) {
  await connection.execute(`UPDATE tooling_regrind_batches SET status='CLOSED',updated_by=?
    WHERE tenant_id=? AND tooling_regrind_batch_id=?`, [userCode,tenantId,Number(batchId)]);
}

export async function incrementRegrindMetric(connection, data) {
  await connection.execute(`INSERT INTO tooling_item_metrics
    (tenant_id,item_id,regrind_event_count,regrind_quantity_total,last_regrind_date,created_by,updated_by)
    VALUES (?,?,1,?,?,?,?)
    ON DUPLICATE KEY UPDATE regrind_event_count=regrind_event_count+1,
      regrind_quantity_total=regrind_quantity_total+VALUES(regrind_quantity_total),
      last_regrind_date=VALUES(last_regrind_date),updated_by=VALUES(updated_by)`,
  [data.tenantId,Number(data.itemId),Number(data.quantity),data.regrindDate,data.userCode,data.userCode]);
}

export async function listMovements(tenantId, { search = "", limit = 100 } = {}, connection = db) {
  const term = `%${String(search).trim()}%`;
  const [rows] = await connection.execute(`SELECT M.tooling_stock_movement_id AS toolingStockMovementId,
    M.movement_type AS movementType,M.movement_date AS movementDate,M.quantity,
    M.from_warehouse_code AS fromWarehouseCode,M.from_bin_location AS fromBinLocation,
    M.to_warehouse_code AS toWarehouseCode,M.to_bin_location AS toBinLocation,M.reference_number AS referenceNumber,
    M.machine_reference AS machineReference,M.employee_reference AS employeeReference,M.operation_reference AS operationReference,
    M.remarks,I.item_code AS itemCode,I.item_description AS itemDescription,U.uom_code AS uomCode
    FROM tooling_stock_movements M JOIN item_master I ON I.item_id=M.item_id
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    WHERE M.tenant_id=? AND (?='' OR I.item_code LIKE ? OR I.item_description LIKE ? OR COALESCE(M.reference_number,'') LIKE ?)
    ORDER BY M.movement_date DESC,M.tooling_stock_movement_id DESC LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 500)}`,
  [tenantId,String(search).trim(),term,term,term]);
  return rows;
}

export async function dashboard(tenantId, connection = db) {
  const [[stock], [batches]] = await Promise.all([
    connection.execute(`SELECT
      COALESCE(SUM(CASE WHEN warehouse_code='Tool Crib' AND stock_status='AVAILABLE' THEN quantity_on_hand ELSE 0 END),0) AS toolCribQuantity,
      COALESCE(SUM(CASE WHEN warehouse_code='Production Stores' AND stock_status='AVAILABLE' THEN quantity_on_hand ELSE 0 END),0) AS issuedQuantity,
      COALESCE(SUM(CASE WHEN stock_status='HOLD' THEN quantity_on_hand ELSE 0 END),0) AS holdQuantity,
      COALESCE(SUM(CASE WHEN stock_status='REGRIND_REQUIRED' THEN quantity_on_hand ELSE 0 END),0) AS regrindRequiredQuantity
      FROM tooling_stock_balance WHERE tenant_id=?`, [tenantId]),
    connection.execute(`SELECT
      COALESCE(SUM(status='DISPATCHED'),0) AS dispatchedBatchCount,
      COALESCE(SUM(status='RECEIVED_PENDING_INSPECTION'),0) AS awaitingInspectionBatchCount
      FROM tooling_regrind_batches WHERE tenant_id=?`, [tenantId]),
  ]);
  return { ...(stock[0] || {}), ...(batches[0] || {}) };
}
