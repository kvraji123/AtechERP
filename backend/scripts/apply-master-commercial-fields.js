import { db } from '../src/config/db.js';

try {
  for (const table of ['customer_master', 'supplier_master']) {
    const [columns] = await db.query(`SHOW COLUMNS FROM ${table}`);
    for (const [name, length] of [['payment_terms', 500], ['transport_mode', 100]]) {
      if (!columns.some(column => column.Field === name)) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${name} VARCHAR(${length}) NULL`);
      }
    }
  }
  console.log('Payment terms and transport mode fields are ready for both masters.');
} finally {
  await db.end();
}
