import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const validationDatabase = `atech_seed_validation_${Date.now()}`;
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  multipleStatements: true,
});

try {
  const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableColumn = Object.keys(tables[0])[0];
  const createStatements = [];
  for (const row of tables) {
    const [definition] = await connection.query(`SHOW CREATE TABLE \`${row[tableColumn]}\``);
    createStatements.push(definition[0]["Create Table"]);
  }

  await connection.query(`CREATE DATABASE \`${validationDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${validationDatabase}\`; SET FOREIGN_KEY_CHECKS=0;`);
  for (const statement of createStatements) await connection.query(statement);
  await connection.query("SET FOREIGN_KEY_CHECKS=1");

  const seed = await fs.readFile(
    new URL("../database/quotation-workflow-test-data.sql", import.meta.url),
    "utf8"
  );
  await connection.query(seed);

  const [[enquiry]] = await connection.query(
    "SELECT doc_no, current_stage, enquiry_status, enquiry_conversion FROM marketing_enquiries WHERE enquiry_id=990001"
  );
  const [parts] = await connection.query(
    "SELECT line_number, part_status FROM marketing_enquiry_parts WHERE enquiry_id=990001 ORDER BY line_number"
  );
  const [[quotation]] = await connection.query(
    "SELECT quotation_no, quotation_status, pdf_status FROM marketing_quotations WHERE enquiry_id=990001"
  );

  if (
    enquiry?.doc_no !== "ENQ/QWF/TEST/0001" ||
    enquiry?.current_stage !== "COMPLETED" ||
    JSON.stringify(parts.map((part) => part.part_status)) !==
      JSON.stringify(["QUOTED", "NOT_FEASIBLE", "QUOTED", "NOT_FEASIBLE", "QUOTED"]) ||
    quotation?.quotation_status !== "FINALIZED" ||
    quotation?.pdf_status !== "NOT_GENERATED"
  ) {
    throw new Error("Imported seed data did not match the expected workflow.");
  }

  console.log(JSON.stringify({ enquiry, parts, quotation }, null, 2));
} finally {
  await connection.query(`DROP DATABASE IF EXISTS \`${validationDatabase}\``);
  await connection.end();
}
