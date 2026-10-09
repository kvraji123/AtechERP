import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({ ...env.db, multipleStatements: true });
try {
  const source = await fs.readFile(new URL("../database/gate-entry-party-migration.sql", import.meta.url), "utf8");
  const statements = source.replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN").replace(/ADD KEY IF NOT EXISTS/gi, "ADD KEY").split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean);
  for (const statement of statements) {
    try { await connection.query(statement); }
    catch (error) { if (["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME"].includes(error.code)) continue; throw error; }
  }
  console.log("Gate entry party migration applied.");
} finally { await connection.end(); }
