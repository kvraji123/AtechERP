import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS columnCount
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [
      "marketing_enquiry_parts",
      "alternative_material",
    ]
  );

  if (Number(rows[0]?.columnCount || 0) === 0) {
    const sql = await fs.readFile(
      new URL(
        "../database/enquiry-alternative-material-migration.sql",
        import.meta.url
      ),
      "utf8"
    );

    await db.query(sql);
    console.log("Enquiry alternative material migration applied.");
  } else {
    console.log("Enquiry alternative material column already exists.");
  }
} finally {
  await db.end();
}
