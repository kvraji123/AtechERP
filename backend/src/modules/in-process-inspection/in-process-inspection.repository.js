import { db } from "../../config/db.js";

const dbConnection = (connection) => connection || db;

export async function listAvailableParts(tenantId, connection) {
  const [rows] = await dbConnection(connection).execute(`SELECT DISTINCT
      P.part_id AS partId,P.part_number AS partNumber,P.part_name AS partName,P.unit_of_measurement AS uomCode
    FROM part_master P
    WHERE P.active_flag='Y'
      AND P.part_status='ACTIVE'
      AND COALESCE(P.save_status,'SUBMITTED')='SUBMITTED'
    ORDER BY P.part_number`, []);
  return rows;
}

export async function listPartProcessPlans(partId, connection) {
  const [plans] = await dbConnection(connection).execute(`SELECT PP.process_plan_id AS processPlanId,
      PP.plan_code AS planCode,PP.route_name AS routeName,PP.is_default AS isDefault,
      PO.process_operation_id AS processOperationId,PO.operation_number AS operationNumber,
      COALESCE(OM.operation_name,D.operation_description,CONCAT('Operation ',PO.operation_number)) AS operationName,
      D.source_type AS sourceType,COUNT(PIC.inspection_characteristic_id) AS characteristicCount
    FROM part_process_plan PP
    JOIN part_process_operation PO ON PO.process_plan_id=PP.process_plan_id
    LEFT JOIN part_process_definition D ON D.process_definition_id=PO.process_definition_id
    LEFT JOIN operation_master OM ON OM.operation_master_id=D.operation_master_id
    JOIN part_operation_inspection_plan IP ON IP.process_operation_id=PO.process_operation_id AND IP.plan_status='READY'
    JOIN part_inspection_characteristic PIC ON PIC.inspection_plan_id=IP.inspection_plan_id
    WHERE PP.part_id=? AND PP.plan_status='APPROVED' AND PP.active_flag='Y'
    GROUP BY PP.process_plan_id,PP.plan_code,PP.route_name,PP.is_default,PO.process_operation_id,
      PO.operation_number,OM.operation_name,D.operation_description,D.source_type
    ORDER BY PP.is_default DESC,PP.process_plan_id,PO.operation_number`, [Number(partId)]);
  return plans;
}

export async function getOperationSetup(connection, { partId, processPlanId, processOperationId }) {
  const [rows] = await connection.execute(`SELECT
      P.part_id AS partId,P.part_number AS partNumber,P.part_name AS partName,
      PP.process_plan_id AS processPlanId,PO.process_operation_id AS processOperationId,
      PO.operation_number AS operationNumber,
      COALESCE(OM.operation_name,D.operation_description,CONCAT('Operation ',PO.operation_number)) AS operationName,
      PIC.inspection_characteristic_id AS inspectionCharacteristicId,
      PIC.sample_size AS sampleSize,PIC.inspection_frequency AS inspectionFrequency,
      ICM.characteristic_code AS characteristicCode,
      COALESCE(NULLIF(PIC.characteristic_text,''),ICM.characteristic_name) AS characteristicName,
      COALESCE(ICM.characteristic_type,'VARIABLE') AS characteristicType,
      PIC.specified_dimension AS specifiedDimension,PIC.lsl,PIC.usl,PIC.drawing_grid AS drawingGrid,
      IIM.instrument_name AS instrumentName
    FROM part_master P
    JOIN part_process_plan PP ON PP.part_id=P.part_id AND PP.plan_status='APPROVED' AND PP.active_flag='Y'
    JOIN part_process_operation PO ON PO.process_plan_id=PP.process_plan_id
    LEFT JOIN part_process_definition D ON D.process_definition_id=PO.process_definition_id
    LEFT JOIN operation_master OM ON OM.operation_master_id=D.operation_master_id
    JOIN part_operation_inspection_plan IP ON IP.process_operation_id=PO.process_operation_id AND IP.plan_status='READY'
    JOIN part_inspection_characteristic PIC ON PIC.inspection_plan_id=IP.inspection_plan_id
    LEFT JOIN inspection_characteristic_master ICM ON ICM.characteristic_master_id=PIC.characteristic_master_id
    LEFT JOIN inspection_instrument_master IIM ON IIM.instrument_master_id=PIC.instrument_master_id
    WHERE P.part_id=?
      AND P.active_flag='Y'
      AND P.part_status='ACTIVE'
      AND COALESCE(P.save_status,'SUBMITTED')='SUBMITTED'
      AND PP.process_plan_id=? AND PO.process_operation_id=?
    ORDER BY PIC.sequence_number`, [Number(partId), Number(processPlanId), Number(processOperationId)]);
  if (!rows.length) return null;
  const first = rows[0];
  return {
    partId: Number(first.partId), partNumber: first.partNumber, partName: first.partName,
    processPlanId: Number(first.processPlanId), processOperationId: Number(first.processOperationId),
    operationNumber: Number(first.operationNumber), operationName: first.operationName,
    characteristics: rows.map((row) => ({
      inspectionCharacteristicId: Number(row.inspectionCharacteristicId),
      sampleSize: row.sampleSize, inspectionFrequency: row.inspectionFrequency,
      characteristicCode: row.characteristicCode, characteristicName: row.characteristicName,
      characteristicType: row.characteristicType, specifiedDimension: row.specifiedDimension,
      lsl: row.lsl, usl: row.usl, drawingGrid: row.drawingGrid, instrumentName: row.instrumentName,
    })),
  };
}

export async function getOrCreateRunForUpdate(connection, data) {
  const [created] = await connection.execute(`INSERT INTO in_process_inspection_run
      (tenant_id,company_id,plant_id,work_order_reference,batch_reference,part_id,process_plan_id,
       process_operation_id,part_number_snapshot,part_name_snapshot,operation_number_snapshot,
       operation_name_snapshot,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE in_process_inspection_run_id=LAST_INSERT_ID(in_process_inspection_run_id)`, [
    data.tenantId,data.companyId || null,data.plantId || null,data.workOrderReference,data.batchReference,
    data.partId,data.processPlanId,data.processOperationId,data.partNumber,data.partName,
    data.operationNumber,data.operationName,data.userCode,data.userCode,
  ]);
  const runId = Number(created.insertId);
  const [rows] = await connection.execute(`SELECT * FROM in_process_inspection_run
    WHERE in_process_inspection_run_id=? FOR UPDATE`, [runId]);
  return rows[0] || null;
}

export async function insertPiece(connection, data) {
  const [result] = await connection.execute(`INSERT INTO in_process_inspection_piece
    (in_process_inspection_run_id,piece_sequence,piece_reference,produced_at,produced_by,piece_status,status_updated_by,status_updated_at)
    VALUES (?,?,?,CURRENT_TIMESTAMP,?,?,?,CURRENT_TIMESTAMP)`, [
    data.runId,data.pieceSequence,data.pieceReference,data.userCode,data.pieceStatus,data.userCode,
  ]);
  return Number(result.insertId);
}

export async function insertRequirement(connection, data) {
  const [result] = await connection.execute(`INSERT INTO in_process_inspection_requirement
    (in_process_inspection_run_id,source_inspection_characteristic_id,trigger_piece_id,trigger_piece_sequence,
     sample_window_start_sequence,sample_window_end_sequence,frequency_code_snapshot,sample_size_code_snapshot,
     required_sample_count,characteristic_code_snapshot,characteristic_name_snapshot,characteristic_type_snapshot,
     specified_dimension_snapshot,lsl_snapshot,usl_snapshot,drawing_grid_snapshot,instrument_name_snapshot,requirement_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    data.runId,data.inspectionCharacteristicId,data.triggerPieceId,data.triggerPieceSequence,
    data.windowStart,data.windowEnd,data.inspectionFrequency,data.sampleSize,data.requiredSampleCount,
    data.characteristicCode || null,data.characteristicName,data.characteristicType || 'VARIABLE',
    data.specifiedDimension ?? null,data.lsl ?? null,data.usl ?? null,data.drawingGrid || null,
    data.instrumentName || null,data.requirementStatus,
  ]);
  return Number(result.insertId);
}

export async function insertSamples(connection, requirementId, pieceIds) {
  for (const pieceId of pieceIds) {
    await connection.execute(`INSERT INTO in_process_inspection_sample
      (in_process_inspection_requirement_id,in_process_inspection_piece_id)
      VALUES (?,?)`, [Number(requirementId), Number(pieceId)]);
  }
}

export async function updateRunNextSequence(connection, runId, nextPieceSequence, userCode) {
  await connection.execute(`UPDATE in_process_inspection_run SET next_piece_sequence=?,updated_by=?
    WHERE in_process_inspection_run_id=?`, [nextPieceSequence,userCode,Number(runId)]);
}

export async function countOpenRequirements(connection, runId) {
  const [rows] = await connection.execute(`SELECT COUNT(*) AS openCount
    FROM in_process_inspection_requirement
    WHERE in_process_inspection_run_id=?
      AND requirement_status IN ('AWAITING_SAMPLE_SELECTION','PENDING_INSPECTION')`, [Number(runId)]);
  return Number(rows[0]?.openCount || 0);
}

export async function updatePieceStatus(connection, pieceId, status, userCode) {
  await connection.execute(`UPDATE in_process_inspection_piece
    SET piece_status=?,status_updated_by=?,status_updated_at=CURRENT_TIMESTAMP
    WHERE in_process_inspection_piece_id=?`, [status,userCode,Number(pieceId)]);
}

export async function listRuns(tenantId, connection) {
  const [rows] = await dbConnection(connection).execute(`SELECT R.in_process_inspection_run_id AS runId,
      R.work_order_reference AS workOrderReference,R.batch_reference AS batchReference,
      R.part_number_snapshot AS partNumber,R.part_name_snapshot AS partName,
      R.operation_number_snapshot AS operationNumber,R.operation_name_snapshot AS operationName,
      R.next_piece_sequence-1 AS producedCount,R.run_status AS runStatus,R.hold_reason AS holdReason,
      SUM(P.piece_status='PENDING_INSPECTION') AS pendingPieceCount,
      SUM(P.piece_status='HOLD') AS heldPieceCount,
      R.updated_at AS lastUpdatedAt
    FROM in_process_inspection_run R
    LEFT JOIN in_process_inspection_piece P ON P.in_process_inspection_run_id=R.in_process_inspection_run_id
    WHERE R.tenant_id=?
    GROUP BY R.in_process_inspection_run_id,R.work_order_reference,R.batch_reference,R.part_number_snapshot,
      R.part_name_snapshot,R.operation_number_snapshot,R.operation_name_snapshot,R.next_piece_sequence,R.run_status,
      R.hold_reason,R.updated_at
    ORDER BY R.updated_at DESC,R.in_process_inspection_run_id DESC LIMIT 100`, [tenantId]);
  return rows;
}

export async function listQueueRequirements(tenantId, connection) {
  const [rows] = await dbConnection(connection).execute(`SELECT Q.in_process_inspection_requirement_id AS requirementId,
      Q.in_process_inspection_run_id AS runId,Q.trigger_piece_sequence AS triggerPieceSequence,
      Q.sample_window_start_sequence AS windowStart,Q.sample_window_end_sequence AS windowEnd,
      Q.frequency_code_snapshot AS inspectionFrequency,Q.sample_size_code_snapshot AS sampleSize,
      Q.required_sample_count AS requiredSampleCount,Q.characteristic_code_snapshot AS characteristicCode,
      Q.characteristic_name_snapshot AS characteristicName,Q.characteristic_type_snapshot AS characteristicType,
      Q.specified_dimension_snapshot AS specifiedDimension,Q.lsl_snapshot AS lsl,Q.usl_snapshot AS usl,
      Q.drawing_grid_snapshot AS drawingGrid,Q.instrument_name_snapshot AS instrumentName,
      Q.requirement_status AS requirementStatus,Q.created_at AS createdAt,
      R.work_order_reference AS workOrderReference,R.batch_reference AS batchReference,
      R.part_number_snapshot AS partNumber,R.part_name_snapshot AS partName,
      R.operation_number_snapshot AS operationNumber,R.operation_name_snapshot AS operationName,
      TP.piece_reference AS triggerPieceReference
    FROM in_process_inspection_requirement Q
    JOIN in_process_inspection_run R ON R.in_process_inspection_run_id=Q.in_process_inspection_run_id
    JOIN in_process_inspection_piece TP ON TP.in_process_inspection_piece_id=Q.trigger_piece_id
    WHERE R.tenant_id=? AND Q.requirement_status IN ('AWAITING_SAMPLE_SELECTION','PENDING_INSPECTION')
    ORDER BY FIELD(Q.requirement_status,'AWAITING_SAMPLE_SELECTION','PENDING_INSPECTION'),Q.created_at,Q.in_process_inspection_requirement_id`, [tenantId]);
  return rows;
}

export async function listSamplesForRequirements(requirementIds, connection) {
  if (!requirementIds.length) return [];
  const placeholders = requirementIds.map(() => '?').join(',');
  const [rows] = await dbConnection(connection).execute(`SELECT S.in_process_inspection_sample_id AS sampleId,
      S.in_process_inspection_requirement_id AS requirementId,S.in_process_inspection_piece_id AS pieceId,
      S.actual_value AS actualValue,S.inspection_result AS inspectionResult,S.remarks,S.inspected_at AS inspectedAt,
      P.piece_sequence AS pieceSequence,P.piece_reference AS pieceReference
    FROM in_process_inspection_sample S
    JOIN in_process_inspection_piece P ON P.in_process_inspection_piece_id=S.in_process_inspection_piece_id
    WHERE S.in_process_inspection_requirement_id IN (${placeholders})
    ORDER BY S.in_process_inspection_requirement_id,P.piece_sequence`, requirementIds.map(Number));
  return rows;
}

export async function listCandidatePieces(connection, runId, start, end) {
  const [rows] = await dbConnection(connection).execute(`SELECT in_process_inspection_piece_id AS pieceId,piece_sequence AS pieceSequence,
      piece_reference AS pieceReference,piece_status AS pieceStatus
    FROM in_process_inspection_piece
    WHERE in_process_inspection_run_id=? AND piece_sequence BETWEEN ? AND ?
      AND piece_status NOT IN ('HOLD','REJECTED')
    ORDER BY piece_sequence`, [Number(runId), Number(start), Number(end)]);
  return rows;
}

export async function listCandidatePiecesForUpdate(connection, runId, start, end) {
  const [rows] = await connection.execute(`SELECT in_process_inspection_piece_id AS pieceId,piece_sequence AS pieceSequence,
      piece_reference AS pieceReference,piece_status AS pieceStatus
    FROM in_process_inspection_piece
    WHERE in_process_inspection_run_id=? AND piece_sequence BETWEEN ? AND ?
      AND piece_status NOT IN ('HOLD','REJECTED')
    ORDER BY piece_sequence FOR UPDATE`, [Number(runId), Number(start), Number(end)]);
  return rows;
}

export async function listAwaitingAutomaticSelectionForUpdate(connection, tenantId) {
  const [rows] = await connection.execute(`SELECT Q.in_process_inspection_requirement_id AS requirementId,
      Q.in_process_inspection_run_id AS runId,Q.required_sample_count AS requiredSampleCount,
      Q.sample_window_start_sequence AS windowStart,Q.sample_window_end_sequence AS windowEnd
    FROM in_process_inspection_requirement Q
    JOIN in_process_inspection_run R ON R.in_process_inspection_run_id=Q.in_process_inspection_run_id
    WHERE R.tenant_id=? AND R.run_status='ACTIVE' AND Q.requirement_status='AWAITING_SAMPLE_SELECTION'
    ORDER BY Q.in_process_inspection_requirement_id FOR UPDATE`, [tenantId]);
  return rows;
}

export async function getRequirementForUpdate(connection, tenantId, requirementId) {
  const [rows] = await connection.execute(`SELECT Q.*,R.tenant_id,R.run_status,R.work_order_reference,
      R.batch_reference,R.part_number_snapshot,R.operation_number_snapshot
    FROM in_process_inspection_requirement Q
    JOIN in_process_inspection_run R ON R.in_process_inspection_run_id=Q.in_process_inspection_run_id
    WHERE Q.in_process_inspection_requirement_id=? AND R.tenant_id=? FOR UPDATE`, [Number(requirementId),tenantId]);
  return rows[0] || null;
}

export async function listRequirementSamplesForUpdate(connection, requirementId) {
  const [rows] = await connection.execute(`SELECT S.*,P.piece_sequence,P.piece_reference
    FROM in_process_inspection_sample S
    JOIN in_process_inspection_piece P ON P.in_process_inspection_piece_id=S.in_process_inspection_piece_id
    WHERE S.in_process_inspection_requirement_id=? FOR UPDATE`, [Number(requirementId)]);
  return rows;
}

export async function updateRequirementStatus(connection, requirementId, status, userCode, failureRemarks = null) {
  await connection.execute(`UPDATE in_process_inspection_requirement
    SET requirement_status=?,completed_by=?,completed_at=CURRENT_TIMESTAMP,failure_remarks=?
    WHERE in_process_inspection_requirement_id=?`, [status,userCode,failureRemarks,Number(requirementId)]);
}

export async function updateSampleResult(connection, sampleId, { actualValue, inspectionDate, inspectionResult, remarks, userCode }) {
  await connection.execute(`UPDATE in_process_inspection_sample
    SET actual_value=?,inspection_result=?,remarks=?,inspected_by=?,
      inspected_at=CASE WHEN ? IS NULL THEN CURRENT_TIMESTAMP ELSE CONCAT(?, ' 00:00:00') END
    WHERE in_process_inspection_sample_id=?`, [
    actualValue,inspectionResult,remarks || null,userCode,inspectionDate || null,inspectionDate || null,Number(sampleId),
  ]);
}

export async function holdRunAndWindow(connection, data) {
  await connection.execute(`UPDATE in_process_inspection_run SET run_status='ON_HOLD',hold_reason=?,updated_by=?
    WHERE in_process_inspection_run_id=?`, [data.reason,data.userCode,Number(data.runId)]);
  await connection.execute(`UPDATE in_process_inspection_piece
    SET piece_status='HOLD',status_updated_by=?,status_updated_at=CURRENT_TIMESTAMP
    WHERE in_process_inspection_run_id=? AND piece_sequence BETWEEN ? AND ? AND piece_status<>'REJECTED'`, [
    data.userCode,Number(data.runId),Number(data.windowStart),Number(data.windowEnd),
  ]);
}

export async function markSamplePiecesReadyWhenClear(connection, requirementId, userCode) {
  await connection.execute(`UPDATE in_process_inspection_piece P
    JOIN in_process_inspection_sample S ON S.in_process_inspection_piece_id=P.in_process_inspection_piece_id
    SET P.piece_status='READY_FOR_TRANSFER',P.status_updated_by=?,P.status_updated_at=CURRENT_TIMESTAMP
    WHERE S.in_process_inspection_requirement_id=? AND P.piece_status='PENDING_INSPECTION'
      AND NOT EXISTS (
        SELECT 1 FROM in_process_inspection_sample SP
        JOIN in_process_inspection_requirement RP ON RP.in_process_inspection_requirement_id=SP.in_process_inspection_requirement_id
        WHERE SP.in_process_inspection_piece_id=P.in_process_inspection_piece_id
          AND RP.requirement_status IN ('AWAITING_SAMPLE_SELECTION','PENDING_INSPECTION','FAIL','HOLD')
      )`, [userCode,Number(requirementId)]);
}
