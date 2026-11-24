import { db } from "../../config/db.js";

export async function list({ tenantId, status = "", search = "", supplier = "", dateRange = "", limit = 100, offset = 0 }) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const pendingGrnClause = normalizedStatus === "PENDING_GRN"
    ? " AND G.status='GATE_ENTERED' AND (COALESCE(G.entry_type,'REGULAR_PURCHASE')<>'OTHER_SERVICES' OR COALESCE(G.service_type,'') IN ('CALIBRATION_RETURN','TOOL_RETURN'))"
    : " AND (?='' OR G.status=?)";
  const statusParams = normalizedStatus === "PENDING_GRN" ? [] : [normalizedStatus, normalizedStatus];
  const params = [tenantId, search, search, search, search, search, search, search, ...statusParams, supplier, supplier];
  const normalizedDateRange = String(dateRange || "").trim().toUpperCase();
  const dateClause = normalizedDateRange === "TODAY"
    ? " AND DATE(G.entry_datetime)=CURRENT_DATE"
    : normalizedDateRange === "WEEK"
      ? " AND YEARWEEK(G.entry_datetime,1)=YEARWEEK(CURRENT_DATE,1)"
      : "";
  const where = `G.tenant_id=? AND (?='' OR G.gate_entry_number LIKE CONCAT('%',?,'%') OR COALESCE(PO.po_number,'') LIKE CONCAT('%',?,'%') OR COALESCE(G.reference_number,'') LIKE CONCAT('%',?,'%') OR COALESCE(G.supplier_name_snapshot,'') LIKE CONCAT('%',?,'%') OR COALESCE(G.customer_name_snapshot,'') LIKE CONCAT('%',?,'%') OR COALESCE(G.vehicle_number,'') LIKE CONCAT('%',?,'%'))${pendingGrnClause} AND (?='' OR COALESCE(G.supplier_name_snapshot,'') LIKE CONCAT('%',?,'%'))${dateClause}`;
  const [rows] = await db.execute(`SELECT G.gate_entry_id AS id,G.gate_entry_number AS gateEntryNumber,G.entry_datetime AS entryDateTime,G.entry_type AS entryType,G.service_type AS serviceType,COALESCE(G.reference_number,PO.po_number,G.part_number_snapshot) AS referenceNumber,G.part_id AS partId,G.part_number_snapshot AS partNumber,G.part_name_snapshot AS partName,G.part_uom_snapshot AS partUom,G.purchase_order_id AS purchaseOrderId,G.supplier_id AS supplierId,G.customer_id AS customerId,COALESCE(PO.po_number,'') AS poNumber,COALESCE(G.supplier_name_snapshot,'') AS supplierName,COALESCE(G.supplier_code_snapshot,'') AS supplierCode,COALESCE(G.customer_name_snapshot,'') AS customerName,G.transport_mode AS transportMode,G.courier_name AS courierName,G.courier_receipt_number AS courierReceiptNumber,G.vehicle_number AS vehicleNumber,G.driver_name AS driverName,G.driving_licence_number AS drivingLicenceNumber,G.status,COALESCE(G.updated_at,G.created_at) AS lastUpdatedAt,COUNT(POI.purchase_order_item_id) AS itemCount,COALESCE(SUM(POI.ordered_quantity),0) AS totalQuantity,COALESCE(PO.delivery_address_snapshot,'') AS deliveryLocation FROM purchase_gate_entries G LEFT JOIN purchase_orders PO ON PO.purchase_order_id=G.purchase_order_id LEFT JOIN purchase_order_items POI ON POI.purchase_order_id=PO.purchase_order_id WHERE ${where} GROUP BY G.gate_entry_id ORDER BY COALESCE(G.updated_at,G.created_at) DESC,G.gate_entry_id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
  const [count] = await db.execute(`SELECT COUNT(*) AS total FROM purchase_gate_entries G LEFT JOIN purchase_orders PO ON PO.purchase_order_id=G.purchase_order_id WHERE ${where}`, params);
  return { rows, total: Number(count[0]?.total || 0) };
}

export async function summary(tenantId) {
  const [rows] = await db.execute(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(status='GATE_ENTERED'), 0) AS gateEntered,
      COALESCE(SUM(status='GATE_ENTERED' AND (COALESCE(entry_type,'REGULAR_PURCHASE')<>'OTHER_SERVICES' OR COALESCE(service_type,'') IN ('CALIBRATION_RETURN','TOOL_RETURN'))), 0) AS pendingGrnCreation,
      COALESCE(SUM(status='GRN_CREATED'), 0) AS grnCreated,
      COALESCE(SUM(status='STOCK_POSTED'), 0) AS stockPosted
    FROM purchase_gate_entries
    WHERE tenant_id=?
  `, [tenantId]);
  return rows[0] || {};
}

export async function listSupplierOptions(tenantId) {
  const [rows] = await db.execute(`SELECT DISTINCT TRIM(supplier_name_snapshot) AS supplierName
    FROM purchase_gate_entries
    WHERE tenant_id=? AND COALESCE(TRIM(supplier_name_snapshot),'')<>''
    ORDER BY supplierName`, [tenantId]);
  return rows.map((row) => row.supplierName);
}

export async function get(id, tenantId, connection = db, lock = false) {
  const [rows] = await connection.execute(`SELECT G.gate_entry_id AS id,G.gate_entry_number AS gateEntryNumber,G.entry_datetime AS entryDateTime,G.entry_type AS entryType,G.service_type AS serviceType,COALESCE(G.reference_number,PO.po_number,G.part_number_snapshot) AS referenceNumber,G.part_id AS partId,G.part_number_snapshot AS partNumber,G.part_name_snapshot AS partName,G.part_uom_snapshot AS partUom,G.purchase_order_id AS purchaseOrderId,G.supplier_id AS supplierId,G.customer_id AS customerId,COALESCE(PO.po_number,'') AS poNumber,COALESCE(G.supplier_name_snapshot,'') AS supplierName,COALESCE(G.supplier_code_snapshot,'') AS supplierCode,COALESCE(G.customer_name_snapshot,'') AS customerName,G.transport_mode AS transportMode,G.courier_name AS courierName,G.courier_receipt_number AS courierReceiptNumber,G.vehicle_number AS vehicleNumber,G.driver_name AS driverName,G.driving_licence_number AS drivingLicenceNumber,G.status,COALESCE(PO.delivery_address_snapshot,'') AS deliveryLocation FROM purchase_gate_entries G LEFT JOIN purchase_orders PO ON PO.purchase_order_id=G.purchase_order_id WHERE G.gate_entry_id=? AND G.tenant_id=? ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  return rows[0] || null;
}

export async function getEligibleOrder(id, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`SELECT * FROM purchase_orders WHERE purchase_order_id=? AND tenant_id=? AND status IN ('APPROVED','PARTIALLY_RECEIVED') ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT * FROM purchase_order_items WHERE purchase_order_id=? AND tenant_id=? AND line_status IN ('OPEN','PARTIALLY_RECEIVED') ORDER BY line_number`, [Number(id), tenantId]);
  return { ...headers[0], items };
}

export async function eligibleOrders(tenantId) {
  const [rows] = await db.execute(`SELECT PO.purchase_order_id AS id,PO.po_number AS poNumber,PO.supplier_name_snapshot AS supplierName,PO.supplier_code_snapshot AS supplierCode,PO.delivery_address_snapshot AS deliveryLocation,PO.transport_mode AS transportMode,S.allowed_transport_modes AS allowedTransportModes,COUNT(POI.purchase_order_item_id) AS itemCount,COALESCE(SUM(GREATEST(POI.ordered_quantity-COALESCE(POI.received_quantity,0)-COALESCE((SELECT SUM(GI.received_quantity) FROM goods_receipt_note_items GI JOIN goods_receipt_notes G ON G.grn_id=GI.grn_id AND G.tenant_id=GI.tenant_id WHERE GI.tenant_id=POI.tenant_id AND GI.purchase_order_item_id=POI.purchase_order_item_id AND G.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')),0),0)),0) AS openQuantity FROM purchase_orders PO JOIN purchase_order_items POI ON POI.purchase_order_id=PO.purchase_order_id AND POI.tenant_id=PO.tenant_id AND POI.line_status IN ('OPEN','PARTIALLY_RECEIVED') JOIN supplier_master S ON S.supplier_id=PO.supplier_id WHERE PO.tenant_id=? AND PO.status IN ('APPROVED','PARTIALLY_RECEIVED') GROUP BY PO.purchase_order_id HAVING openQuantity > 0 ORDER BY PO.po_date DESC,PO.purchase_order_id DESC`, [tenantId]);
  return rows;
}

export async function receivableOrders(tenantId) {
  const [rows] = await db.execute(`SELECT PO.purchase_order_id AS id,PO.po_number AS poNumber,PO.supplier_name_snapshot AS supplierName,PO.supplier_code_snapshot AS supplierCode,PO.delivery_address_snapshot AS deliveryLocation,PO.transport_mode AS transportMode,S.allowed_transport_modes AS allowedTransportModes,COUNT(POI.purchase_order_item_id) AS itemCount,COALESCE(SUM(GREATEST(POI.ordered_quantity-COALESCE(POI.received_quantity,0)-COALESCE((SELECT SUM(GI.received_quantity) FROM goods_receipt_note_items GI JOIN goods_receipt_notes G ON G.grn_id=GI.grn_id AND G.tenant_id=GI.tenant_id WHERE GI.tenant_id=POI.tenant_id AND GI.purchase_order_item_id=POI.purchase_order_item_id AND G.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')),0),0)),0) AS openQuantity FROM purchase_orders PO JOIN purchase_order_items POI ON POI.purchase_order_id=PO.purchase_order_id AND POI.tenant_id=PO.tenant_id AND COALESCE(POI.line_status,'OPEN') NOT IN ('RECEIVED','CANCELLED') JOIN supplier_master S ON S.supplier_id=PO.supplier_id WHERE PO.tenant_id=? AND PO.status IN ('APPROVED','PARTIALLY_RECEIVED') GROUP BY PO.purchase_order_id HAVING openQuantity > 0 ORDER BY PO.po_date DESC,PO.purchase_order_id DESC`, [tenantId]);
  return rows;
}

export async function getReceivableOrder(id, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`SELECT * FROM purchase_orders WHERE purchase_order_id=? AND tenant_id=? AND status IN ('APPROVED','PARTIALLY_RECEIVED') ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT * FROM purchase_order_items WHERE purchase_order_id=? AND tenant_id=? AND COALESCE(line_status,'OPEN') NOT IN ('RECEIVED','CANCELLED') ORDER BY line_number`, [Number(id), tenantId]);
  return items.length ? { ...headers[0], items } : null;
}

export async function insert(connection, values) {
  const [result] = await connection.execute(`INSERT INTO purchase_gate_entries (tenant_id,company_id,plant_id,gate_entry_number,entry_datetime,entry_type,service_type,reference_number,purchase_order_id,supplier_id,customer_id,part_id,part_number_snapshot,part_name_snapshot,part_uom_snapshot,supplier_code_snapshot,supplier_name_snapshot,customer_name_snapshot,transport_mode,courier_name,courier_receipt_number,vehicle_number,driver_name,driving_licence_number,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values);
  return result.insertId;
}

export async function update(connection, id, tenantId, values) {
  await connection.execute(`UPDATE purchase_gate_entries SET entry_datetime=?,entry_type=?,service_type=?,reference_number=?,purchase_order_id=?,plant_id=?,supplier_id=?,customer_id=?,part_id=?,part_number_snapshot=?,part_name_snapshot=?,part_uom_snapshot=?,supplier_code_snapshot=?,supplier_name_snapshot=?,customer_name_snapshot=?,transport_mode=?,courier_name=?,courier_receipt_number=?,vehicle_number=?,driver_name=?,driving_licence_number=?,status=?,updated_by=? WHERE gate_entry_id=? AND tenant_id=? AND status='DRAFT'`, [...values, Number(id), tenantId]);
}

export async function getActiveCustomer(connection, customerId) { const [rows] = await connection.execute("SELECT customer_id,customer_name,allowed_transport_modes,transport_mode FROM customer_master WHERE customer_id=? AND active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED' AND party_type IN ('CUSTOMER','BOTH')", [Number(customerId)]); return rows[0] || null; }
export async function getActiveSupplier(connection, supplierId) { const [rows] = await connection.execute("SELECT supplier_id,supplier_name,supplier_code,allowed_transport_modes,transport_mode FROM supplier_master WHERE supplier_id=? AND active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'", [Number(supplierId)]); return rows[0] || null; }
export async function getActivePart(connection, partId) { const [rows] = await connection.execute("SELECT part_id,part_number,part_name,unit_of_measurement FROM part_master WHERE part_id=? AND active_flag='Y' AND part_status='ACTIVE' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'", [Number(partId)]); return rows[0] || null; }

export async function setStatus(connection, id, tenantId, status, userCode) {
  await connection.execute(`UPDATE purchase_gate_entries SET status=?,updated_by=? WHERE gate_entry_id=? AND tenant_id=?`, [status, userCode, Number(id), tenantId]);
}

export async function listItemCategories(tenantId, purchaseOrderIds, connection = db) {
  const ids = [...new Set(purchaseOrderIds.map(Number).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.execute(`
    SELECT POS.purchase_order_id AS purchaseOrderId,
      CASE
        WHEN COUNT(DISTINCT PR.requisition_type) > 1 THEN 'Mixed Items'
        WHEN MAX(PR.requisition_type) = 'NEW_ITEM' THEN 'New Item'
        WHEN MAX(PR.requisition_type) = 'EXISTING_ITEM' THEN 'Existing Item'
        ELSE 'Item type unavailable'
      END AS itemCategory
    FROM purchase_order_sources POS
    JOIN purchase_requests PR ON PR.purchase_request_id = POS.purchase_request_id
      AND PR.tenant_id = POS.tenant_id
    WHERE POS.tenant_id = ? AND POS.purchase_order_id IN (${placeholders})
    GROUP BY POS.purchase_order_id
  `, [tenantId, ...ids]);
  return rows;
}
