import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const sections = [
  ["Core document sequences, Customer Master and Part Master", "master-schema.sql"],
  ["Independent Supplier Master", "supplier-master-schema.sql"],
  ["Item, UOM and Material masters", "item-master-schema.sql"],
  ["Retired Item fields and Raw Material-only Material/Grade", "item-master-field-removal-migration.sql"],
  ["Consumables-only Shelf Life radio flag", "consumable-shelf-life-radio-migration.sql"],
  ["Machine types, machine models and installed machine units", "machine-master-schema.sql"],
  ["Part Bill of Material links", "part-bom-schema.sql"],
  ["Part Process Flow and operation-wise Inspection Plan", "part-process-inspection-schema.sql"],
  ["Item Master incoming-inspection characteristics", "item-incoming-inspection-plan-migration.sql"],
  ["Process Plan variants and shared process definitions", "process-plan-variants-shared-definitions-migration.sql"],
  ["Complete ISO tolerance grade ranges imported from Inspection Plan", "tolerance-grade-master-data.sql"],
  ["Marketing Enquiry workflow", "marketing-schema.sql"],
  ["Enquiry initial In Progress status", "enquiry-in-progress-status-migration.sql"],
  ["Feasibility, regret letters and shared reference values", "feasibility-schema.sql"],
  ["Workout costing and assembled-part subparts", "workout-schema.sql"],
  ["Quotation workflow and quotation notes", "quotation-schema.sql"],
  ["Application attachment storage", "attachment-schema.sql"],
  ["Project-wide dropdown masters and Material/Grade/UOM relationships", "project-reference-masters-migration.sql"],
  ["Normalized Material and Grade master dropdowns", "material-master-normalization-migration.sql"],
  ["Process Plan links for Workouts and Quotations", "process-plan-consumer-links-migration.sql"],
  ["Purchase Request, Approval, Enquiry and Supplier Quotation workflow", "purchase-schema.sql"],
  ["Purchase module multi-tenant, PO, GRN, audit and outbox extensions", "purchase-module-migration.sql"],
  ["GRN sampled inspection plans and Quality hold/disposition workflow", "grn-inspection-disposition-migration.sql"],
  ["Persistent Gate Entry and GRN integration", "gate-entry-integration-migration.sql"],
  ["GRN receipt classification and customer-supplied references", "grn-receipt-type-migration.sql"],
  ["Open-purchase GRN lines without a purchase order", "grn-open-purchase-migration.sql"],
  ["Gate Entry type and direct-receipt references", "gate-entry-type-migration.sql"],
  ["Gate Entry customer and supplier references", "gate-entry-party-migration.sql"],
  ["Persistent GRN stock receipts and inventory ledger", "grn-stock-receipt-inventory-migration.sql"],
  ["Gauge Master individual instrument registration and calibration lifecycle", "gauge-master-migration.sql"],
  ["Gauge Master home storage locations", "gauge-storage-location-migration.sql"],
  ["Gauge Master bulk Issue and Return vouchers", "gauge-bulk-movement-migration.sql"],
  ["Gauge calibration certificates", "gauge-calibration-certificate-migration.sql"],
  ["External calibration dispatch challans", "gauge-calibration-dispatch-migration.sql"],
  ["GRN receipt ownership and open-purchase approval fields", "grn-receipt-ownership-migration.sql"],
  ["GRN rejection reason/disposition masters and rejection records", "grn-rejection-master-migration.sql"],
  ["Segregated rejection inventory balances and ledger", "rejection-inventory-migration.sql"],
  ["Formal Return-to-Vendor documents and rejection evidence uploads", "rtv-and-rejection-attachment-migration.sql"],
  ["RTV approval, supplier acknowledgement and dispatch control", "rtv-approval-acknowledgement-migration.sql"],
  ["Controlled customer return, rework, scrap and deviation resolution workflows", "rejection-resolution-workflow-migration.sql"],
  ["Rework re-inspection and stock receipt", "rework-reinspection-migration.sql"],
  ["Customer-owned stock, job allocation and Return-to-Customer control", "customer-material-control-migration.sql"],
  ["Outsourced-part GRN WIP and Process Plan operation hand-off", "outsourcing-wip-process-plan-migration.sql"],
  ["Allowed party transport modes and shipment transport selection", "party-transport-modes-migration.sql"],
  ["Purchased Item group", "purchased-item-group-migration.sql"],
  ["Consumables category cleanup", "consumable-category-cleanup-migration.sql"],
  ["Packing Material Size", "packing-material-size-migration.sql"],
  ["Separate Tools and Fixtures", "tools-fixtures-group-migration.sql"],
  ["Rod Type dropdown", "rod-type-migration.sql"],
  ["Optional Rod Length", "rod-length-optional-migration.sql"],
  ["Purchased Item categories", "purchased-item-categories-migration.sql"],
  ["Customer supplied Raw Material category", "customer-supplied-item-category-migration.sql"],
  ["Furniture Item Type dropdown", "furniture-item-type-migration.sql"],
  ["Item Master category types and specification fields", "item-master-type-specifications-migration.sql"],
  ["Purchased Item description generation", "purchased-item-description-generation-migration.sql"],
];

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - PRODUCTION DATABASE CLEAN INSTALL",
  "-- Generated from current schemas. No test transactions are included.",
  "-- Target: MySQL 8.0+ / clean database installation.",
  "--",
  "-- IMPORTANT:",
  "--   1. Back up before importing into any existing environment.",
  "--   2. This file is intended for a NEW/CLEAN database.",
  "--   3. Change the database name below if production uses another DB_NAME.",
  "--   4. Review document-sequence financial year and currency rates before go-live.",
  "-- ============================================================================",
  "",
  "CREATE DATABASE IF NOT EXISTS `atech_erp`",
  "  CHARACTER SET utf8mb4",
  "  COLLATE utf8mb4_unicode_ci;",
  "USE `atech_erp`;",
  "SET NAMES utf8mb4;",
  "SET time_zone = '+05:30';",
  "SET FOREIGN_KEY_CHECKS = 1;",
  "",
];

for (const [title, filename] of sections) {
  const rawSql = await fs.readFile(path.join(databaseDirectory, filename), "utf8");
  const sql = ["purchase-module-migration.sql", "grn-inspection-disposition-migration.sql", "grn-stock-receipt-inventory-migration.sql", "grn-receipt-type-migration.sql", "grn-open-purchase-migration.sql", "grn-receipt-ownership-migration.sql", "gate-entry-integration-migration.sql", "gate-entry-type-migration.sql", "gate-entry-party-migration.sql", "project-reference-masters-migration.sql", "rtv-approval-acknowledgement-migration.sql", "rework-reinspection-migration.sql", "customer-material-control-migration.sql", "outsourcing-wip-process-plan-migration.sql", "party-transport-modes-migration.sql"].includes(filename)
    ? rawSql.replace(/ADD COLUMN IF NOT EXISTS/gi, "ADD COLUMN").replace(/ADD (UNIQUE )?KEY IF NOT EXISTS/gi, "ADD $1KEY").replace(/DROP INDEX IF EXISTS/gi, "DROP INDEX")
    : rawSql;
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
  "-- Installation complete",
  "-- ============================================================================",
  "SELECT 'A TECH Automation production database created successfully.' AS result;",
  ""
);

const outputPath = path.join(databaseDirectory, "atech-production-complete.sql");
await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(outputPath);
