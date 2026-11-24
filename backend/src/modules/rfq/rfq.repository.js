import { db } from "../../config/db.js";

export async function approvedLines(connection, tenantId, ids) {
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `SELECT PRI.*,PR.purchase_request_id AS requestId,PR.pr_number AS prNumber,PR.required_date AS requestRequiredDate
     FROM purchase_request_items PRI JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id
     WHERE PRI.tenant_id=? AND PR.tenant_id=? AND PRI.purchase_request_item_id IN (${placeholders})
       AND PRI.approval_status='APPROVED' AND PR.requisition_type='NEW_ITEM'
       AND PR.pr_status IN ('APPROVED','PARTIALLY_APPROVED')`,
    [tenantId, tenantId, ...ids]
  );
  return rows;
}

export async function insertHeader(connection, values) { const [result] = await connection.execute(`INSERT INTO purchase_enquiries (tenant_id,company_id,enquiry_number,financial_year,enquiry_date,quote_due_date,subject,delivery_required_by,delivery_location,commercial_terms,notes,enquiry_status,remarks,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values); return result.insertId; }
export async function insertRequest(connection, values) { await connection.execute(`INSERT INTO purchase_enquiry_requests (tenant_id,purchase_enquiry_id,purchase_request_id,created_by) VALUES (?,?,?,?)`, values); }
export async function insertItem(connection, values) { const [result] = await connection.execute(`INSERT INTO purchase_enquiry_items (tenant_id,purchase_enquiry_id,purchase_request_item_id,line_number,enquiry_quantity,uom_code,enquiry_required,line_status,created_by) VALUES (?,?,?,?,?,?, 'Y','READY',?)`, values); return result.insertId; }
export async function insertSupplier(connection, values) { await connection.execute(`INSERT INTO purchase_enquiry_item_suppliers (tenant_id,purchase_enquiry_item_id,supplier_id,supplier_email,assigned_by) VALUES (?,?,?,?,?)`, values); }
export async function getSupplier(connection, supplierId) { const [rows] = await connection.execute(`SELECT supplier_id AS supplierId,supplier_code AS supplierCode,supplier_name AS supplierName,email_address AS supplierEmail FROM supplier_master WHERE supplier_id=? AND active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'`, [supplierId]); return rows[0] || null; }
export async function upsertDocument(connection, values) { await connection.execute(`INSERT INTO purchase_rfq_documents (tenant_id,purchase_enquiry_id,supplier_id,file_name,file_url,file_size_bytes,generated_at,generated_by) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,?) ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_url=VALUES(file_url),file_size_bytes=VALUES(file_size_bytes),generated_at=CURRENT_TIMESTAMP,generated_by=VALUES(generated_by)`, values); }
export async function listDocuments(id, tenantId, connection = db) { const [rows] = await connection.execute(`SELECT D.rfq_document_id AS rfqDocumentId,D.supplier_id AS supplierId,C.supplier_code AS supplierCode,C.supplier_name AS supplierName,D.file_name AS fileName,D.file_url AS fileUrl,D.file_size_bytes AS fileSizeBytes,D.generated_at AS generatedAt FROM purchase_rfq_documents D JOIN supplier_master C ON C.supplier_id=D.supplier_id WHERE D.purchase_enquiry_id=? AND D.tenant_id=? ORDER BY C.supplier_name`, [Number(id), tenantId]); return rows; }

export async function list({ tenantId, search = "", status = "", limit = 20, offset = 0 }) {
  const params = [tenantId, search, search, search, status, status];
  const [rows] = await db.execute(
    `SELECT PE.purchase_enquiry_id AS id,PE.enquiry_number AS enquiryNumber,PE.enquiry_date AS enquiryDate,PE.quote_due_date AS quoteDueDate,PE.subject,PE.enquiry_status AS status,COALESCE(PE.updated_on,PE.created_on) AS lastUpdatedAt,COUNT(DISTINCT PEIS.supplier_id) AS supplierCount,COUNT(DISTINCT PEI.purchase_enquiry_item_id) AS itemCount
     FROM purchase_enquiries PE LEFT JOIN purchase_enquiry_items PEI ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id LEFT JOIN purchase_enquiry_item_suppliers PEIS ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id
     WHERE PE.tenant_id=? AND (?='' OR PE.enquiry_number LIKE CONCAT('%',?, '%') OR PE.subject LIKE CONCAT('%',?, '%')) AND (?='' OR PE.enquiry_status=?)
     GROUP BY PE.purchase_enquiry_id ORDER BY COALESCE(PE.updated_on,PE.created_on) DESC,PE.purchase_enquiry_id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  const [countRows] = await db.execute(`SELECT COUNT(*) total FROM purchase_enquiries PE WHERE PE.tenant_id=? AND (?='' OR PE.enquiry_number LIKE CONCAT('%',?, '%') OR PE.subject LIKE CONCAT('%',?, '%')) AND (?='' OR PE.enquiry_status=?)`, params);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

// A tracking record is supplier-specific: it combines RFQ assignment, the latest
// queued/delivered email job, and that supplier's latest received quotation.
export async function listTracking({ tenantId, search = "", supplier = "", limit = 100, offset = 0 }) {
  const params = [tenantId, search, search, search, search, supplier, supplier];
  const [rows] = await db.execute(
    `SELECT PE.purchase_enquiry_id AS enquiryId,PE.enquiry_number AS enquiryNumber,PE.enquiry_date AS enquiryDate,PE.quote_due_date AS quoteDueDate,PE.subject,PE.delivery_required_by AS deliveryRequiredBy,PE.delivery_location AS deliveryLocation,PE.commercial_terms AS commercialTerms,PE.notes,PE.enquiry_status AS enquiryStatus,COALESCE(PE.updated_on,PE.created_on) AS lastUpdatedAt,
       C.supplier_id AS supplierId,C.supplier_name AS supplierName,C.supplier_code AS supplierCode,C.email_address AS supplierEmail,MAX(PEIS.sent_on) AS sentOn,
       GROUP_CONCAT(DISTINCT PR.pr_number ORDER BY PR.pr_number SEPARATOR ', ') AS prNumbers,COUNT(DISTINCT PEI.purchase_enquiry_item_id) AS itemCount,GROUP_CONCAT(DISTINCT COALESCE(PRI.item_description,PRI.item_type_name) ORDER BY PEI.line_number SEPARATOR ', ') AS itemSummary,
       SQ.supplier_quotation_id AS supplierQuotationId,SQ.supplier_quotation_number AS supplierQuotationNumber,SQ.quotation_status AS quotationStatus,SQ.received_on AS quotationReceivedOn,COUNT(DISTINCT CASE WHEN SQI.quote_response='QUOTED' THEN SQI.supplier_quotation_item_id END) AS quotedItemCount,
       COALESCE(CASE EMAIL.status WHEN 'SENT' THEN 'COMPLETED' ELSE EMAIL.status END,JOB.status) AS emailJobStatus,COALESCE(EMAIL.created_at,JOB.created_at) AS emailQueuedAt,COALESCE(EMAIL.sent_at,JOB.completed_at) AS emailCompletedAt,COALESCE(EMAIL.last_error,JOB.last_error) AS emailLastError
     FROM purchase_enquiries PE
     JOIN purchase_enquiry_items PEI ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id AND PEI.tenant_id=PE.tenant_id
     JOIN purchase_enquiry_item_suppliers PEIS ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id AND PEIS.tenant_id=PE.tenant_id
     JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id
     JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id
     JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id
     LEFT JOIN supplier_quotations SQ ON SQ.supplier_quotation_id=(SELECT latestSQ.supplier_quotation_id FROM supplier_quotations latestSQ WHERE latestSQ.tenant_id=PE.tenant_id AND latestSQ.purchase_enquiry_id=PE.purchase_enquiry_id AND latestSQ.supplier_id=C.supplier_id ORDER BY latestSQ.revision_number DESC,latestSQ.supplier_quotation_id DESC LIMIT 1)
     LEFT JOIN supplier_quotation_items SQI ON SQI.supplier_quotation_id=SQ.supplier_quotation_id
     LEFT JOIN purchase_rfq_email_outbox EMAIL ON EMAIL.email_outbox_id=(SELECT latestEmail.email_outbox_id FROM purchase_rfq_email_outbox latestEmail WHERE latestEmail.tenant_id=PE.tenant_id AND latestEmail.purchase_enquiry_id=PE.purchase_enquiry_id AND latestEmail.supplier_id=C.supplier_id ORDER BY latestEmail.email_outbox_id DESC LIMIT 1)
     LEFT JOIN purchase_outbox_job JOB ON JOB.job_id=(SELECT latestJob.job_id FROM purchase_outbox_job latestJob WHERE latestJob.tenant_id=PE.tenant_id AND latestJob.entity_type='RFQ' AND latestJob.entity_id=PE.purchase_enquiry_id AND latestJob.job_type='RFQ_EMAIL' ORDER BY latestJob.job_id DESC LIMIT 1)
     WHERE PE.tenant_id=? AND (?='' OR PE.enquiry_number LIKE CONCAT('%',?, '%') OR PR.pr_number LIKE CONCAT('%',?, '%') OR C.supplier_name LIKE CONCAT('%',?, '%')) AND (?='' OR C.supplier_name=?)
     GROUP BY PE.purchase_enquiry_id,C.supplier_id,SQ.supplier_quotation_id,EMAIL.email_outbox_id,JOB.job_id
     ORDER BY COALESCE(PE.updated_on,PE.created_on) DESC,PE.purchase_enquiry_id DESC,C.supplier_id DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM (SELECT PE.purchase_enquiry_id,C.supplier_id FROM purchase_enquiries PE JOIN purchase_enquiry_items PEI ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id AND PEI.tenant_id=PE.tenant_id JOIN purchase_enquiry_item_suppliers PEIS ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id AND PEIS.tenant_id=PE.tenant_id JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id WHERE PE.tenant_id=? AND (?='' OR PE.enquiry_number LIKE CONCAT('%',?, '%') OR PR.pr_number LIKE CONCAT('%',?, '%') OR C.supplier_name LIKE CONCAT('%',?, '%')) AND (?='' OR C.supplier_name=?) GROUP BY PE.purchase_enquiry_id,C.supplier_id) tracking`,
    params
  );
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function trackingSummary(tenantId) {
  const [rows] = await db.execute(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(supplierQuotationId IS NOT NULL AND quotedItemCount>=itemCount), 0) AS quotesReceived
    FROM (
      SELECT
        PE.purchase_enquiry_id AS enquiryId,
        C.supplier_id AS supplierId,
        SQ.supplier_quotation_id AS supplierQuotationId,
        COUNT(DISTINCT PEI.purchase_enquiry_item_id) AS itemCount,
        COUNT(DISTINCT CASE WHEN SQI.quote_response='QUOTED' THEN SQI.supplier_quotation_item_id END) AS quotedItemCount
      FROM purchase_enquiries PE
      JOIN purchase_enquiry_items PEI
        ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id AND PEI.tenant_id=PE.tenant_id
      JOIN purchase_enquiry_item_suppliers PEIS
        ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id AND PEIS.tenant_id=PE.tenant_id
      JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id
      LEFT JOIN supplier_quotations SQ ON SQ.supplier_quotation_id=(
        SELECT latestSQ.supplier_quotation_id
        FROM supplier_quotations latestSQ
        WHERE latestSQ.tenant_id=PE.tenant_id
          AND latestSQ.purchase_enquiry_id=PE.purchase_enquiry_id
          AND latestSQ.supplier_id=C.supplier_id
        ORDER BY latestSQ.revision_number DESC, latestSQ.supplier_quotation_id DESC
        LIMIT 1
      )
      LEFT JOIN supplier_quotation_items SQI ON SQI.supplier_quotation_id=SQ.supplier_quotation_id
      WHERE PE.tenant_id=?
      GROUP BY PE.purchase_enquiry_id, C.supplier_id, SQ.supplier_quotation_id
    ) TRACKING
  `, [tenantId]);
  return rows[0] || {};
}

export async function listTrackingSupplierOptions(tenantId) {
  const [rows] = await db.execute(`SELECT DISTINCT C.supplier_name AS supplierName
    FROM purchase_enquiries PE
    JOIN purchase_enquiry_items PEI
      ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id AND PEI.tenant_id=PE.tenant_id
    JOIN purchase_enquiry_item_suppliers PEIS
      ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id AND PEIS.tenant_id=PE.tenant_id
    JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id
    WHERE PE.tenant_id=? AND COALESCE(TRIM(C.supplier_name),'')<>''
    ORDER BY supplierName`, [tenantId]);
  return rows.map((row) => row.supplierName);
}

export async function get(id, tenantId, connection = db) {
  const [headers] = await connection.execute(`SELECT * FROM purchase_enquiries WHERE purchase_enquiry_id=? AND tenant_id=?`, [Number(id), tenantId]); if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT PEI.*,PRI.item_id,PRI.item_type_name,PRI.item_description,PRI.item_specification,PR.pr_number,PR.required_date FROM purchase_enquiry_items PEI JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id JOIN purchase_requests PR ON PR.purchase_request_id=PRI.purchase_request_id WHERE PEI.purchase_enquiry_id=? AND PEI.tenant_id=? ORDER BY PEI.line_number`, [Number(id), tenantId]);
  const [suppliers] = await connection.execute(`SELECT PEIS.*,C.supplier_code AS supplierCode,C.supplier_name AS supplierName,C.email_address AS supplierEmail FROM purchase_enquiry_item_suppliers PEIS JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id WHERE PEIS.tenant_id=? AND PEIS.purchase_enquiry_item_id IN (SELECT purchase_enquiry_item_id FROM purchase_enquiry_items WHERE purchase_enquiry_id=?)`, [tenantId, Number(id)]);
  const documents = await listDocuments(id, tenantId, connection);
  return { ...headers[0], items, suppliers, documents };
}

export async function setSent(connection, id, tenantId, userCode) { await connection.execute(`UPDATE purchase_enquiries SET enquiry_status='SENT',updated_by=? WHERE purchase_enquiry_id=? AND tenant_id=? AND enquiry_status IN ('DRAFT','SENT')`, [userCode, Number(id), tenantId]); await connection.execute(`UPDATE purchase_enquiry_item_suppliers SET assignment_status='SENT',sent_on=CURRENT_TIMESTAMP,updated_by=? WHERE tenant_id=? AND purchase_enquiry_item_id IN (SELECT purchase_enquiry_item_id FROM purchase_enquiry_items WHERE purchase_enquiry_id=?)`, [userCode, tenantId, Number(id)]); }
