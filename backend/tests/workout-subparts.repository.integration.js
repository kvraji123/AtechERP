import assert from "node:assert/strict";

import { db } from "../src/config/db.js";
import * as repository from "../src/modules/workout/workout.repository.js";

const connection = await db.getConnection();

try {
  await connection.beginTransaction();

  const [schemaColumns] = await connection.execute(
    `SELECT table_name AS tableName, column_name AS columnName
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND (
          (table_name = 'marketing_enquiry_parts' AND column_name = 'is_assembled_part')
          OR
          (table_name = 'marketing_workouts' AND column_name = 'assembly_labour_cost_inr')
        )`
  );
  assert.equal(schemaColumns.length, 2, "Workout sub-part columns are not fully migrated.");

  const [referenceRows] = await connection.execute(
    `SELECT value_code AS valueCode
       FROM marketing_reference_values
      WHERE reference_type = 'SUBPART_MATERIAL_TYPE'
        AND active_flag = 'Y'
      ORDER BY sort_order`
  );
  assert.deepEqual(referenceRows.map((row) => row.valueCode), ["PURCHASE", "MANUFACTURING"]);

  const [partRows] = await connection.execute(
    `SELECT enquiry_part_id
       FROM marketing_enquiry_parts
      WHERE active_flag = 'Y'
      ORDER BY enquiry_part_id
      LIMIT 1`
  );
  assert.ok(partRows.length, "At least one enquiry part is required for this integration test.");

  const part = await repository.getPart(partRows[0].enquiry_part_id, connection);
  assert.ok(part, "Test enquiry part could not be loaded.");

  const existing = await repository.getWorkout(part.enquiry_part_id, connection);
  const workoutNo = existing?.workout_no || `TEST/SUBPART/${Date.now()}`;
  const data = {
    workoutDate: "2026-07-29",
    currencyCode: "EUR",
    exchangeRateEffectiveDate: "2026-04-01",
    overheadPercent: 10,
    profitCalculationType: "FIXED_AMOUNT",
    profitValue: 300,
    commissionPercent: 0,
    paymentTerms: null,
    developmentTime: null,
    pilotBatchDelivery: null,
    moq: 10,
  };
  const totals = {
    currencyRate: 85,
    overheadPercent: 10,
    profitCalculationType: "FIXED_AMOUNT",
    profitValue: 300,
    commissionPercent: 0,
    weightKg: 0,
    materialRate: 0,
    additionalMaterialCost: 0,
    assemblyLabour: 600,
    materialCost: 425,
    materialCostForeign: 5,
    legacy: {
      TURNING: 0,
      VMC: 0,
      KEYWAY_SPLINE: 0,
      HEAT_TREATMENT: 0,
      SHAPING_GEAR: 0,
    },
    packing: 0,
    totalMachining: 1000,
    overheadAmount: 100,
    profitAmount: 300,
    adjustedMachining: 1400,
    adjustedMachiningForeign: 16.4706,
    packingForeign: 0,
    partPriceBeforeCommission: 1825,
    partPriceBeforeCommissionForeign: 21.4706,
    commissionAmount: 0,
    commissionAmountForeign: 0,
    finalPartPrice: 1825,
    finalPartPriceForeign: 21.4706,
    pattern: 0,
    fixture: 0,
    specialTool: 0,
    gauge: 0,
    trial: 0,
    totalDevelopment: 10000,
    totalDevelopmentForeign: 117.6471,
  };

  await repository.upsertWorkout(
    connection,
    part,
    workoutNo,
    data,
    totals,
    "INTEGRATION_TEST",
    "DRAFT"
  );
  await repository.replaceProcessCosts(connection, part.enquiry_part_id, [], "INTEGRATION_TEST");
  await repository.replaceSubparts(
    connection,
    part.enquiry_part_id,
    [{
      partName: "Housing",
      partDrawingNumber: "394849",
      materialType: "PURCHASE",
      materialAndGrade: "EN8 Steel",
      materialPricePerKg: 85,
      rmWeightKg: 5,
      materialCostInr: 425,
      totalMachiningCostInr: 400,
      patternCostInr: 10000,
      fixtureCostInr: 0,
      specialToolCostInr: 0,
      gaugeCostInr: 0,
      trialCostInr: 0,
      totalDevelopmentCostInr: 10000,
      processCosts: [
        { processType: "TURNING", description: null, costInr: 100 },
        { processType: "VMC", description: null, costInr: 300 },
      ],
    }],
    "INTEGRATION_TEST"
  );

  const reloaded = await repository.getWorkout(part.enquiry_part_id, connection);
  assert.equal(Number(reloaded.assembly_labour_cost_inr), 600);
  assert.equal(reloaded.subparts.length, 1);
  assert.equal(reloaded.subparts[0].partName, "Housing");
  assert.equal(reloaded.subparts[0].processCosts.length, 2);
  assert.equal(reloaded.subparts[0].processCosts[1].processType, "VMC");

  console.log("Workout sub-part repository integration test passed.");
  await connection.rollback();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await db.end();
}
