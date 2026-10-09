import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

const columns = [
  "raw_material_source",
  "purchase_source_available",
  "material_source_details",
  "outsource_process_required",
  "outsource_source_details",
];

try {
  const [rows] = await db.execute(
    `SELECT column_name AS columnName
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name IN (?, ?, ?, ?, ?)`,
    ["marketing_feasibilities", ...columns]
  );

  const existing = new Set(rows.map((row) => row.columnName));

  if (columns.every((column) => existing.has(column))) {
    console.log("Feasibility sourcing columns already exist.");
  } else if (existing.size > 0) {
    throw new Error(
      "Feasibility sourcing migration is partially applied. Verify the marketing_feasibilities columns before retrying."
    );
  } else {
    const sql = await fs.readFile(
      new URL(
        "../database/feasibility-sourcing-fields-migration.sql",
        import.meta.url
      ),
      "utf8"
    );

    await db.query(sql);
    console.log("Feasibility sourcing fields migration applied.");
  }
} finally {
  await db.end();
}
