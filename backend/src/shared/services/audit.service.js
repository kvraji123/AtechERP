import { db } from "../../config/db.js";

export async function recordAudit({ connection = db, tenantId, module, entityType, entityId, action, oldValue = null, newValue = null, performedBy, ipAddress = null, remarks = null }) {
  await connection.execute(`
    INSERT INTO audit_log
      (tenant_id, module, entity_type, entity_id, action, old_value, new_value, performed_by, ip_address, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [tenantId, module, entityType, String(entityId), action,
    oldValue === null ? null : JSON.stringify(oldValue), newValue === null ? null : JSON.stringify(newValue),
    performedBy, ipAddress, remarks]);
}
