import { db } from "../../config/db.js";

const like = (value) => `%${String(value || "").trim()}%`;

export async function listSources(connection = db, includeInactive = false) {
  const [rows] = await connection.execute(`SELECT source_code AS sourceCode,
    source_name AS sourceName,costing_mode AS costingMode,display_order AS displayOrder,
    active_flag AS activeFlag FROM operation_source_master
    WHERE (?='Y' OR active_flag='Y') ORDER BY display_order,source_name`,
  [includeInactive ? "Y" : "N"]);
  return rows;
}

export async function getSource(connection, sourceCode) {
  const [rows] = await connection.execute(`SELECT source_code AS sourceCode,
    source_name AS sourceName,costing_mode AS costingMode,active_flag AS activeFlag
    FROM operation_source_master WHERE source_code=?`, [sourceCode]);
  return rows[0] || null;
}

export async function listOperations({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT O.operation_master_id AS operationMasterId,
    O.operation_code AS operationCode,O.operation_name AS operationName,
    O.default_source AS defaultSource,S.source_name AS sourceName,S.costing_mode AS costingMode,
    O.display_order AS displayOrder,O.active_flag AS activeFlag,
    COALESCE(O.updated_on,O.created_on) AS lastUpdated
    FROM operation_master O LEFT JOIN operation_source_master S ON S.source_code=O.default_source
    WHERE (?='' OR O.operation_code LIKE ? OR O.operation_name LIKE ?)
      AND (?='' OR O.active_flag=?)
    ORDER BY COALESCE(O.updated_on,O.created_on) DESC,O.operation_master_id DESC`,
  [String(search).trim(),like(search),like(search),status,status]);
  return rows;
}

export async function findOperationConflict(connection, { operationMasterId = 0, operationCode, operationName }) {
  const [rows] = await connection.execute(`SELECT operation_master_id AS operationMasterId
    FROM operation_master WHERE operation_master_id<>? AND
    (UPPER(operation_code)=UPPER(?) OR UPPER(operation_name)=UPPER(?)) LIMIT 1`,
  [operationMasterId,operationCode,operationName]);
  return rows[0] || null;
}

export async function insertOperation(connection, data) {
  const [result] = await connection.execute(`INSERT INTO operation_master
    (operation_code,operation_name,default_source,display_order,active_flag)
    VALUES (?,?,?,?,?)`, [data.operationCode,data.operationName,data.defaultSource,
    data.displayOrder,data.activeFlag]);
  return result.insertId;
}

export async function updateOperation(connection, operationMasterId, data) {
  const [result] = await connection.execute(`UPDATE operation_master SET operation_code=?,
    operation_name=?,default_source=?,display_order=?,active_flag=? WHERE operation_master_id=?`,
  [data.operationCode,data.operationName,data.defaultSource,data.displayOrder,data.activeFlag,operationMasterId]);
  return result.affectedRows;
}

export async function listInstruments({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT instrument_master_id AS instrumentMasterId,
    instrument_code AS instrumentCode,instrument_name AS instrumentName,active_flag AS activeFlag,
    COALESCE(updated_on,created_on) AS lastUpdated
    FROM inspection_instrument_master
    WHERE (?='' OR instrument_code LIKE ? OR instrument_name LIKE ?)
      AND (?='' OR active_flag=?) ORDER BY COALESCE(updated_on,created_on) DESC,instrument_master_id DESC`,
  [String(search).trim(),like(search),like(search),status,status]);
  return rows;
}

export async function findInstrumentConflict(connection, { instrumentMasterId = 0, instrumentCode, instrumentName }) {
  const [rows] = await connection.execute(`SELECT instrument_master_id AS instrumentMasterId
    FROM inspection_instrument_master WHERE instrument_master_id<>? AND
    (UPPER(instrument_code)=UPPER(?) OR UPPER(instrument_name)=UPPER(?)) LIMIT 1`,
  [instrumentMasterId,instrumentCode,instrumentName]);
  return rows[0] || null;
}

export async function insertInstrument(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inspection_instrument_master
    (instrument_code,instrument_name,active_flag) VALUES (?,?,?)`,
  [data.instrumentCode,data.instrumentName,data.activeFlag]);
  return result.insertId;
}

export async function updateInstrument(connection, instrumentMasterId, data) {
  const [result] = await connection.execute(`UPDATE inspection_instrument_master SET
    instrument_code=?,instrument_name=?,active_flag=? WHERE instrument_master_id=?`,
  [data.instrumentCode,data.instrumentName,data.activeFlag,instrumentMasterId]);
  return result.affectedRows;
}

export async function listDepartments({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT department_id AS departmentId,
    department_code AS departmentCode,department_name AS departmentName,
    display_order AS displayOrder,active_flag AS activeFlag,
    COALESCE(updated_on,created_on) AS lastUpdated
    FROM department_master
    WHERE (?='' OR department_code LIKE ? OR department_name LIKE ?)
      AND (?='' OR active_flag=?)
    ORDER BY display_order,department_name,department_id`,
  [String(search).trim(),like(search),like(search),status,status]);
  return rows;
}

export async function findDepartmentConflict(connection, { departmentId = 0, departmentCode, departmentName }) {
  const [rows] = await connection.execute(`SELECT department_id AS departmentId
    FROM department_master WHERE department_id<>? AND
      (UPPER(department_code)=UPPER(?) OR UPPER(department_name)=UPPER(?)) LIMIT 1`,
  [departmentId,departmentCode,departmentName]);
  return rows[0] || null;
}

export async function insertDepartment(connection, data) {
  const [result] = await connection.execute(`INSERT INTO department_master
    (department_code,department_name,display_order,active_flag) VALUES (?,?,?,?)`,
  [data.departmentCode,data.departmentName,data.displayOrder,data.activeFlag]);
  return result.insertId;
}

export async function updateDepartment(connection, departmentId, data) {
  const [result] = await connection.execute(`UPDATE department_master SET department_code=?,
    department_name=?,display_order=?,active_flag=? WHERE department_id=?`,
  [data.departmentCode,data.departmentName,data.displayOrder,data.activeFlag,departmentId]);
  return result.affectedRows;
}

export async function getActiveDepartmentByName(connection, departmentName) {
  const [rows] = await connection.execute(`SELECT department_id AS departmentId,
    department_code AS departmentCode,department_name AS departmentName
    FROM department_master WHERE active_flag='Y' AND UPPER(department_name)=UPPER(?) LIMIT 1`,
  [String(departmentName || "").trim()]);
  return rows[0] || null;
}

export async function listToleranceGrades({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT tolerance_grade_id AS toleranceGradeId,
    grade_code AS gradeCode,basic_size_from AS basicSizeFrom,basic_size_to AS basicSizeTo,
    lower_deviation_microns AS lowerDeviationMicrons,
    upper_deviation_microns AS upperDeviationMicrons,active_flag AS activeFlag,
    COALESCE(updated_on,created_on) AS lastUpdated
    FROM tolerance_grade_master WHERE (?='' OR grade_code LIKE ?)
      AND (?='' OR active_flag=?) ORDER BY COALESCE(updated_on,created_on) DESC,tolerance_grade_id DESC`,
  [String(search).trim(),like(search),status,status]);
  return rows;
}

export async function findToleranceConflict(connection, { toleranceGradeId = 0, gradeCode,
  basicSizeFrom,basicSizeTo }) {
  const [rows] = await connection.execute(`SELECT tolerance_grade_id AS toleranceGradeId
    FROM tolerance_grade_master WHERE tolerance_grade_id<>? AND UPPER(grade_code)=UPPER(?)
      AND basic_size_from=? AND basic_size_to=? LIMIT 1`,
  [toleranceGradeId,gradeCode,basicSizeFrom,basicSizeTo]);
  return rows[0] || null;
}

export async function insertToleranceGrade(connection, data) {
  const [result] = await connection.execute(`INSERT INTO tolerance_grade_master
    (grade_code,basic_size_from,basic_size_to,lower_deviation_microns,
     upper_deviation_microns,active_flag) VALUES (?,?,?,?,?,?)`,
  [data.gradeCode,data.basicSizeFrom,data.basicSizeTo,data.lowerDeviationMicrons,
    data.upperDeviationMicrons,data.activeFlag]);
  return result.insertId;
}

export async function updateToleranceGrade(connection, toleranceGradeId, data) {
  const [result] = await connection.execute(`UPDATE tolerance_grade_master SET grade_code=?,
    basic_size_from=?,basic_size_to=?,lower_deviation_microns=?,upper_deviation_microns=?,
    active_flag=? WHERE tolerance_grade_id=?`,
  [data.gradeCode,data.basicSizeFrom,data.basicSizeTo,data.lowerDeviationMicrons,
    data.upperDeviationMicrons,data.activeFlag,toleranceGradeId]);
  return result.affectedRows;
}

export async function listInspectionCharacteristics({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT characteristic_master_id AS characteristicMasterId,
    characteristic_code AS characteristicCode,characteristic_name AS characteristicName,
    characteristic_type AS characteristicType,active_flag AS activeFlag
    FROM inspection_characteristic_master
    WHERE (?='' OR characteristic_code LIKE ? OR characteristic_name LIKE ?)
      AND (?='' OR active_flag=?)
    ORDER BY characteristic_name,characteristic_master_id`,
  [String(search).trim(),like(search),like(search),status,status]);
  return rows;
}

export async function findInspectionCharacteristicConflict(connection, { characteristicMasterId = 0, characteristicCode, characteristicName }) {
  const [rows] = await connection.execute(`SELECT characteristic_master_id AS characteristicMasterId
    FROM inspection_characteristic_master WHERE characteristic_master_id<>? AND
    (UPPER(characteristic_code)=UPPER(?) OR UPPER(characteristic_name)=UPPER(?)) LIMIT 1`,
  [characteristicMasterId,characteristicCode,characteristicName]);
  return rows[0] || null;
}

export async function insertInspectionCharacteristic(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inspection_characteristic_master
    (characteristic_code,characteristic_name,characteristic_type,active_flag) VALUES (?,?,?,?)`,
  [data.characteristicCode,data.characteristicName,data.characteristicType,data.activeFlag]);
  return result.insertId;
}

export async function updateInspectionCharacteristic(connection, characteristicMasterId, data) {
  const [result] = await connection.execute(`UPDATE inspection_characteristic_master SET
    characteristic_code=?,characteristic_name=?,characteristic_type=?,active_flag=? WHERE characteristic_master_id=?`,
  [data.characteristicCode,data.characteristicName,data.characteristicType,data.activeFlag,characteristicMasterId]);
  return result.affectedRows;
}

export async function listInspectionFrequencies({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT frequency_id AS frequencyId,frequency_code AS frequencyCode,
    frequency_label AS frequencyLabel,display_order AS displayOrder,active_flag AS activeFlag
    FROM inspection_frequency_master
    WHERE (?='' OR frequency_code LIKE ? OR frequency_label LIKE ?)
      AND (?='' OR active_flag=?)
    ORDER BY display_order,frequency_label,frequency_id`,
  [String(search).trim(),like(search),like(search),status,status]);
  return rows;
}

export async function findInspectionFrequencyConflict(connection, { frequencyId = 0, frequencyCode, frequencyLabel }) {
  const [rows] = await connection.execute(`SELECT frequency_id AS frequencyId
    FROM inspection_frequency_master WHERE frequency_id<>? AND
    (UPPER(frequency_code)=UPPER(?) OR UPPER(frequency_label)=UPPER(?)) LIMIT 1`,
  [frequencyId,frequencyCode,frequencyLabel]);
  return rows[0] || null;
}

export async function insertInspectionFrequency(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inspection_frequency_master
    (frequency_code,frequency_label,display_order,active_flag) VALUES (?,?,?,?)`,
  [data.frequencyCode,data.frequencyLabel,data.displayOrder,data.activeFlag]);
  return result.insertId;
}

export async function updateInspectionFrequency(connection, frequencyId, data) {
  const [result] = await connection.execute(`UPDATE inspection_frequency_master SET
    frequency_code=?,frequency_label=?,display_order=?,active_flag=? WHERE frequency_id=?`,
  [data.frequencyCode,data.frequencyLabel,data.displayOrder,data.activeFlag,frequencyId]);
  return result.affectedRows;
}

export async function listRejectionDispositions({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT rejection_disposition_id AS rejectionDispositionId,
    disposition_code AS dispositionCode,disposition_name AS dispositionName,
    party_action AS partyAction,stock_action AS stockAction,active_flag AS activeFlag,
    COALESCE(updated_at,created_at) AS lastUpdated
    FROM rejection_disposition_master
    WHERE (?='' OR disposition_code LIKE ? OR disposition_name LIKE ?)
      AND (?='' OR active_flag=?) ORDER BY COALESCE(updated_at,created_at) DESC,rejection_disposition_id DESC`,
  [String(search).trim(),like(search),like(search),status,status]);
  return rows;
}

export async function getRejectionDisposition(connection, rejectionDispositionId) {
  const [rows] = await connection.execute(`SELECT rejection_disposition_id AS rejectionDispositionId,
    disposition_code AS dispositionCode,disposition_name AS dispositionName,
    party_action AS partyAction,stock_action AS stockAction,active_flag AS activeFlag
    FROM rejection_disposition_master WHERE rejection_disposition_id=?`,[Number(rejectionDispositionId)]);
  return rows[0] || null;
}

export async function findRejectionDispositionConflict(connection, { rejectionDispositionId = 0, dispositionCode, dispositionName }) {
  const [rows] = await connection.execute(`SELECT rejection_disposition_id AS rejectionDispositionId
    FROM rejection_disposition_master WHERE rejection_disposition_id<>? AND
    (UPPER(disposition_code)=UPPER(?) OR UPPER(disposition_name)=UPPER(?)) LIMIT 1`,
  [rejectionDispositionId,dispositionCode,dispositionName]);
  return rows[0] || null;
}

export async function insertRejectionDisposition(connection, data) {
  const [result] = await connection.execute(`INSERT INTO rejection_disposition_master
    (disposition_code,disposition_name,party_action,stock_action,active_flag) VALUES (?,?,?,?,?)`,
  [data.dispositionCode,data.dispositionName,data.partyAction,data.stockAction,data.activeFlag]);
  return result.insertId;
}

export async function updateRejectionDisposition(connection, rejectionDispositionId, data) {
  const [result] = await connection.execute(`UPDATE rejection_disposition_master SET disposition_code=?,
    disposition_name=?,party_action=?,stock_action=?,active_flag=? WHERE rejection_disposition_id=?`,
  [data.dispositionCode,data.dispositionName,data.partyAction,data.stockAction,data.activeFlag,rejectionDispositionId]);
  return result.affectedRows;
}

export async function listRejectionReasons({ search = "", status = "" } = {}, connection = db) {
  const [rows] = await connection.execute(`SELECT R.rejection_reason_id AS rejectionReasonId,
    R.reason_code AS reasonCode,R.reason_name AS reasonName,R.reason_category AS reasonCategory,
    R.applicable_receipt_types AS applicableReceiptTypes,R.default_disposition_id AS defaultDispositionId,
    D.disposition_code AS defaultDispositionCode,D.disposition_name AS defaultDispositionName,
    R.require_remarks AS requireRemarks,R.require_attachment AS requireAttachment,R.active_flag AS activeFlag,
    COALESCE(R.updated_at,R.created_at) AS lastUpdated
    FROM rejection_reason_master R
    LEFT JOIN rejection_disposition_master D ON D.rejection_disposition_id=R.default_disposition_id
    WHERE (?='' OR R.reason_code LIKE ? OR R.reason_name LIKE ? OR R.reason_category LIKE ?)
      AND (?='' OR R.active_flag=?) ORDER BY COALESCE(R.updated_at,R.created_at) DESC,R.rejection_reason_id DESC`,
  [String(search).trim(),like(search),like(search),like(search),status,status]);
  return rows;
}

export async function findRejectionReasonConflict(connection, { rejectionReasonId = 0, reasonCode, reasonName }) {
  const [rows] = await connection.execute(`SELECT rejection_reason_id AS rejectionReasonId
    FROM rejection_reason_master WHERE rejection_reason_id<>? AND
    (UPPER(reason_code)=UPPER(?) OR UPPER(reason_name)=UPPER(?)) LIMIT 1`,
  [rejectionReasonId,reasonCode,reasonName]);
  return rows[0] || null;
}

export async function insertRejectionReason(connection, data) {
  const [result] = await connection.execute(`INSERT INTO rejection_reason_master
    (reason_code,reason_name,reason_category,applicable_receipt_types,default_disposition_id,
     require_remarks,require_attachment,active_flag) VALUES (?,?,?,?,?,?,?,?)`,
  [data.reasonCode,data.reasonName,data.reasonCategory,data.applicableReceiptTypes,
    data.defaultDispositionId || null,data.requireRemarks,data.requireAttachment,data.activeFlag]);
  return result.insertId;
}

export async function updateRejectionReason(connection, rejectionReasonId, data) {
  const [result] = await connection.execute(`UPDATE rejection_reason_master SET reason_code=?,reason_name=?,
    reason_category=?,applicable_receipt_types=?,default_disposition_id=?,require_remarks=?,
    require_attachment=?,active_flag=? WHERE rejection_reason_id=?`,
  [data.reasonCode,data.reasonName,data.reasonCategory,data.applicableReceiptTypes,
    data.defaultDispositionId || null,data.requireRemarks,data.requireAttachment,data.activeFlag,rejectionReasonId]);
  return result.affectedRows;
}
