import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const sql = await fs.readFile(new URL("../database/party-transport-modes-migration.sql", import.meta.url), "utf8");
const connection = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.database, multipleStatements: true });

try {
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const executable = statement.replace(/^(?:--[^\r\n]*(?:\r?\n|$))+/g, "").trim();
    const addColumn = executable.match(/^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-z0-9_]+)`?/i);
    if (addColumn) {
      const [, tableName, columnName] = addColumn;
      const [existing] = await connection.execute(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [tableName, columnName]
      );
      if (existing.length) continue;
    }
    await connection.query(executable.replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, "ADD COLUMN"));
  }
  console.log("Party allowed transport modes and shipment transport-mode fields migrated successfully.");
} finally {
  await connection.end();
}
