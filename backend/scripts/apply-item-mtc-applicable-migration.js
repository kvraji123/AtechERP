import { db } from "../src/config/db.js";

async function addColumnIfMissing(columnName, definition) {
  const [columns] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'item_master'
        AND column_name = ?`,
    [columnName]
  );
  if (!Number(columns[0]?.total)) {
    await db.query(`ALTER TABLE item_master ADD COLUMN ${columnName} ${definition}`);
  }
}

try {
  await addColumnIfMissing("mtc_applicable", "ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER material_grade_id");
  await db.query(`UPDATE item_master I
    JOIN item_group_master G ON G.item_group_id = I.item_group_id
    SET I.mtc_applicable = 'N'
    WHERE G.group_code <> 'RM' AND I.item_id > 0`);
  console.log("Item Master MTC Applicable field is ready.");
} finally {
  await db.end();
}
