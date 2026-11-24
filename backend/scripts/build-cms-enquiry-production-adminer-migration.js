import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const outputPath = path.join(databaseDirectory, "cms-enquiry-production-adminer-migration.sql");

const [bootstrap, migration] = await Promise.all([
  fs.readFile(path.join(databaseDirectory, "cms-enquiry-database-adminer-bootstrap.sql"), "utf8"),
  fs.readFile(path.join(databaseDirectory, "cms-enquiry-database-adminer-migration.sql"), "utf8"),
]);

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - CMS LABOUR ENQUIRY PRODUCTION MIGRATION",
  "-- Target: existing production ATECH ERP on MySQL 8.0+.",
  "--",
  "-- Run once in Adminer while logged in as a MySQL server administrator",
  "-- (for example root). Do NOT run this while logged in as atech_user.",
  "--",
  "-- This script is safe to re-run. It creates cms_erp and its Marketing",
  "-- workflow tables only. It does NOT move, change, or delete existing",
  "-- Labour enquiries in atech_erp.",
  "-- ============================================================================",
  "",
  "-- ============================================================================",
  "-- CMS schema and application-account grants",
  "-- ============================================================================",
  "",
  bootstrap.trim(),
  "",
  "-- ============================================================================",
  "-- CMS Marketing workflow tables, indexes and foreign keys",
  "-- ============================================================================",
  "",
  migration.trim(),
  "",
  "-- ============================================================================",
  "-- Post-import verification: expected 17 marketing tables and 27 FKs.",
  "-- ============================================================================",
  "SELECT 'CMS schema migration completed.' AS result;",
  "",
  "SELECT table_schema, COUNT(*) AS marketing_table_count",
  "FROM information_schema.tables",
  "WHERE table_schema = 'cms_erp'",
  "  AND table_type = 'BASE TABLE'",
  "  AND table_name REGEXP '^marketing_'",
  "GROUP BY table_schema;",
  "",
  "SELECT constraint_schema, COUNT(*) AS foreign_key_count",
  "FROM information_schema.table_constraints",
  "WHERE constraint_schema = 'cms_erp'",
  "  AND constraint_type = 'FOREIGN KEY'",
  "GROUP BY constraint_schema;",
  "",
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(outputPath);
