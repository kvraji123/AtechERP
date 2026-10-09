import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const sql = await fs.readFile(
    new URL(
      "../database/enquiry-in-progress-status-migration.sql",
      import.meta.url
    ),
    "utf8"
  );

  for (const statement of sql.split(";").map((item) => item.trim()).filter(Boolean)) {
    await db.query(statement);
  }

  const [rows] = await db.query(
    `SELECT enquiry_status AS enquiryStatus, COUNT(*) AS total
     FROM marketing_enquiries
     GROUP BY enquiry_status
     ORDER BY enquiry_status`
  );

  console.log(JSON.stringify({
    message: "Enquiry In Progress status migration applied.",
    statuses: rows,
  }, null, 2));
} finally {
  await db.end();
}
