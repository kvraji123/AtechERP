import fs from "node:fs/promises";

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

  if (Number(rows[0].total) === 0) {
    await db.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`
    );
  }
}

try {
  await addColumnIfMissing(
    "marketing_enquiry_parts",
    "is_assembled_part",
    "TINYINT(1) NOT NULL DEFAULT 0 AFTER alternative_material"
  );
  await addColumnIfMissing(
    "marketing_workouts",
    "assembly_labour_cost_inr",
    "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER additional_material_cost_inr"
  );

  const sql = await fs.readFile(
    new URL("../database/workout-subparts-schema.sql", import.meta.url),
    "utf8"
  );
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  await db.query(
    `ALTER TABLE marketing_workout_subparts
     MODIFY COLUMN material_type VARCHAR(50) NULL`
  );
  console.log("Workout sub-part migration applied successfully.");
} finally {
  await db.end();
}
