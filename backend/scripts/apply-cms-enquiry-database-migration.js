import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const identifier = (value, label) => {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error(`${label} must be a valid MySQL identifier.`);
  }
  return `\`${normalized}\``;
};

const sourceSchema = identifier(env.db.database, "DB_NAME");
const cmsSchema = identifier(env.db.cmsDatabase, "CMS_DB_NAME");
const sourceSchemaName = String(env.db.database).trim();
const cmsSchemaName = String(env.db.cmsDatabase).trim();

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  multipleStatements: true,
});

try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${cmsSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const [tables] = await connection.execute(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema=? AND table_type='BASE TABLE' AND table_name LIKE 'marketing\\_%'
      ORDER BY table_name`,
    [sourceSchemaName]
  );
  if (!tables.length) throw new Error(`No marketing tables found in ${sourceSchemaName}.`);

  for (const row of tables) {
    const table = identifier(row.tableName, "marketing table name");
    await connection.query(`CREATE TABLE IF NOT EXISTS ${cmsSchema}.${table} LIKE ${sourceSchema}.${table}`);
  }

  const tableNames = tables.map((row) => row.tableName);
  const tablePlaceholders = tableNames.map(() => "?").join(",");
  const [foreignKeys] = await connection.execute(
    `SELECT K.table_name AS tableName,K.constraint_name AS constraintName,
            K.column_name AS columnName,K.referenced_table_schema AS referencedSchema,
            K.referenced_table_name AS referencedTable,K.referenced_column_name AS referencedColumn,
            K.ordinal_position AS ordinalPosition,R.update_rule AS updateRule,R.delete_rule AS deleteRule
       FROM information_schema.key_column_usage K
       JOIN information_schema.referential_constraints R
         ON R.constraint_schema=K.table_schema
        AND R.table_name=K.table_name
        AND R.constraint_name=K.constraint_name
      WHERE K.table_schema=?
        AND K.table_name IN (${tablePlaceholders})
        AND K.referenced_table_name IS NOT NULL
      ORDER BY K.table_name,K.constraint_name,K.ordinal_position`,
    [sourceSchemaName, ...tableNames]
  );
  const groupedForeignKeys = new Map();
  for (const foreignKey of foreignKeys) {
    const key = `${foreignKey.tableName}:${foreignKey.constraintName}`;
    const group = groupedForeignKeys.get(key) || { ...foreignKey, columns: [], referencedColumns: [] };
    group.columns.push(foreignKey.columnName);
    group.referencedColumns.push(foreignKey.referencedColumn);
    groupedForeignKeys.set(key, group);
  }

  for (const foreignKey of groupedForeignKeys.values()) {
    const [existing] = await connection.execute(
      `SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema=? AND table_name=? AND constraint_name=? LIMIT 1`,
      [cmsSchemaName, foreignKey.tableName, foreignKey.constraintName]
    );
    if (existing.length) continue;
    const targetSchemaName = tableNames.includes(foreignKey.referencedTable)
      ? cmsSchemaName
      : sourceSchemaName;
    const targetSchema = identifier(targetSchemaName, "referenced schema");
    const table = identifier(foreignKey.tableName, "foreign-key table");
    const constraint = identifier(foreignKey.constraintName, "foreign-key name");
    const referencedTable = identifier(foreignKey.referencedTable, "referenced table");
    const columns = foreignKey.columns.map((name) => identifier(name, "foreign-key column")).join(",");
    const referencedColumns = foreignKey.referencedColumns.map((name) => identifier(name, "referenced column")).join(",");
    await connection.query(
      `ALTER TABLE ${cmsSchema}.${table} ADD CONSTRAINT ${constraint}
       FOREIGN KEY (${columns}) REFERENCES ${targetSchema}.${referencedTable} (${referencedColumns})
       ON DELETE ${foreignKey.deleteRule} ON UPDATE ${foreignKey.updateRule}`
    );
  }

  const [autoIncrementTables] = await connection.execute(
    `SELECT DISTINCT table_name AS tableName
       FROM information_schema.columns
      WHERE table_schema=? AND table_name IN (${tablePlaceholders})
        AND extra LIKE '%auto_increment%'`,
    [sourceSchemaName, ...tableNames]
  );
  for (const row of autoIncrementTables) {
    const table = identifier(row.tableName, "auto-increment table");
    await connection.query(`ALTER TABLE ${cmsSchema}.${table} AUTO_INCREMENT=1000000000`);
  }

  await connection.query(
    `INSERT IGNORE INTO ${cmsSchema}.\`marketing_reference_values\`
     SELECT * FROM ${sourceSchema}.\`marketing_reference_values\``
  );
  console.log(`CMS marketing database ${cmsSchemaName} is ready with ${tableNames.length} tables, indexes, and foreign keys.`);
} finally {
  await connection.end();
}
