import { db } from "../src/config/db.js";

const defaultNotes = [
  {
    code: "RAW_MATERIAL_WEIGHT_VARIATION",
    text: "Any change in raw material weight during production may lead to a price revision.",
    sortOrder: 70,
  },
  {
    code: "CURRENCY_RAW_MATERIAL_REVISION",
    text: "Currency value changes and raw material price changes may lead to a price revision once every three months.",
    sortOrder: 80,
  },
];

try {
  for (const note of defaultNotes) {
    await db.execute(
      `INSERT INTO quotation_notes_master
        (note_code, note_text, default_flag, sort_order, active_flag)
       VALUES (?, ?, 'Y', ?, 'Y')
       ON DUPLICATE KEY UPDATE
        note_text = VALUES(note_text),
        default_flag = 'Y',
        sort_order = VALUES(sort_order),
        active_flag = 'Y'`,
      [note.code, note.text, note.sortOrder]
    );
  }

  console.log("Default quotation commercial notes are ready.");
} finally {
  await db.end();
}
