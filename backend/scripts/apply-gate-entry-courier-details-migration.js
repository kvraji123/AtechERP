import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({ ...env.db, multipleStatements: true });

try {
  const source = await fs.readFile(new URL("../database/gate-entry-courier-details-migration.sql", import.meta.url), "utf8");
  const statements = source.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    const executable = statement.replace(/^(?:--[^\r\n]*(?:\r?\n|$))+/g, "").trim();
    if (!executable) continue;
    try { await connection.query(executable); }
    catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
  }
  console.log("Gate entry courier details migration applied.");
} finally {
  await connection.end();
}
