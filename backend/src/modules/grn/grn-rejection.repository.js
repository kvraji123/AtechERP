import { db } from "../../config/db.js";

export async function getActiveReason(connection, rejectionReasonId) {
  const [rows] = await connection.execute(`SELECT R.rejection_reason_id AS rejectionReasonId,
    R.reason_code AS reasonCode,R.reason_name AS reasonName,R.reason_category AS reasonCategory,
    R.applicable_receipt_types AS applicableReceiptTypes,R.default_disposition_id AS defaultDispositionId,
    R.require_remarks AS requireRemarks,R.require_attachment AS requireAttachment,
    D.disposition_code AS defaultDispositionCode,D.disposition_name AS defaultDispositionName
    FROM rejection_reason_master R
    LEFT JOIN rejection_disposition_master D ON D.rejection_disposition_id=R.default_disposition_id
    WHERE R.rejection_reason_id=? AND R.active_flag='Y'`, [Number(rejectionReasonId)]);
  return rows[0] || null;
}

export async function getActiveDisposition(connection, rejectionDispositionId) {
  const [rows] = await connection.execute(`SELECT rejection_disposition_id AS rejectionDispositionId,
    disposition_code AS dispositionCode,disposition_name AS dispositionName,
    party_action AS partyAction,stock_action AS stockAction
    FROM rejection_disposition_master
    WHERE rejection_disposition_id=? AND active_flag='Y'`, [Number(rejectionDispositionId)]);
  return rows[0] || null;
}

export async function upsertRecord(connection, data) {
  await connection.execute(`INSERT INTO grn_rejection_records
    (tenant_id,grn_id,grn_item_id,receipt_type,responsible_party,supplier_id,customer_id,
     rejection_reason_id,rejection_reason_code_snapshot,rejection_reason_name_snapshot,
     rejection_disposition_id,rejection_disposition_code_snapshot,rejection_disposition_name_snapshot,
     rejected_quantity,uom_code_snapshot,quality_remarks,attachment_reference,status,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'OPEN',?,?)
    ON DUPLICATE KEY UPDATE receipt_type=VALUES(receipt_type),responsible_party=VALUES(responsible_party),
     supplier_id=VALUES(supplier_id),customer_id=VALUES(customer_id),rejection_reason_id=VALUES(rejection_reason_id),
     rejection_reason_code_snapshot=VALUES(rejection_reason_code_snapshot),
     rejection_reason_name_snapshot=VALUES(rejection_reason_name_snapshot),
     rejection_disposition_id=VALUES(rejection_disposition_id),
     rejection_disposition_code_snapshot=VALUES(rejection_disposition_code_snapshot),
     rejection_disposition_name_snapshot=VALUES(rejection_disposition_name_snapshot),
     rejected_quantity=VALUES(rejected_quantity),uom_code_snapshot=VALUES(uom_code_snapshot),
     quality_remarks=VALUES(quality_remarks),attachment_reference=VALUES(attachment_reference),status='OPEN',
     updated_by=VALUES(updated_by),closed_by=NULL,closed_at=NULL`,
  [data.tenantId,data.grnId,data.grnItemId,data.receiptType,data.responsibleParty,data.supplierId || null,
    data.customerId || null,data.reason.rejectionReasonId,data.reason.reasonCode,data.reason.reasonName,
    data.disposition.rejectionDispositionId,data.disposition.dispositionCode,data.disposition.dispositionName,
    data.rejectedQuantity,data.uomCode,data.qualityRemarks || null,data.attachmentReference || null,
    data.userCode,data.userCode]);
  const [rows] = await connection.execute(`SELECT grn_rejection_id AS grnRejectionId
    FROM grn_rejection_records WHERE tenant_id=? AND grn_item_id=?`,[data.tenantId,Number(data.grnItemId)]);
  return rows[0] || null;
}

export async function cancelOpenRecord(connection, tenantId, grnItemId, userCode) {
  await connection.execute(`UPDATE grn_rejection_records SET status='CANCELLED',closed_by=?,
    closed_at=CURRENT_TIMESTAMP,updated_by=? WHERE tenant_id=? AND grn_item_id=? AND status='OPEN'`,
  [userCode,userCode,tenantId,Number(grnItemId)]);
}

export async function countAttachments(connection, tenantId, grnId, grnItemId) {
  const [[row]] = await connection.execute(`SELECT COUNT(*) AS attachmentCount FROM grn_rejection_attachments
    WHERE tenant_id=? AND grn_id=? AND grn_item_id=?`,[tenantId,Number(grnId),Number(grnItemId)]);
  return Number(row?.attachmentCount || 0);
}

export async function listAttachments(connection = db, tenantId, grnId, grnItemId = null) {
  const params = [tenantId,Number(grnId)];
  let itemClause = "";
  if (grnItemId !== null) { itemClause = " AND grn_item_id=?"; params.push(Number(grnItemId)); }
  const [rows] = await connection.execute(`SELECT grn_rejection_attachment_id AS rejectionAttachmentId,
    grn_item_id AS grnItemId,file_name AS fileName,mime_type AS mimeType,file_size_bytes AS fileSizeBytes,
    uploaded_by AS uploadedBy,uploaded_at AS uploadedAt,
    CONCAT('/uploads/',REPLACE(file_path,'\\\\','/')) AS fileUrl
    FROM grn_rejection_attachments WHERE tenant_id=? AND grn_id=?${itemClause}
    ORDER BY grn_rejection_attachment_id`,params);
  return rows;
}

export async function insertAttachment(connection, data) {
  const relativePath = `marketing/grn-rejections/${data.file.filename}`;
  const [result] = await connection.execute(`INSERT INTO grn_rejection_attachments
    (tenant_id,grn_id,grn_item_id,file_name,stored_file_name,file_path,mime_type,file_size_bytes,uploaded_by)
    VALUES (?,?,?,?,?,?,?,?,?)`,
  [data.tenantId,data.grnId,data.grnItemId,data.file.originalname,data.file.filename,relativePath,
    data.file.mimetype || null,Number(data.file.size || 0),data.userCode]);
  const [rows] = await connection.execute(`SELECT grn_rejection_attachment_id AS rejectionAttachmentId,
    grn_item_id AS grnItemId,file_name AS fileName,mime_type AS mimeType,file_size_bytes AS fileSizeBytes,
    uploaded_by AS uploadedBy,uploaded_at AS uploadedAt,
    CONCAT('/uploads/',REPLACE(file_path,'\\\\','/')) AS fileUrl
    FROM grn_rejection_attachments WHERE grn_rejection_attachment_id=?`,[result.insertId]);
  return rows[0] || null;
}

export async function getAttachment(connection, tenantId, grnId, grnItemId, attachmentId) {
  const [rows] = await connection.execute(`SELECT * FROM grn_rejection_attachments
    WHERE grn_rejection_attachment_id=? AND tenant_id=? AND grn_id=? AND grn_item_id=?`,
  [Number(attachmentId),tenantId,Number(grnId),Number(grnItemId)]);
  return rows[0] || null;
}

export async function deleteAttachment(connection, attachmentId) {
  await connection.execute(`DELETE FROM grn_rejection_attachments WHERE grn_rejection_attachment_id=?`,[Number(attachmentId)]);
}

export async function listByGrn(connection = db, tenantId, grnId) {
  const [rows] = await connection.execute(`SELECT R.grn_rejection_id AS grnRejectionId,
    R.grn_item_id AS grnItemId,R.receipt_type AS receiptType,R.responsible_party AS responsibleParty,
    R.rejection_reason_code_snapshot AS reasonCode,R.rejection_reason_name_snapshot AS reasonName,
    R.rejection_disposition_code_snapshot AS dispositionCode,
    R.rejection_disposition_name_snapshot AS dispositionName,R.rejected_quantity AS rejectedQuantity,
    R.uom_code_snapshot AS uomCode,R.quality_remarks AS qualityRemarks,
    R.attachment_reference AS attachmentReference,R.status,R.created_at AS createdAt,
    (SELECT COUNT(*) FROM grn_rejection_attachments A
      WHERE A.tenant_id=R.tenant_id AND A.grn_item_id=R.grn_item_id) AS attachmentCount,
    GI.item_description_snapshot AS itemName
    FROM grn_rejection_records R
    JOIN goods_receipt_note_items GI ON GI.grn_item_id=R.grn_item_id
    WHERE R.tenant_id=? AND R.grn_id=? ORDER BY R.grn_rejection_id`, [tenantId,Number(grnId)]);
  return rows;
}
