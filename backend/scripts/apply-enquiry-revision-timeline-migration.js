import { db } from "../src/config/db.js";

const revisionActions = [
  "CREATED", "UPDATED", "SUBMITTED", "MIGRATED",
  "FEASIBILITY_SAVED", "FEASIBILITY_CLOSED",
  "WORKOUT_SAVED", "WORKOUT_COMPLETED",
  "QUOTATION_SAVED", "QUOTATION_FINALIZED",
  "ENQUIRY_ATTACHMENT_ADDED", "ENQUIRY_ATTACHMENT_UPDATED",
  "ENQUIRY_ATTACHMENT_REMOVED",
].map((action) => `'${action}'`).join(", ");

try {
  const [columns] = await db.query(
    "SHOW COLUMNS FROM marketing_enquiry_revisions LIKE 'revision_action'"
  );
  const columnType = String(columns[0]?.Type || "").toUpperCase();

  if (columns.length && !columnType.includes("FEASIBILITY_SAVED")) {
    await db.query(
      `ALTER TABLE marketing_enquiry_revisions MODIFY COLUMN revision_action ENUM(${revisionActions}) NOT NULL DEFAULT 'UPDATED'`
    );
  }

  console.log("Enquiry revision timeline actions are ready.");
} finally {
  await db.end();
}
