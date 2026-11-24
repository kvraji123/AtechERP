import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password,
  database: env.db.database, multipleStatements: true,
});

try {
  const source = await fs.readFile(new URL("../database/inventory-control-migration.sql", import.meta.url), "utf8");
  // The source file remains MySQL 8 friendly; stripping the idempotency keywords
  // here also lets the controlled runner support a MySQL 5.7 production upgrade.
  const portableSource = source
    .replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN")
    .replace(/ADD (UNIQUE )?KEY IF NOT EXISTS/gi, "ADD $1KEY")
    .replace(/DROP INDEX IF EXISTS/gi, "DROP INDEX");
  const statements = portableSource.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_CANT_DROP_FIELD_OR_KEY"].includes(error.code)) continue;
      throw error;
    }
  }
  console.log("Production inventory control migration applied.");
} finally {
  await connection.end();
}
