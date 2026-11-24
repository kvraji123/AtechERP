import { db } from "../src/config/db.js";

try {
  const [referenceColumns] = await db.query(
    "SHOW COLUMNS FROM marketing_enquiries LIKE 'customer_enquiry_reference'"
  );
  if (!referenceColumns.length) {
    await db.query(
      "ALTER TABLE marketing_enquiries ADD COLUMN customer_enquiry_reference VARCHAR(100) NULL AFTER required_date"
    );
  }

  const [dateColumns] = await db.query(
    "SHOW COLUMNS FROM marketing_enquiries LIKE 'customer_enquiry_date'"
  );
  if (!dateColumns.length) {
    await db.query(
      "ALTER TABLE marketing_enquiries ADD COLUMN customer_enquiry_date DATE NULL AFTER customer_enquiry_reference"
    );
  }

  console.log("Customer enquiry reference fields are ready.");
} finally {
  await db.end();
}
