import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
  database: env.db.database, multipleStatements: true,
});

async function exists(kind, tableName, name) {
  const field = kind === "column" ? "column_name" : kind === "index" ? "index_name" : "constraint_name";
  const source = kind === "column" ? "columns" : kind === "index" ? "statistics" : "table_constraints";
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.${source} WHERE table_schema=DATABASE() AND table_name=? AND ${field}=?`,
    [tableName, name],
  );
  return rows.length > 0;
}

try {
  const source = await fs.readFile(new URL("../database/material-outward-calibration-dispatch-migration.sql", import.meta.url), "utf8");
  const statements = source.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    const executable = statement.replace(/^(?:--[^\r\n]*(?:\r?\n|$))+/g, "").trim();
    if (!executable) continue;
    const column = executable.match(/^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?\s+ADD\s+COLUMN\s+`?([a-z0-9_]+)`?/i);
    const index = executable.match(/^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?\s+ADD\s+(?:UNIQUE\s+)?KEY\s+`?([a-z0-9_]+)`?/i);
    const constraint = executable.match(/ADD\s+CONSTRAINT\s+`?([a-z0-9_]+)`?\s+FOREIGN\s+KEY/i);
    if (column && await exists("column", column[1], column[2])) continue;
    if (index && await exists("index", index[1], index[2])) continue;
    if (constraint && await exists("constraint", "gauge_movement_batches", constraint[1])) continue;
    await connection.query(executable);
  }
  console.log("Material Outward calibration dispatch migration applied.");
} finally {
  await connection.end();
}
