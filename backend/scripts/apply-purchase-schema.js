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
  const sql = await fs.readFile(new URL("../database/purchase-schema.sql", import.meta.url), "utf8");
  await connection.query(sql);
  console.log("Purchase base schema applied.");
} finally {
  await connection.end();
}
