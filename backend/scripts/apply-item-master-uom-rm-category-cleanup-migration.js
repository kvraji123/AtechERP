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
  const source = await fs.readFile(
    new URL("../database/item-master-uom-rm-category-cleanup-migration.sql", import.meta.url),
    "utf8"
  );
  await connection.query(source);
  console.log("Retired duplicate KGS UOM and obsolete Raw Material categories.");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
