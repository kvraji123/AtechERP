import fs from "fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const sql = await fs.readFile(
  new URL("../database/item-incoming-inspection-plan-migration.sql", import.meta.url), "utf8"
);

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user,
  password: env.db.password, database: env.db.database, multipleStatements: true,
});

try {
  await connection.query(sql);
  console.log("Item Master incoming inspection plan schema applied successfully.");
} finally {
  await connection.end();
}
