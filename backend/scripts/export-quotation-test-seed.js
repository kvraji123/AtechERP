import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
});

const selections = [
  ["customer_master", "customer_id=2"],
  ["marketing_enquiries", "enquiry_id=5"],
  ["marketing_enquiry_parts", "enquiry_id=5"],
  ["marketing_feasibilities", "enquiry_id=5"],
  ["marketing_regret_letters", "enquiry_id=5"],
  ["marketing_workouts", "enquiry_id=5"],
  ["marketing_workout_process_costs", "workout_id IN (SELECT workout_id FROM marketing_workouts WHERE enquiry_id=5)"],
  ["marketing_workout_notes", "workout_id IN (SELECT workout_id FROM marketing_workouts WHERE enquiry_id=5)"],
  ["marketing_quotations", "enquiry_id=5"],
  ["marketing_quotation_items", "quotation_id IN (SELECT quotation_id FROM marketing_quotations WHERE enquiry_id=5)"],
  ["marketing_quotation_notes", "quotation_id IN (SELECT quotation_id FROM marketing_quotations WHERE enquiry_id=5)"],
];

const rowsByTable = {};
for (const [table, where] of selections) {
  const [rows] = await connection.query(`SELECT * FROM ${table} WHERE ${where}`);
  rowsByTable[table] = rows;
}
await connection.end();

const idMaps = {
  customer_id: new Map([[2, 990001]]),
  enquiry_id: new Map([[5, 990001]]),
  enquiry_part_id: new Map([[6, 990001], [7, 990002], [8, 990003], [9, 990004], [10, 990005]]),
  feasibility_id: new Map([[7, 990001], [8, 990002], [9, 990003], [10, 990004], [11, 990005]]),
  regret_letter_id: new Map([[2, 990001], [3, 990002]]),
  workout_id: new Map([[6, 990001], [7, 990002], [8, 990003]]),
  workout_process_cost_id: new Map([[13, 990001], [14, 990002], [15, 990003], [16, 990004], [17, 990005], [18, 990006]]),
  workout_note_id: new Map([[4, 990001], [5, 990002], [6, 990003]]),
  quotation_id: new Map([[1, 990001]]),
  quotation_item_id: new Map([[4, 990001], [5, 990002], [6, 990003]]),
  quotation_note_id: new Map([[7, 990001], [8, 990002], [9, 990003], [10, 990004], [11, 990005], [12, 990006]]),
};

function transform(table, row) {
  const output = { ...row };
  for (const [column, map] of Object.entries(idMaps)) {
    if (output[column] !== undefined && output[column] !== null) {
      output[column] = map.get(Number(output[column])) ?? output[column];
    }
  }

  const replacements = [
    ["Quotation Workflow Test Customer 1784777500467", "Quotation Workflow Test Customer"],
    ["CUS/2026-27/0002", "CUS/QWF/TEST/0001"],
    ["ENQ/0002/26-27", "ENQ/QWF/TEST/0001"],
    ["QWF-TEST-1784777500693", "QWF-TEST-0001"],
    ["QUO/2026-27/0001", "QUO/QWF/TEST/0001"],
  ];
  for (const key of Object.keys(output)) {
    if (typeof output[key] !== "string") continue;
    for (const [from, to] of replacements) output[key] = output[key].replaceAll(from, to);
  }

  if (table === "marketing_quotations") {
    output.pdf_status = "NOT_GENERATED";
    output.pdf_file_path = null;
    output.pdf_generated_on = null;
    output.email_status = "NOT_SENT";
    output.email_to = null;
    output.email_subject = null;
    output.email_sent_on = null;
    output.email_sent_by = null;
    output.email_failure_reason = null;
  }
  if (table === "marketing_regret_letters") output.file_path = null;
  return output;
}

const escape = (value) => {
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 19).replace("T", " ");
    return mysql.escape(iso);
  }
  return mysql.escape(value);
};

function insertStatement(table, row) {
  const columns = Object.keys(row).map((column) => `\`${column}\``).join(", ");
  const values = Object.values(row).map(escape).join(", ");
  return `INSERT INTO \`${table}\` (${columns}) VALUES (${values});`;
}

const reverseTables = [...selections].reverse().map(([table]) => table);
const deleteKeys = {
  customer_master: ["customer_id", [990001]],
  marketing_enquiries: ["enquiry_id", [990001]],
  marketing_enquiry_parts: ["enquiry_part_id", [990001, 990002, 990003, 990004, 990005]],
  marketing_feasibilities: ["feasibility_id", [990001, 990002, 990003, 990004, 990005]],
  marketing_regret_letters: ["regret_letter_id", [990001, 990002]],
  marketing_workouts: ["workout_id", [990001, 990002, 990003]],
  marketing_workout_process_costs: ["workout_process_cost_id", [990001, 990002, 990003, 990004, 990005, 990006]],
  marketing_workout_notes: ["workout_note_id", [990001, 990002, 990003]],
  marketing_quotations: ["quotation_id", [990001]],
  marketing_quotation_items: ["quotation_item_id", [990001, 990002, 990003]],
  marketing_quotation_notes: ["quotation_note_id", [990001, 990002, 990003, 990004, 990005, 990006]],
};

const sql = [
  "-- ATECH five-item quotation workflow test seed",
  "-- Prerequisite: apply the project database schemas/upgrades before importing this file.",
  "-- Reserved IDs 990001-990006 are used only for this repeatable test dataset.",
  "-- Lines 1, 3 and 5 are feasible/quoted; lines 2 and 4 are not feasible.",
  "-- PDF status is reset because generated files are not embedded in SQL.",
  "",
  "SET NAMES utf8mb4;",
  "SET FOREIGN_KEY_CHECKS = 0;",
  "START TRANSACTION;",
  "",
  ...reverseTables.map((table) => {
    const [column, ids] = deleteKeys[table];
    return `DELETE FROM \`${table}\` WHERE \`${column}\` IN (${ids.join(", ")});`;
  }),
  "DELETE FROM `marketing_enquiries` WHERE `doc_no` = 'ENQ/QWF/TEST/0001';",
  "DELETE FROM `customer_master` WHERE `customer_code` = 'CUS/QWF/TEST/0001';",
  "",
  ...selections.flatMap(([table]) => [
    `-- ${table}`,
    ...rowsByTable[table].map((row) => insertStatement(table, transform(table, row))),
    "",
  ]),
  "COMMIT;",
  "SET FOREIGN_KEY_CHECKS = 1;",
  "",
  "-- Verification",
  "SELECT enquiry_id, doc_no, current_stage, enquiry_status, enquiry_conversion",
  "FROM marketing_enquiries WHERE enquiry_id = 990001;",
  "SELECT line_number, part_number, part_status",
  "FROM marketing_enquiry_parts WHERE enquiry_id = 990001 ORDER BY line_number;",
  "SELECT quotation_no, quotation_status, pdf_status",
  "FROM marketing_quotations WHERE enquiry_id = 990001;",
  "",
].join("\n");

const outputPath = path.resolve("database/quotation-workflow-test-data.sql");
await fs.writeFile(outputPath, sql, "utf8");
console.log(outputPath);
