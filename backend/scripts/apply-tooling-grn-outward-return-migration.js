import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const connection = await mysql.createConnection({
  host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.database,
});

async function exists(sql, values) {
  const [rows] = await connection.execute(sql, values);
  return Boolean(rows[0]?.existsFlag);
}

try {
  const databaseName = env.db.database;
  const column = (name) => exists("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name='tooling_regrind_batches' AND column_name=?) AS existsFlag", [databaseName, name]);
  const index = (name) => exists("SELECT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=? AND table_name='tooling_regrind_batches' AND index_name=?) AS existsFlag", [databaseName, name]);
  const steps = [
    { exists: () => column("material_outward_document_id"), sql: "ALTER TABLE tooling_regrind_batches ADD COLUMN material_outward_document_id BIGINT UNSIGNED NULL AFTER dispatch_bin_location" },
    { exists: () => column("return_grn_number"), sql: "ALTER TABLE tooling_regrind_batches ADD COLUMN return_grn_number VARCHAR(80) NULL AFTER material_outward_document_id" },
    { exists: () => column("return_gate_entry_id"), sql: "ALTER TABLE tooling_regrind_batches ADD COLUMN return_gate_entry_id BIGINT UNSIGNED NULL AFTER return_grn_number" },
    { exists: () => index("uq_tooling_regrind_return_grn"), sql: "ALTER TABLE tooling_regrind_batches ADD UNIQUE KEY uq_tooling_regrind_return_grn (tenant_id,return_grn_number)" },
    { exists: () => index("ix_tooling_regrind_outward_document"), sql: "ALTER TABLE tooling_regrind_batches ADD KEY ix_tooling_regrind_outward_document (material_outward_document_id)" },
    { exists: () => index("ix_tooling_regrind_return_gate"), sql: "ALTER TABLE tooling_regrind_batches ADD KEY ix_tooling_regrind_return_gate (return_gate_entry_id)" },
  ];
  for (const step of steps) if (!await step.exists()) await connection.query(step.sql);
  console.log("Tooling GRN Outward and Tool Return migration applied.");
} finally {
  await connection.end();
}
