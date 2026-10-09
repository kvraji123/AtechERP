import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
const connection = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.database });
try {
  const source = await fs.readFile(new URL('../database/grn-receipt-ownership-migration.sql', import.meta.url), 'utf8');
  for (const statement of source.replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN').split(';').map(s => s.trim()).filter(Boolean)) {
    try { await connection.query(statement); } catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; }
  }
  console.log('GRN receipt ownership migration applied.');
} finally { await connection.end(); }
