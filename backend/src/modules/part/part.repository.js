// src/modules/part/part.repository.js

import { db } from "../../config/db.js";
import * as queries from "./part.queries.js";

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
    safeSearch,
    safeSearch,
    safeSearch,
    safeSearch,
    safeCustomerId,
    safeCustomerId,
    safeActiveFlag,
    safeActiveFlag,
  ];

  const [rows] = await db.execute(
    listSql,
    parameters
  );

  const [countRows] = await db.execute(
    queries.COUNT_PARTS,
    parameters
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
  const [sampleSizes] = await connection.query(`SELECT sample_size_code AS value,sample_size_label AS label
    FROM inspection_sample_size_master WHERE active_flag='Y' ORDER BY display_order`);
  const [frequencies] = await connection.query(`SELECT frequency_code AS value,frequency_label AS label
    FROM inspection_frequency_master WHERE active_flag='Y' ORDER BY display_order`);
  return { operations,sources,machineTypes,characteristics,instruments,toleranceGrades,sampleSizes,frequencies };
}

async function attachInspectionPlan(operation, connection) {
  const [inspectionPlans] = await connection.execute(`SELECT inspection_plan_id AS inspectionPlanId,
    plan_status AS planStatus,cmm_required AS cmmRequired
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
    PIC.tolerance_minus AS toleranceMinus,PIC.tolerance_plus AS tolerancePlus,PIC.lsl,PIC.usl,
    PIC.drawing_grid AS drawingGrid,PIC.instrument_master_id AS instrumentMasterId,
    PIC.sample_size AS sampleSize,PIC.inspection_frequency AS inspectionFrequency,
    PIC.sc_cc_identification AS scCcIdentification,PIC.patrol_qa_result AS patrolQaResult,
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
    PO.inspection_required AS inspectionRequired
    FROM part_process_operation PO
    LEFT JOIN part_process_definition D ON D.process_definition_id=PO.process_definition_id
    LEFT JOIN operation_master OM ON OM.operation_master_id=D.operation_master_id
    WHERE PO.process_plan_id=? ORDER BY PO.operation_number`, [plan.processPlanId]);
  for (const operation of operations) {
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

async function replaceOperationInspectionPlan(connection, processOperationId, inspectionPlan, userCode) {
  await connection.execute("DELETE FROM part_operation_inspection_plan WHERE process_operation_id=?", [processOperationId]);
  if (!inspectionPlan) return;
  const [inspectionResult] = await connection.execute(`INSERT INTO part_operation_inspection_plan
    (process_operation_id,plan_status,cmm_required,created_by) VALUES (?,?,?,?)`, [processOperationId,
    inspectionPlan.planStatus,inspectionPlan.cmmRequired ? "Y" : "N",userCode]);
  for (const row of inspectionPlan.characteristics) {
    await connection.execute(`INSERT INTO part_inspection_characteristic
      (inspection_plan_id,sequence_number,balloon_number,characteristic_master_id,characteristic_text,
       specified_dimension,tolerance_mode,tolerance_grade_id,tolerance_grade_text,tolerance_minus,tolerance_plus,lsl,usl,
       drawing_grid,instrument_master_id,sample_size,inspection_frequency,sc_cc_identification,
       patrol_qa_result,periodic_operator_required,final_inspection_required,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [inspectionResult.insertId,row.sequenceNumber,
      row.balloonNumber,row.characteristicMasterId,row.characteristicText,row.specifiedDimension,row.toleranceMode,
      row.toleranceGradeId,row.toleranceGradeText,row.toleranceMinus,row.tolerancePlus,row.lsl,row.usl,row.drawingGrid,
      row.instrumentMasterId,row.sampleSize,row.inspectionFrequency,row.scCcIdentification ? "Y" : "N",
      null,row.periodicOperatorRequired ? "Y" : "N",
      row.finalInspectionRequired ? "Y" : "N",userCode]);
  }
}

async function upsertProcessDefinition(connection, partId, operation, userCode) {
  const definitionId = Number(operation.processDefinitionId || 0);
  const values = [operation.operationMasterId,operation.operationDescription,operation.sourceType,
    operation.machineTypeId,operation.cycleTimeSeconds,operation.clampingTimeSeconds,
    operation.settingTimeHours,operation.outsourceCostInr,operation.processCostInr,userCode];
  if (definitionId) {
    const [owned] = await connection.execute(`SELECT process_definition_id FROM part_process_definition
      WHERE process_definition_id=? AND part_id=?`, [definitionId,Number(partId)]);
    if (!owned[0]) throw new Error("Shared Process Definition does not belong to this Part.");
    await connection.execute(`UPDATE part_process_definition SET
      operation_master_id=?,operation_description=?,source_type=?,machine_type_id=?,cycle_time_seconds=?,
      clamping_time_seconds=?,setting_time_hours=?,outsource_cost_inr=?,process_cost_inr=?,updated_by=?
      WHERE process_definition_id=? AND part_id=?`, [...values,definitionId,Number(partId)]);
    return definitionId;
  }
  const temporaryCode = `NEW-${partId}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  const [result] = await connection.execute(`INSERT INTO part_process_definition
    (part_id,definition_code,operation_master_id,operation_description,source_type,machine_type_id,
     cycle_time_seconds,clamping_time_seconds,setting_time_hours,outsource_cost_inr,process_cost_inr,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [Number(partId),temporaryCode,...values.slice(0,9),userCode]);
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
  const definitionPayloads = new Map();
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
      let processDefinitionId = existingDefinitionId;
      if (!processDefinitionId || !definitionPayloads.has(processDefinitionId)) {
        processDefinitionId = await upsertProcessDefinition(connection,safePartId,operation,userCode);
      }
      if (!definitionPayloads.has(processDefinitionId)) {
        definitionPayloads.set(processDefinitionId,{ ...operation,processDefinitionId });
      }
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

  for (const [definitionId,operation] of definitionPayloads) {
    await connection.execute(`UPDATE part_process_operation PO JOIN part_process_definition D
      ON D.process_definition_id=PO.process_definition_id SET PO.operation_master_id=D.operation_master_id,
      PO.operation_description=D.operation_description,PO.source_type=D.source_type,PO.machine_type_id=D.machine_type_id,
      PO.cycle_time_seconds=D.cycle_time_seconds,PO.clamping_time_seconds=D.clamping_time_seconds,
      PO.setting_time_hours=D.setting_time_hours,PO.outsource_cost_inr=D.outsource_cost_inr,
      PO.process_cost_inr=D.process_cost_inr WHERE PO.process_definition_id=?`, [definitionId]);
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
       FROM part_master WHERE part_id = ? AND active_flag = 'Y'`,
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
    activeFlag = "Y",
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

  const status =
    String(partStatus || "ACTIVE").toUpperCase() === "INACTIVE"
      ? "INACTIVE"
      : "ACTIVE";
  const flag =
    String(activeFlag || "Y").toUpperCase() === "N" ? "N" : "Y";

  if (safeValues.length !== 17) {
    throw new Error("Part insert requires 17 values.");
  }

  const [result] = await connection.execute(
    queries.INSERT_PART,
    [
      ...safeValues.slice(0, 15),
      status,
      flag,
      ...safeValues.slice(15),
    ]
  );

  return result.insertId;
}

export async function updatePart(
  partId,
  values,
  connection = db
) {
  if (!queries.UPDATE_PART) {
    throw new Error(
      "UPDATE_PART query is not exported from part.queries.js."
    );
  }

  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await connection.execute(
    queries.UPDATE_PART,
    [
      ...safeValues,
      Number(partId),
    ]
  );

  return result.affectedRows;
}

export async function updatePartStatus(
  partId,
  values
) {
  if (!queries.UPDATE_PART_STATUS) {
    throw new Error(
      "UPDATE_PART_STATUS query is not exported from part.queries.js."
    );
  }

  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await db.execute(
    queries.UPDATE_PART_STATUS,
    [
      ...safeValues,
      Number(partId),
    ]
  );

  return result.affectedRows;
}
