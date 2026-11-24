import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({ ...env.db, multipleStatements: true });

try {
  const source = await fs.readFile(new URL("../database/gate-exit-migration.sql", import.meta.url), "utf8");
  const statements = source.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    const executable = statement.replace(/^(?:--[^\r\n]*(?:\r?\n|$))+/g, "").trim();
    if (executable) await connection.query(executable);
  }
  console.log("Gate exit migration applied.");
} finally {
  await connection.end();
}
