import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
const connection = await mysql.createConnection({ host:env.db.host, port:env.db.port, user:env.db.user, password:env.db.password, database:env.db.database, multipleStatements:true });
try {
  await connection.query(await fs.readFile(new URL('../database/packing-material-size-migration.sql',import.meta.url),'utf8'));
  console.log('Packing Material Size configured.');
} catch (error) { await connection.rollback(); throw error; }
finally { await connection.end(); }
