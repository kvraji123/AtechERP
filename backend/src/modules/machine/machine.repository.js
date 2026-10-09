import { db } from "../../config/db.js";

const integer = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

export async function listMachines(filters = {}) {
  const search = String(filters.search || "").trim();
  const status = ["ACTIVE", "INACTIVE"].includes(String(filters.status || "").toUpperCase())
    ? String(filters.status).toUpperCase() : "";
  const limit = integer(filters.limit, 20, 1, 100);
  const offset = integer(filters.offset, 0);
  const parameters = [search, search, search, search, search, status, status];
  const [rows] = await db.execute(`
    SELECT MM.machine_master_id AS machineMasterId,MM.item_id AS itemId,
      I.item_code AS itemCode,I.item_description AS machineName,
      I.make_name AS makeName,I.model_name AS modelName,I.machine_capacity AS machineCapacity,
      MT.machine_type_code AS machineTypeCode,MT.machine_type_name AS machineTypeName,
      MT.hourly_cost_inr AS hourlyCostInr,
      MM.other_specification AS otherSpecification,MM.machine_status AS machineStatus,
      COUNT(MU.machine_unit_id) AS numberOfMachines,
      GROUP_CONCAT(MU.machine_code ORDER BY MU.machine_code SEPARATOR ', ') AS machineCodes,
      COALESCE(MAX(MU.updated_on),MM.updated_on,MM.created_on) AS lastUpdated
    FROM machine_master MM
    JOIN item_master I ON I.item_id=MM.item_id
    JOIN machine_type_master MT ON MT.machine_type_id=I.machine_type_id
    LEFT JOIN machine_unit MU ON MU.machine_master_id=MM.machine_master_id
    WHERE (?='' OR I.item_code LIKE CONCAT('%',?,'%') OR I.item_description LIKE CONCAT('%',?,'%')
      OR I.make_name LIKE CONCAT('%',?,'%') OR I.model_name LIKE CONCAT('%',?,'%'))
      AND (?='' OR MM.machine_status=?)
    GROUP BY MM.machine_master_id,MM.item_id,I.item_code,I.item_description,I.make_name,I.model_name,
      I.machine_capacity,MT.machine_type_code,MT.machine_type_name,MT.hourly_cost_inr,
      MM.other_specification,MM.machine_status,MM.updated_on,MM.created_on
    ORDER BY lastUpdated DESC,MM.machine_master_id DESC
    LIMIT ${limit} OFFSET ${offset}`, parameters);
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM machine_master MM
    JOIN item_master I ON I.item_id=MM.item_id
    WHERE (?='' OR I.item_code LIKE CONCAT('%',?,'%') OR I.item_description LIKE CONCAT('%',?,'%')
      OR I.make_name LIKE CONCAT('%',?,'%') OR I.model_name LIKE CONCAT('%',?,'%'))
      AND (?='' OR MM.machine_status=?)`, parameters);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getEligibleItems(connection = db) {
  const [rows] = await connection.query(`SELECT I.item_id AS itemId,I.item_code AS itemCode,
    I.item_description AS machineName,I.make_name AS makeName,I.model_name AS modelName,
    I.machine_capacity AS machineCapacity,I.machine_type_id AS machineTypeId,
    MT.machine_type_code AS machineTypeCode,MT.machine_type_name AS machineTypeName,
    MT.hourly_cost_inr AS hourlyCostInr,
    MM.machine_master_id AS linkedMachineMasterId
    FROM item_master I
    JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='CA'
    JOIN item_type_master IT ON IT.item_type_id=I.item_type_id AND IT.type_name='Machines & Equipment'
    LEFT JOIN machine_type_master MT ON MT.machine_type_id=I.machine_type_id
    LEFT JOIN machine_master MM ON MM.item_id=I.item_id
    WHERE I.active_flag='Y' ORDER BY I.item_description,I.item_code`);
  return rows;
}

export async function getSourceItem(connection, itemId) {
  const [rows] = await connection.execute(`SELECT I.item_id AS itemId,I.item_code AS itemCode,
    I.item_description AS machineName,I.make_name AS makeName,I.model_name AS modelName,
    I.machine_capacity AS machineCapacity,I.machine_type_id AS machineTypeId,
    MT.machine_type_code AS machineTypeCode,MT.machine_type_name AS machineTypeName,
    MT.hourly_cost_inr AS hourlyCostInr
    FROM item_master I
    JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='CA'
    JOIN item_type_master IT ON IT.item_type_id=I.item_type_id AND IT.type_name='Machines & Equipment'
    LEFT JOIN machine_type_master MT ON MT.machine_type_id=I.machine_type_id AND MT.active_flag='Y'
    WHERE I.item_id=? AND I.active_flag='Y'`, [itemId]);
  return rows[0] || null;
}

export async function getMachineById(machineMasterId, connection = db) {
  const [rows] = await connection.execute(`SELECT MM.machine_master_id AS machineMasterId,
    MM.item_id AS itemId,I.item_code AS itemCode,I.item_description AS machineName,
    I.make_name AS makeName,I.model_name AS modelName,I.machine_capacity AS machineCapacity,
    MT.machine_type_code AS machineTypeCode,MT.machine_type_name AS machineTypeName,
    MT.hourly_cost_inr AS hourlyCostInr,
    MM.other_specification AS otherSpecification,MM.machine_status AS machineStatus,
    MM.created_on AS createdOn,MM.updated_on AS updatedOn
    FROM machine_master MM JOIN item_master I ON I.item_id=MM.item_id
    JOIN machine_type_master MT ON MT.machine_type_id=I.machine_type_id
    WHERE MM.machine_master_id=?`, [machineMasterId]);
  if (!rows[0]) return null;
  const [units] = await connection.execute(`SELECT machine_unit_id AS machineUnitId,
    machine_code AS machineCode,serial_number AS serialNumber,installation_date AS installationDate,
    plant_location AS plantLocation,department_name AS departmentName,unit_status AS unitStatus,
    remarks FROM machine_unit WHERE machine_master_id=? ORDER BY machine_unit_id`, [machineMasterId]);
  return { ...rows[0], numberOfMachines: units.length, units };
}

export async function findByItemId(connection, itemId) {
  const [rows] = await connection.execute(`SELECT machine_master_id AS machineMasterId
    FROM machine_master WHERE item_id=?`, [itemId]);
  return rows[0] || null;
}

export async function findConflictingUnitCodes(connection, machineCodes, excludeMachineMasterId = 0) {
  if (!machineCodes.length) return [];
  const placeholders = machineCodes.map(() => "?").join(",");
  const [rows] = await connection.execute(`SELECT machine_code AS machineCode FROM machine_unit
    WHERE UPPER(machine_code) IN (${placeholders}) AND (?=0 OR machine_master_id<>?)`,
    [...machineCodes.map((code) => code.toUpperCase()), excludeMachineMasterId, excludeMachineMasterId]);
  return rows;
}

export async function insertMachine(connection, data, userCode) {
  const [result] = await connection.execute(`INSERT INTO machine_master
    (item_id,other_specification,machine_status,active_flag,created_by)
    VALUES (?,?,?,?,?)`, [data.itemId,data.otherSpecification,data.machineStatus,
    data.machineStatus === "ACTIVE" ? "Y" : "N",userCode]);
  return result.insertId;
}

export async function updateMachine(connection, machineMasterId, data, userCode) {
  await connection.execute(`UPDATE machine_master SET other_specification=?,machine_status=?,
    active_flag=?,updated_by=? WHERE machine_master_id=?`, [data.otherSpecification,data.machineStatus,
    data.machineStatus === "ACTIVE" ? "Y" : "N",userCode,machineMasterId]);
}

export async function updateMachineTypeHourlyCost(connection, machineTypeId, hourlyCostInr, userCode) {
  await connection.execute(`UPDATE machine_type_master SET hourly_cost_inr=?,updated_by=?
    WHERE machine_type_id=?`, [hourlyCostInr,userCode,machineTypeId]);
}

export async function replaceUnits(connection, machineMasterId, units, userCode) {
  const [existingRows] = await connection.execute(`SELECT machine_unit_id AS machineUnitId
    FROM machine_unit WHERE machine_master_id=?`, [machineMasterId]);
  const existingIds = new Set(existingRows.map((row) => Number(row.machineUnitId)));
  const submittedIds = units.map((unit) => Number(unit.machineUnitId || 0)).filter(Boolean);
  if (submittedIds.some((id) => !existingIds.has(id))) {
    throw new Error("One or more Machine Unit rows do not belong to this Machine Master record.");
  }
  for (const unit of units) {
    if (unit.machineUnitId) {
      await connection.execute(`UPDATE machine_unit SET machine_code=?,serial_number=?,installation_date=?,
        plant_location=?,department_name=?,unit_status=?,remarks=?,updated_by=?
        WHERE machine_unit_id=? AND machine_master_id=?`, [unit.machineCode,unit.serialNumber,
        unit.installationDate,unit.plantLocation,unit.departmentName,unit.unitStatus,unit.remarks,
        userCode,unit.machineUnitId,machineMasterId]);
    } else {
      await connection.execute(`INSERT INTO machine_unit
        (machine_master_id,machine_code,serial_number,installation_date,plant_location,
         department_name,unit_status,remarks,created_by)
        VALUES (?,?,?,?,?,?,?,?,?)`, [machineMasterId,unit.machineCode,unit.serialNumber,
        unit.installationDate,unit.plantLocation,unit.departmentName,unit.unitStatus,unit.remarks,userCode]);
    }
  }
  const removedIds = [...existingIds].filter((id) => !submittedIds.includes(id));
  if (removedIds.length) {
    const placeholders = removedIds.map(() => "?").join(",");
    await connection.execute(`DELETE FROM machine_unit WHERE machine_master_id=?
      AND machine_unit_id IN (${placeholders})`, [machineMasterId,...removedIds]);
  }
}

export async function deleteMachine(machineMasterId) {
  const [result] = await db.execute(`DELETE FROM machine_master WHERE machine_master_id=?`, [machineMasterId]);
  return result.affectedRows;
}
