import fs from "fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const schemaSql = await fs.readFile(
  new URL("../database/part-process-inspection-schema.sql", import.meta.url), "utf8"
);
const toleranceSql = await fs.readFile(
  new URL("../database/tolerance-grade-master-data.sql", import.meta.url), "utf8"
);
const variantsSql = await fs.readFile(
  new URL("../database/process-plan-variants-shared-definitions-migration.sql", import.meta.url), "utf8"
);
const consumersSql = await fs.readFile(
  new URL("../database/process-plan-consumer-links-migration.sql", import.meta.url), "utf8"
);
const sql = `${schemaSql}\n${toleranceSql}\n${variantsSql}\n${consumersSql}`;

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user,
  password: env.db.password, database: env.db.database, multipleStatements: true,
});

try {
  await connection.query(sql);
  console.log("Part Process Flow and Inspection Plan schema applied successfully.");
} finally {
  await connection.end();
}
