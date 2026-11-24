import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("./build-production-database.js");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const cleanInstallPath = path.join(databaseDirectory, "atech-production-complete.sql");
const outputPath = path.join(databaseDirectory, "atech-production-deployment.sql");
const productionUpgradeDate = "2026-10-30-r2";
const adminerOutputPath = path.join(
  databaseDirectory,
  `atech-production-adminer-upgrade-${productionUpgradeDate}.sql`
);
const cleanInstallSql = await fs.readFile(cleanInstallPath, "utf8");

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function guardSql(predicate, statement, label) {
  return [
    `-- Deployment guard: ${label}`,
    `SET @atech_deploy_sql := IF(${predicate}, 'SELECT 1', ${quoteSql(statement)});`,
    "PREPARE atech_deploy_statement FROM @atech_deploy_sql;",
    "EXECUTE atech_deploy_statement;",
    "DEALLOCATE PREPARE atech_deploy_statement;",
  ].join("\n");
}

function splitAlterClauses(clauses) {
  const output = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < clauses.length; index += 1) {
    const character = clauses[index];
    if (quote) {
      if (character === quote && clauses[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(depth - 1, 0);
    } else if (character === "," && depth === 0) {
      output.push(clauses.slice(start, index).trim());
      start = index + 1;
    }
  }
  output.push(clauses.slice(start).trim());
  return output.filter(Boolean);
}

function protectAlterStatements(sql) {
  // Only transform standalone ALTER statements. A migration may contain the words
  // "ALTER TABLE" inside a dynamically prepared SQL string.
  const alterPattern = /(^|\n)([ \t]*ALTER TABLE\s+`?([A-Za-z_][A-Za-z0-9_]*)`?\s+([\s\S]*?);)/gi;
  const protectedSql = sql;
  return protectedSql.replace(alterPattern, (matched, boundary, _statement, tableName, operations) => {
    const guarded = splitAlterClauses(operations.trim().replace(/;$/, "")).map((operation) => {
      const statement = `ALTER TABLE ${tableName} ${operation}`;
      const column = /^ADD\s+COLUMN\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i.exec(operation);
      if (column) {
        return guardSql(
          `EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${quoteSql(tableName)} AND COLUMN_NAME=${quoteSql(column[1])})`,
          statement,
          `${tableName}.${column[1]}`
        );
      }
      const index = /^ADD\s+(?:UNIQUE\s+)?KEY\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i.exec(operation);
      if (index) {
        return guardSql(
          `EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${quoteSql(tableName)} AND INDEX_NAME=${quoteSql(index[1])})`,
          statement,
          `${tableName}.${index[1]} index`
        );
      }
      const constraint = /^ADD\s+CONSTRAINT\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i.exec(operation);
      if (constraint) {
        return guardSql(
          `EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${quoteSql(tableName)} AND CONSTRAINT_NAME=${quoteSql(constraint[1])})`,
          statement,
          `${tableName}.${constraint[1]} constraint`
        );
      }
      const dropIndex = /^DROP\s+INDEX\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i.exec(operation);
      if (dropIndex) {
        return guardSql(
          `NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${quoteSql(tableName)} AND INDEX_NAME=${quoteSql(dropIndex[1])})`,
          statement,
          `${tableName}.${dropIndex[1]} index removal`
        );
      }
      return `${statement};`;
    }).join("\n");
    return `${boundary}${guarded}`;
  });
}

const installStart = cleanInstallSql.indexOf("CREATE DATABASE IF NOT EXISTS");
if (installStart < 0) throw new Error("Could not locate the database installation section.");

const deploymentSql = protectAlterStatements(cleanInstallSql.slice(installStart));
const adminerUpgradeSql = deploymentSql.replace(
  /^CREATE DATABASE IF NOT EXISTS `atech_erp`[\s\S]*?^SET FOREIGN_KEY_CHECKS = 1;\r?\n/m,
  ""
);
const itemMasterTaxPercentUpgrade = guardSql(
  "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='item_master' AND COLUMN_NAME='tax_percent')",
  "ALTER TABLE item_master ADD COLUMN tax_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000 AFTER hsn_code",
  "item_master.tax_percent"
);
const itemMtcApplicableUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='item_master' AND COLUMN_NAME='mtc_applicable')",
    "ALTER TABLE item_master ADD COLUMN mtc_applicable ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER material_grade_id",
    "item_master.mtc_applicable"
  ),
  "UPDATE item_master I JOIN item_group_master G ON G.item_group_id=I.item_group_id SET I.mtc_applicable='N' WHERE G.group_code<>'RM' AND I.item_id>0;",
].join("\n\n");
const customerEnquiryReferenceUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_enquiries' AND COLUMN_NAME='customer_enquiry_reference')",
    "ALTER TABLE marketing_enquiries ADD COLUMN customer_enquiry_reference VARCHAR(100) NULL AFTER required_date",
    "marketing_enquiries.customer_enquiry_reference"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_enquiries' AND COLUMN_NAME='customer_enquiry_date')",
    "ALTER TABLE marketing_enquiries ADD COLUMN customer_enquiry_date DATE NULL AFTER customer_enquiry_reference",
    "marketing_enquiries.customer_enquiry_date"
  ),
].join("\n\n");
const customerRepresentativeUpgrade = guardSql(
  "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_enquiries' AND COLUMN_NAME='customer_representative_name')",
  "ALTER TABLE marketing_enquiries ADD COLUMN customer_representative_name VARCHAR(150) NULL AFTER customer_short_name_snapshot",
  "marketing_enquiries.customer_representative_name"
);
const workoutMachineProcessCostUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workout_process_costs' AND COLUMN_NAME='total_cycle_time_seconds')",
    "ALTER TABLE marketing_workout_process_costs ADD COLUMN total_cycle_time_seconds DECIMAL(14,4) NULL AFTER process_description",
    "marketing_workout_process_costs.total_cycle_time_seconds"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workout_process_costs' AND COLUMN_NAME='machine_cost_inr')",
    "ALTER TABLE marketing_workout_process_costs ADD COLUMN machine_cost_inr DECIMAL(18,4) NULL AFTER total_cycle_time_seconds",
    "marketing_workout_process_costs.machine_cost_inr"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workout_subpart_process_costs' AND COLUMN_NAME='total_cycle_time_seconds')",
    "ALTER TABLE marketing_workout_subpart_process_costs ADD COLUMN total_cycle_time_seconds DECIMAL(14,4) NULL AFTER process_description",
    "marketing_workout_subpart_process_costs.total_cycle_time_seconds"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workout_subpart_process_costs' AND COLUMN_NAME='machine_cost_inr')",
    "ALTER TABLE marketing_workout_subpart_process_costs ADD COLUMN machine_cost_inr DECIMAL(18,4) NULL AFTER total_cycle_time_seconds",
    "marketing_workout_subpart_process_costs.machine_cost_inr"
  ),
  guardSql(
    "NOT (EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workout_subpart_process_costs' AND COLUMN_NAME='total_cycle_time_minutes') AND EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workout_subpart_process_costs' AND COLUMN_NAME='total_cycle_time_seconds'))",
    "UPDATE marketing_workout_subpart_process_costs SET total_cycle_time_seconds = COALESCE(total_cycle_time_seconds, total_cycle_time_minutes * 60)",
    "marketing_workout_subpart_process_costs legacy minute-to-second conversion"
  ),
].join("\n\n");
const workoutSampleCostPercentUpgrade = guardSql(
  "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workouts' AND COLUMN_NAME='sample_cost_percent')",
  "ALTER TABLE marketing_workouts ADD COLUMN sample_cost_percent DECIMAL(7,4) NOT NULL DEFAULT 0 AFTER trial_cost_inr",
  "marketing_workouts.sample_cost_percent"
);
const workoutActualMaterialCostUpgrade = guardSql(
  "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workouts' AND COLUMN_NAME='actual_material_cost_inr')",
  "ALTER TABLE marketing_workouts ADD COLUMN actual_material_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER material_cost_inr",
  "marketing_workouts.actual_material_cost_inr"
);
const quotationSampleCostUpgrade = guardSql(
  "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_quotation_items' AND COLUMN_NAME='sample_cost_inr')",
  "ALTER TABLE marketing_quotation_items ADD COLUMN sample_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER total_development_cost_foreign",
  "marketing_quotation_items.sample_cost_inr"
);
const supplierCategoryProcessUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='supplier_master' AND COLUMN_NAME='supplier_category')",
    "ALTER TABLE supplier_master ADD COLUMN supplier_category VARCHAR(50) NULL AFTER supplier_type",
    "supplier_master.supplier_category"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='supplier_master' AND INDEX_NAME='ix_supplier_category_active')",
    "ALTER TABLE supplier_master ADD KEY ix_supplier_category_active (supplier_category, active_flag)",
    "supplier_master.ix_supplier_category_active index"
  ),
].join("\n\n");
const customerLookupIndexesUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_master' AND INDEX_NAME='ix_customer_lookup_code')",
    "ALTER TABLE customer_master ADD KEY ix_customer_lookup_code (active_flag, party_type, customer_code)",
    "customer_master.ix_customer_lookup_code index"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_master' AND INDEX_NAME='ix_customer_lookup_name')",
    "ALTER TABLE customer_master ADD KEY ix_customer_lookup_name (active_flag, party_type, customer_name)",
    "customer_master.ix_customer_lookup_name index"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_master' AND INDEX_NAME='ix_customer_lookup_short_name')",
    "ALTER TABLE customer_master ADD KEY ix_customer_lookup_short_name (active_flag, party_type, customer_short_name)",
    "customer_master.ix_customer_lookup_short_name index"
  ),
].join("\n\n");
const partRevisionCloneUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='part_status' AND COLUMN_TYPE LIKE '%DRAWING_UNDER_REVISION%')",
    "ALTER TABLE part_master MODIFY COLUMN part_status ENUM('ACTIVE','INACTIVE','DRAWING_UNDER_REVISION') NOT NULL DEFAULT 'ACTIVE'",
    "part_master.part_status DRAWING_UNDER_REVISION enum value"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='revision_source_part_id')",
    "ALTER TABLE part_master ADD COLUMN revision_source_part_id BIGINT UNSIGNED NULL AFTER active_flag",
    "part_master.revision_source_part_id"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='bom_release_status')",
    "ALTER TABLE part_master ADD COLUMN bom_release_status ENUM('DRAFT','RELEASED','NOT_REQUIRED') NOT NULL DEFAULT 'NOT_REQUIRED' AFTER revision_source_part_id",
    "part_master.bom_release_status"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='bom_released_by')",
    "ALTER TABLE part_master ADD COLUMN bom_released_by VARCHAR(50) NULL AFTER bom_release_status",
    "part_master.bom_released_by"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='bom_released_on')",
    "ALTER TABLE part_master ADD COLUMN bom_released_on DATETIME NULL AFTER bom_released_by",
    "part_master.bom_released_on"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND INDEX_NAME='ix_part_revision_source')",
    "ALTER TABLE part_master ADD KEY ix_part_revision_source (revision_source_part_id)",
    "part_master.ix_part_revision_source index"
  ),
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND CONSTRAINT_NAME='fk_part_revision_source')",
    "ALTER TABLE part_master ADD CONSTRAINT fk_part_revision_source FOREIGN KEY (revision_source_part_id) REFERENCES part_master(part_id) ON UPDATE CASCADE ON DELETE RESTRICT",
    "part_master.fk_part_revision_source foreign key"
  ),
].join("\n\n");
const masterDraftWorkflowUpgrade = [
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_master' AND COLUMN_NAME='save_status')",
    "ALTER TABLE customer_master ADD COLUMN save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER customer_status",
    "customer_master.save_status"
  ),
  "ALTER TABLE customer_master MODIFY COLUMN customer_name VARCHAR(200) NULL;",
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='supplier_master' AND COLUMN_NAME='save_status')",
    "ALTER TABLE supplier_master ADD COLUMN save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER supplier_status",
    "supplier_master.save_status"
  ),
  "ALTER TABLE supplier_master MODIFY COLUMN supplier_name VARCHAR(200) NULL;",
  guardSql(
    "EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='save_status')",
    "ALTER TABLE part_master ADD COLUMN save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER part_status",
    "part_master.save_status"
  ),
  "ALTER TABLE part_master MODIFY COLUMN customer_id BIGINT UNSIGNED NULL;",
  "ALTER TABLE part_master MODIFY COLUMN part_category ENUM('MACHINING', 'ASSEMBLY') NULL;",
  "ALTER TABLE part_master MODIFY COLUMN part_name VARCHAR(200) NULL;",
  "ALTER TABLE marketing_enquiries MODIFY COLUMN customer_id BIGINT UNSIGNED NULL;",
  "ALTER TABLE marketing_enquiries MODIFY COLUMN customer_code_snapshot VARCHAR(50) NULL;",
  "ALTER TABLE marketing_enquiries MODIFY COLUMN customer_name_snapshot VARCHAR(200) NULL;",
].join("\n\n");
const upgradeExtras = [
  itemMasterTaxPercentUpgrade,
  "",
  itemMtcApplicableUpgrade,
  "",
  customerEnquiryReferenceUpgrade,
  "",
  customerRepresentativeUpgrade,
  "",
  workoutMachineProcessCostUpgrade,
  "",
  workoutSampleCostPercentUpgrade,
  "",
  workoutActualMaterialCostUpgrade,
  "",
  quotationSampleCostUpgrade,
  "",
  supplierCategoryProcessUpgrade,
  "",
  customerLookupIndexesUpgrade,
  "",
  partRevisionCloneUpgrade,
  "",
  masterDraftWorkflowUpgrade,
];
const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - PRODUCTION DEPLOYMENT / UPGRADE",
  "-- Applies the current schema to a clean or existing ATECH database.",
  "-- Duplicate column, index and foreign-key additions are safely skipped.",
  "-- This script can resume a partial import such as a duplicate-column failure.",
  "-- Target: MySQL 5.7+ / MySQL 8.0+.",
  "--",
  "-- Before running: take a database backup and change `atech_erp` below if needed.",
  "-- ============================================================================",
  "",
  deploymentSql.trim(),
  "",
  ...upgradeExtras,
  "",
];

const adminerOutput = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - PRODUCTION ADMINER UPGRADE",
  `-- Generated on ${productionUpgradeDate} from the current application schema.`,
  "-- Import only after selecting the LIVE ERP database in Adminer.",
  "-- This file does not create or switch databases.",
  "-- Duplicate column, index and foreign-key additions are safely skipped.",
  "-- Target: MySQL 5.7+ / MySQL 8.0+.",
  "-- ============================================================================",
  "",
  "SET NAMES utf8mb4;",
  "SET time_zone = '+05:30';",
  "SET FOREIGN_KEY_CHECKS = 1;",
  "",
  adminerUpgradeSql.trim(),
  "",
  ...upgradeExtras,
  "",
  "SELECT 'A TECH Automation production upgrade completed successfully.' AS result;",
  "",
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
await fs.writeFile(adminerOutputPath, adminerOutput.join("\n"), "utf8");
console.log(outputPath);
console.log(adminerOutputPath);
