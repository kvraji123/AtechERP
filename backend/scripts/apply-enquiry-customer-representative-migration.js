import { db } from "../src/config/db.js";

try {
  const [columns] = await db.query(
    "SHOW COLUMNS FROM marketing_enquiries LIKE 'customer_representative_name'"
  );
  if (!columns.length) {
    await db.query(
      "ALTER TABLE marketing_enquiries ADD COLUMN customer_representative_name VARCHAR(150) NULL AFTER customer_short_name_snapshot"
    );
  }

  console.log("Customer representative field is ready for enquiries.");
} finally {
  await db.end();
}
