import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const atechSchemaPath = path.join(databaseDirectory, "atech-production-complete.sql");
const cmsSchemaPath = path.join(databaseDirectory, "cms-enquiry-database-adminer-migration.sql");
const outputPath = path.join(databaseDirectory, "atech-item-master-preserving-reset.sql");

function tableNames(sql, expression) {
  return [...sql.matchAll(expression)].map((match) => match[1]).filter(Boolean);
}

const [atechSchema, cmsSchema] = await Promise.all([
  fs.readFile(atechSchemaPath, "utf8"),
  fs.readFile(cmsSchemaPath, "utf8"),
]);

const atechTables = [...new Set(tableNames(
  atechSchema,
  /CREATE TABLE IF NOT EXISTS\s+`?([A-Za-z0-9_]+)`?/gi
))].sort();
const cmsTables = [...new Set(tableNames(
  cmsSchema,
  /CREATE TABLE IF NOT EXISTS\s+`cms_erp`\.`([A-Za-z0-9_]+)`/gi
))].sort();

// The Item Master record must retain the lookup tables and child records it
// needs to remain usable after Customer, Supplier, Part and workflow data are
// removed. app_users is retained so the administrator can sign in afterwards.
const preserveAtechTables = new Set([
  "app_document_sequences",
  "app_users",
  "hsn_master",
  "inspection_characteristic_master",
  "inspection_frequency_master",
  "inspection_instrument_master",
  "inspection_sample_size_master",
  "inspection_tolerance_standard_band",
  "inspection_tolerance_standard_master",
  "item_attachment",
  "item_group_master",
  "item_incoming_inspection_characteristic",
  "item_master",
  "item_reference_value",
  "item_specification_value",
  "item_type_description_template",
  "item_type_master",
  "item_type_spec_field",
  "material_grade_master",
  "material_master",
  "marketing_reference_values",
  // These are configuration/reference masters, not workflow data. Retaining
  // them keeps installed-machine selection and warehouse/location lookups
  // working after a business-data reset.
  "machine_master",
  "machine_type_master",
  "machine_unit",
  "location_master",
  "inventory_locations",
  "operation_master",
  "operation_source_master",
  "tolerance_grade_master",
  "uom_master",
]);

const atechTablesToDelete = atechTables.filter((table) => !preserveAtechTables.has(table));

const quoteIdentifier = (value) => `\`${value.replace(/`/g, "``")}\``;
const guardedDelete = (schema, table) =>
  `DELETE FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} WHERE @atech_confirm_item_master_preserving_reset = 1;`;

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP + CMS - ITEM MASTER PRESERVING RESET",
  "-- Generated from the current schema. Target: MySQL 8.0+ / Adminer.",
  "--",
  "-- PURPOSE",
  "--   Delete all business and workflow data while retaining Item Master, its",
  "--   required catalogue records (group/type/UOM/material/grade/specification),",
  "--   the system enquiry lookup values, document-sequence configuration and",
  "--   application user accounts.",
  "--",
  "-- DELETED",
  "--   Customer, Supplier, Part, BOM, Process Plan, Inspection Plan, Sales and",
  "--   CMS Labour enquiries, feasibility, workout, quotation, purchase, GRN,",
  "--   inventory, tooling, gauge, attachments metadata, audit data and sessions.",
  "--",
  "-- NOT DELETED",
  "--   Item Master and its item-specific data, installed-machine configuration,",
  "--   warehouse/location configuration, app_users, static marketing reference",
  "--   values and document-sequence configuration. Existing users",
  "--   must sign in again because all server-side sessions are removed.",
  "--",
  "-- SAFETY",
  "--   1. Stop the backend and take verified backups of atech_erp and cms_erp.",
  "--   2. The script starts in PREVIEW mode. It changes nothing until the",
  "--      confirmation value below is changed from 0 to 1.",
  "--   3. Uploaded files are not stored in MySQL. This removes only their",
  "--      database metadata; archive physical upload files separately after",
  "--      the reset is verified.",
  "--   4. It resets visible document codes only. Internal AUTO_INCREMENT IDs",
  "--      are deliberately not reset, which avoids foreign-key risk.",
  "-- ============================================================================",
  "",
  "-- Use the sequence table's collation so Adminer's session collation cannot conflict.",
  "SET @atech_financial_year := _utf8mb4'2026-27' COLLATE utf8mb4_unicode_ci;",
  "SET @atech_confirm_item_master_preserving_reset := 0; -- CHANGE TO 1 ONLY AFTER BACKUP",
  "",
  "SELECT @atech_confirm_item_master_preserving_reset AS confirmation_required,",
  "       @atech_financial_year AS financial_year_to_reset;",
  "",
  "SELECT 'Before reset' AS checkpoint,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`customer_master`) AS customers,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`supplier_master`) AS suppliers,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`part_master`) AS parts,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`marketing_enquiries`) AS sales_enquiries,",
  "  (SELECT COUNT(*) FROM `cms_erp`.`marketing_enquiries`) AS labour_enquiries,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`item_master`) AS retained_items;",
  "",
  "START TRANSACTION;",
  "SET FOREIGN_KEY_CHECKS = 0;",
  "SET SQL_SAFE_UPDATES = 0;",
  "",
  "-- ATECH records removed. Foreign-key checks are disabled only for this",
  "-- transaction because every non-preserved dependent table is cleared.",
  ...atechTablesToDelete.map((table) => guardedDelete("atech_erp", table)),
  "",
  "-- CMS Labour workflow records removed. The lookup copy is re-seeded below.",
  ...cmsTables.map((table) => guardedDelete("cms_erp", table)),
  "",
  "-- CMS needs the shared enquiry dropdown values after its copy is cleared.",
  "INSERT IGNORE INTO `cms_erp`.`marketing_reference_values`",
  "SELECT * FROM `atech_erp`.`marketing_reference_values`",
  "WHERE @atech_confirm_item_master_preserving_reset = 1;",
  "",
  "-- Reset every configured visible document-code sequence for the selected FY.",
  "UPDATE `atech_erp`.`app_document_sequences`",
  "SET current_number = 0",
  "WHERE @atech_confirm_item_master_preserving_reset = 1",
  "  AND financial_year = CONVERT(@atech_financial_year USING utf8mb4) COLLATE utf8mb4_unicode_ci;",
  "",
  "SET FOREIGN_KEY_CHECKS = 1;",
  "COMMIT;",
  "",
  "SELECT 'After reset' AS checkpoint,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`customer_master`) AS customers,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`supplier_master`) AS suppliers,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`part_master`) AS parts,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`marketing_enquiries`) AS sales_enquiries,",
  "  (SELECT COUNT(*) FROM `cms_erp`.`marketing_enquiries`) AS labour_enquiries,",
  "  (SELECT COUNT(*) FROM `atech_erp`.`item_master`) AS retained_items;",
  "",
  "SELECT sequence_key, financial_year, prefix, current_number, number_padding",
  "FROM `atech_erp`.`app_document_sequences`",
  "WHERE financial_year = CONVERT(@atech_financial_year USING utf8mb4) COLLATE utf8mb4_unicode_ci",
  "ORDER BY sequence_key;",
  "",
  "SELECT IF(@atech_confirm_item_master_preserving_reset = 1,",
  "  'Item Master preserving reset completed. Restart the backend and sign in again.',",
  "  'PREVIEW ONLY: no data was changed. Set confirmation to 1 and rerun only after backup.') AS result;",
  "",
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(`${outputPath} (${atechTablesToDelete.length} ATECH tables and ${cmsTables.length} CMS tables cleared when confirmed)`);
