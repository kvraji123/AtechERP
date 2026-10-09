import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import("./build-production-database.js");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseDirectory = path.resolve(scriptDirectory, "../database");
const cleanInstallPath = path.join(databaseDirectory, "atech-production-complete.sql");
const outputPath = path.join(databaseDirectory, "atech-production-deployment.sql");
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
];

await fs.writeFile(outputPath, output.join("\n"), "utf8");
console.log(outputPath);
