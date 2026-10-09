import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
  database: env.db.database, multipleStatements: true,
});

async function hasColumn(tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function hasIndex(tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema=DATABASE() AND table_name=? AND index_name=?`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function hasForeignKey(constraintName) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema=DATABASE() AND constraint_name=? AND constraint_type='FOREIGN KEY'`,
    [constraintName],
  );
  return rows.length > 0;
}

try {
  const source = await fs.readFile(new URL("../database/gauge-calibration-dispatch-migration.sql", import.meta.url), "utf8");
  const statements = source.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    const executable = statement.replace(/^(?:--[^\r\n]*(?:\r?\n|$))+/g, "").trim();
    if (!executable) continue;
    const addColumn = executable.match(/^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?\s+ADD\s+COLUMN\s+`?([a-z0-9_]+)`?/i);
    if (addColumn && await hasColumn(addColumn[1], addColumn[2])) continue;
    const addKey = executable.match(/^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?\s+ADD\s+KEY\s+`?([a-z0-9_]+)`?/i);
    if (addKey && await hasIndex(addKey[1], addKey[2])) continue;
    const addForeignKey = executable.match(/ADD\s+CONSTRAINT\s+`?([a-z0-9_]+)`?\s+FOREIGN\s+KEY/i);
    if (addForeignKey && await hasForeignKey(addForeignKey[1])) continue;
    await connection.query(executable);
  }
  console.log("Gauge calibration dispatch migration applied.");
} finally {
  await connection.end();
}
