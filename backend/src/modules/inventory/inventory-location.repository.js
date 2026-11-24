import { db } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

export async function listLocations(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT location_id AS locationId,
    LM.warehouse_name AS warehouseCode,LM.location_name AS binLocation,
    CONCAT(LM.warehouse_name,' / ',LM.location_name) AS label
    FROM location_master LM
    JOIN inventory_locations I ON I.tenant_id=LM.tenant_id
      AND I.warehouse_code=LM.warehouse_name AND I.bin_location=LM.location_name
    WHERE LM.tenant_id=? AND LM.active_flag='Y' AND I.active_flag='Y'
    ORDER BY LM.warehouse_name,LM.location_name`, [tenantId]);
  return rows;
}

export async function validateStorageLocation(connection, tenantId, value) {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError('Select a valid storage location.');
  const [rows] = await connection.execute(`SELECT location_id FROM inventory_locations
    WHERE tenant_id=? AND location_id=? AND active_flag='Y' FOR SHARE`, [tenantId,id]);
  if (!rows.length) throw new AppError('Storage location is inactive or unavailable.');
  return id;
}
