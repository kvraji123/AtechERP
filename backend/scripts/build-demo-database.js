import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("./build-production-database.js");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory,"../database");
const schemaPath = path.join(databaseDirectory,"atech-production-complete.sql");
const samplePath = path.join(databaseDirectory,"atech-production-sample-data.sql");
const outputPath = path.join(databaseDirectory,"atech-demo-complete.sql");
const schema = await fs.readFile(schemaPath,"utf8");
const sample = await fs.readFile(samplePath,"utf8");
const completionMarker = "-- ============================================================================\n-- Installation complete";
const schemaWithoutCompletion = schema.includes(completionMarker) ? schema.slice(0,schema.indexOf(completionMarker)).trimEnd() : schema.trimEnd();
const sampleForCombinedImport = sample
  .replace("-- A TECH AUTOMATION ERP - SAMPLE DATA\n-- Run only AFTER atech-production-complete.sql.","-- A TECH AUTOMATION ERP - INCLUDED DEMO DATA\n-- This section is included in the clean-install demo database.")
  .replace("USE `atech_erp`;\n","");

const output = [
  "-- ============================================================================",
  "-- A TECH AUTOMATION ERP - COMPLETE DEMO DATABASE",
  "-- Clean MySQL 8.0+ installation with the full current schema and demo records.",
  "-- Change `atech_erp` below before import if a different database name is required.",
  "-- ============================================================================",
  "",
  schemaWithoutCompletion,
  "",
  "-- ============================================================================",
  "-- DEMO DATA",
  "-- ============================================================================",
  "",
  sampleForCombinedImport.trim(),
  "",
  "SELECT 'A TECH Automation demo database created successfully.' AS result;",
  "",
];

await fs.writeFile(outputPath,output.join("\n"),"utf8");
console.log(outputPath);
