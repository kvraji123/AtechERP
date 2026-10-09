import { db, withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const htmlEscape = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const dateText = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "Not specified";

function composeEmail(source) {
  const subject = `Request for Quotation - ${source.enquiryNumber}`;
  const items = source.items.map((item) => `${item.lineNumber}. ${item.itemDescription}${item.specification ? ` — ${item.specification}` : ""} | ${item.quantity} ${item.uom}`).join("\n");
  const terms = String(source.commercialTerms || "").trim();
  const notes = String(source.notes || "").trim();
  const text = [
    `Dear ${source.supplierName},`, "", `Please submit your quotation for RFQ ${source.enquiryNumber}.`,
    `Quotation due date: ${dateText(source.quoteDueDate)}`,
    source.deliveryRequiredBy ? `Delivery required by: ${dateText(source.deliveryRequiredBy)}` : "",
    source.deliveryLocation ? `Delivery location: ${source.deliveryLocation}` : "", "", "Items requested:", items,
    terms ? `\nCommercial terms requested:\n${terms}` : "",
    notes ? `\nNotes:\n${notes}` : "", "", "Regards,", "Atech Automation Purchase Team",
  ].filter(Boolean).join("\n");
  const itemRows = source.items.map((item) => `<tr><td>${item.lineNumber}</td><td>${htmlEscape(item.itemDescription)}${item.specification ? `<br><small>${htmlEscape(item.specification)}</small>` : ""}</td><td>${htmlEscape(item.quantity)}</td><td>${htmlEscape(item.uom)}</td></tr>`).join("");
  const html = `<p>Dear ${htmlEscape(source.supplierName)},</p><p>Please submit your quotation for <strong>RFQ ${htmlEscape(source.enquiryNumber)}</strong>.</p><p><strong>Quotation due date:</strong> ${htmlEscape(dateText(source.quoteDueDate))}${source.deliveryRequiredBy ? `<br><strong>Delivery required by:</strong> ${htmlEscape(dateText(source.deliveryRequiredBy))}` : ""}${source.deliveryLocation ? `<br><strong>Delivery location:</strong> ${htmlEscape(source.deliveryLocation)}` : ""}</p><p><strong>Items requested</strong></p><table border="1" cellpadding="7" cellspacing="0"><thead><tr><th>#</th><th>Item / specification</th><th>Quantity</th><th>UOM</th></tr></thead><tbody>${itemRows}</tbody></table>${terms ? `<p><strong>Commercial terms requested</strong><br>${htmlEscape(terms).replace(/\n/g, "<br>")}</p>` : ""}${notes ? `<p><strong>Notes</strong><br>${htmlEscape(notes).replace(/\n/g, "<br>")}</p>` : ""}<p>Regards,<br>Atech Automation Purchase Team</p>`;
  return { subject, text, html };
}

async function getEmailSources(connection, tenantId, enquiryId) {
  const [rows] = await connection.execute(
    `SELECT PE.enquiry_number AS enquiryNumber, PE.quote_due_date AS quoteDueDate, PE.subject, PE.delivery_required_by AS deliveryRequiredBy, PE.delivery_location AS deliveryLocation, PE.commercial_terms AS commercialTerms, PE.notes,
       C.supplier_id AS supplierId, C.supplier_name AS supplierName, COALESCE(PEIS.supplier_email,C.email_address) AS supplierEmail,
       PEI.line_number AS lineNumber, PRI.item_description AS itemDescription, PRI.item_specification AS specification, PEI.enquiry_quantity AS quantity, PEI.uom_code AS uom
     FROM purchase_enquiries PE
     JOIN purchase_enquiry_items PEI ON PEI.purchase_enquiry_id=PE.purchase_enquiry_id AND PEI.tenant_id=PE.tenant_id
     JOIN purchase_enquiry_item_suppliers PEIS ON PEIS.purchase_enquiry_item_id=PEI.purchase_enquiry_item_id AND PEIS.tenant_id=PE.tenant_id
     JOIN supplier_master C ON C.supplier_id=PEIS.supplier_id
     JOIN purchase_request_items PRI ON PRI.purchase_request_item_id=PEI.purchase_request_item_id
     WHERE PE.tenant_id=? AND PE.purchase_enquiry_id=? AND PEIS.assignment_status IN ('ASSIGNED','SENT')
     ORDER BY C.supplier_id, PEI.line_number`,
    [tenantId, Number(enquiryId)]
  );
  const bySupplier = new Map();
  for (const row of rows) {
    const current = bySupplier.get(row.supplierId) || { ...row, items: [] };
    current.items.push(row);
    bySupplier.set(row.supplierId, current);
  }
  return [...bySupplier.values()];
}

export async function queueRfqEmails(connection, { tenantId, enquiryId, userCode }) {
  const sources = await getEmailSources(connection, tenantId, enquiryId);
  if (!sources.length) throw new AppError("No assigned suppliers are available for this RFQ.", 409);
  const invalid = sources.filter((source) => !emailPattern.test(String(source.supplierEmail || "").trim()));
  if (invalid.length) throw new AppError(`A valid email address is required for: ${invalid.map((source) => source.supplierName).join(", ")}.`, 409);
  for (const source of sources) {
    const message = composeEmail(source);
    await connection.execute(
      `INSERT INTO purchase_rfq_email_outbox
       (tenant_id,purchase_enquiry_id,supplier_id,recipient_email,recipient_name,subject,text_body,html_body,created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [tenantId, Number(enquiryId), source.supplierId, source.supplierEmail.trim(), source.supplierName, message.subject, message.text, message.html, userCode]
    );
  }
  return sources.length;
}

export async function listEmailOutbox(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 100);
  const search = String(query.search || "").trim();
  const status = String(query.status || "").trim().toUpperCase();
  const params = [user.tenantId, search, search, search, search, status, status];
  const [rows] = await db.execute(
    `SELECT O.email_outbox_id AS emailOutboxId, O.purchase_enquiry_id AS enquiryId, PE.enquiry_number AS enquiryNumber, C.supplier_name AS supplierName, O.recipient_email AS recipientEmail, O.subject, O.status, O.attempts, O.available_at AS availableAt, O.sent_at AS sentAt, O.message_id AS messageId, O.last_error AS lastError, O.created_at AS createdAt, COALESCE(O.updated_at,O.sent_at,O.created_at) AS lastUpdatedAt,
       D.file_name AS rfqPdfFileName, D.file_url AS rfqPdfUrl
     FROM purchase_rfq_email_outbox O
     JOIN purchase_enquiries PE ON PE.purchase_enquiry_id=O.purchase_enquiry_id
     JOIN supplier_master C ON C.supplier_id=O.supplier_id
     LEFT JOIN purchase_rfq_documents D ON D.purchase_enquiry_id=O.purchase_enquiry_id AND D.supplier_id=O.supplier_id AND D.tenant_id=O.tenant_id
     WHERE O.tenant_id=? AND (?='' OR PE.enquiry_number LIKE CONCAT('%',?, '%') OR C.supplier_name LIKE CONCAT('%',?, '%') OR O.recipient_email LIKE CONCAT('%',?, '%')) AND (?='' OR O.status=?)
     ORDER BY COALESCE(O.updated_at,O.sent_at,O.created_at) DESC, O.email_outbox_id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params
  );
  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM purchase_rfq_email_outbox O JOIN purchase_enquiries PE ON PE.purchase_enquiry_id=O.purchase_enquiry_id JOIN supplier_master C ON C.supplier_id=O.supplier_id WHERE O.tenant_id=? AND (?='' OR PE.enquiry_number LIKE CONCAT('%',?, '%') OR C.supplier_name LIKE CONCAT('%',?, '%') OR O.recipient_email LIKE CONCAT('%',?, '%')) AND (?='' OR O.status=?)`,
    params
  );
  return { rows, total: Number(countRows[0]?.total || 0), page, pageSize };
}

export async function retryEmailOutbox(id, user) {
  const [result] = await db.execute(
    `UPDATE purchase_rfq_email_outbox SET status='PENDING', available_at=CURRENT_TIMESTAMP, locked_at=NULL, last_error=NULL WHERE email_outbox_id=? AND tenant_id=? AND status='FAILED'`,
    [Number(id), user.tenantId]
  );
  if (!result.affectedRows) throw new AppError("Only failed RFQ emails can be retried.", 409);
}

export async function claimPendingEmail() {
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT * FROM purchase_rfq_email_outbox WHERE status='PENDING' AND available_at<=CURRENT_TIMESTAMP ORDER BY email_outbox_id LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const row = rows[0];
    if (!row) return null;
    await connection.execute(`UPDATE purchase_rfq_email_outbox SET status='PROCESSING', attempts=attempts+1, locked_at=CURRENT_TIMESTAMP WHERE email_outbox_id=?`, [row.email_outbox_id]);
    return { ...row, attempts: Number(row.attempts || 0) + 1 };
  });
}

export async function recoverStaleEmailClaims() {
  await db.execute(
    `UPDATE purchase_rfq_email_outbox SET status='PENDING', locked_at=NULL, available_at=CURRENT_TIMESTAMP, last_error='Delivery worker restarted before the previous attempt completed.' WHERE status='PROCESSING' AND locked_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)`
  );
}

export async function markEmailSent(id, messageId) {
  await db.execute(`UPDATE purchase_rfq_email_outbox SET status='SENT', sent_at=CURRENT_TIMESTAMP, message_id=?, last_error=NULL WHERE email_outbox_id=?`, [messageId || null, Number(id)]);
}

export async function markEmailFailed(id, error) {
  await db.execute(`UPDATE purchase_rfq_email_outbox SET status='FAILED', last_error=? WHERE email_outbox_id=?`, [String(error || "SMTP delivery failed.").slice(0, 2000), Number(id)]);
}
