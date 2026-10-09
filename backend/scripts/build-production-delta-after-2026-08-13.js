import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory,"../database");
const sections = [
  ["Process Plan variants and shared Process Definitions","process-plan-variants-shared-definitions-migration.sql"],
  ["Selected Process Plan links for Workouts and Quotations","process-plan-consumer-links-migration.sql"],
  ["Retired Item Master fields and Raw Material-only Material/Grade","item-master-field-removal-migration.sql"],
  ["Consumables-only Shelf Life Yes/No flag","consumable-shelf-life-radio-migration.sql"],
];

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - PRODUCTION DELTA",
  "-- Baseline: production-delta-after-master-schemas-2026-08-13.sql already applied",
  "-- Generated: 2026-08-17",
  "-- Target: MySQL 8.x",
  "-- ============================================================================",
  "-- IMPORTANT:",
  "--   1. Take and verify a production database backup before execution.",
  "--   2. Select the production database before running this file.",
  "--   3. Deploy the matching backend/frontend application immediately afterward.",
  "--   4. DDL statements auto-commit in MySQL; this migration cannot be rolled back",
  "--      as one transaction.",
  "--",
  "-- Intentional data cleanup:",
  "--   * Drops item_customer and its customer-specific Item mappings.",
  "--   * Drops make_buy_classification, stock_classification and valuation_method.",
  "--   * Clears Material/Grade on every non-Raw-Material Item.",
  "--   * Keeps Shelf Life and Shelf Life Days only for Consumable Items.",
  "-- ============================================================================",
  "",
  "SET NAMES utf8mb4;",
  "",
  "-- No DELIMITER/client commands are used, so this file works in Workbench,",
  "-- phpMyAdmin, MySQL CLI and programmatic multiple-statement runners.",
  "SELECT DATABASE() AS selected_database,",
  "  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()",
  "    AND table_name IN ('item_master','item_group_master','part_process_plan','part_process_operation',",
  "                       'marketing_workouts','marketing_quotation_items')) AS required_baseline_tables,",
  "  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()",
  "    AND table_name='part_process_operation' AND column_name='machine_type_id')",
  "    THEN 'BASELINE PRESENT' ELSE 'BASELINE MISSING - STOP' END AS baseline_status;",
  "",
];

for (const [title,filename] of sections) {
  const sql = await fs.readFile(path.join(databaseDirectory,filename),"utf8");
  output.push(
    "-- ============================================================================",
    `-- ${title}`,
    `-- Source: ${filename}`,
    "-- ============================================================================",
    "",
    sql.trim(),
    ""
  );
}

output.push(
  "-- ============================================================================",
  "-- POST-MIGRATION VERIFICATION",
  "-- Every migration_status value must be PRESENT and both invalid-link counts 0.",
  "-- ============================================================================",
  "SELECT requirement,CASE WHEN available_count>0 THEN 'PRESENT' ELSE 'MISSING' END AS migration_status",
  "FROM (",
  "  SELECT 'part_process_definition table' requirement,COUNT(*) available_count",
  "  FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='part_process_definition'",
  "  UNION ALL SELECT 'part_process_plan.plan_code',COUNT(*) FROM information_schema.columns",
  "    WHERE table_schema=DATABASE() AND table_name='part_process_plan' AND column_name='plan_code'",
  "  UNION ALL SELECT 'part_process_operation.process_definition_id',COUNT(*) FROM information_schema.columns",
  "    WHERE table_schema=DATABASE() AND table_name='part_process_operation' AND column_name='process_definition_id'",
  "  UNION ALL SELECT 'marketing_workouts.process_plan_id',COUNT(*) FROM information_schema.columns",
  "    WHERE table_schema=DATABASE() AND table_name='marketing_workouts' AND column_name='process_plan_id'",
  "  UNION ALL SELECT 'marketing_quotation_items.process_plan_id',COUNT(*) FROM information_schema.columns",
  "    WHERE table_schema=DATABASE() AND table_name='marketing_quotation_items' AND column_name='process_plan_id'",
  "  UNION ALL SELECT 'item_master.shelf_life_applicable',COUNT(*) FROM information_schema.columns",
  "    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_applicable'",
  "  UNION ALL SELECT 'item_master.shelf_life_days',COUNT(*) FROM information_schema.columns",
  "    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_days'",
  ") V;",
  "",
  "SELECT",
  "  (SELECT COUNT(*) FROM item_master I JOIN item_group_master G ON G.item_group_id=I.item_group_id",
  "    WHERE G.group_code<>'RM' AND (I.material_id IS NOT NULL OR I.material_grade_id IS NOT NULL))",
  "    AS non_raw_items_with_material_grade,",
  "  (SELECT COUNT(*) FROM item_master I JOIN item_group_master G ON G.item_group_id=I.item_group_id",
  "    WHERE (G.group_code<>'CM' AND (I.shelf_life_applicable='Y' OR I.shelf_life_days IS NOT NULL))",
  "       OR (G.group_code='CM' AND ((I.shelf_life_applicable='Y' AND COALESCE(I.shelf_life_days,0)=0)",
  "                              OR (I.shelf_life_applicable='N' AND I.shelf_life_days IS NOT NULL))))",
  "    AS items_with_invalid_shelf_life;",
  "",
  "SELECT 'Production delta after 2026-08-13 applied successfully.' AS result;",
  ""
);

const outputPath = path.join(databaseDirectory,"production-delta-after-master-schemas-2026-08-13-to-2026-08-17.sql");
await fs.writeFile(outputPath,output.join("\n"),"utf8");
console.log(outputPath);
