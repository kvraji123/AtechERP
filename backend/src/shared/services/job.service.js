import { db } from "../../config/db.js";

export async function enqueueJob({ connection = db, tenantId, type, entityType, entityId, payload }) {
  const [result] = await connection.execute(
    `INSERT INTO purchase_outbox_job
       (tenant_id,job_type,entity_type,entity_id,payload)
     VALUES (?,?,?,?,?)`,
    [tenantId, type, entityType, Number(entityId), JSON.stringify(payload || {})]
  );
  return result.insertId;
}

export async function claimPendingJobs({ limit = 20 } = {}) {
  const [rows] = await db.execute(
    `SELECT * FROM purchase_outbox_job
     WHERE status='PENDING' AND available_at<=CURRENT_TIMESTAMP
     ORDER BY job_id LIMIT ${Math.min(Math.max(Number(limit) || 20, 1), 100)}`
  );
  return rows;
}
