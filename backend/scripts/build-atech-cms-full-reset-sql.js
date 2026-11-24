import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const freshInstallPath = path.join(databaseDirectory, "atech-cms-fresh-install.sql");
const outputPath = path.join(databaseDirectory, "atech-cms-full-database-reset.sql");

const freshInstall = await fs.readFile(freshInstallPath, "utf8");

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP + CMS - FULL DATABASE RESET",
  "-- Generated from the current clean-install schema.",
  "-- Target: MySQL 8.0+ / Adminer import as a MySQL server administrator.",
  "--",
  "-- DESTRUCTIVE: this permanently deletes both atech_erp and cms_erp, including",
  "-- all masters, transactions, attachments metadata, quotation history, users",
  "-- and login sessions. The databases, tables, indexes, foreign keys, lookup",
  "-- seed data and document-number sequences are then recreated from scratch.",
  "--",
  "-- BEFORE IMPORTING:",
  "--   1. Stop the ATECH backend so no connection recreates data during reset.",
  "--   2. Take and verify a full backup of atech_erp and cms_erp.",
  "--   3. Ensure backend .env has INITIAL_ADMIN_USERNAME and a valid",
  "--      INITIAL_ADMIN_PASSWORD (12+ characters). The first backend restart",
  "--      creates that administrator because all previous accounts are removed.",
  "--   4. The MySQL account atech_user@localhost must already exist, or change",
  "--      the GRANT host/user in the CMS bootstrap section below.",
  "--   5. Database SQL cannot delete uploaded files. Archive or remove the",
  "--      configured UPLOAD_ROOT separately only after the backup is verified.",
  "--",
  "-- CMS internal numeric IDs intentionally begin at 1000000000 to keep them",
  "-- separate from Sales IDs. Its visible enquiry / quotation document numbers",
  "-- still restart from 0001 through the shared document-sequence table.",
  "-- ============================================================================",
  "",
  "DROP DATABASE IF EXISTS `cms_erp`;",
  "DROP DATABASE IF EXISTS `atech_erp`;",
  "",
  freshInstall.trim(),
  "",
  "-- ============================================================================",
  "-- Reset verification",
  "-- ============================================================================",
  "SELECT table_schema, COUNT(*) AS table_count",
  "FROM information_schema.tables",
  "WHERE table_schema IN ('atech_erp', 'cms_erp')",
  "GROUP BY table_schema",
  "ORDER BY table_schema;",
  "",
  "SELECT sequence_key, financial_year, prefix, current_number, number_padding",
  "FROM `atech_erp`.`app_document_sequences`",
  "ORDER BY sequence_key, financial_year;",
  "",
  "SELECT 'Full database reset completed. Restart the backend to bootstrap the initial administrator.' AS result;",
  "",
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(outputPath);
