import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("./build-production-deployment.js");
await import("./build-cms-enquiry-production-adminer-migration.js");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const atechUpgradePath = path.join(
  databaseDirectory,
  "atech-production-adminer-upgrade-2026-10-30-r2.sql"
);
const cmsUpgradePath = path.join(
  databaseDirectory,
  "cms-enquiry-production-adminer-migration.sql"
);
const outputPath = path.join(
  databaseDirectory,
  "atech-production-adminer-complete-update.sql"
);

const [atechUpgrade, cmsUpgrade] = await Promise.all([
  fs.readFile(atechUpgradePath, "utf8"),
  fs.readFile(cmsUpgradePath, "utf8"),
]);

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - COMPLETE PRODUCTION ADMINER UPDATE",
  "-- Target: an existing production MySQL 8.0+ server.",
  "-- Run once as a MySQL server administrator (for example root).",
  "--",
  "-- Includes:",
  "--   1. All current ATECH ERP schema upgrades for atech_erp.",
  "--   2. CMS Labour Enquiry database (cms_erp), tables, indexes and grants.",
  "--",
  "-- Safety:",
  "--   - Back up both databases first.",
  "--   - The underlying migrations are guarded and can resume a partial import.",
  "--   - The CMS section grants permissions to atech_user@localhost. Change the",
  "--     host in that section only if the backend connects with a different MySQL host account.",
  "-- ============================================================================",
  "",
  "USE `atech_erp`;",
  "",
  atechUpgrade.trim(),
  "",
  "-- ============================================================================",
  "-- CMS LABOUR ENQUIRY DATABASE PROVISIONING",
  "-- ============================================================================",
  "",
  cmsUpgrade.trim(),
  "",
  "SELECT 'A TECH Automation complete production update completed successfully.' AS result;",
  "",
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(outputPath);
