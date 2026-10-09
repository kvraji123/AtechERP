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
  const source = await fs.readFile(new URL("../database/purchase-module-migration.sql", import.meta.url), "utf8");
  // MySQL 5.7 and some hosted-compatible engines do not support
  // `ADD COLUMN IF NOT EXISTS`. The migration is additive, so execute
  // ordered statements and ignore duplicate-column reruns.
  const statements = source
    .replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_TABLE_EXISTS_ERROR"].includes(error.code)) continue;
      throw error;
    }
  }
  console.log("Purchase module migration applied.");
} finally {
  await connection.end();
}
