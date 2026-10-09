import { db } from "../../config/db.js";

export async function listQueue({ tenantId, search = "", status = "", plant = "", department = "", priority = "", supplier = "", limit = 20, offset = 0 }) {
  const params = [tenantId, search, search, search, status, status, status, plant, plant, department, department, priority, priority, supplier, supplier];
  const where = `PR.tenant_id=?
      AND (?='' OR PR.pr_number LIKE CONCAT('%', ?, '%') OR PR.requested_by LIKE CONCAT('%', ?, '%'))
      AND (?='' OR IF(?='PENDING',PR.pr_status IN ('SUBMITTED','PENDING_APPROVAL'),PR.pr_status=?))
      AND (?='' OR PR.plant_code=?)
      AND (?='' OR PR.floor_department=?)
      AND (?='' OR PR.priority=?)
      AND (?='' OR PR.preferred_supplier_id=?)
      AND PR.pr_status IN ('SUBMITTED','PENDING_APPROVAL','RETURNED')`;
  const [rows] = await db.execute(`
    SELECT PR.purchase_request_id AS id, PR.pr_number AS prNumber, PR.plant_code AS plantCode,
      PR.floor_department AS department, PR.requested_by AS requestedBy, PR.priority,
      PR.requisition_type AS requisitionType, PR.required_date AS requiredDate,
      PR.pr_status AS status, PR.submitted_on AS submittedOn,
      COALESCE(PR.updated_on, PR.submitted_on, PR.created_on) AS lastUpdatedAt,
      PR.estimated_total_amount AS estimatedTotalAmount,
      PR.preferred_supplier_id AS preferredSupplierId,
      SUP.supplier_name AS preferredSupplierName,
      SUP.supplier_code AS preferredSupplierCode,
      COUNT(PRI.purchase_request_item_id) AS itemCount,
      SUM(PRI.approval_status='APPROVED') AS approvedItemCount
    FROM purchase_requests PR LEFT JOIN purchase_request_items PRI
      ON PRI.purchase_request_id=PR.purchase_request_id AND PRI.tenant_id=PR.tenant_id
    LEFT JOIN supplier_master SUP ON SUP.supplier_id=PR.preferred_supplier_id
    WHERE ${where}
    GROUP BY PR.purchase_request_id
    ORDER BY COALESCE(PR.updated_on, PR.submitted_on, PR.created_on) DESC, PR.purchase_request_id DESC
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `, params);
  const [countRows] = await db.execute(`
    SELECT COUNT(*) AS total
    FROM purchase_requests PR
    WHERE ${where}
  `, params);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getForUpdate(connection, id, tenantId) {
  const [headers] = await connection.execute(`
    SELECT PR.*, SUP.supplier_name AS preferred_supplier_name, SUP.supplier_code AS preferred_supplier_code,
      SUP.email_address AS preferred_supplier_email, SUP.mobile_number AS preferred_supplier_mobile
    FROM purchase_requests PR
    LEFT JOIN supplier_master SUP ON SUP.supplier_id = PR.preferred_supplier_id
    WHERE PR.purchase_request_id=? AND PR.tenant_id=? FOR UPDATE
  `, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT * FROM purchase_request_items WHERE purchase_request_id=? AND tenant_id=? ORDER BY line_number`, [Number(id), tenantId]);
  return { ...headers[0], items };
}

export async function updateLine(connection, item, userCode) {
  await connection.execute(`UPDATE purchase_request_items SET approval_status=?, approved_quantity=?, approval_reason=?, approved_by=?, approved_on=CURRENT_TIMESTAMP, updated_by=? WHERE purchase_request_item_id=? AND tenant_id=?`, [item.status, item.approvedQuantity, item.reason, userCode, userCode, item.id, item.tenantId]);
}

export async function insertLineHistory(connection, values) {
  await connection.execute(`INSERT INTO purchase_request_item_approval_history (tenant_id,purchase_request_id,purchase_request_item_id,decision,approved_quantity,reason,from_status,to_status,performed_by) VALUES (?,?,?,?,?,?,?,?,?)`, values);
}
