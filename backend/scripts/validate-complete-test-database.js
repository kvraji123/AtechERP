import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const validationDatabase = `atech_complete_validation_${Date.now()}`;
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

try {
  const source = await fs.readFile(
    new URL("../database/atech-enquiry-quotation-complete-test.sql", import.meta.url),
    "utf8"
  );
  const validationSql = source.replaceAll("`atech_erp`", `\`${validationDatabase}\``);
  await connection.query(validationSql);

  await connection.query(`USE \`${validationDatabase}\``);
  const [[{ tableCount }]] = await connection.query(
    "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'",
    [validationDatabase]
  );
  const [[enquiry]] = await connection.query(
    "SELECT doc_no, current_stage, enquiry_status, enquiry_conversion FROM marketing_enquiries WHERE enquiry_id = 990001"
  );
  const [parts] = await connection.query(
    "SELECT line_number, part_status FROM marketing_enquiry_parts WHERE enquiry_id = 990001 ORDER BY line_number"
  );
  const [[quotation]] = await connection.query(
    "SELECT quotation_no, quotation_status, pdf_status FROM marketing_quotations WHERE enquiry_id = 990001"
  );

  const expectedPartStatuses = [
    "QUOTED",
    "NOT_FEASIBLE",
    "QUOTED",
    "NOT_FEASIBLE",
    "QUOTED",
  ];
  if (
    Number(tableCount) !== 18 ||
    enquiry?.doc_no !== "ENQ/QWF/TEST/0001" ||
    enquiry?.current_stage !== "COMPLETED" ||
    enquiry?.enquiry_status !== "QUOTED" ||
    JSON.stringify(parts.map((part) => part.part_status)) !== JSON.stringify(expectedPartStatuses) ||
    quotation?.quotation_status !== "FINALIZED" ||
    quotation?.pdf_status !== "NOT_GENERATED"
  ) {
    throw new Error("The complete SQL import did not produce the expected schema and testing data.");
  }

  console.log(JSON.stringify({
    databaseCreated: validationDatabase,
    tableCount,
    enquiry,
    parts,
    quotation,
  }, null, 2));
} finally {
  await connection.query(`DROP DATABASE IF EXISTS \`${validationDatabase}\``);
  await connection.end();
}
