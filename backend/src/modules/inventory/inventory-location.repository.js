import { db } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

export async function listLocations(tenantId, connection = db) {
  const [rows] = await connection.execute(`SELECT location_id AS locationId,
    warehouse_code AS warehouseCode,bin_location AS binLocation,
    CONCAT(warehouse_code,' / ',bin_location) AS label
    FROM inventory_locations WHERE tenant_id=? AND active_flag='Y'
    ORDER BY warehouse_code,bin_location`, [tenantId]);
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
