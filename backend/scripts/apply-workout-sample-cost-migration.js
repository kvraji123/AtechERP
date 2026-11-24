import { db } from "../src/config/db.js";

async function addColumnIfMissing(columnName, definition) {
  const [columns] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'marketing_workouts'
        AND column_name = ?`,
    [columnName]
  );
  if (!Number(columns[0].total)) {
    await db.query(`ALTER TABLE marketing_workouts ADD COLUMN ${columnName} ${definition}`);
  }
}

try {
  await addColumnIfMissing("sample_cost_inr", "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER trial_cost_inr");
  await addColumnIfMissing("sample_cost_percent", "DECIMAL(7,4) NOT NULL DEFAULT 0 AFTER trial_cost_inr");
  console.log("Workout sample-cost percentage and calculated sample-cost fields are ready.");
} finally {
  await db.end();
}
