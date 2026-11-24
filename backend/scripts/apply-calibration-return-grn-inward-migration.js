import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({ ...env.db, multipleStatements: true });

async function exists(sql, values) {
  const [rows] = await connection.execute(sql, values);
  return Boolean(rows[0]?.existsFlag);
}

try {
  const databaseName = env.db.database;
  const steps = [
    {
      exists: () => exists("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name='purchase_gate_entries' AND column_name='service_type') AS existsFlag", [databaseName]),
      sql: "ALTER TABLE purchase_gate_entries ADD COLUMN service_type VARCHAR(40) NULL AFTER entry_type",
    },
    {
      exists: () => exists("SELECT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=? AND table_name='purchase_gate_entries' AND index_name='ix_gate_entry_service_type') AS existsFlag", [databaseName]),
      sql: "ALTER TABLE purchase_gate_entries ADD KEY ix_gate_entry_service_type (tenant_id, entry_type, service_type, status)",
    },
    {
      exists: () => exists("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name='gauge_movement_batches' AND column_name='gate_entry_id') AS existsFlag", [databaseName]),
      sql: "ALTER TABLE gauge_movement_batches ADD COLUMN gate_entry_id BIGINT UNSIGNED NULL AFTER material_outward_document_id",
    },
    {
      exists: () => exists("SELECT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=? AND table_name='gauge_movement_batches' AND index_name='uq_gauge_calibration_return_gate_entry') AS existsFlag", [databaseName]),
      sql: "ALTER TABLE gauge_movement_batches ADD UNIQUE KEY uq_gauge_calibration_return_gate_entry (gate_entry_id)",
    },
    {
      exists: () => exists("SELECT EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE table_schema=? AND table_name='gauge_movement_batches' AND constraint_name='fk_gauge_calibration_return_gate_entry') AS existsFlag", [databaseName]),
      sql: "ALTER TABLE gauge_movement_batches ADD CONSTRAINT fk_gauge_calibration_return_gate_entry FOREIGN KEY (gate_entry_id) REFERENCES purchase_gate_entries(gate_entry_id) ON UPDATE CASCADE ON DELETE RESTRICT",
    },
  ];

  for (const step of steps) {
    if (!await step.exists()) await connection.query(step.sql);
  }
  console.log("Calibration Return GRN Inward migration applied.");
} finally {
  await connection.end();
}
