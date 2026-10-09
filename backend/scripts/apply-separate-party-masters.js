import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { getFinancialYear } from '../src/utils/sequence.js';
import path from 'node:path';

// Run with the application stopped. DDL commits implicitly in MySQL; take a backup first.
// Existing IDs/codes and historical document snapshots are intentionally preserved.
const connection = await mysql.createConnection({ ...env.db, multipleStatements: true });
const quote = value => '`' + String(value).replaceAll('`', '``') + '`';
try {
  const [locks] = await connection.query("SELECT GET_LOCK('atech_separate_party_masters', 0) AS acquired");
  if (!locks[0].acquired) throw new Error('Another master migration is running.');
  const backupDirectory = path.resolve('backups');
  await fs.mkdir(backupDirectory, { recursive: true });
  const [backupRows] = await connection.query('SELECT * FROM customer_master');
  const [backupSchema] = await connection.query('SHOW CREATE TABLE customer_master');
  const [backupKeys] = await connection.query(`SELECT * FROM information_schema.KEY_COLUMN_USAGE
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='customer_master'`);
  const [backupViews] = await connection.query(`SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS
    WHERE TABLE_SCHEMA=DATABASE() AND VIEW_DEFINITION LIKE '%customer_master%'`);
  await fs.writeFile(path.join(backupDirectory, `separate-masters-${Date.now()}.json`),
    JSON.stringify({ schema: backupSchema, rows: backupRows, foreignKeys: backupKeys, views: backupViews }, null, 2), { flag: 'wx' });
  const [columns] = await connection.query("SHOW COLUMNS FROM customer_master");
  if (!columns.some(column => column.Field === 'customer_type')) {
    await connection.query('ALTER TABLE customer_master ADD COLUMN customer_type VARCHAR(100) NULL AFTER customer_code');
  }
  const schema = await fs.readFile(new URL('../database/supplier-master-schema.sql', import.meta.url), 'utf8');
  const table = schema.match(/CREATE TABLE IF NOT EXISTS supplier_master \([\s\S]*?ENGINE=InnoDB[^;]*;/)[0];
  await connection.query(table);
  // Repoint every supplier FK, including optional purchase modules installed in this database.
  const [foreignKeys] = await connection.query(`SELECT K.TABLE_NAME, K.COLUMN_NAME, K.CONSTRAINT_NAME,
      R.UPDATE_RULE, R.DELETE_RULE
    FROM information_schema.KEY_COLUMN_USAGE K
    JOIN information_schema.REFERENTIAL_CONSTRAINTS R ON R.CONSTRAINT_SCHEMA=K.CONSTRAINT_SCHEMA
      AND R.TABLE_NAME=K.TABLE_NAME AND R.CONSTRAINT_NAME=K.CONSTRAINT_NAME
    WHERE K.CONSTRAINT_SCHEMA=DATABASE() AND K.REFERENCED_TABLE_NAME='customer_master'
      AND K.COLUMN_NAME LIKE '%supplier_id'`);
  const references = foreignKeys.map(key => `EXISTS (SELECT 1 FROM ${quote(key.TABLE_NAME)} T WHERE T.${quote(key.COLUMN_NAME)}=C.customer_id)`);
  const sourceFields = columns.map(column => column.Field).filter(field => !['party_type', 'customer_type'].includes(field));
  await connection.query(`INSERT INTO supplier_master (${sourceFields.map(field => quote(field.replaceAll('customer','supplier'))).join(',')})
    SELECT ${sourceFields.map(field => 'C.'+quote(field)).join(',')} FROM customer_master C
    WHERE (C.party_type IN ('SUPPLIER','BOTH') ${references.length ? 'OR '+references.join(' OR ') : ''})
      AND NOT EXISTS (SELECT 1 FROM supplier_master S WHERE S.supplier_id=C.customer_id)`);
  for (const key of foreignKeys) {
    await connection.query(`ALTER TABLE ${quote(key.TABLE_NAME)} DROP FOREIGN KEY ${quote(key.CONSTRAINT_NAME)},
      ADD CONSTRAINT ${quote(key.CONSTRAINT_NAME.slice(0, 49) + '_supplier_v2')} FOREIGN KEY (${quote(key.COLUMN_NAME)})
      REFERENCES supplier_master (supplier_id) ON UPDATE ${key.UPDATE_RULE} ON DELETE ${key.DELETE_RULE}`);
  }
  const [views] = await connection.query(`SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS
    WHERE TABLE_SCHEMA=DATABASE() AND VIEW_DEFINITION LIKE '%customer_master%'`);
  for (const view of views) {
    // Only replace supplier joins; customer-related views remain untouched.
    let definition = view.VIEW_DEFINITION;
    const aliases = [...definition.matchAll(/`customer_master`\s+`(\w+)`\s+on\s*\([\s\S]*?\)/gi)]
      .filter(match => /supplier_id/i.test(match[0])).map(match => match[1]);
    for (const alias of aliases) {
      definition = definition.replaceAll('`customer_master` `'+alias+'`', '`supplier_master` `'+alias+'`');
      for (const field of ['id','code','name']) definition = definition.replaceAll('`'+alias+'`.`customer_'+field+'`','`'+alias+'`.`supplier_'+field+'`');
    }
    if (definition !== view.VIEW_DEFINITION) await connection.query(`CREATE OR REPLACE VIEW ${quote(view.TABLE_NAME)} AS ${definition}`);
  }
  await connection.execute(`INSERT INTO app_document_sequences
    (sequence_key,financial_year,prefix,current_number,number_padding) VALUES ('SUPPLIER',?,'SUP',0,4)
    ON DUPLICATE KEY UPDATE sequence_key=VALUES(sequence_key)`, [getFinancialYear()]);
  // A migrated legacy SUP code may already use this year's generated format.
  await connection.execute(`UPDATE app_document_sequences SET current_number=GREATEST(current_number,
    (SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(supplier_code,'/',-1) AS UNSIGNED)),0)
     FROM supplier_master WHERE supplier_code REGEXP ?)) WHERE sequence_key='SUPPLIER' AND financial_year=?`,
    [`^SUP/${getFinancialYear()}/[0-9]+$`,getFinancialYear()]);
  console.log('Separate supplier master created; supplier links migrated. Legacy supplier rows remain hidden in customer_master for historical compatibility.');
} finally {
  await connection.end();
}
