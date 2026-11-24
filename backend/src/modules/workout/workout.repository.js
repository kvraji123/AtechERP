import { db } from "../../config/db.js";

export async function getPart(enquiryPartId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT P.*, E.doc_no, E.po_reference, E.customer_name_snapshot,
            E.current_stage, E.save_status AS enquiry_save_status,
            F.feasibility_decision, F.save_status AS feasibility_save_status,
            F.payment_terms AS feasibility_payment_terms
       FROM marketing_enquiry_parts P
       INNER JOIN marketing_enquiries E ON E.enquiry_id = P.enquiry_id
       LEFT JOIN marketing_feasibilities F ON F.enquiry_part_id = P.enquiry_part_id
      WHERE P.enquiry_part_id = ? AND P.active_flag = 'Y'`,
    [Number(enquiryPartId)]
  );
  return rows[0] || null;
}

export async function getEnquiryParts(enquiryId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT P.enquiry_part_id AS enquiryPartId, P.part_number AS partNumber,
            P.item_code AS itemCode, P.drawing_number AS drawingNumber,
            P.product_description AS productDescription, P.part_status AS partStatus
       FROM marketing_enquiry_parts P
       INNER JOIN marketing_feasibilities F ON F.enquiry_part_id = P.enquiry_part_id
      WHERE P.enquiry_id = ? AND P.active_flag = 'Y'
        AND F.feasibility_decision = 'FEASIBLE'
        AND F.save_status IN ('CLOSED', 'SUBMITTED')
      ORDER BY P.line_number`,
    [Number(enquiryId)]
  );
  return rows;
}

export async function getPartProcessPlans(partId, connection = db) {
  if (!Number(partId)) return [];
  const [rows] = await connection.execute(`SELECT process_plan_id AS processPlanId,
    plan_code AS planCode,route_name AS routeName,production_capacity_per_day AS productionCapacityPerDay,
    plan_status AS planStatus,is_default AS isDefault
    FROM part_process_plan WHERE part_id=? AND active_flag='Y'
    ORDER BY is_default DESC,(plan_status='APPROVED') DESC,process_plan_id`, [Number(partId)]);
  return rows;
}

export async function getReferenceValues(connection = db) {
  const [rows] = await connection.execute(
    `SELECT reference_type AS referenceType, value_code AS valueCode,
            display_label AS displayLabel, numeric_value AS numericValue,
            effective_date AS effectiveDate
       FROM marketing_reference_values
      WHERE active_flag = 'Y'
        AND reference_type IN ('CURRENCY', 'MACHINING_PROCESS', 'SUBPART_MATERIAL_TYPE')
      ORDER BY reference_type, sort_order, display_label`
  );
  return rows;
}

export async function getWorkout(enquiryPartId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT * FROM marketing_workouts WHERE enquiry_part_id = ?`,
    [Number(enquiryPartId)]
  );
  if (!rows.length) return null;
  const workout = rows[0];
  const [notes, processCosts, subparts] = await Promise.all([
    connection.execute(
      `SELECT workout_note_id AS workoutNoteId, note_text AS noteText,
              display_order AS displayOrder
         FROM marketing_workout_notes
        WHERE workout_id = ? AND active_flag = 'Y'
        ORDER BY display_order`,
      [workout.workout_id]
    ).then(([result]) => result),
    connection.execute(
      `SELECT workout_process_cost_id AS workoutProcessCostId,
              process_type AS processType,
              process_description AS description,
              total_cycle_time_seconds AS totalCycleTimeSeconds,
              machine_cost_inr AS machineCostInr,
              cost_inr AS costInr,
              display_order AS displayOrder
         FROM marketing_workout_process_costs
        WHERE workout_id = ? AND active_flag = 'Y'
        ORDER BY display_order`,
      [workout.workout_id]
    ).then(([result]) => result),
    getWorkoutSubparts(connection, workout.workout_id),
  ]);
  return { ...workout, notes, processCosts, subparts };
}

async function getWorkoutSubparts(connection, workoutId) {
  const [rows] = await connection.execute(
    `SELECT workout_subpart_id AS workoutSubpartId,
            line_number AS lineNumber,
            part_name AS partName,
            part_drawing_number AS partDrawingNumber,
            material_type AS materialType,
            material_and_grade AS materialAndGrade,
            material_price_per_kg AS materialPricePerKg,
            rm_weight_kg AS rmWeightKg,
            material_cost_inr AS materialCostInr,
            total_machining_cost_inr AS totalMachiningCostInr,
            pattern_cost_inr AS patternCostInr,
            fixture_cost_inr AS fixtureCostInr,
            special_tool_cost_inr AS specialToolCostInr,
            gauge_cost_inr AS gaugeCostInr,
            trial_cost_inr AS trialCostInr,
            total_development_cost_inr AS totalDevelopmentCostInr
       FROM marketing_workout_subparts
      WHERE workout_id = ? AND active_flag = 'Y'
      ORDER BY line_number`,
    [workoutId]
  );

  return Promise.all(rows.map(async (subpart) => {
    const [processCosts] = await connection.execute(
      `SELECT workout_subpart_process_cost_id AS workoutSubpartProcessCostId,
              process_type AS processType,
              process_description AS description,
              total_cycle_time_seconds AS totalCycleTimeSeconds,
              machine_cost_inr AS machineCostInr,
              cost_inr AS costInr,
              display_order AS displayOrder
         FROM marketing_workout_subpart_process_costs
        WHERE workout_subpart_id = ? AND active_flag = 'Y'
        ORDER BY display_order`,
      [subpart.workoutSubpartId]
    );
    return { ...subpart, processCosts };
  }));
}

export async function upsertWorkout(connection, part, workoutNo, data, totals, userCode, saveStatus, masterConnection = connection) {
  const requestedProcessPlanId = Number(data.processPlanId || 0);
  const [processPlans] = part.part_id ? await masterConnection.execute(`SELECT process_plan_id AS processPlanId
    FROM part_process_plan WHERE part_id=? AND active_flag='Y'
      AND (?=0 OR process_plan_id=?)
    ORDER BY (process_plan_id=?) DESC,is_default DESC,(plan_status='APPROVED') DESC,process_plan_id
    LIMIT 1`, [Number(part.part_id),requestedProcessPlanId,requestedProcessPlanId,requestedProcessPlanId]) : [[]];
  const values = {
    workoutNo,
    enquiryId: part.enquiry_id,
    enquiryPartId: part.enquiry_part_id,
    processPlanId: processPlans[0]?.processPlanId || null,
    workoutDate: data.workoutDate,
    referenceNo: part.po_reference || null,
    currencyCode: data.currencyCode,
    currencyRate: totals.currencyRate,
    exchangeRateEffectiveDate: data.exchangeRateEffectiveDate || null,
    overheadPercent: totals.overheadPercent,
    profitCalculationType: totals.profitCalculationType,
    profitValue: totals.profitValue,
    commissionPercent: totals.commissionPercent,
    paymentTerms: data.paymentTerms || null,
    developmentTime: data.developmentTime || null,
    pilotBatchDelivery: data.pilotBatchDelivery || null,
    itemCode: part.item_code || null,
    drawingNumber: part.drawing_number,
    revisionNumber: part.drawing_revision_number || null,
    description: part.product_description,
    annualQuantity: part.annual_quantity || null,
    requiredQuantity:
      part.required_quantity || part.annual_quantity || null,
    moq: Number(data.moq || 0),
    material: part.material_and_grade,
    weightKg: totals.weightKg,
    materialRate: totals.materialRate,
    additionalMaterialCost: totals.additionalMaterialCost,
    assemblyLabourCost: totals.assemblyLabour,
    materialCost: totals.materialCost,
    actualMaterialCost: totals.actualMaterialCost,
    materialCostForeign: totals.materialCostForeign,
    turning: totals.legacy.TURNING,
    vmc: totals.legacy.VMC,
    keywaySpline: totals.legacy.KEYWAY_SPLINE,
    heatTreatment: totals.legacy.HEAT_TREATMENT,
    shapingGear: totals.legacy.SHAPING_GEAR,
    packing: totals.packing,
    totalMachining: totals.totalMachining,
    overheadAmount: totals.overheadAmount,
    profitAmount: totals.profitAmount,
    adjustedMachining: totals.adjustedMachining,
    adjustedMachiningForeign: totals.adjustedMachiningForeign,
    packingForeign: totals.packingForeign,
    partPriceBeforeCommission: totals.partPriceBeforeCommission,
    partPriceBeforeCommissionForeign: totals.partPriceBeforeCommissionForeign,
    commissionAmountInr: totals.commissionAmount,
    commissionAmountForeign: totals.commissionAmountForeign,
    finalPartPriceInr: totals.finalPartPrice,
    finalPartPriceForeign: totals.finalPartPriceForeign,
    pattern: totals.pattern,
    fixture: totals.fixture,
    specialTool: totals.specialTool,
    gauge: totals.gauge,
    trial: totals.trial,
    sampleCostPercent: totals.sampleCostPercent,
    sample: totals.sample,
    totalDevelopment: totals.totalDevelopment,
    totalDevelopmentForeign: totals.totalDevelopmentForeign,
    saveStatus,
    userCode,
  };

  await connection.execute(
    `INSERT INTO marketing_workouts (
       workout_no, enquiry_id, enquiry_part_id, process_plan_id, workout_date, reference_no,
       currency_code, currency_rate, exchange_rate_effective_date,
       overhead_profit_percent, profit_calculation_type, profit_value,
       commission_percent, payment_terms, development_time, pilot_batch_delivery,
       item_code, machining_drawing_number, revision_number, description,
       annual_quantity, required_quantity_snapshot, moq, material, weight_kg,
       material_rate_per_kg, additional_material_cost_inr, assembly_labour_cost_inr, material_cost_inr, actual_material_cost_inr,
       material_cost_foreign, turning_cost_inr, vmc_cost_inr,
       keyway_spline_cost_inr, heat_treatment_cost_inr, shaping_gear_cost_inr,
       packing_forwarding_cost_inr, total_machining_cost_inr,
       overhead_profit_amount_inr, profit_amount_inr,
       adjusted_machining_cost_inr, adjusted_machining_cost_foreign,
       part_cost_with_overhead_inr, part_cost_with_overhead_foreign,
       machining_cost_with_va_inr, packing_cost_foreign,
       part_price_fob_inr, part_price_fob_foreign,
       commission_amount_inr, commission_amount_foreign,
       final_part_price_fob_inr, final_part_price_fob_foreign,
       pattern_cost_inr, fixture_cost_inr, special_tool_cost_inr,
       gauge_cost_inr, trial_cost_inr, sample_cost_percent, sample_cost_inr, total_development_cost_inr,
       total_development_cost_foreign, save_status, active_flag, created_by, updated_by
     ) VALUES (
       :workoutNo, :enquiryId, :enquiryPartId, :processPlanId, :workoutDate, :referenceNo,
       :currencyCode, :currencyRate, :exchangeRateEffectiveDate,
       :overheadPercent, :profitCalculationType, :profitValue,
       :commissionPercent, :paymentTerms, :developmentTime, :pilotBatchDelivery,
       :itemCode, :drawingNumber, :revisionNumber, :description,
       :annualQuantity, :requiredQuantity, :moq, :material, :weightKg,
       :materialRate, :additionalMaterialCost, :assemblyLabourCost, :materialCost, :actualMaterialCost, :materialCostForeign,
       :turning, :vmc, :keywaySpline, :heatTreatment, :shapingGear,
       :packing, :totalMachining, :overheadAmount, :profitAmount,
       :adjustedMachining, :adjustedMachiningForeign,
       :adjustedMachining, :adjustedMachiningForeign, :totalMachining,
       :packingForeign, :partPriceBeforeCommission, :partPriceBeforeCommissionForeign,
       :commissionAmountInr, :commissionAmountForeign,
       :finalPartPriceInr, :finalPartPriceForeign,
       :pattern, :fixture, :specialTool, :gauge, :trial, :sampleCostPercent, :sample,
       :totalDevelopment, :totalDevelopmentForeign, :saveStatus, 'Y', :userCode, :userCode
     ) ON DUPLICATE KEY UPDATE
       process_plan_id=VALUES(process_plan_id), workout_date=VALUES(workout_date), currency_code=VALUES(currency_code),
       currency_rate=VALUES(currency_rate), exchange_rate_effective_date=VALUES(exchange_rate_effective_date),
       overhead_profit_percent=VALUES(overhead_profit_percent),
       profit_calculation_type=VALUES(profit_calculation_type), profit_value=VALUES(profit_value),
       commission_percent=VALUES(commission_percent), payment_terms=VALUES(payment_terms),
       development_time=VALUES(development_time), pilot_batch_delivery=VALUES(pilot_batch_delivery),
       required_quantity_snapshot=VALUES(required_quantity_snapshot), moq=VALUES(moq),
       weight_kg=VALUES(weight_kg), material_rate_per_kg=VALUES(material_rate_per_kg),
       additional_material_cost_inr=VALUES(additional_material_cost_inr),
       assembly_labour_cost_inr=VALUES(assembly_labour_cost_inr),
       material_cost_inr=VALUES(material_cost_inr), actual_material_cost_inr=VALUES(actual_material_cost_inr), material_cost_foreign=VALUES(material_cost_foreign),
       turning_cost_inr=VALUES(turning_cost_inr), vmc_cost_inr=VALUES(vmc_cost_inr),
       keyway_spline_cost_inr=VALUES(keyway_spline_cost_inr),
       heat_treatment_cost_inr=VALUES(heat_treatment_cost_inr), shaping_gear_cost_inr=VALUES(shaping_gear_cost_inr),
       packing_forwarding_cost_inr=VALUES(packing_forwarding_cost_inr),
       total_machining_cost_inr=VALUES(total_machining_cost_inr),
       overhead_profit_amount_inr=VALUES(overhead_profit_amount_inr),
       profit_amount_inr=VALUES(profit_amount_inr),
       adjusted_machining_cost_inr=VALUES(adjusted_machining_cost_inr),
       adjusted_machining_cost_foreign=VALUES(adjusted_machining_cost_foreign),
       part_cost_with_overhead_inr=VALUES(part_cost_with_overhead_inr),
       part_cost_with_overhead_foreign=VALUES(part_cost_with_overhead_foreign),
       machining_cost_with_va_inr=VALUES(machining_cost_with_va_inr),
       packing_cost_foreign=VALUES(packing_cost_foreign),
       part_price_fob_inr=VALUES(part_price_fob_inr), part_price_fob_foreign=VALUES(part_price_fob_foreign),
       commission_amount_inr=VALUES(commission_amount_inr), commission_amount_foreign=VALUES(commission_amount_foreign),
       final_part_price_fob_inr=VALUES(final_part_price_fob_inr),
       final_part_price_fob_foreign=VALUES(final_part_price_fob_foreign),
       pattern_cost_inr=VALUES(pattern_cost_inr), fixture_cost_inr=VALUES(fixture_cost_inr),
       special_tool_cost_inr=VALUES(special_tool_cost_inr), gauge_cost_inr=VALUES(gauge_cost_inr),
       trial_cost_inr=VALUES(trial_cost_inr), sample_cost_percent=VALUES(sample_cost_percent), sample_cost_inr=VALUES(sample_cost_inr), total_development_cost_inr=VALUES(total_development_cost_inr),
       total_development_cost_foreign=VALUES(total_development_cost_foreign),
       save_status=VALUES(save_status), updated_by=VALUES(updated_by)`,
    values
  );
}

async function workoutId(connection, enquiryPartId) {
  const [rows] = await connection.execute(
    `SELECT workout_id FROM marketing_workouts WHERE enquiry_part_id = ?`,
    [Number(enquiryPartId)]
  );
  return rows[0].workout_id;
}

export async function replaceProcessCosts(connection, enquiryPartId, processCosts, userCode) {
  const id = await workoutId(connection, enquiryPartId);
  await connection.execute(`DELETE FROM marketing_workout_process_costs WHERE workout_id = ?`, [id]);
  for (let index = 0; index < processCosts.length; index += 1) {
    const line = processCosts[index];
    await connection.execute(
      `INSERT INTO marketing_workout_process_costs
       (workout_id, process_type, process_description, total_cycle_time_seconds, machine_cost_inr, cost_inr, display_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, line.processType, line.description || null, line.totalCycleTimeSeconds, line.machineCostInr, line.costInr, index + 1, userCode]
    );
  }
}

export async function replaceSubparts(connection, enquiryPartId, subparts, userCode) {
  const id = await workoutId(connection, enquiryPartId);
  await connection.execute(`DELETE FROM marketing_workout_subparts WHERE workout_id = ?`, [id]);

  for (let index = 0; index < subparts.length; index += 1) {
    const line = subparts[index];
    const [result] = await connection.execute(
      `INSERT INTO marketing_workout_subparts (
         workout_id, line_number, part_name, part_drawing_number,
         material_type, material_and_grade, material_price_per_kg,
         rm_weight_kg, material_cost_inr, total_machining_cost_inr,
         pattern_cost_inr, fixture_cost_inr, special_tool_cost_inr,
         gauge_cost_inr, trial_cost_inr, total_development_cost_inr,
         active_flag, created_by, updated_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', ?, ?)`,
      [
        id,
        index + 1,
        line.partName,
        line.partDrawingNumber,
        line.materialType,
        line.materialAndGrade,
        line.materialPricePerKg,
        line.rmWeightKg,
        line.materialCostInr,
        line.totalMachiningCostInr,
        line.patternCostInr,
        line.fixtureCostInr,
        line.specialToolCostInr,
        line.gaugeCostInr,
        line.trialCostInr,
        line.totalDevelopmentCostInr,
        userCode,
        userCode,
      ]
    );

    for (let processIndex = 0; processIndex < line.processCosts.length; processIndex += 1) {
      const process = line.processCosts[processIndex];
      await connection.execute(
        `INSERT INTO marketing_workout_subpart_process_costs (
           workout_subpart_id, process_type, process_description,
           total_cycle_time_seconds, machine_cost_inr, cost_inr,
           display_order, active_flag, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Y', ?)`,
        [
          result.insertId,
          process.processType,
          process.description,
          process.totalCycleTimeSeconds,
          process.machineCostInr,
          process.costInr,
          processIndex + 1,
          userCode,
        ]
      );
    }
  }
}

export async function replaceNotes(connection, enquiryPartId, notes, userCode) {
  const id = await workoutId(connection, enquiryPartId);
  await connection.execute(`DELETE FROM marketing_workout_notes WHERE workout_id = ?`, [id]);
  for (let index = 0; index < notes.length; index += 1) {
    const note = String(notes[index] || "").trim();
    if (!note) continue;
    await connection.execute(
      `INSERT INTO marketing_workout_notes
       (workout_id, note_text, display_order, active_flag, created_by)
       VALUES (?, ?, ?, 'Y', ?)`,
      [id, note, index + 1, userCode]
    );
  }
}

export async function refreshQuotationItemsForWorkout(
  connection,
  enquiryPartId,
  userCode
) {
  const id = await workoutId(connection, enquiryPartId);
  const [result] = await connection.execute(
    `UPDATE marketing_quotation_items QI
       INNER JOIN marketing_workouts W ON W.workout_id=QI.workout_id
       INNER JOIN marketing_enquiry_parts P ON P.enquiry_part_id=W.enquiry_part_id
          SET QI.moq=W.moq,
              QI.process_plan_id=W.process_plan_id,
              QI.material=P.material_and_grade,
              QI.weight_kg=W.weight_kg,
              QI.currency_code=W.currency_code,
              QI.part_price_fob_inr=W.final_part_price_fob_inr,
              QI.part_price_fob_foreign=W.final_part_price_fob_foreign,
              QI.total_development_cost_inr=W.total_development_cost_inr,
              QI.total_development_cost_foreign=W.total_development_cost_foreign
        WHERE W.workout_id=?`,
    [id]
  );

  if (result.affectedRows > 0) {
    await connection.execute(
      `UPDATE marketing_quotations Q
         INNER JOIN marketing_quotation_items QI
                 ON QI.quotation_id=Q.quotation_id
            SET Q.pdf_status='NOT_GENERATED',
                Q.pdf_file_path=NULL,
                Q.pdf_generated_on=NULL,
                Q.updated_by=?
          WHERE QI.workout_id=?`,
      [userCode, id]
    );
  }
}

export async function completeWorkout(connection, part, user) {
  await connection.execute(
    `UPDATE marketing_workouts
        SET save_status='COMPLETED', submitted_by=?, submitted_on=CURRENT_TIMESTAMP,
            completed_by_name=?, completed_by_role=?, updated_by=?
      WHERE enquiry_part_id=?`,
    [user.userCode, user.employeeName, user.role, user.userCode, part.enquiry_part_id]
  );
  await connection.execute(
    `UPDATE marketing_enquiry_parts SET part_status='WORKOUT_COMPLETED', updated_by=?
      WHERE enquiry_part_id=?`,
    [user.userCode, part.enquiry_part_id]
  );
  const [pending] = await connection.execute(
    `SELECT COUNT(*) AS total
       FROM marketing_enquiry_parts P
       INNER JOIN marketing_feasibilities F ON F.enquiry_part_id=P.enquiry_part_id
      WHERE P.enquiry_id=? AND P.active_flag='Y'
        AND F.feasibility_decision='FEASIBLE'
        AND F.save_status IN ('CLOSED','SUBMITTED')
        AND P.part_status <> 'WORKOUT_COMPLETED'`,
    [part.enquiry_id]
  );
  if (Number(pending[0].total) === 0) {
    await connection.execute(
      `UPDATE marketing_enquiries SET current_stage='QUOTATION', enquiry_status='IN_PROGRESS', updated_by=? WHERE enquiry_id=?`,
      [user.userCode, part.enquiry_id]
    );
  }
}
