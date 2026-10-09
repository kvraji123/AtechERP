import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const sql = await fs.readFile(
    new URL("../database/quotation-optional-costs-migration.sql", import.meta.url),
    "utf8"
  );
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  console.log("Quotation optional costs migration applied successfully.");
} finally {
  await db.end();
}
