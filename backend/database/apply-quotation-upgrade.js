import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  multipleStatements: true,
});

try {
  await connection.query(await fs.readFile(new URL("./quotation-schema.sql", import.meta.url), "utf8"));
  console.log("Quotation database upgrade applied successfully.");
} finally {
  await connection.end();
}
