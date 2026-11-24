import { db } from "../../config/db.js";

const itemSelect = `
  SELECT I.item_id AS itemId, I.item_code AS itemCode,
    G.group_name AS itemGroupName, T.type_name AS itemTypeName,
    I.item_description AS itemDescription, I.item_specification AS itemSpecification,
    U.uom_code AS uomCode, I.hsn_code AS hsnCode, I.tax_percent AS taxPercent,
    COALESCE(I.purchase_rate, 0) AS purchaseRate
  FROM item_master I
  JOIN item_group_master G ON G.item_group_id = I.item_group_id
  JOIN item_type_master T ON T.item_type_id = I.item_type_id
  JOIN uom_master U ON U.uom_id = I.uom_id
  WHERE I.item_id = ? AND I.active_flag = 'Y'`;

export async function getItemSnapshot(itemId, connection = db) {
  const [rows] = await connection.execute(itemSelect, [Number(itemId)]);
  return rows[0] || null;
}

export async function insertRequest(connection, values) {
  const [result] = await connection.execute(`
    INSERT INTO purchase_requests
      (tenant_id, company_id, plant_id, pr_number, financial_year, plant_code,
       floor_department, department_id, requested_by, request_date, required_date,
       requisition_type, priority, preferred_supplier_id, quote_reference, remarks,
       estimated_subtotal, estimated_tax_amount, estimated_total_amount, pr_status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, values);
  return result.insertId;
}

export async function getActiveDepartmentByName(connection, departmentName) {
  const [rows] = await connection.execute(`SELECT department_code AS departmentCode,
    department_name AS departmentName FROM department_master
    WHERE active_flag='Y' AND UPPER(department_name)=UPPER(?) LIMIT 1`,
  [String(departmentName || "").trim()]);
  return rows[0] || null;
}

export async function insertItem(connection, values) {
  const [result] = await connection.execute(`
    INSERT INTO purchase_request_items
      (tenant_id, company_id, purchase_request_id, line_number, item_id, item_group_name,
       item_type_name, item_description, item_specification, requested_quantity,
       approved_quantity, uom_code, estimated_rate_per_qty, tax_percent,
       estimated_tax_amount, estimated_total_amount, hsn_code, purpose, approval_status,
       created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `, values);
  return result.insertId;
}

export async function insertHeaderHistory(connection, values) {
  await connection.execute(`
    INSERT INTO purchase_request_approval_history
      (purchase_request_id, decision, decision_reason, decided_by, from_status, to_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, values);
}

export async function listRequests({ tenantId, search = "", status = "", plant = "", department = "", priority = "", rfqEligible = false, pendingApproval = false, clarificationOnly = false, limit = 20, offset = 0 }) {
  const rfqEligibleClause = rfqEligible ? `
      AND PR.requisition_type='NEW_ITEM'
      AND PR.pr_status IN ('APPROVED','PARTIALLY_APPROVED')
      AND EXISTS (SELECT 1 FROM purchase_request_items RFQ_ITEM WHERE RFQ_ITEM.purchase_request_id=PR.purchase_request_id AND RFQ_ITEM.tenant_id=PR.tenant_id AND RFQ_ITEM.approval_status='APPROVED')
      AND NOT EXISTS (
        SELECT 1 FROM purchase_enquiry_requests RFQ_REQUEST
        JOIN purchase_enquiries RFQ_ENQUIRY ON RFQ_ENQUIRY.purchase_enquiry_id=RFQ_REQUEST.purchase_enquiry_id AND RFQ_ENQUIRY.tenant_id=RFQ_REQUEST.tenant_id
        WHERE RFQ_REQUEST.purchase_request_id=PR.purchase_request_id AND RFQ_REQUEST.tenant_id=PR.tenant_id AND RFQ_ENQUIRY.enquiry_status<>'CANCELLED'
      )` : "";
  const clarificationClause = clarificationOnly
    ? " AND EXISTS (SELECT 1 FROM purchase_request_items CLARIFICATION_ITEM WHERE CLARIFICATION_ITEM.purchase_request_id=PR.purchase_request_id AND CLARIFICATION_ITEM.tenant_id=PR.tenant_id AND CLARIFICATION_ITEM.approval_status='CLARIFICATION')"
    : "";
  const pendingApprovalClause = pendingApproval ? " AND PR.pr_status IN ('SUBMITTED', 'PENDING_APPROVAL')" : "";
  const params = [tenantId, search, search, search, status, status, plant, plant, department, department, priority, priority];
  const [rows] = await db.execute(`
    SELECT PR.purchase_request_id AS id, PR.pr_number AS prNumber,
      PR.plant_code AS plantCode, PR.floor_department AS department,
      PR.requested_by AS requestedBy, PR.request_date AS requestDate,
      PR.required_date AS requiredDate, PR.requisition_type AS requisitionType,
      PR.priority,
      CASE
        WHEN SUM(CASE WHEN PRI.approval_status = 'CLARIFICATION' THEN 1 ELSE 0 END) > 0
          AND SUM(CASE WHEN PRI.approval_status = 'APPROVED' THEN 1 ELSE 0 END) > 0
          THEN 'PARTIALLY_APPROVED'
        WHEN SUM(CASE WHEN PRI.approval_status = 'CLARIFICATION' THEN 1 ELSE 0 END) > 0
          AND SUM(CASE WHEN PRI.approval_status = 'APPROVED' THEN 1 ELSE 0 END) = 0
          AND PR.pr_status IN ('APPROVED','PARTIALLY_APPROVED','RETURNED')
          THEN 'RETURNED'
        ELSE PR.pr_status
      END AS status,
      PR.submitted_on AS submittedOn,
      COALESCE(PR.updated_on, PR.submitted_on, PR.created_on) AS lastUpdatedAt,
      PR.estimated_total_amount AS estimatedTotalAmount,
      PR.preferred_supplier_id AS preferredSupplierId,
      SUP.supplier_name AS preferredSupplierName,
      SUP.supplier_code AS preferredSupplierCode,
      COUNT(PRI.purchase_request_item_id) AS itemCount,
      SUM(CASE WHEN PRI.approval_status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedItemCount,
      SUM(CASE WHEN PRI.approval_status = 'PENDING' THEN 1 ELSE 0 END) AS pendingItemCount,
      SUM(CASE WHEN PRI.approval_status = 'NOT_APPROVED' THEN 1 ELSE 0 END) AS rejectedItemCount,
      SUM(CASE WHEN PRI.approval_status = 'CLARIFICATION' THEN 1 ELSE 0 END) AS clarificationItemCount,
      GROUP_CONCAT(PRI.item_description ORDER BY PRI.line_number SEPARATOR ', ') AS itemSummary,
      GROUP_CONCAT(
        CASE WHEN PRI.approval_status = 'APPROVED' THEN PRI.item_description END
        ORDER BY PRI.line_number SEPARATOR ', '
      ) AS approvedItemSummary,
      CASE WHEN PR.requisition_type = 'EXISTING_ITEM' THEN 'NOT_REQUIRED'
      WHEN EXISTS (
        SELECT 1
        FROM purchase_enquiry_requests PER
        JOIN purchase_enquiries PE
          ON PE.purchase_enquiry_id = PER.purchase_enquiry_id
          AND PE.tenant_id = PER.tenant_id
        WHERE PER.purchase_request_id = PR.purchase_request_id
          AND PER.tenant_id = PR.tenant_id
          AND PE.enquiry_status <> 'CANCELLED'
      ) THEN 'CREATED' ELSE 'NOT_CREATED' END AS rfqStatus,
      (
        SELECT GROUP_CONCAT(DISTINCT CONCAT(RFQS.supplier_code, ' · ', RFQS.supplier_name)
          ORDER BY RFQS.supplier_name SEPARATOR ' | ')
        FROM purchase_enquiry_requests PER
        JOIN purchase_enquiries RFQ
          ON RFQ.purchase_enquiry_id = PER.purchase_enquiry_id
          AND RFQ.tenant_id = PER.tenant_id
        JOIN purchase_enquiry_items RFQI
          ON RFQI.purchase_enquiry_id = RFQ.purchase_enquiry_id
          AND RFQI.tenant_id = RFQ.tenant_id
        JOIN purchase_request_items RFQPRI
          ON RFQPRI.purchase_request_item_id = RFQI.purchase_request_item_id
          AND RFQPRI.tenant_id = RFQI.tenant_id
        JOIN purchase_enquiry_item_suppliers RFQIS
          ON RFQIS.purchase_enquiry_item_id = RFQI.purchase_enquiry_item_id
          AND RFQIS.tenant_id = RFQI.tenant_id
        JOIN supplier_master RFQS ON RFQS.supplier_id = RFQIS.supplier_id
        WHERE PER.purchase_request_id = PR.purchase_request_id
          AND PER.tenant_id = PR.tenant_id
          AND RFQPRI.purchase_request_id = PR.purchase_request_id
          AND RFQ.enquiry_status <> 'CANCELLED'
      ) AS assignedSuppliers,
      CASE WHEN EXISTS (
        SELECT 1 FROM purchase_order_sources POS
        JOIN purchase_orders PO ON PO.purchase_order_id = POS.purchase_order_id AND PO.tenant_id = POS.tenant_id
        WHERE POS.purchase_request_id = PR.purchase_request_id AND POS.tenant_id = PR.tenant_id AND PO.status <> 'CANCELLED'
      ) THEN 'CREATED' ELSE 'PENDING' END AS poReadiness
    FROM purchase_requests PR
    LEFT JOIN supplier_master SUP ON SUP.supplier_id = PR.preferred_supplier_id
    LEFT JOIN purchase_request_items PRI ON PRI.purchase_request_id = PR.purchase_request_id
    WHERE PR.tenant_id = ?
      AND (? = '' OR PR.pr_number LIKE CONCAT('%', ?, '%') OR PR.requested_by LIKE CONCAT('%', ?, '%') OR EXISTS (
        SELECT 1 FROM purchase_request_items SEARCH_ITEM
        WHERE SEARCH_ITEM.purchase_request_id=PR.purchase_request_id
          AND SEARCH_ITEM.tenant_id=PR.tenant_id
          AND (SEARCH_ITEM.item_description LIKE CONCAT('%', ?, '%') OR SEARCH_ITEM.item_specification LIKE CONCAT('%', ?, '%'))
      ))
      AND (? = '' OR PR.pr_status = ?)
      AND (? = '' OR PR.plant_code = ?)
      AND (? = '' OR PR.floor_department = ?)
      AND (? = '' OR PR.priority = ?)${rfqEligibleClause}${pendingApprovalClause}${clarificationClause}
    GROUP BY PR.purchase_request_id
    ORDER BY COALESCE(PR.updated_on, PR.submitted_on, PR.created_on) DESC, PR.purchase_request_id DESC
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `, [tenantId, search, search, search, search, search, status, status, plant, plant, department, department, priority, priority]);
  const [countRows] = await db.execute(`
    SELECT COUNT(*) AS total FROM purchase_requests PR
    WHERE PR.tenant_id = ?
      AND (? = '' OR PR.pr_number LIKE CONCAT('%', ?, '%') OR PR.requested_by LIKE CONCAT('%', ?, '%') OR EXISTS (
        SELECT 1 FROM purchase_request_items SEARCH_ITEM
        WHERE SEARCH_ITEM.purchase_request_id=PR.purchase_request_id
          AND SEARCH_ITEM.tenant_id=PR.tenant_id
          AND (SEARCH_ITEM.item_description LIKE CONCAT('%', ?, '%') OR SEARCH_ITEM.item_specification LIKE CONCAT('%', ?, '%'))
      ))
      AND (? = '' OR PR.pr_status = ?)
      AND (? = '' OR PR.plant_code = ?)
      AND (? = '' OR PR.floor_department = ?)
      AND (? = '' OR PR.priority = ?)${rfqEligibleClause}${pendingApprovalClause}${clarificationClause}
  `, [tenantId, search, search, search, search, search, status, status, plant, plant, department, department, priority, priority]);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function summary(tenantId) {
  const [rows] = await db.execute(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(effectiveStatus='PARTIALLY_APPROVED'), 0) AS partiallyApproved,
      COALESCE(SUM(effectiveStatus='RETURNED'), 0) AS clarification,
      COALESCE(SUM(effectiveStatus='REJECTED'), 0) AS rejected,
      COALESCE(SUM(effectiveStatus='APPROVED'), 0) AS approved,
      COALESCE(SUM(effectiveStatus IN ('SUBMITTED','PENDING_APPROVAL')), 0) AS pendingApproval,
      COALESCE(SUM(effectiveStatus NOT IN ('APPROVED','PARTIALLY_APPROVED','RETURNED','REJECTED','CANCELLED')), 0) AS pending,
      COALESCE(SUM(
        requisitionType='NEW_ITEM'
        AND effectiveStatus IN ('APPROVED','PARTIALLY_APPROVED')
        AND approvedItemCount>0
        AND NOT EXISTS (
          SELECT 1
          FROM purchase_enquiry_requests RFQ_REQUEST
          JOIN purchase_enquiries RFQ_ENQUIRY
            ON RFQ_ENQUIRY.purchase_enquiry_id=RFQ_REQUEST.purchase_enquiry_id
            AND RFQ_ENQUIRY.tenant_id=RFQ_REQUEST.tenant_id
          WHERE RFQ_REQUEST.purchase_request_id=purchaseRequestId
            AND RFQ_REQUEST.tenant_id=tenantId
            AND RFQ_ENQUIRY.enquiry_status<>'CANCELLED'
        )
      ), 0) AS rfqEligible
    FROM (
      SELECT
        PR.purchase_request_id AS purchaseRequestId,
        PR.tenant_id AS tenantId,
        PR.requisition_type AS requisitionType,
        SUM(PRI.approval_status='APPROVED') AS approvedItemCount,
        CASE
          WHEN SUM(PRI.approval_status='CLARIFICATION')>0
            AND SUM(PRI.approval_status='APPROVED')>0 THEN 'PARTIALLY_APPROVED'
          WHEN SUM(PRI.approval_status='CLARIFICATION')>0
            AND SUM(PRI.approval_status='APPROVED')=0
            AND PR.pr_status IN ('APPROVED','PARTIALLY_APPROVED','RETURNED') THEN 'RETURNED'
          ELSE PR.pr_status
        END AS effectiveStatus
      FROM purchase_requests PR
      LEFT JOIN purchase_request_items PRI
        ON PRI.purchase_request_id=PR.purchase_request_id AND PRI.tenant_id=PR.tenant_id
      WHERE PR.tenant_id=?
      GROUP BY PR.purchase_request_id
    ) PR_SUMMARY
  `, [tenantId]);
  return rows[0] || {};
}

export async function getRequest(id, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`
    SELECT PR.*, SUP.supplier_name AS preferred_supplier_name, SUP.supplier_code AS preferred_supplier_code
    FROM purchase_requests PR
    LEFT JOIN supplier_master SUP ON SUP.supplier_id = PR.preferred_supplier_id
    WHERE PR.purchase_request_id = ? AND PR.tenant_id = ? ${lock ? "FOR UPDATE" : ""}
  `, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`
    SELECT PRI.*, I.item_code AS item_code FROM purchase_request_items PRI
    LEFT JOIN item_master I ON I.item_id = PRI.item_id
    WHERE PRI.purchase_request_id = ? AND PRI.tenant_id = ?
    ORDER BY PRI.line_number
  `, [Number(id), tenantId]);
  const [history] = await connection.execute(`
    SELECT * FROM purchase_request_item_approval_history
    WHERE purchase_request_id = ? AND tenant_id = ? ORDER BY performed_at, id
  `, [Number(id), tenantId]);
  return { ...headers[0], items, approvalHistory: history };
}

export async function updateDraft(connection, id, tenantId, values) {
  await connection.execute(`
    UPDATE purchase_requests SET plant_code=?, plant_id=?, floor_department=?, department_id=?,
      request_date=?, required_date=?, requisition_type=?, priority=?, preferred_supplier_id=?,
      quote_reference=?, remarks=?, updated_by=?
      WHERE purchase_request_id=? AND tenant_id=? AND pr_status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL','RETURNED','PARTIALLY_APPROVED','APPROVED')
  `, [...values, Number(id), tenantId]);
}
