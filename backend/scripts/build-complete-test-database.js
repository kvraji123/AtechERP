import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(scriptDirectory, "..");
const databaseDirectory = path.join(backendDirectory, "database");

const sections = [
  ["Master tables and document sequences", "master-schema.sql"],
  ["Enquiry tables and enquiry sequence", "marketing-schema.sql"],
  ["Feasibility and regret-letter tables", "feasibility-schema.sql"],
  ["Workout tables and reference values", "workout-schema.sql"],
  ["Quotation tables, notes master and quotation sequence", "quotation-schema.sql"],
  ["Repeatable five-part workflow testing data", "quotation-workflow-test-data.sql"],
];

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION - ENQUIRY TO QUOTATION MODULE",
  "-- Complete MySQL database, tables, document sequences and testing data",
  "-- Generated from the project schema and repeatable workflow seed files.",
  "--",
  "-- Import this single file on a tester PC using MySQL Workbench or:",
  "-- mysql -u <user> -p < this-file.sql",
  "--",
  "-- Safe to run repeatedly: tables use IF NOT EXISTS and the reserved test",
  "-- records (IDs 990001-990006) are replaced on every import.",
  "-- ============================================================================",
  "",
  "CREATE DATABASE IF NOT EXISTS `atech_erp`",
  "  CHARACTER SET utf8mb4",
  "  COLLATE utf8mb4_unicode_ci;",
  "USE `atech_erp`;",
  "SET NAMES utf8mb4;",
  "",
];

for (const [title, filename] of sections) {
  const sql = await fs.readFile(path.join(databaseDirectory, filename), "utf8");
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

const outputPath = path.join(databaseDirectory, "atech-enquiry-quotation-complete-test.sql");
await fs.writeFile(outputPath, `${output.join("\n")}\n`, "utf8");
console.log(outputPath);
