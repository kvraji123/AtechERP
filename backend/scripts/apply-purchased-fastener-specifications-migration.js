import fs from "fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const source = await fs.readFile(
  new URL("../database/purchased-fastener-specifications-migration.sql", import.meta.url),
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
  await connection.query(source);
  console.log("Purchased Fastener specification fields applied.");
} finally {
  await connection.end();
}
