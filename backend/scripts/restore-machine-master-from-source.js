import fs from "node:fs/promises";
import mysql from "mysql2/promise";

import { env } from "../src/config/env.js";

// Applies the verified Machine Master workbook import without deleting existing
// records. This is intentionally safe to run more than once: the source SQL
// matches records by its stable MM-001 ... MM-011 keys and updates them.
await import("./apply-machine-master-migration.js");

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  multipleStatements: true,
});

async function runDelimitedImport(fileName) {
  const sql = await fs.readFile(new URL(`../database/${fileName}`, import.meta.url), "utf8");
  const delimiterStart = sql.indexOf("DELIMITER $$");
  const delimiterEnd = sql.indexOf("DELIMITER ;", delimiterStart);

  if (delimiterStart < 0 || delimiterEnd < 0) {
    throw new Error(`${fileName} does not contain the expected stored-procedure delimiters.`);
  }

  const beforeProcedure = sql.slice(0, delimiterStart);
  const procedureBlock = sql.slice(delimiterStart + "DELIMITER $$".length, delimiterEnd);
  const afterProcedure = sql.slice(delimiterEnd + "DELIMITER ;".length);

  await connection.query(beforeProcedure);
  for (const statement of procedureBlock.split("$$").map((value) => value.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  await connection.query(afterProcedure);
}

try {
  await runDelimitedImport("01-machine-items-from-machine-master.sql");
  await runDelimitedImport("02-machine-master-from-machine-master.sql");

  const [[counts]] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM machine_type_master WHERE active_flag='Y') AS machine_types,
      (SELECT COUNT(*) FROM machine_master WHERE active_flag='Y') AS machines,
      (SELECT COUNT(*) FROM machine_unit WHERE unit_status='ACTIVE') AS machine_units
  `);

  if (Number(counts.machine_types) < 7 || Number(counts.machines) !== 11 || Number(counts.machine_units) !== 18) {
    throw new Error(`Machine Master restore verification failed: ${JSON.stringify(counts)}`);
  }

  console.log(`Machine Master restored: ${counts.machine_types} types, ${counts.machines} machines, ${counts.machine_units} units.`);
} finally {
  await connection.end();
}
