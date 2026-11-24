import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
});

try {
  const source = await fs.readFile(
    new URL("../database/inventory-location-subinventory-migration.sql", import.meta.url),
    "utf8",
  );
  const statements = source
    .replace(/^--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await connection.query(statement);
  console.log("Inventory warehouse, sub-inventory, and bin mapping is ready.");
} finally {
  await connection.end();
}
