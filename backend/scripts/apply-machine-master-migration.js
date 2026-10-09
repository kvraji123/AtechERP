import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const sql = await fs.readFile(
  new URL("../database/machine-master-schema.sql", import.meta.url),
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
  const [beforeProcedure, procedureAndAfter] = sql.split("DELIMITER $$");
  const afterProcedure = procedureAndAfter.split("DELIMITER ;")[1];
  await connection.query(beforeProcedure);

  const [hourlyCostColumns] = await connection.execute(`SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='machine_type_master' AND column_name='hourly_cost_inr'`);
  if (!hourlyCostColumns.length) {
    await connection.query(`ALTER TABLE machine_type_master
      ADD COLUMN hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER machine_type_name`);
  }

  const [typeColumns] = await connection.execute(`SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='machine_type_id'`);
  if (!typeColumns.length) {
    await connection.query(`ALTER TABLE item_master
      ADD COLUMN machine_type_id BIGINT UNSIGNED NULL AFTER model_name`);
  }
  const [capacityColumns] = await connection.execute(`SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='machine_capacity'`);
  if (!capacityColumns.length) {
    await connection.query(`ALTER TABLE item_master
      ADD COLUMN machine_capacity VARCHAR(500) NULL AFTER machine_type_id`);
  }
  const [constraints] = await connection.execute(`SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema=DATABASE() AND table_name='item_master' AND constraint_name='fk_item_machine_type'`);
  if (!constraints.length) {
    await connection.query(`ALTER TABLE item_master ADD CONSTRAINT fk_item_machine_type
      FOREIGN KEY (machine_type_id) REFERENCES machine_type_master(machine_type_id)
      ON UPDATE CASCADE ON DELETE RESTRICT`);
  }
  await connection.query(afterProcedure);
  console.log("Machine Master schema and Item Master machine fields applied successfully.");
} finally {
  await connection.end();
}
