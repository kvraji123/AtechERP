import { db } from "../src/config/db.js";

const indexes = [
  ["ix_customer_lookup_code", "ALTER TABLE customer_master ADD KEY ix_customer_lookup_code (active_flag, party_type, customer_code)"],
  ["ix_customer_lookup_name", "ALTER TABLE customer_master ADD KEY ix_customer_lookup_name (active_flag, party_type, customer_name)"],
  ["ix_customer_lookup_short_name", "ALTER TABLE customer_master ADD KEY ix_customer_lookup_short_name (active_flag, party_type, customer_short_name)"],
];

async function indexExists(indexName) {
  const [rows] = await db.execute(`SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE table_schema=DATABASE() AND table_name='customer_master' AND index_name=?`, [indexName]);
  return Number(rows[0]?.total || 0) > 0;
}

try {
  for (const [indexName, statement] of indexes) {
    if (!(await indexExists(indexName))) await db.query(statement);
  }
  console.log("Customer lookup indexes are ready.");
} finally {
  await db.end();
}
