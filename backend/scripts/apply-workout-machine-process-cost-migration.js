import { db } from "../src/config/db.js";

async function addColumnIfMissing(tableName, columnName, definition) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?`,
    [tableName, columnName]
  );

  if (!Number(rows[0].total)) {
    await db.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN ${columnName} ${definition}`
    );
  }
}

try {
  await addColumnIfMissing(
    "marketing_workout_process_costs",
    "total_cycle_time_seconds",
    "DECIMAL(14,4) NULL AFTER process_description"
  );
  await addColumnIfMissing(
    "marketing_workout_process_costs",
    "machine_cost_inr",
    "DECIMAL(18,4) NULL AFTER total_cycle_time_seconds"
  );
  await addColumnIfMissing(
    "marketing_workout_subpart_process_costs",
    "total_cycle_time_seconds",
    "DECIMAL(14,4) NULL AFTER process_description"
  );
  await addColumnIfMissing(
    "marketing_workout_subpart_process_costs",
    "machine_cost_inr",
    "DECIMAL(18,4) NULL AFTER total_cycle_time_seconds"
  );
  const [legacyMinuteColumn] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'marketing_workout_subpart_process_costs'
        AND column_name = 'total_cycle_time_minutes'`
  );
  if (Number(legacyMinuteColumn[0].total)) {
    await db.query(
      `UPDATE marketing_workout_subpart_process_costs
          SET total_cycle_time_seconds = COALESCE(total_cycle_time_seconds, total_cycle_time_minutes * 60)`
    );
  }
  await db.execute(
    `INSERT INTO marketing_reference_values
      (reference_type, value_code, display_label, numeric_value, sort_order, active_flag)
     VALUES
      ('MACHINING_PROCESS', 'TURNING', 'Turning', 300, 10, 'Y'),
      ('MACHINING_PROCESS', 'VMC', 'VMC', 500, 20, 'Y'),
      ('MACHINING_PROCESS', 'HMC', 'HMC', 1000, 30, 'Y')
     ON DUPLICATE KEY UPDATE
      display_label = VALUES(display_label),
      numeric_value = COALESCE(numeric_value, VALUES(numeric_value)),
      sort_order = VALUES(sort_order),
      active_flag = 'Y'`
  );

  console.log("Workout process cycle times, machine costs, and HMC process are ready.");
} finally {
  await db.end();
}
