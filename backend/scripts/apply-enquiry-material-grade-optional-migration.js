import { db } from "../src/config/db.js";

try {
  const [columns] = await db.query(
    "SHOW COLUMNS FROM marketing_enquiry_parts LIKE 'material_and_grade'"
  );

  if (columns[0]?.Null !== "YES") {
    await db.query(
      "ALTER TABLE marketing_enquiry_parts MODIFY COLUMN material_and_grade VARCHAR(300) NULL"
    );
  }

  console.log("Enquiry Material and Grade is optional.");
} finally {
  await db.end();
}
