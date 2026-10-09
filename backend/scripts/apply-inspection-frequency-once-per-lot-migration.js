import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const sql = await fs.readFile(
  new URL("../database/inspection-frequency-once-per-lot-migration.sql", import.meta.url),
  "utf8"
);

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  multipleStatements: true,
});

try {
  await connection.query(sql);
  console.log("Once per Lot inspection frequency added successfully.");
} finally {
  await connection.end();
}
