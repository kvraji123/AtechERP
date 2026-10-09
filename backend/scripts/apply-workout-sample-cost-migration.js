import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const [columns] = await db.query(
    "SHOW COLUMNS FROM marketing_workouts LIKE 'sample_cost_inr'"
  );

  if (!columns.length) {
    const sql = await fs.readFile(
      new URL("../database/workout-sample-cost-migration.sql", import.meta.url),
      "utf8"
    );
    await db.query(sql.trim());
    console.log("Workout Sample Cost column added successfully.");
  } else {
    console.log("Workout Sample Cost column already exists; no change was needed.");
  }
} finally {
  await db.end();
}
