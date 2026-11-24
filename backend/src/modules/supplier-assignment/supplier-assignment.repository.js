import { db } from "../../config/db.js";

export async function eligibleItems(tenantId) {
  const [rows] = await db.execute(`
    SELECT PRI.purchase_request_item_id AS purchaseRequestItemId, PR.purchase_request_id AS purchaseRequestId,
      PR.pr_number AS prNumber, PR.pr_status AS prStatus, PRI.item_id AS itemId,
      PRI.item_type_name AS itemType, PRI.item_description AS itemDescription,
      PRI.item_specification AS itemSpecification, PRI.approved_quantity AS approvedQuantity,
      PRI.uom_code AS uomCode, PR.required_date AS requiredDate, I.item_code AS itemCode,
      COALESCE((SELECT MAX(A2.updated_at) FROM purchase_request_supplier_assignments A2 WHERE A2.tenant_id=PRI.tenant_id AND A2.purchase_request_item_id=PRI.purchase_request_item_id),PR.updated_on,PR.submitted_on,PR.created_on) AS lastUpdatedAt,
      (SELECT GROUP_CONCAT(A.supplier_id ORDER BY A.supplier_id SEPARATOR ',')
        FROM purchase_request_supplier_assignments A
        WHERE A.tenant_id=PRI.tenant_id AND A.purchase_request_item_id=PRI.purchase_request_item_id AND A.assignment_status='ASSIGNED') AS assignedSupplierIds
    FROM purchase_request_items PRI JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id
    LEFT JOIN item_master I ON I.item_id=PRI.item_id
    WHERE PRI.tenant_id=? AND PR.tenant_id=? AND PRI.approval_status='APPROVED'
      AND PR.requisition_type='NEW_ITEM'
      AND PR.pr_status IN ('APPROVED','PARTIALLY_APPROVED') AND PRI.line_status='ACTIVE'
    ORDER BY COALESCE((SELECT MAX(A2.updated_at) FROM purchase_request_supplier_assignments A2 WHERE A2.tenant_id=PRI.tenant_id AND A2.purchase_request_item_id=PRI.purchase_request_item_id),PR.updated_on,PR.submitted_on,PR.created_on) DESC, PR.purchase_request_id DESC, PRI.purchase_request_item_id DESC
  `, [tenantId, tenantId]);
  return rows;
}

export async function getSupplier(connection, supplierId) {
  const [rows] = await connection.execute(`SELECT supplier_id AS supplierId, supplier_code AS supplierCode, supplier_name AS supplierName, COALESCE(NULLIF(delivery_address,''),billing_address) AS billingAddress, delivery_address AS deliveryAddress, gst_number AS gstNumber, email_address AS emailAddress, currency_code AS currencyCode, allowed_transport_modes AS allowedTransportModes, transport_mode AS transportMode FROM supplier_master WHERE supplier_id=? AND active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'`, [Number(supplierId)]);
  return rows[0] || null;
}

export async function getLinesForUpdate(connection, tenantId, itemIds) {
  const placeholders = itemIds.map(() => "?").join(",");
  const [rows] = await connection.execute(`
    SELECT PRI.*, PR.purchase_request_id AS requestId, PR.pr_number AS prNumber, PR.pr_status AS prStatus, PR.pr_status AS pr_status,
      PR.required_date AS requestRequiredDate, PR.plant_id AS plantId,
      PR.requisition_type AS requisitionType, PR.preferred_supplier_id AS preferredSupplierId,
      I.item_code AS itemCode, I.purchase_rate AS masterPurchaseRate
    FROM purchase_request_items PRI JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id
    JOIN item_master I ON I.item_id=PRI.item_id
    WHERE PRI.tenant_id=? AND PR.tenant_id=? AND PRI.purchase_request_item_id IN (${placeholders})
    FOR UPDATE
  `, [tenantId, tenantId, ...itemIds]);
  return rows;
}

export async function replaceAssignments(connection, tenantId, assignments, userCode) {
  const itemIds = [...new Set(assignments.map((entry) => entry.purchaseRequestItemId))];
  const placeholders = itemIds.map(() => "?").join(",");
  await connection.execute(`UPDATE purchase_request_supplier_assignments SET assignment_status='CANCELLED', updated_by=? WHERE tenant_id=? AND purchase_request_item_id IN (${placeholders}) AND assignment_status='ASSIGNED'`, [userCode, tenantId, ...itemIds]);
  for (const entry of assignments) {
    await connection.execute(`
      INSERT INTO purchase_request_supplier_assignments
        (tenant_id,purchase_request_item_id,supplier_id,assigned_quantity,assignment_status,assigned_by,updated_by)
      VALUES (?,?,?,?, 'ASSIGNED', ?, ?)
      ON DUPLICATE KEY UPDATE
        assigned_quantity=VALUES(assigned_quantity),
        assignment_status='ASSIGNED',
        assigned_by=VALUES(assigned_by),
        assigned_at=CURRENT_TIMESTAMP,
        updated_by=VALUES(updated_by),
        updated_at=CURRENT_TIMESTAMP
    `, [tenantId, entry.purchaseRequestItemId, entry.supplierId, entry.assignedQuantity, userCode, userCode]);
  }
}

export async function getActiveAssignments(connection, tenantId, itemIds) {
  const placeholders = itemIds.map(() => "?").join(",");
  const [rows] = await connection.execute(`SELECT A.*, C.supplier_code AS supplierCode, C.supplier_name AS supplierName, COALESCE(NULLIF(C.delivery_address,''),C.billing_address) AS supplierAddress, C.gst_number AS supplierGst, C.currency_code AS currencyCode FROM purchase_request_supplier_assignments A JOIN supplier_master C ON C.supplier_id=A.supplier_id WHERE A.tenant_id=? AND A.assignment_status='ASSIGNED' AND A.purchase_request_item_id IN (${placeholders})`, [tenantId, ...itemIds]);
  return rows;
}
