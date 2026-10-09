import { db } from "../../config/db.js";

export async function listComparisons({ tenantId, limit = 100, offset = 0 }) {
  const [rows] = await db.execute(
    `SELECT PE.purchase_enquiry_id AS enquiryId,PE.enquiry_number AS enquiryNumber,
       PE.enquiry_status AS status,PE.enquiry_date AS enquiryDate,PE.quote_due_date AS quoteDueDate,
       COALESCE(PE.updated_on,PE.created_on) AS lastUpdatedAt,
       PE.subject,GROUP_CONCAT(DISTINCT PR.pr_number ORDER BY PR.pr_number SEPARATOR ', ') AS prNumbers,
       COUNT(DISTINCT PEI.purchase_enquiry_item_id) AS itemCount,
       COUNT(DISTINCT SQ.supplier_quotation_id) AS quotationCount,
       COUNT(DISTINCT SQ.supplier_id) AS supplierCount
     FROM purchase_enquiries PE
     JOIN purchase_enquiry_items PEI ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id AND PEI.tenant_id=PE.tenant_id
     JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id
     JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id
     JOIN supplier_quotations SQ ON SQ.purchase_enquiry_id=PE.purchase_enquiry_id AND SQ.tenant_id=PE.tenant_id
       AND SQ.quotation_status NOT IN ('REJECTED','WITHDRAWN')
       AND SQ.revision_number=(SELECT MAX(rev.revision_number) FROM supplier_quotations rev WHERE rev.tenant_id=SQ.tenant_id AND rev.purchase_enquiry_id=SQ.purchase_enquiry_id AND rev.supplier_id=SQ.supplier_id)
     WHERE PE.tenant_id=?
       AND NOT EXISTS (
         SELECT 1
         FROM purchase_order_sources POS
         JOIN purchase_orders PO ON PO.purchase_order_id=POS.purchase_order_id AND PO.tenant_id=POS.tenant_id
         JOIN purchase_enquiry_items completedLine ON completedLine.purchase_request_item_id=POS.purchase_request_item_id AND completedLine.tenant_id=POS.tenant_id
         WHERE completedLine.purchase_enquiry_id=PE.purchase_enquiry_id
           AND PO.status NOT IN ('CANCELLED','REJECTED')
       )
     GROUP BY PE.purchase_enquiry_id
     ORDER BY COALESCE(PE.updated_on,PE.created_on) DESC,PE.purchase_enquiry_id DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [tenantId]
  );
  const [countRows] = await db.execute(
    `SELECT COUNT(DISTINCT PE.purchase_enquiry_id) AS total FROM purchase_enquiries PE
     JOIN supplier_quotations SQ ON SQ.purchase_enquiry_id=PE.purchase_enquiry_id AND SQ.tenant_id=PE.tenant_id
       AND SQ.quotation_status NOT IN ('REJECTED','WITHDRAWN')
     WHERE PE.tenant_id=?
       AND NOT EXISTS (
         SELECT 1
         FROM purchase_order_sources POS
         JOIN purchase_orders PO ON PO.purchase_order_id=POS.purchase_order_id AND PO.tenant_id=POS.tenant_id
         JOIN purchase_enquiry_items completedLine ON completedLine.purchase_request_item_id=POS.purchase_request_item_id AND completedLine.tenant_id=POS.tenant_id
         WHERE completedLine.purchase_enquiry_id=PE.purchase_enquiry_id
           AND PO.status NOT IN ('CANCELLED','REJECTED')
       )`,
    [tenantId]
  );
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getComparison(connection = db, tenantId, enquiryId) {
  const [headerRows] = await connection.execute(
    `SELECT purchase_enquiry_id AS enquiryId, enquiry_number AS enquiryNumber,
       enquiry_status AS status, enquiry_date AS enquiryDate, quote_due_date AS quoteDueDate,
       subject
     FROM purchase_enquiries
     WHERE purchase_enquiry_id=? AND tenant_id=?`,
    [Number(enquiryId), tenantId]
  );
  if (!headerRows[0]) return null;
  const [rows] = await connection.execute(
    `SELECT PEI.purchase_enquiry_item_id AS purchaseEnquiryItemId,
       PEI.line_number AS lineNumber, PEI.enquiry_quantity AS enquiryQuantity,
       PEI.uom_code AS uomCode, PEI.line_status AS lineStatus,
       PRI.purchase_request_item_id AS purchaseRequestItemId, PR.pr_number AS prNumber,
       PR.priority AS priority,PR.required_date AS requiredDate,PRI.approval_status AS approvalStatus,
       PRI.item_type_name AS itemType, PRI.item_description AS itemDescription,
       PRI.item_specification AS itemSpecification,
       SQ.supplier_quotation_id AS supplierQuotationId,
       SQ.supplier_quotation_number AS supplierQuotationNumber,
       SQ.quotation_status AS quotationStatus,
       SQ.supplier_id AS supplierId, C.supplier_code AS supplierCode,
       C.supplier_name AS supplierName,
       SQI.supplier_quotation_item_id AS supplierQuotationItemId,
       SQI.quote_response AS quoteResponse, SQI.quoted_quantity AS quotedQuantity,
       SQI.unit_price AS unitPrice, SQI.discount_amount AS discountAmount,
       SQI.tax_percent AS taxPercent, SQI.tax_amount AS taxAmount,
       SQI.freight_amount AS freightAmount, SQI.packing_amount AS packingAmount,
       SQI.other_charges_amount AS otherChargesAmount, SQI.total_amount AS totalAmount,
       SQI.delivery_date AS deliveryDate, SQI.delivery_lead_days AS deliveryLeadDays,
       SQI.payment_terms AS itemPaymentTerms, SQI.warranty_months AS warrantyMonths,
       SQI.quality_rating_snapshot AS qualityRating,SQI.comparison_score AS comparisonScore,
       SQI.recommended_flag AS recommendedFlag,
       PSS.purchase_supplier_selection_id AS selectionId,
       PSS.selected_quantity AS selectedQuantity, PSS.selection_reason AS selectionReason,
       PSS.manager_decision AS managerDecision
     FROM purchase_enquiry_items PEI
     JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id
     JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id
     JOIN purchase_enquiry_item_suppliers PEIS ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id
       AND PEIS.tenant_id=PEI.tenant_id AND PEIS.assignment_status IN ('ASSIGNED','SENT','REMINDER_SENT')
     LEFT JOIN supplier_quotations SQ ON SQ.purchase_enquiry_id=PEI.purchase_enquiry_id
       AND SQ.tenant_id=PEI.tenant_id AND SQ.supplier_id=PEIS.supplier_id
       AND SQ.quotation_status NOT IN ('REJECTED','WITHDRAWN')
       AND SQ.revision_number=(SELECT MAX(rev.revision_number) FROM supplier_quotations rev WHERE rev.tenant_id=SQ.tenant_id AND rev.purchase_enquiry_id=SQ.purchase_enquiry_id AND rev.supplier_id=SQ.supplier_id)
     LEFT JOIN supplier_quotation_items SQI ON SQI.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id AND SQI.supplier_quotation_id=SQ.supplier_quotation_id
     LEFT JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id
     LEFT JOIN purchase_supplier_selections PSS
       ON PSS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id
      AND PSS.supplier_quotation_item_id=SQI.supplier_quotation_item_id
      AND PSS.tenant_id=? AND PSS.manager_decision='SELECTED'
     WHERE PEI.purchase_enquiry_id=? AND PEI.tenant_id=?
     ORDER BY PEI.line_number, C.supplier_name, SQ.supplier_quotation_id`,
    [tenantId, Number(enquiryId), tenantId]
  );
  return { ...headerRows[0], rows };
}

export async function getSelectedLines(connection, tenantId, enquiryId) {
  const [rows] = await connection.execute(
    `SELECT PSS.purchase_enquiry_item_id AS purchaseEnquiryItemId,
       PRI.purchase_request_item_id AS purchaseRequestItemId,
       PSS.supplier_id AS supplierId, PSS.selected_quantity AS assignedQuantity,
       SQI.unit_price AS unitPrice, SQI.discount_amount AS discountAmount,
       SQI.tax_percent AS taxPercent, SQI.freight_amount AS freightAmount,
       SQI.packing_amount AS packingAmount, SQI.other_charges_amount AS otherChargesAmount,
       SQI.delivery_date AS deliveryDate, SQI.payment_terms AS paymentTerms,
       SQI.delivery_lead_days AS deliveryLeadDays, SQI.warranty_months AS warrantyMonths,
       SQ.currency_code AS currencyCode
     FROM purchase_supplier_selections PSS
     JOIN supplier_quotation_items SQI ON SQI.supplier_quotation_item_id=PSS.supplier_quotation_item_id
     JOIN supplier_quotations SQ ON SQ.supplier_quotation_id=SQI.supplier_quotation_id
     JOIN purchase_enquiry_items PEI ON PEI.purchase_enquiry_item_id=PSS.purchase_enquiry_item_id
     JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id
     WHERE PSS.tenant_id=? AND PEI.tenant_id=? AND PEI.purchase_enquiry_id=?
       AND PSS.manager_decision='SELECTED' AND SQI.quote_response='QUOTED'`,
    [tenantId, tenantId, Number(enquiryId)]
  );
  return rows;
}

export async function getLinesForUpdate(connection, tenantId, enquiryId, ids) {
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `SELECT PEI.purchase_enquiry_item_id AS purchaseEnquiryItemId,
       PEI.enquiry_quantity AS enquiryQuantity, PEI.line_status AS lineStatus,
       PRI.purchase_request_item_id AS purchaseRequestItemId,
       PRI.purchase_request_id AS requestId, PRI.approval_status AS approvalStatus,
       PRI.approved_quantity AS approvedQuantity
     FROM purchase_enquiry_items PEI
     JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id
     WHERE PEI.tenant_id=? AND PEI.purchase_enquiry_id=?
       AND PEI.purchase_enquiry_item_id IN (${placeholders}) FOR UPDATE`,
    [tenantId, Number(enquiryId), ...ids]
  );
  return rows;
}

export async function clearSelections(connection, tenantId, itemIds, userCode) {
  const placeholders = itemIds.map(() => "?").join(",");
  await connection.execute(
    `UPDATE purchase_supplier_selections SET manager_decision='CANCELLED', updated_by=?
     WHERE tenant_id=? AND purchase_enquiry_item_id IN (${placeholders})
       AND manager_decision='SELECTED'`,
    [userCode, tenantId, ...itemIds]
  );
}

export async function insertSelection(connection, values) {
  await connection.execute(
    `INSERT INTO purchase_supplier_selections
       (tenant_id,purchase_enquiry_item_id,supplier_quotation_item_id,supplier_id,
        selected_quantity,selection_reason,manager_decision,selected_by)
     VALUES (?,?,?,?,?,?, 'SELECTED',?)
     ON DUPLICATE KEY UPDATE
       supplier_id=VALUES(supplier_id),
       selected_quantity=VALUES(selected_quantity),
       selection_reason=VALUES(selection_reason),
       manager_decision='SELECTED',
       selected_by=VALUES(selected_by),
       selected_on=CURRENT_TIMESTAMP,
       updated_by=VALUES(selected_by)`,
    values
  );
}

export async function updateLineStatus(connection, tenantId, itemId, status, userCode) {
  await connection.execute(
    `UPDATE purchase_enquiry_items SET line_status=?,updated_by=?
     WHERE purchase_enquiry_item_id=? AND tenant_id=?`,
    [status, userCode, Number(itemId), tenantId]
  );
}

export async function updateEnquiryStatus(connection, tenantId, enquiryId) {
  await connection.execute(
    `UPDATE purchase_enquiries SET enquiry_status=CASE
       WHEN EXISTS (SELECT 1 FROM purchase_enquiry_items WHERE purchase_enquiry_id=? AND tenant_id=? AND line_status='SELECTED') THEN 'CLOSED'
       ELSE enquiry_status END, updated_by='SYSTEM'
     WHERE purchase_enquiry_id=? AND tenant_id=?`,
    [Number(enquiryId), tenantId, Number(enquiryId), tenantId]
  );
}
