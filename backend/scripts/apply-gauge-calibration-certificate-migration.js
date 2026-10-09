import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  multipleStatements: true,
});

try {
  const sql = await fs.readFile(new URL("../database/gauge-calibration-certificate-migration.sql", import.meta.url), "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const executable = statement.replace(/^(?:--[^\r\n]*(?:\r?\n|$))+/g, "").trim();
    const addColumn = executable.match(/^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?\s+ADD\s+COLUMN\s+`?([a-z0-9_]+)`?/i);
    if (addColumn) {
      const [, tableName, columnName] = addColumn;
      const [existing] = await connection.execute(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`,
        [tableName, columnName]
      );
      if (existing.length) continue;
    }
    await connection.query(executable);
  }
  console.log("Gauge calibration certificate migration applied.");
} finally {
  await connection.end();
}
