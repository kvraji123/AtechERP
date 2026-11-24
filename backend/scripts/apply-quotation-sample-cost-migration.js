import { db } from "../src/config/db.js";

async function addColumnIfMissing() {
  const [columns] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'marketing_quotation_items'
        AND column_name = 'sample_cost_inr'`
  );
  if (!Number(columns[0].total)) {
    await db.query(
      `ALTER TABLE marketing_quotation_items
       ADD COLUMN sample_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0
       AFTER total_development_cost_foreign`
    );
  }
}

try {
  await addColumnIfMissing();
  await db.query(
    `UPDATE marketing_quotation_items QI
      INNER JOIN marketing_workouts W ON W.workout_id = QI.workout_id
         SET QI.sample_cost_inr = W.sample_cost_inr
       WHERE QI.sample_cost_inr = 0`
  );
  console.log("Quotation sample-cost snapshot is ready.");
} finally {
  await db.end();
}
