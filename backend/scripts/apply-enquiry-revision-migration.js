import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const sql = await fs.readFile(
    new URL(
      "../database/enquiry-revision-history-migration.sql",
      import.meta.url
    ),
    "utf8"
  );

  await db.query(sql);

  const [rows] = await db.execute(
    `SELECT COUNT(*) AS tableCount
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    ["marketing_enquiry_revisions"]
  );

  if (Number(rows[0]?.tableCount || 0) !== 1) {
    throw new Error("Revision history table was not created.");
  }

  console.log("Enquiry revision history migration applied.");
} finally {
  await db.end();
}
