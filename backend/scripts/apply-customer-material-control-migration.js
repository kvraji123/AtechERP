import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
  database: env.db.database, multipleStatements: true,
});

try {
  const source = await fs.readFile(new URL("../database/customer-material-control-migration.sql", import.meta.url), "utf8");
  const statements = source.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    try { await connection.query(statement); }
    catch (error) {
      if (["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_CANT_DROP_FIELD_OR_KEY"].includes(error.code)) continue;
      throw error;
    }
  }
  console.log("Customer material control migration applied.");
} finally {
  await connection.end();
}
