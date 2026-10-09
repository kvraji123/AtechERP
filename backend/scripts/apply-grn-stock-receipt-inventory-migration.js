import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.database, multipleStatements: true });
try {
  const source = await fs.readFile(new URL("../database/grn-stock-receipt-inventory-migration.sql", import.meta.url), "utf8");
  const statements = source.replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN").split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    try { await connection.query(statement); }
    catch (error) { if (["ER_DUP_FIELDNAME", "ER_TABLE_EXISTS_ERROR"].includes(error.code)) continue; throw error; }
  }
  console.log("GRN stock receipt inventory migration applied.");
} finally { await connection.end(); }
