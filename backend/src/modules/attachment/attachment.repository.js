import { db } from "../../config/db.js";

export async function list(entityType, entityId, tenantId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT attachment_id AS attachmentId, entity_type AS entityType, entity_id AS entityId,
            attachment_type AS attachmentType, attachment_name AS attachmentName,
            file_name AS fileName, stored_file_name AS storedFileName,
            CONCAT('/uploads/', REPLACE(file_path, '\\\\', '/')) AS fileUrl,
            mime_type AS mimeType, file_size_bytes AS fileSizeBytes,
            created_by AS createdBy, created_on AS createdOn
       FROM application_attachments
      WHERE tenant_id=? AND entity_type=? AND entity_id=? AND active_flag='Y'
      ORDER BY attachment_id`,
    [tenantId, entityType, Number(entityId)]
  );
  return rows;
}

export async function insert(data, connection = db) {
  const [result] = await connection.execute(
    `INSERT INTO application_attachments (
       tenant_id,entity_type,entity_id,attachment_type,attachment_name,
       file_name,stored_file_name,file_path,mime_type,file_size_bytes,created_by
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.tenantId,
      data.entityType,
      Number(data.entityId),
      data.attachmentType,
      data.attachmentName,
      data.fileName,
      data.storedFileName,
      data.filePath,
      data.mimeType,
      data.fileSizeBytes,
      data.createdBy,
    ]
  );
  const rows = await list(data.entityType, data.entityId, data.tenantId, connection);
  return rows.find((row) => Number(row.attachmentId) === Number(result.insertId));
}

export async function get(attachmentId, entityType, entityId, tenantId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT * FROM application_attachments
      WHERE attachment_id=? AND tenant_id=? AND entity_type=? AND entity_id=? AND active_flag='Y'`,
    [Number(attachmentId), tenantId, entityType, Number(entityId)]
  );
  return rows[0] || null;
}

export async function update(attachmentId, data, connection = db) {
  await connection.execute(
    `UPDATE application_attachments
        SET attachment_type=?, attachment_name=?
      WHERE attachment_id=?`,
    [data.attachmentType, data.attachmentName, Number(attachmentId)]
  );
}

export async function remove(attachmentId, connection = db) {
  await connection.execute(
    "UPDATE application_attachments SET active_flag='N' WHERE attachment_id=?",
    [Number(attachmentId)]
  );
}
