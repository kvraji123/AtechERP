import { db } from "../src/config/db.js";

async function columnExists(columnName) {
  const [rows] = await db.execute(`SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE table_schema=DATABASE() AND table_name='supplier_master' AND column_name=?`, [columnName]);
  return Number(rows[0]?.total || 0) > 0;
}

async function indexExists(indexName) {
  const [rows] = await db.execute(`SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE table_schema=DATABASE() AND table_name='supplier_master' AND index_name=?`, [indexName]);
  return Number(rows[0]?.total || 0) > 0;
}

try {
  if (!(await columnExists("supplier_category"))) {
    await db.query("ALTER TABLE supplier_master ADD COLUMN supplier_category VARCHAR(50) NULL AFTER supplier_type");
  }
  if (!(await indexExists("ix_supplier_category_active"))) {
    await db.query("ALTER TABLE supplier_master ADD KEY ix_supplier_category_active (supplier_category, active_flag)");
  }
  console.log("Supplier category / process field is ready.");
} finally {
  await db.end();
}
