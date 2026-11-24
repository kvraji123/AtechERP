import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");

const primaryDatabasePath = path.join(databaseDirectory, "atech-production-complete.sql");
const cmsBootstrapPath = path.join(databaseDirectory, "cms-enquiry-database-adminer-bootstrap.sql");
const cmsMigrationPath = path.join(databaseDirectory, "cms-enquiry-database-adminer-migration.sql");
const outputPath = path.join(databaseDirectory, "atech-cms-fresh-install.sql");

const [primaryDatabase, cmsBootstrap, cmsMigration] = await Promise.all([
  fs.readFile(primaryDatabasePath, "utf8"),
  fs.readFile(cmsBootstrapPath, "utf8"),
  fs.readFile(cmsMigrationPath, "utf8"),
]);

const primaryWithoutCompletion = primaryDatabase.replace(
  /-- ============================================================================\r?\n-- Installation complete\r?\n-- ============================================================================\r?\nSELECT 'A TECH Automation production database created successfully\.' AS result;\r?\n?$/,
  ""
);

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP + CMS - COMPLETE FRESH DATABASE INSTALL",
  "-- Generated from the current clean ATECH schema and CMS Labour Enquiry schema.",
  "-- Target: MySQL 8.0+.",
  "--",
  "-- USE ON A NEW PC / NEW MYSQL SERVER ONLY.",
  "-- This creates atech_erp and cms_erp. It does not copy any production data.",
  "--",
  "-- IMPORT REQUIREMENTS:",
  "--   1. Import while connected as a MySQL server administrator (for example root).",
  "--   2. The application database account must exist before the GRANT statements",
  "--      below run. The default is atech_user@localhost; change the bootstrap",
  "--      section if the backend .env uses a different MySQL user or host.",
  "--   3. Use the same database user/password in backend .env after import.",
  "--   4. Back up before importing into a server that already contains either DB.",
  "-- ============================================================================",
  "",
  primaryWithoutCompletion.trim(),
  "",
  "-- ============================================================================",
  "-- CMS database creation and application-user permissions",
  "-- Source: cms-enquiry-database-adminer-bootstrap.sql",
  "-- ============================================================================",
  "",
  cmsBootstrap.trim(),
  "",
  "-- ============================================================================",
  "-- CMS Labour Enquiry, Feasibility, Workout and Quotation workflow tables",
  "-- Source: cms-enquiry-database-adminer-migration.sql",
  "-- ============================================================================",
  "",
  cmsMigration.trim(),
  "",
  "-- ============================================================================",
  "-- Fresh install verification",
  "-- ============================================================================",
  "SELECT 'A TECH Automation ERP and CMS databases created successfully.' AS result;",
  "SELECT table_schema, COUNT(*) AS table_count",
  "FROM information_schema.tables",
  "WHERE table_schema IN ('atech_erp', 'cms_erp')",
  "GROUP BY table_schema",
  "ORDER BY table_schema;",
  "",
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(outputPath);
