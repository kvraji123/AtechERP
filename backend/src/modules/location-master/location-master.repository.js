import { db } from "../../config/db.js";

const like = (value) => `%${String(value || "").trim()}%`;

export async function listLocations({ tenantId, search = "", status = "" }, connection = db) {
  const [rows] = await connection.execute(
    `SELECT location_master_id AS locationMasterId,
      warehouse_name AS warehouseName,sub_inventory_code AS subinventoryCode,
      location_name AS locationName,active_flag AS activeFlag,
      COALESCE(updated_at,created_at) AS lastUpdated
     FROM location_master
     WHERE tenant_id=?
       AND (?='' OR warehouse_name LIKE ? OR location_name LIKE ?)
       AND (?='' OR active_flag=?)
     ORDER BY warehouse_name,location_name,location_master_id`,
    [tenantId, String(search).trim(), like(search), like(search), status, status]
  );
  return rows;
}

export async function listWarehouseNames(tenantId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT warehouse_name AS warehouseName
     FROM location_master
     WHERE tenant_id=? AND active_flag='Y'
     ORDER BY warehouse_name`,
    [tenantId]
  );
  return rows;
}

export async function listSubinventories(tenantId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT subinventory_code AS subinventoryCode,subinventory_name AS subinventoryName
     FROM inventory_subinventory_master
     WHERE tenant_id=? AND active_flag='Y'
     ORDER BY subinventory_name`,
    [tenantId]
  );
  return rows;
}

export async function getLocation(connection, { tenantId, locationMasterId }) {
  const [rows] = await connection.execute(
    `SELECT location_master_id AS locationMasterId,warehouse_name AS warehouseName,
      sub_inventory_code AS subinventoryCode,location_name AS locationName,active_flag AS activeFlag
     FROM location_master
     WHERE tenant_id=? AND location_master_id=? FOR UPDATE`,
    [tenantId, Number(locationMasterId)]
  );
  return rows[0] || null;
}

export async function findConflict(connection, { tenantId, locationMasterId = 0, warehouseName, locationName }) {
  const [rows] = await connection.execute(
    `SELECT location_master_id AS locationMasterId
     FROM location_master
     WHERE tenant_id=? AND location_master_id<>?
       AND UPPER(warehouse_name)=UPPER(?) AND UPPER(location_name)=UPPER(?)
     LIMIT 1`,
    [tenantId, Number(locationMasterId), warehouseName, locationName]
  );
  return rows[0] || null;
}

export async function insertLocation(connection, { tenantId, warehouseName, subinventoryCode, locationName, activeFlag, userCode }) {
  const [result] = await connection.execute(
    `INSERT INTO location_master
      (tenant_id,warehouse_name,sub_inventory_code,location_name,active_flag,created_by)
     VALUES (?,?,?,?,?,?)`,
    [tenantId, warehouseName, subinventoryCode, locationName, activeFlag, userCode]
  );
  return result.insertId;
}

export async function updateLocation(connection, { tenantId, locationMasterId, warehouseName, subinventoryCode, locationName, activeFlag, userCode }) {
  const [result] = await connection.execute(
    `UPDATE location_master
     SET warehouse_name=?,sub_inventory_code=?,location_name=?,active_flag=?,updated_by=?,updated_at=CURRENT_TIMESTAMP
     WHERE tenant_id=? AND location_master_id=?`,
    [warehouseName, subinventoryCode, locationName, activeFlag, userCode, tenantId, Number(locationMasterId)]
  );
  return result.affectedRows;
}

export async function syncInventoryLocation(connection, { tenantId, warehouseName, locationName, activeFlag, previous }) {
  if (previous && (previous.warehouseName !== warehouseName || previous.locationName !== locationName)) {
    const [updated] = await connection.execute(
      `UPDATE inventory_locations
       SET warehouse_code=?,bin_location=?,active_flag=?
       WHERE tenant_id=? AND warehouse_code=? AND bin_location=?`,
      [warehouseName, locationName, activeFlag, tenantId, previous.warehouseName, previous.locationName]
    );
    if (updated.affectedRows) return;
  }
  await connection.execute(
    `INSERT INTO inventory_locations (tenant_id,warehouse_code,bin_location,active_flag)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE active_flag=VALUES(active_flag)`,
    [tenantId, warehouseName, locationName, activeFlag]
  );
}
