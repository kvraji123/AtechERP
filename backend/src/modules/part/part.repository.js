// src/modules/part/part.repository.js

import { db } from "../../config/db.js";
import * as queries from "./part.queries.js";

function parseJsonColumn(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getSafeInteger(
  value,
  defaultValue,
  minimum,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const parsedValue = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  return Math.min(
    Math.max(parsedValue, minimum),
    maximum
  );
}

export async function listParts({
  search = "",
  customerId = 0,
  activeFlag = "",
  partStatus = "",
  saveStatus = "",
  includeDraft = false,
  tenantId = "DEFAULT",
  limit = 20,
  offset = 0,
} = {}) {
  if (!queries.LIST_PARTS) {
    throw new Error(
      "LIST_PARTS query is not exported from part.queries.js."
    );
  }

  if (!queries.COUNT_PARTS) {
    throw new Error(
      "COUNT_PARTS query is not exported from part.queries.js."
    );
  }

  const safeSearch = String(search || "").trim();

  const safeCustomerId = getSafeInteger(
    customerId,
    0,
    0
  );

  const safeActiveFlag = String(
    activeFlag || ""
  )
    .trim()
    .toUpperCase();
  const safePartStatus = String(partStatus || "").trim().toUpperCase();
  const safeSaveStatus = ["DRAFT", "SUBMITTED"].includes(
    String(saveStatus || "").trim().toUpperCase()
  )
    ? String(saveStatus).trim().toUpperCase()
    : "";
  // Query-string values arrive from Express as strings. The Part Master list
  // sends `includeDraft=true`, so accept both the HTTP value and the database
  // style `Y` value. Previously only the boolean `true`/`Y` was accepted,
  // which silently hid saved drafts from the list view.
  const includeDraftValue = String(includeDraft ?? "").trim().toUpperCase();
  const safeIncludeDraft = includeDraft === true || ["Y", "TRUE", "1"].includes(includeDraftValue)
    ? "Y"
    : "N";

  const safeLimit = getSafeInteger(
    limit,
    20,
    1,
    100
  );

  const safeOffset = getSafeInteger(
    offset,
    0,
    0
  );

  const listSql = `
    ${queries.LIST_PARTS}
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;

  const parameters = [
    String(tenantId || "DEFAULT"),
    safeSearch,
    safeSearch,
    safeSearch,
    safeSearch,
    safeSearch,
    safeCustomerId,
    safeCustomerId,
    safeActiveFlag,
    safeActiveFlag,
    safePartStatus,
    safePartStatus,
    safeSaveStatus,
    safeSaveStatus,
    safeIncludeDraft,
  ];
  const countParameters = parameters.slice(1);

  const [rows] = await db.execute(
    listSql,
    parameters
  );

  const [countRows] = await db.execute(
    queries.COUNT_PARTS,
    countParameters
  );

  return {
    rows,
    total: Number(countRows[0]?.total || 0),
  };
}

export async function getPartById(
  partId,
  connection = db
) {
  if (!queries.GET_PART_BY_ID) {
    throw new Error(
      "GET_PART_BY_ID query is not exported from part.queries.js."
    );
  }

  const safePartId = Number(partId);

  const [rows] = await connection.execute(
    queries.GET_PART_BY_ID,
    [safePartId]
  );

  if (!rows[0]) return null;

  const bomComponents = await getBomComponents(safePartId, connection);
  const processPlans = await getProcessPlans(safePartId, connection);
  const processPlan = processPlans.find((plan) => plan.isDefault === "Y" && plan.activeFlag === "Y")
    || processPlans.find((plan) => plan.activeFlag === "Y") || processPlans[0] || null;

  return { ...rows[0], bomComponents, processPlan, processPlans };
}

export async function findRevisionWarnings(partIds, connection = db) {
  const safePartIds = [...new Set(
    (Array.isArray(partIds) ? partIds : [])
      .map((partId) => Number.parseInt(String(partId), 10))
      .filter((partId) => Number.isSafeInteger(partId) && partId > 0)
  )].slice(0, 100);

  if (!safePartIds.length) return [];

  const placeholders = safePartIds.map(() => "?").join(", ");
  const [rows] = await connection.execute(
    `
      SELECT
        P.part_id AS partId,
        P.part_number AS partNumber,
        P.drawing_number AS drawingNumber,
        P.drawing_revision_number AS drawingRevisionNumber,
        R.part_id AS revisionPartId,
        R.part_number AS revisionPartNumber,
        R.drawing_revision_number AS revisionDrawingRevisionNumber
      FROM part_master P
      INNER JOIN part_master R
        ON R.revision_source_part_id = P.part_id
      WHERE P.part_id IN (${placeholders})
        AND P.active_flag = 'N'
        AND P.part_status = 'INACTIVE'
        AND R.active_flag = 'Y'
        AND R.part_status = 'DRAWING_UNDER_REVISION'
      ORDER BY R.created_on DESC, R.part_id DESC
    `,
    safePartIds
  );

  return rows;
}

export async function getProcessMasters(connection = db) {
  const [operations] = await connection.query(`SELECT O.operation_master_id AS operationMasterId,
    O.operation_code AS operationCode,O.operation_name AS operationName,O.default_source AS defaultSource,
    S.source_name AS sourceName,S.costing_mode AS costingMode
    FROM operation_master O LEFT JOIN operation_source_master S ON S.source_code=O.default_source
    WHERE O.active_flag='Y' ORDER BY O.display_order,O.operation_name`);
  const [sources] = await connection.query(`SELECT source_code AS sourceCode,source_name AS sourceName,
    costing_mode AS costingMode FROM operation_source_master
    WHERE active_flag='Y' ORDER BY display_order,source_name`);
  const [machineTypes] = await connection.query(`SELECT machine_type_id AS machineTypeId,
    machine_type_code AS machineTypeCode,machine_type_name AS machineTypeName,
    hourly_cost_inr AS hourlyCostInr
    FROM machine_type_master WHERE active_flag='Y' ORDER BY display_order,machine_type_name`);
  const [characteristics] = await connection.query(`SELECT characteristic_master_id AS characteristicMasterId,
    characteristic_code AS characteristicCode,characteristic_name AS characteristicName,
    characteristic_type AS characteristicType FROM inspection_characteristic_master
    WHERE active_flag='Y' ORDER BY characteristic_name`);
  const [instruments] = await connection.query(`SELECT instrument_master_id AS instrumentMasterId,
    instrument_code AS instrumentCode,instrument_name AS instrumentName
    FROM inspection_instrument_master WHERE active_flag='Y' ORDER BY instrument_name`);
  const [toleranceGrades] = await connection.query(`SELECT tolerance_grade_id AS toleranceGradeId,
    grade_code AS gradeCode,basic_size_from AS basicSizeFrom,basic_size_to AS basicSizeTo,
    lower_deviation_microns AS lowerDeviationMicrons,upper_deviation_microns AS upperDeviationMicrons
    FROM tolerance_grade_master WHERE active_flag='Y' ORDER BY grade_code,basic_size_from`);
  const [toleranceStandards] = await connection.query(`SELECT tolerance_standard_id AS toleranceStandardId,
    standard_code AS standardCode,standard_name AS standardName
    FROM inspection_tolerance_standard_master WHERE active_flag='Y' ORDER BY standard_name`);
  const [toleranceStandardBands] = await connection.query(`SELECT tolerance_standard_band_id AS toleranceStandardBandId,
    tolerance_standard_id AS toleranceStandardId,characteristic_type AS characteristicType,
    range_label AS rangeLabel,nominal_from AS nominalFrom,nominal_to AS nominalTo,
    minimum_inclusive AS minimumInclusive,maximum_inclusive AS maximumInclusive,
    tolerance_minus_mm AS toleranceMinusMm,tolerance_plus_mm AS tolerancePlusMm,
    tolerance_display AS toleranceDisplay
    FROM inspection_tolerance_standard_band WHERE active_flag='Y'
    ORDER BY tolerance_standard_id,characteristic_type,display_order`);
  const [sampleSizes] = await connection.query(`SELECT sample_size_code AS value,sample_size_label AS label
    FROM inspection_sample_size_master WHERE active_flag='Y' ORDER BY display_order`);
  const [frequencies] = await connection.query(`SELECT frequency_code AS value,frequency_label AS label
    FROM inspection_frequency_master WHERE active_flag='Y' ORDER BY display_order`);
  return { operations,sources,machineTypes,characteristics,instruments,toleranceGrades,
    toleranceStandards,toleranceStandardBands,sampleSizes,frequencies };
}

async function attachInspectionPlan(operation, connection) {
  const [inspectionPlans] = await connection.execute(`SELECT inspection_plan_id AS inspectionPlanId,
    plan_status AS planStatus,cmm_required AS cmmRequired,measurement_unit AS measurementUnit,
    tolerance_standard_id AS toleranceStandardId,approval_status AS approvalStatus
    FROM part_operation_inspection_plan WHERE process_operation_id=?`,
    [operation.processOperationId]);
  if (!inspectionPlans[0]) { operation.inspectionPlan = null; return; }
  const inspectionPlan = inspectionPlans[0];
  const [rows] = await connection.execute(`SELECT inspection_characteristic_id AS inspectionCharacteristicId,
    sequence_number AS sequenceNumber,balloon_number AS balloonNumber,
    PIC.characteristic_master_id AS characteristicMasterId,PIC.characteristic_text AS characteristicText,
    COALESCE(NULLIF(PIC.characteristic_text,''),ICM.characteristic_name) AS characteristicName,
    PIC.specified_dimension AS specifiedDimension,
    PIC.tolerance_mode AS toleranceMode,PIC.tolerance_grade_id AS toleranceGradeId,
    COALESCE(PIC.tolerance_grade_text,TGM.grade_code) AS toleranceGradeText,TGM.grade_code AS toleranceGradeCode,
    PIC.tolerance_standard_id AS toleranceStandardId,
    PIC.tolerance_minus AS toleranceMinus,PIC.tolerance_plus AS tolerancePlus,PIC.lsl,PIC.usl,
    PIC.drawing_grid AS drawingGrid,PIC.instrument_master_id AS instrumentMasterId,
    PIC.sample_size AS sampleSize,PIC.inspection_frequency AS inspectionFrequency,
    PIC.sc_cc_identification AS scCcIdentification,
    PIC.patrol_inspection_qa_required AS patrolInspectionQaRequired,
    PIC.patrol_qa_result AS patrolQaResult,
    PIC.periodic_operator_required AS periodicOperatorRequired,
    PIC.final_inspection_required AS finalInspectionRequired
    FROM part_inspection_characteristic PIC
    LEFT JOIN inspection_characteristic_master ICM ON ICM.characteristic_master_id=PIC.characteristic_master_id
    LEFT JOIN tolerance_grade_master TGM ON TGM.tolerance_grade_id=PIC.tolerance_grade_id
    WHERE PIC.inspection_plan_id=? ORDER BY PIC.sequence_number`,
    [inspectionPlan.inspectionPlanId]);
  operation.inspectionPlan = { ...inspectionPlan, characteristics: rows };
}

export async function getProcessPlans(partId, connection = db) {
  const [plans] = await connection.execute(`SELECT process_plan_id AS processPlanId,
    drawing_revision_number AS drawingRevisionNumber,plan_code AS planCode,route_name AS routeName,
    production_capacity_per_day AS productionCapacityPerDay,plan_status AS planStatus,
    is_default AS isDefault,active_flag AS activeFlag
    FROM part_process_plan WHERE part_id=?
    ORDER BY is_default DESC,active_flag DESC,process_plan_id`, [Number(partId)]);
  for (const plan of plans) {
  const [operations] = await connection.execute(`SELECT PO.process_operation_id AS processOperationId,
    PO.process_definition_id AS processDefinitionId,D.definition_code AS processDefinitionCode,
    PO.operation_number AS operationNumber,D.operation_master_id AS operationMasterId,
    OM.operation_name AS operationName,D.operation_description AS operationDescription,
    D.source_type AS sourceType,D.machine_type_id AS machineTypeId,
    D.cycle_time_seconds AS cycleTimeSeconds,D.clamping_time_seconds AS clampingTimeSeconds,
    D.setting_time_hours AS settingTimeHours,
    D.outsource_cost_inr AS outsourceCostInr,D.process_cost_inr AS processCostInr,
    D.tool_list_data AS toolList,D.program_data AS program,D.document_approval_data AS documentApprovals,
    D.program_number AS programNumber,
    PO.inspection_required AS inspectionRequired
    FROM part_process_operation PO
    LEFT JOIN part_process_definition D ON D.process_definition_id=PO.process_definition_id
    LEFT JOIN operation_master OM ON OM.operation_master_id=D.operation_master_id
    WHERE PO.process_plan_id=? ORDER BY PO.operation_number`, [plan.processPlanId]);
  for (const operation of operations) {
    operation.toolList = parseJsonColumn(operation.toolList);
    operation.program = parseJsonColumn(operation.program);
    operation.documentApprovals = parseJsonColumn(operation.documentApprovals) || {
      program: false,
      toolList: false,
      workInstructions: false,
    };
    await attachInspectionPlan(operation, connection);
  }
    plan.operations = operations;
  }
  const usage = new Map();
  for (const plan of plans) for (const operation of plan.operations) {
    const id = Number(operation.processDefinitionId || 0);
    if (id) usage.set(id, (usage.get(id) || 0) + 1);
  }
  for (const plan of plans) for (const operation of plan.operations) {
    operation.sharedVariantCount = usage.get(Number(operation.processDefinitionId || 0)) || 1;
  }
  return plans;
}

export async function getProcessPlan(partId, connection = db) {
  const plans = await getProcessPlans(partId, connection);
  return plans.find((plan) => plan.isDefault === "Y" && plan.activeFlag === "Y")
    || plans.find((plan) => plan.activeFlag === "Y") || plans[0] || null;
}

export async function getToolListContext(processDefinitionId, connection = db) {
  const [rows] = await connection.execute(`SELECT
      D.process_definition_id AS processDefinitionId,
      D.program_number AS programNumber,
      D.cycle_time_seconds AS cycleTimeSeconds,
      D.clamping_time_seconds AS clampingTimeSeconds,
      P.part_id AS partId,P.part_number AS partNumber,P.part_name AS partName,
      P.drawing_number AS drawingNumber,P.drawing_code AS drawingCode,
      P.material_specification AS materialSpecification,
      C.customer_name AS customerName,
      MT.machine_type_code AS machineTypeCode,
      COALESCE(NULLIF(M.material_name,''),NULLIF(P.material_specification,'')) AS material,
      GROUP_CONCAT(DISTINCT PO.operation_number
        ORDER BY CAST(PO.operation_number AS UNSIGNED),PO.operation_number SEPARATOR ' & ') AS operationNumber
    FROM part_process_definition D
    INNER JOIN part_master P ON P.part_id=D.part_id
    LEFT JOIN customer_master C ON C.customer_id=P.customer_id
    LEFT JOIN material_master M ON M.material_id=P.material_id
    LEFT JOIN machine_type_master MT ON MT.machine_type_id=D.machine_type_id
    LEFT JOIN part_process_operation PO ON PO.process_definition_id=D.process_definition_id
    WHERE D.process_definition_id=?
    GROUP BY D.process_definition_id,D.program_number,D.cycle_time_seconds,D.clamping_time_seconds,
      P.part_id,P.part_number,P.part_name,P.drawing_number,P.drawing_code,P.material_specification,
      C.customer_name,MT.machine_type_code,M.material_name`, [Number(processDefinitionId)]);
  return rows[0] || null;
}

export async function countProcessDefinitionWorkInstructions(processDefinitionId, connection = db) {
  const [rows] = await connection.execute(`SELECT COUNT(*) AS attachmentCount
    FROM application_attachments
    WHERE entity_type='PART_PROCESS_DEFINITION' AND entity_id=? AND attachment_type='WORK_INSTRUCTION'`,
  [Number(processDefinitionId)]);
  return Number(rows[0]?.attachmentCount || 0);
}

async function replaceOperationInspectionPlan(connection, processOperationId, inspectionPlan, userCode) {
  await connection.execute("DELETE FROM part_operation_inspection_plan WHERE process_operation_id=?", [processOperationId]);
  if (!inspectionPlan) return;
  const [inspectionResult] = await connection.execute(`INSERT INTO part_operation_inspection_plan
    (process_operation_id,plan_status,approval_status,cmm_required,measurement_unit,tolerance_standard_id,created_by) VALUES (?,?,?,?,?,?,?)`, [processOperationId,
    inspectionPlan.planStatus,inspectionPlan.approvalStatus === "APPROVED" ? "APPROVED" : "DRAFT",
    inspectionPlan.cmmRequired ? "Y" : "N",inspectionPlan.measurementUnit || "MM",
    inspectionPlan.toleranceStandardId || null,userCode]);
  for (const row of inspectionPlan.characteristics) {
    await connection.execute(`INSERT INTO part_inspection_characteristic
      (inspection_plan_id,sequence_number,balloon_number,characteristic_master_id,characteristic_text,
       specified_dimension,tolerance_mode,tolerance_grade_id,tolerance_grade_text,tolerance_standard_id,tolerance_minus,tolerance_plus,lsl,usl,
       drawing_grid,instrument_master_id,sample_size,inspection_frequency,sc_cc_identification,
       patrol_inspection_qa_required,patrol_qa_result,periodic_operator_required,final_inspection_required,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [inspectionResult.insertId,row.sequenceNumber,
      row.balloonNumber,row.characteristicMasterId,row.characteristicText,row.specifiedDimension,row.toleranceMode,
      row.toleranceGradeId,row.toleranceGradeText,row.toleranceStandardId ?? null,row.toleranceMinus,row.tolerancePlus,row.lsl,row.usl,row.drawingGrid,
      row.instrumentMasterId,row.sampleSize,row.inspectionFrequency,row.scCcIdentification ? "Y" : "N",
      row.patrolInspectionQaRequired ? "Y" : "N",null,row.periodicOperatorRequired ? "Y" : "N",
      row.finalInspectionRequired ? "Y" : "N",userCode]);
  }
}

async function upsertProcessDefinition(connection, partId, operation, userCode) {
  const definitionId = Number(operation.processDefinitionId || 0);
  const values = [operation.operationMasterId,operation.operationDescription,operation.sourceType,
    operation.machineTypeId,operation.cycleTimeSeconds,operation.clampingTimeSeconds,
    operation.settingTimeHours,operation.outsourceCostInr,operation.processCostInr,
    operation.toolList ? JSON.stringify(operation.toolList) : null,
    operation.program ? JSON.stringify(operation.program) : null,
    operation.documentApprovals ? JSON.stringify(operation.documentApprovals) : null,
    operation.programNumber,userCode];
  if (definitionId) {
    const [owned] = await connection.execute(`SELECT process_definition_id FROM part_process_definition
      WHERE process_definition_id=? AND part_id=?`, [definitionId,Number(partId)]);
    if (!owned[0]) throw new Error("Shared Process Definition does not belong to this Part.");
    await connection.execute(`UPDATE part_process_definition SET
      operation_master_id=?,operation_description=?,source_type=?,machine_type_id=?,cycle_time_seconds=?,
      clamping_time_seconds=?,setting_time_hours=?,outsource_cost_inr=?,process_cost_inr=?,tool_list_data=?,
      program_data=?,document_approval_data=?,program_number=?,updated_by=?
      WHERE process_definition_id=? AND part_id=?`, [...values,definitionId,Number(partId)]);
    return definitionId;
  }
  const temporaryCode = `NEW-${partId}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  const [result] = await connection.execute(`INSERT INTO part_process_definition
    (part_id,definition_code,operation_master_id,operation_description,source_type,machine_type_id,
     cycle_time_seconds,clamping_time_seconds,setting_time_hours,outsource_cost_inr,process_cost_inr,tool_list_data,
     program_data,document_approval_data,program_number,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [Number(partId),temporaryCode,...values]);
  const code = `PD-${String(result.insertId).padStart(4,"0")}`;
  await connection.execute("UPDATE part_process_definition SET definition_code=? WHERE process_definition_id=?",
    [code,result.insertId]);
  return Number(result.insertId);
}

export async function replaceProcessPlans(connection, partId, processPlans, userCode) {
  const safePartId = Number(partId);
  const incomingPlans = Array.isArray(processPlans) ? processPlans : [];
  const [existingPlans] = await connection.execute(`SELECT process_plan_id AS processPlanId,plan_status AS planStatus
    FROM part_process_plan WHERE part_id=?`, [safePartId]);
  const retainedPlanIds = new Set();
  const usedProcessDefinitionIds = new Set();
  await connection.execute("UPDATE part_process_plan SET is_default='N',updated_by=? WHERE part_id=?", [userCode,safePartId]);

  for (let planIndex=0; planIndex<incomingPlans.length; planIndex+=1) {
    const plan = incomingPlans[planIndex];
    let processPlanId = Number(plan.processPlanId || 0);
    const requestedCode = String(plan.planCode || "").trim();
    if (processPlanId) {
      const [result] = await connection.execute(`UPDATE part_process_plan SET drawing_revision_number=?,plan_code=?,
        route_name=?,production_capacity_per_day=?,is_default=?,active_flag=?,updated_by=?
        WHERE process_plan_id=? AND part_id=?`, [plan.drawingRevisionNumber,requestedCode,
        plan.routeName,plan.productionCapacityPerDay,plan.isDefault ? "Y" : "N",
        plan.activeFlag === "N" ? "N" : "Y",userCode,processPlanId,safePartId]);
      if (!result.affectedRows) throw new Error("Process Plan Variant does not belong to this Part.");
    } else {
      const temporaryCode = requestedCode || `NEW-${safePartId}-${Date.now()}-${planIndex}`;
      const [result] = await connection.execute(`INSERT INTO part_process_plan
        (part_id,drawing_revision_number,plan_code,route_name,production_capacity_per_day,plan_status,
         is_default,active_flag,created_by) VALUES (?,?,?,?,?,'DRAFT',?,?,?)`, [safePartId,
        plan.drawingRevisionNumber,temporaryCode,plan.routeName,plan.productionCapacityPerDay,
        plan.isDefault ? "Y" : "N",plan.activeFlag === "N" ? "N" : "Y",userCode]);
      processPlanId = Number(result.insertId);
      if (!requestedCode) await connection.execute("UPDATE part_process_plan SET plan_code=? WHERE process_plan_id=?",
        [`PP-${String(processPlanId).padStart(4,"0")}`,processPlanId]);
    }
    retainedPlanIds.add(processPlanId);
    await connection.execute("DELETE FROM part_process_operation WHERE process_plan_id=?", [processPlanId]);
    for (const operation of plan.operations) {
      const existingDefinitionId = Number(operation.processDefinitionId || 0);
      const shouldCreateIndependentDefinition = !existingDefinitionId
        || usedProcessDefinitionIds.has(existingDefinitionId);
      const processDefinitionId = await upsertProcessDefinition(
        connection,
        safePartId,
        shouldCreateIndependentDefinition
          ? { ...operation, processDefinitionId: undefined }
          : operation,
        userCode
      );
      usedProcessDefinitionIds.add(processDefinitionId);
      const [operationResult] = await connection.execute(`INSERT INTO part_process_operation
        (process_plan_id,process_definition_id,operation_number,operation_master_id,operation_description,source_type,
         machine_type_id,machine_unit_id,cycle_time_seconds,clamping_time_seconds,setting_time_hours,
         outsource_cost_inr,process_cost_inr,inspection_required,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [processPlanId,processDefinitionId,operation.operationNumber,
        operation.operationMasterId,operation.operationDescription,operation.sourceType,operation.machineTypeId,null,
        operation.cycleTimeSeconds,operation.clampingTimeSeconds,operation.settingTimeHours,operation.outsourceCostInr,
        operation.processCostInr,operation.inspectionPlan ? "Y" : "N",userCode]);
      await replaceOperationInspectionPlan(connection,Number(operationResult.insertId),operation.inspectionPlan,userCode);
    }
    plan.processPlanId = processPlanId;
  }

  for (const existing of existingPlans) {
    if (retainedPlanIds.has(Number(existing.processPlanId))) continue;
    if (existing.planStatus === "APPROVED") {
      await connection.execute("UPDATE part_process_plan SET active_flag='N',is_default='N',updated_by=? WHERE process_plan_id=?",
        [userCode,existing.processPlanId]);
    } else {
      await connection.execute("DELETE FROM part_process_plan WHERE process_plan_id=?", [existing.processPlanId]);
    }
  }

  for (const plan of incomingPlans) {
    await connection.execute("UPDATE part_process_plan SET plan_status=?,updated_by=? WHERE process_plan_id=?",
      [plan.planStatus,userCode,plan.processPlanId]);
  }
}

export async function replaceProcessPlan(connection, partId, processPlan, userCode) {
  return replaceProcessPlans(connection,partId,processPlan ? [{ ...processPlan,isDefault:true,
    activeFlag:"Y",planCode:processPlan.planCode || "",routeName:processPlan.routeName || "Default Route" }] : [],userCode);
}

export async function getBomComponents(parentPartId, connection = db) {
  const [bomComponents] = await connection.execute(
    `
      SELECT
        B.bom_component_id AS bomComponentId,
        B.component_type AS componentType,
        CASE WHEN B.component_type = 'PART' THEN B.component_part_id ELSE B.component_item_id END AS componentId,
        CASE WHEN B.component_type = 'PART' THEN P.part_number ELSE I.item_code END AS componentCode,
        CASE WHEN B.component_type = 'PART' THEN P.part_name ELSE I.item_description END AS componentDescription,
        COALESCE(U.uom_code, P.unit_of_measurement, '-') AS uomCode,
        B.uom_id AS uomId,
        B.quantity
      FROM part_bill_of_material B
      LEFT JOIN part_master P
        ON B.component_type = 'PART' AND P.part_id = B.component_part_id
      LEFT JOIN item_master I
        ON B.component_type = 'ITEM' AND I.item_id = B.component_item_id
      LEFT JOIN uom_master U ON U.uom_id = B.uom_id
      WHERE B.parent_part_id = ?
      ORDER BY B.bom_component_id
    `,
    [Number(parentPartId)]
  );
  return bomComponents;
}

export async function searchBomOptions({ search = "", excludePartId = 0 } = {}) {
  const safeSearch = String(search || "").trim();
  const safeExcludePartId = Number(excludePartId || 0);
  const likeSearch = `%${safeSearch}%`;
  const [rows] = await db.execute(
    `
      SELECT * FROM (
        SELECT
          'PART' AS componentType,
          P.part_id AS componentId,
          P.part_number AS componentCode,
          P.part_name AS componentDescription,
          P.uom_id AS uomId,
          COALESCE(U.uom_code, P.unit_of_measurement, '-') AS uomCode
        FROM part_master P
        LEFT JOIN uom_master U ON U.uom_id = P.uom_id
        WHERE P.active_flag = 'Y'
          AND P.part_status = 'ACTIVE'
          AND COALESCE(P.save_status, 'SUBMITTED') = 'SUBMITTED'
          AND (? = 0 OR P.part_id <> ?)
          AND (? = '' OR P.part_number LIKE ? OR P.part_name LIKE ?)

        UNION ALL

        SELECT
          'ITEM' AS componentType,
          I.item_id AS componentId,
          I.item_code AS componentCode,
          I.item_description AS componentDescription,
          I.uom_id AS uomId,
          U.uom_code AS uomCode
        FROM item_master I
        INNER JOIN uom_master U ON U.uom_id = I.uom_id
        WHERE I.active_flag = 'Y'
          AND (? = '' OR I.item_code LIKE ? OR I.item_description LIKE ?)
      ) OPTIONS
      ORDER BY componentDescription, componentCode
      LIMIT 30
    `,
    [safeExcludePartId, safeExcludePartId, safeSearch, likeSearch, likeSearch,
      safeSearch, likeSearch, likeSearch]
  );
  return rows;
}

export async function validateBomComponent(connection, componentType, componentId) {
  if (componentType === "PART") {
    const [rows] = await connection.execute(
      `SELECT part_id AS componentId, uom_id AS uomId
       FROM part_master
       WHERE part_id = ?
         AND active_flag = 'Y'
         AND part_status = 'ACTIVE'
         AND COALESCE(save_status, 'SUBMITTED') = 'SUBMITTED'`,
      [componentId]
    );
    return rows[0] || null;
  }
  const [rows] = await connection.execute(
    `SELECT item_id AS componentId, uom_id AS uomId
     FROM item_master WHERE item_id = ? AND active_flag = 'Y'`,
    [componentId]
  );
  return rows[0] || null;
}

export async function wouldCreateBomCycle(connection, parentPartId, componentPartId) {
  const [rows] = await connection.execute(
    `
      WITH RECURSIVE descendants (part_id) AS (
        SELECT component_part_id
        FROM part_bill_of_material
        WHERE parent_part_id = ?
          AND component_type = 'PART'
          AND component_part_id IS NOT NULL
        UNION DISTINCT
        SELECT B.component_part_id
        FROM part_bill_of_material B
        INNER JOIN descendants D ON D.part_id = B.parent_part_id
        WHERE B.component_type = 'PART'
          AND B.component_part_id IS NOT NULL
      )
      SELECT EXISTS(
        SELECT 1 FROM descendants WHERE part_id = ?
      ) AS createsCycle
    `,
    [componentPartId, parentPartId]
  );
  return Boolean(rows[0]?.createsCycle);
}

export async function replaceBomComponents(connection, parentPartId, components, userCode) {
  await connection.execute(
    "DELETE FROM part_bill_of_material WHERE parent_part_id = ?",
    [parentPartId]
  );
  for (const component of components) {
    await connection.execute(
      `INSERT INTO part_bill_of_material
       (parent_part_id, component_type, component_part_id, component_item_id,
        uom_id, quantity, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parentPartId, component.componentType,
        component.componentType === "PART" ? component.componentId : null,
        component.componentType === "ITEM" ? component.componentId : null,
        component.uomId, component.quantity, userCode]
    );
  }
}

export async function getActivePartByDrawing(
  drawingNumber,
  connection = db
) {
  const [rows] = await connection.execute(
    `
      SELECT P.*, C.customer_code, C.customer_name
      FROM part_master P
      INNER JOIN customer_master C ON C.customer_id = P.customer_id
      WHERE UPPER(TRIM(P.drawing_number)) = UPPER(TRIM(?))
        AND P.active_flag = 'Y'
        AND P.part_status = 'ACTIVE'
        AND COALESCE(P.save_status, 'SUBMITTED') = 'SUBMITTED'
      ORDER BY P.part_id
      LIMIT 1
    `,
    [String(drawingNumber || "").trim()]
  );
  return rows[0] || null;
}

export async function getPartByNumber(partNumber, connection = db) {
  const [rows] = await connection.execute(
    `
      SELECT part_id, part_number, drawing_number
      FROM part_master
      WHERE UPPER(TRIM(part_number)) = UPPER(TRIM(?))
      LIMIT 1
    `,
    [String(partNumber || "").trim()]
  );
  return rows[0] || null;
}

export async function getPartByDrawingCode(
  drawingCode,
  { excludePartId = null, connection = db } = {}
) {
  const [rows] = await connection.execute(
    `
      SELECT part_id, part_number, drawing_code
      FROM part_master
      WHERE UPPER(TRIM(drawing_code)) = UPPER(TRIM(?))
        AND (? IS NULL OR part_id <> ?)
      LIMIT 1
    `,
    [String(drawingCode || "").trim(), excludePartId, excludePartId]
  );
  return rows[0] || null;
}

export async function getHighestNumericDrawingCode(connection = db) {
  const [rows] = await connection.execute(
    `
      SELECT COALESCE(MAX(CAST(TRIM(drawing_code) AS UNSIGNED)), 0) AS highestDrawingCode
      FROM part_master
      WHERE TRIM(COALESCE(drawing_code, '')) REGEXP '^[0-9]+$'
    `
  );
  return Number(rows[0]?.highestDrawingCode || 0);
}

export async function validateMaterialSelection(connection, materialId, materialGradeId, uomId) {
  const [rows] = await connection.execute(`SELECT
    (? IS NULL OR EXISTS(SELECT 1 FROM material_master WHERE material_id=? AND active_flag='Y')) AS materialOk,
    EXISTS(SELECT 1 FROM uom_master WHERE uom_id=? AND active_flag='Y') AS uomOk,
    (? IS NULL OR EXISTS(SELECT 1 FROM material_grade_master
      WHERE material_grade_id=? AND material_id=? AND active_flag='Y')) AS gradeOk`,
  [materialId, materialId, uomId, materialGradeId, materialGradeId, materialId]);
  return rows[0];
}

export async function insertPart(
  connection,
  values,
  {
    partStatus = "ACTIVE",
    saveStatus = "SUBMITTED",
    activeFlag = "Y",
    revisionSourcePartId = null,
    bomReleaseStatus = "NOT_REQUIRED",
    bomRequired = "N",
  } = {}
) {
  if (!queries.INSERT_PART) {
    throw new Error(
      "INSERT_PART query is not exported from part.queries.js."
    );
  }

  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const requestedStatus = String(partStatus || "ACTIVE").toUpperCase();
  const status = ["ACTIVE", "INACTIVE", "DRAWING_UNDER_REVISION"].includes(requestedStatus)
    ? requestedStatus
    : "ACTIVE";
  const flag =
    String(activeFlag || "Y").toUpperCase() === "N" ? "N" : "Y";
  const draftStatus = String(saveStatus || "SUBMITTED").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  const releaseStatus = ["DRAFT", "RELEASED", "NOT_REQUIRED"].includes(
    String(bomReleaseStatus || "NOT_REQUIRED").toUpperCase()
  ) ? String(bomReleaseStatus).toUpperCase() : "NOT_REQUIRED";
  const required = String(bomRequired || "N").toUpperCase() === "Y" ? "Y" : "N";

  if (safeValues.length !== 17) {
    throw new Error("Part insert requires 17 values.");
  }

  const [result] = await connection.execute(
    queries.INSERT_PART,
    [
      ...safeValues.slice(0, 15),
      status,
      draftStatus,
      flag,
      revisionSourcePartId ? Number(revisionSourcePartId) : null,
      releaseStatus,
      required,
      ...safeValues.slice(15),
    ]
  );

  return result.insertId;
}

export async function updatePart(
  partId,
  values,
  connection = db,
  { saveStatus = "SUBMITTED", activeFlag = "Y", bomRequired = "N" } = {}
) {
  if (!queries.UPDATE_PART) {
    throw new Error(
      "UPDATE_PART query is not exported from part.queries.js."
    );
  }

  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );
  const draftStatus = String(saveStatus || "SUBMITTED").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  const flag = String(activeFlag || "Y").toUpperCase() === "N" ? "N" : "Y";
  const required = String(bomRequired || "N").toUpperCase() === "Y" ? "Y" : "N";

  const [result] = await connection.execute(
    queries.UPDATE_PART,
    [
      ...safeValues.slice(0, 15),
      draftStatus,
      flag,
      required,
      ...safeValues.slice(15),
      Number(partId),
    ]
  );

  return result.affectedRows;
}

export async function updatePartStatus(
  partId,
  values,
  connection = db
) {
  if (!queries.UPDATE_PART_STATUS) {
    throw new Error(
      "UPDATE_PART_STATUS query is not exported from part.queries.js."
    );
  }

  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await connection.execute(
    queries.UPDATE_PART_STATUS,
    [
      ...safeValues,
      Number(partId),
    ]
  );

  return result.affectedRows;
}

export async function updateBomReleaseStatus(
  connection,
  partId,
  releaseStatus,
  userCode
) {
  await connection.execute(
    `UPDATE part_master
        SET bom_release_status=?,
            bom_released_by=CASE WHEN ?='RELEASED' THEN ? ELSE NULL END,
            bom_released_on=CASE WHEN ?='RELEASED' THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_by=?
      WHERE part_id=?`,
    [releaseStatus, releaseStatus, userCode, releaseStatus, userCode, Number(partId)]
  );
}

export async function activateRevisionWhenReleased(connection, partId, userCode) {
  const [result] = await connection.execute(
    `UPDATE part_master P
        SET P.part_status='ACTIVE', P.active_flag='Y', P.updated_by=?
      WHERE P.part_id=?
        AND P.part_status='DRAWING_UNDER_REVISION'
        AND P.bom_release_status IN ('RELEASED','NOT_REQUIRED')
        AND EXISTS (
          SELECT 1
            FROM part_process_plan PP
           WHERE PP.part_id=P.part_id
             AND PP.active_flag='Y'
             AND PP.is_default='Y'
             AND PP.plan_status='APPROVED'
        )`,
    [userCode, Number(partId)]
  );
  return result.affectedRows;
}

export async function listPartAttachmentsForClone(connection, partId, tenantId) {
  const [rows] = await connection.execute(
    `SELECT attachment_type AS attachmentType, attachment_name AS attachmentName,
            file_name AS fileName, stored_file_name AS storedFileName,
            file_path AS filePath, mime_type AS mimeType,
            file_size_bytes AS fileSizeBytes
       FROM application_attachments
      WHERE tenant_id=? AND entity_type='PART' AND entity_id=? AND active_flag='Y'
      ORDER BY attachment_id`,
    [String(tenantId), Number(partId)]
  );
  return rows;
}

export async function insertClonedPartAttachments(
  connection,
  partId,
  tenantId,
  attachments,
  userCode
) {
  for (const attachment of attachments) {
    await connection.execute(
      `INSERT INTO application_attachments
        (tenant_id,entity_type,entity_id,attachment_type,attachment_name,
         file_name,stored_file_name,file_path,mime_type,file_size_bytes,created_by)
       VALUES (?,'PART',?,?,?,?,?,?,?,?,?)`,
      [String(tenantId), Number(partId), attachment.attachmentType,
        attachment.attachmentName, attachment.fileName, attachment.storedFileName,
        attachment.filePath, attachment.mimeType, Number(attachment.fileSizeBytes || 0), userCode]
    );
  }
}
