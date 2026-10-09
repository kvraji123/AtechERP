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

async function addMissingColumns(table, definitions) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  const existing = new Set(rows.map((row) => row.COLUMN_NAME));
  for (const [column, definition] of Object.entries(definitions)) {
    if (!existing.has(column)) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

try {
  await connection.query(await fs.readFile(new URL("./feasibility-schema.sql", import.meta.url), "utf8"));
  await addMissingColumns("marketing_reference_values", {
    numeric_value: "DECIMAL(18,6) NULL AFTER display_label",
    effective_date: "DATE NULL AFTER numeric_value",
  });
  await connection.query(await fs.readFile(new URL("./workout-schema.sql", import.meta.url), "utf8"));
  await addMissingColumns("marketing_workouts", {
    exchange_rate_effective_date: "DATE NULL AFTER currency_rate",
    profit_calculation_type: "VARCHAR(20) NOT NULL DEFAULT 'FIXED_AMOUNT' AFTER overhead_profit_percent",
    profit_value: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER profit_calculation_type",
    required_quantity_snapshot: "DECIMAL(14,3) NULL AFTER annual_quantity",
    material_rate_per_kg: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER weight_kg",
    additional_material_cost_inr: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER material_rate_per_kg",
    material_cost_foreign: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER material_cost_inr",
    profit_amount_inr: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER overhead_profit_amount_inr",
    adjusted_machining_cost_inr: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER profit_amount_inr",
    adjusted_machining_cost_foreign: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER adjusted_machining_cost_inr",
    commission_amount_inr: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER part_price_fob_foreign",
    final_part_price_fob_inr: "DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER commission_amount_foreign",
    completed_by_name: "VARCHAR(200) NULL AFTER submitted_on",
    completed_by_role: "VARCHAR(100) NULL AFTER completed_by_name",
  });
  console.log("Workout database upgrade applied successfully.");
} finally {
  await connection.end();
}
