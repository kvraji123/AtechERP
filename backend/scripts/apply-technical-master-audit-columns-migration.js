import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const sql = await fs.readFile(
    new URL("../database/instrument-master-audit-columns-migration.sql", import.meta.url),
    "utf8"
  );
  const statements = sql
    .replace(/^--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const connection = await db.getConnection();
  try {
    for (const statement of statements) await connection.query(statement);
  } finally {
    connection.release();
  }
  console.log("Technical Master audit timestamp columns are ready.");
} finally {
  await db.end();
}
