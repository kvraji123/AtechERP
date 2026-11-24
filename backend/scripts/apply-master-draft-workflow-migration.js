import { db } from "../src/config/db.js";

async function columnExists(tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!await columnExists(tableName, columnName)) {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

try {
  await addColumnIfMissing(
    "customer_master",
    "save_status",
    "save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER customer_status"
  );
  await addColumnIfMissing(
    "supplier_master",
    "save_status",
    "save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER supplier_status"
  );
  await addColumnIfMissing(
    "part_master",
    "save_status",
    "save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER part_status"
  );

  await db.query("ALTER TABLE customer_master MODIFY COLUMN customer_name VARCHAR(200) NULL");
  await db.query("ALTER TABLE supplier_master MODIFY COLUMN supplier_name VARCHAR(200) NULL");
  await db.query("ALTER TABLE part_master MODIFY COLUMN customer_id BIGINT UNSIGNED NULL");
  await db.query("ALTER TABLE part_master MODIFY COLUMN part_category ENUM('MACHINING', 'ASSEMBLY') NULL");
  await db.query("ALTER TABLE part_master MODIFY COLUMN part_name VARCHAR(200) NULL");
  await db.query("ALTER TABLE marketing_enquiries MODIFY COLUMN customer_id BIGINT UNSIGNED NULL");
  await db.query("ALTER TABLE marketing_enquiries MODIFY COLUMN customer_code_snapshot VARCHAR(50) NULL");
  await db.query("ALTER TABLE marketing_enquiries MODIFY COLUMN customer_name_snapshot VARCHAR(200) NULL");

  console.log("Draft workflow schema is ready for masters and enquiries.");
} finally {
  await db.end();
}
