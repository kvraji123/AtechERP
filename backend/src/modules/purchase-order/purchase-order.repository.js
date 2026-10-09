import { db } from "../../config/db.js";

export async function findExistingForLine(connection, tenantId, itemId) {
  const [rows] = await connection.execute(`SELECT POI.purchase_order_id AS purchaseOrderId FROM purchase_order_items POI JOIN purchase_orders PO ON PO.purchase_order_id=POI.purchase_order_id WHERE POI.tenant_id=? AND POI.purchase_request_item_id=? AND PO.status NOT IN ('CANCELLED','REJECTED') LIMIT 1`, [tenantId, itemId]);
  return rows[0] || null;
}

export async function insertHeader(connection, values) {
  const [result] = await connection.execute(`INSERT INTO purchase_orders (tenant_id,company_id,plant_id,po_number,financial_year,po_date,supplier_id,supplier_code_snapshot,supplier_name_snapshot,supplier_address_snapshot,supplier_gst_snapshot,source_reference,billing_address_snapshot,delivery_address_snapshot,payment_terms,delivery_terms,transport_mode,expected_delivery_date,remarks,special_instructions,subtotal_amount,discount_amount,tax_amount,packing_amount,freight_amount,other_charges_amount,grand_total_amount,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values);
  return result.insertId;
}

export async function insertItem(connection, values) {
  const [result] = await connection.execute(`INSERT INTO purchase_order_items (tenant_id,purchase_order_id,purchase_request_item_id,line_number,item_id,item_code_snapshot,item_type_snapshot,item_description_snapshot,item_specification_snapshot,uom_code_snapshot,hsn_code_snapshot,ordered_quantity,unit_price,discount_amount,tax_percent,tax_amount,packing_amount,freight_amount,other_charges_amount,line_total_amount,required_date,line_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values);
  return result.insertId;
}

export async function insertSource(connection, values) {
  await connection.execute(`INSERT INTO purchase_order_sources (tenant_id,purchase_order_id,purchase_order_item_id,purchase_request_id,purchase_request_item_id,source_quantity) VALUES (?,?,?,?,?,?)`, values);
}

export async function upsertItemSupplierRate(connection, { itemId, supplierId, purchaseRate, currencyCode, leadTimeDays }, userCode) {
  await connection.execute(`
    INSERT INTO item_supplier
      (item_id,supplier_id,supplier_item_code,purchase_rate,currency_code,moq,lead_time_days,
       effective_from,effective_to,preferred_supplier,remarks,created_by)
    VALUES (?,?,NULL,?,?,NULL,?,CURRENT_DATE,NULL,'N','Updated from accepted purchase quotation',?)
    ON DUPLICATE KEY UPDATE
      purchase_rate=VALUES(purchase_rate),
      currency_code=VALUES(currency_code),
      lead_time_days=VALUES(lead_time_days),
      effective_from=VALUES(effective_from),
      effective_to=NULL,
      updated_by=VALUES(created_by),
      updated_on=CURRENT_TIMESTAMP
  `, [Number(itemId), Number(supplierId), Number(purchaseRate), String(currencyCode || "INR").slice(0, 10), leadTimeDays == null ? null : Number(leadTimeDays), userCode]);
  await connection.execute(`UPDATE item_master SET purchase_rate=?,updated_by=? WHERE item_id=?`, [Number(purchaseRate), userCode, Number(itemId)]);
}

export async function listOrders({ tenantId, search = "", status = "", supplier = "", source = "", dateRange = "", approvalOnly = false, limit = 20, offset = 0 }) {
  const normalizedSource = String(source || "").trim().toUpperCase();
  const normalizedDateRange = String(dateRange || "").trim().toUpperCase();
  const sourceClause = normalizedSource === "RFQ"
    ? " AND COALESCE(PO.source_reference,'') REGEXP 'RFQ|PE/'"
    : normalizedSource === "DIRECT"
      ? " AND (PO.source_reference IS NULL OR PO.source_reference='' OR PO.source_reference NOT REGEXP 'RFQ|PE/')"
      : "";
  const dateClause = normalizedDateRange === "TODAY"
    ? " AND DATE(PO.po_date)=CURRENT_DATE"
    : normalizedDateRange === "WEEK"
      ? " AND YEARWEEK(PO.po_date,1)=YEARWEEK(CURRENT_DATE,1)"
      : normalizedDateRange === "MONTH"
        ? " AND DATE_FORMAT(PO.po_date,'%Y-%m')=DATE_FORMAT(CURRENT_DATE,'%Y-%m')"
        : "";
  const approvalClause = approvalOnly ? " AND PO.status IN ('SUBMITTED','APPROVED','RETURNED','REJECTED')" : "";
  const rowWhere = `PO.tenant_id=?
    AND (?='' OR PO.po_number LIKE CONCAT('%', ?, '%') OR PO.source_reference LIKE CONCAT('%', ?, '%') OR PR.pr_number LIKE CONCAT('%', ?, '%'))
    AND (?='' OR PO.status=?)
    AND (?='' OR PO.supplier_name_snapshot LIKE CONCAT('%', ?, '%'))${sourceClause}${dateClause}${approvalClause}`;
  const countWhere = `PO.tenant_id=?
    AND (?='' OR PO.po_number LIKE CONCAT('%', ?, '%') OR PO.source_reference LIKE CONCAT('%', ?, '%') OR EXISTS (
      SELECT 1 FROM purchase_order_sources COUNT_POS
      JOIN purchase_requests COUNT_PR ON COUNT_PR.purchase_request_id=COUNT_POS.purchase_request_id AND COUNT_PR.tenant_id=COUNT_POS.tenant_id
      WHERE COUNT_POS.purchase_order_id=PO.purchase_order_id AND COUNT_POS.tenant_id=PO.tenant_id
        AND COUNT_PR.pr_number LIKE CONCAT('%', ?, '%')
    ))
    AND (?='' OR PO.status=?)
    AND (?='' OR PO.supplier_name_snapshot LIKE CONCAT('%', ?, '%'))${sourceClause}${dateClause}${approvalClause}`;
  const params = [tenantId, search, search, search, search, status, status, supplier, supplier];
  const [rows] = await db.execute(`SELECT PO.purchase_order_id AS id, PO.po_number AS poNumber, PO.po_date AS poDate, PO.supplier_name_snapshot AS supplierName, PO.supplier_code_snapshot AS supplierCode, COALESCE(NULLIF(PO.source_reference,''),GROUP_CONCAT(DISTINCT PR.pr_number ORDER BY PR.pr_number SEPARATOR ', ')) AS sourceReference, PO.expected_delivery_date AS expectedDeliveryDate, PO.grand_total_amount AS grandTotalAmount, PO.status, PO.submitted_by AS submittedBy, PO.submitted_at AS submittedAt, COALESCE(PO.updated_at, PO.submitted_at, PO.created_at) AS lastUpdatedAt, COUNT(DISTINCT POI.purchase_order_item_id) AS itemCount FROM purchase_orders PO LEFT JOIN purchase_order_items POI ON POI.purchase_order_id=PO.purchase_order_id LEFT JOIN purchase_order_sources POS ON POS.purchase_order_id=PO.purchase_order_id AND POS.tenant_id=PO.tenant_id LEFT JOIN purchase_requests PR ON PR.purchase_request_id=POS.purchase_request_id AND PR.tenant_id=PO.tenant_id WHERE ${rowWhere} GROUP BY PO.purchase_order_id ORDER BY COALESCE(PO.updated_at, PO.submitted_at, PO.created_at) DESC, PO.purchase_order_id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM purchase_orders PO WHERE ${countWhere}`, params);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function approvalSummary(tenantId) {
  const [rows] = await db.execute(`
    SELECT PO.status, COUNT(*) AS count, COALESCE(SUM(PO.grand_total_amount), 0) AS totalValue
    FROM purchase_orders PO
    WHERE PO.tenant_id=? AND PO.status IN ('SUBMITTED','APPROVED','RETURNED','REJECTED')
    GROUP BY PO.status`, [tenantId]);
  return rows;
}

export async function summary(tenantId) {
  const [rows] = await db.execute(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(status IN ('DRAFT','RETURNED')), 0) AS draft,
      COALESCE(SUM(status='SUBMITTED'), 0) AS pending,
      COALESCE(SUM(status IN ('APPROVED','COMPLETED')), 0) AS approved,
      COALESCE(SUM(status='PARTIALLY_RECEIVED'), 0) AS partial
    FROM purchase_orders
    WHERE tenant_id=?
  `, [tenantId]);
  return rows[0] || {};
}

export async function listSupplierOptions(tenantId) {
  const [rows] = await db.execute(`SELECT DISTINCT TRIM(supplier_name_snapshot) AS supplierName
    FROM purchase_orders
    WHERE tenant_id=? AND COALESCE(TRIM(supplier_name_snapshot),'')<>''
    ORDER BY supplierName`, [tenantId]);
  return rows.map((row) => row.supplierName);
}

export async function getOrder(id, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`SELECT * FROM purchase_orders WHERE purchase_order_id=? AND tenant_id=? ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT * FROM purchase_order_items WHERE purchase_order_id=? AND tenant_id=? ORDER BY line_number`, [Number(id), tenantId]);
  const [sources] = await connection.execute(`SELECT POS.*,PR.pr_number AS prNumber,PR.requisition_type AS requisitionType FROM purchase_order_sources POS LEFT JOIN purchase_requests PR ON PR.purchase_request_id=POS.purchase_request_id AND PR.tenant_id=POS.tenant_id WHERE POS.purchase_order_id=? AND POS.tenant_id=? ORDER BY POS.id`, [Number(id), tenantId]);
  const [history] = await connection.execute(`SELECT * FROM purchase_order_approval_history WHERE purchase_order_id=? AND tenant_id=? ORDER BY performed_at,id`, [Number(id), tenantId]);
  const [attachments] = await connection.execute(`SELECT * FROM purchase_order_attachments WHERE purchase_order_id=? AND tenant_id=? ORDER BY uploaded_at,id`, [Number(id), tenantId]);
  return { ...headers[0], items, sources, approvalHistory: history, attachments };
}

export async function updateHeader(connection, id, tenantId, values) {
  await connection.execute(`UPDATE purchase_orders SET expected_delivery_date=?,payment_terms=?,delivery_terms=?,transport_mode=?,billing_address_snapshot=?,delivery_address_snapshot=?,remarks=?,special_instructions=?,updated_by=? WHERE purchase_order_id=? AND tenant_id=? AND status IN ('DRAFT','RETURNED')`, [...values, Number(id), tenantId]);
}

export async function updateItem(connection, id, tenantId, values) {
  await connection.execute(`UPDATE purchase_order_items SET ordered_quantity=?,unit_price=?,discount_amount=?,tax_percent=?,tax_amount=?,packing_amount=?,freight_amount=?,other_charges_amount=?,line_total_amount=?,updated_at=CURRENT_TIMESTAMP WHERE purchase_order_item_id=? AND tenant_id=?`, [...values, Number(id), tenantId]);
}

export async function setStatus(connection, id, tenantId, status, userCode) {
  await connection.execute(`UPDATE purchase_orders SET status=?,updated_by=?,submitted_by=CASE WHEN ?='SUBMITTED' THEN ? ELSE submitted_by END,submitted_at=CASE WHEN ?='SUBMITTED' THEN CURRENT_TIMESTAMP ELSE submitted_at END,approved_by=CASE WHEN ?='APPROVED' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='APPROVED' THEN CURRENT_TIMESTAMP ELSE approved_at END WHERE purchase_order_id=? AND tenant_id=?`, [status, userCode, status, userCode, status, status, userCode, status, Number(id), tenantId]);
}

export async function insertHistory(connection, values) {
  await connection.execute(`INSERT INTO purchase_order_approval_history (tenant_id,purchase_order_id,decision,reason,from_status,to_status,performed_by) VALUES (?,?,?,?,?,?,?)`, values);
}

export async function listOrderItemCategories(tenantId, purchaseOrderIds, connection = db) {
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
