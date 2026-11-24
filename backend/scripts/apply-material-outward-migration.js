import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const sql = await fs.readFile(
    new URL("../database/material-outward-migration.sql", import.meta.url),
    "utf8"
  );
  const statements = sql
    .replace(/^--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.query(statement);
  }
  console.log("Material Outward tables are ready.");
} finally {
  await db.end();
}
