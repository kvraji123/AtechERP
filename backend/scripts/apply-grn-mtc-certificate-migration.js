import { db } from "../src/config/db.js";

async function addColumnIfMissing(columnName, definition) {
  const [columns] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'goods_receipt_note_items'
        AND column_name = ?`,
    [columnName]
  );
  if (!Number(columns[0]?.total)) {
    await db.query(`ALTER TABLE goods_receipt_note_items ADD COLUMN ${columnName} ${definition}`);
  }
}

try {
  await addColumnIfMissing("mtc_applicable", "ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER replacement_required");
  await db.query(`UPDATE goods_receipt_note_items GI
    LEFT JOIN item_master I ON I.item_id = GI.item_id
    SET GI.mtc_applicable = COALESCE(I.mtc_applicable, 'N')`);
  console.log("GRN MTC certificate requirement is ready.");
} finally {
  await db.end();
}
