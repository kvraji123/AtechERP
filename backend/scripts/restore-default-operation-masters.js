import { withTransaction } from "../src/config/db.js";

const defaultOperations = [
  ["MILLING", "Milling", "INHOUSE", 10],
  ["DRILLING", "Drilling", "INHOUSE", 20],
  ["MILLING_DRILLING", "Milling and Drilling", "INHOUSE", 21],
  ["MILLING_DRILLING_TAPPING", "Milling, Drilling and Tapping", "INHOUSE", 22],
  ["MILLING_BORING_DRILLING_TAPPING", "Milling, Boring, Drilling and Tapping", "INHOUSE", 23],
  ["FINAL_INSPECTION", "Final Inspection", "INHOUSE", 30],
  ["INWARD_INSPECTION", "Inward Inspection", "INHOUSE", 40],
  ["HEAT_TREATMENT", "Heat Treatment", "OUTSOURCE", 50],
  ["TURNING", "Turning", "INHOUSE", 60],
  ["POWDER_COATING", "Powder Coating", "OUTSOURCE", 70],
  ["PHOSPHATING", "Phosphating", "OUTSOURCE", 80],
  ["PACKING", "Packing", "INHOUSE", 90],
  ["OIL_APPLICATION", "Oil Dipping / Application", "INHOUSE", 100],
];

await withTransaction(async (connection) => {
  await connection.query(
    `INSERT INTO operation_source_master
      (source_code, source_name, costing_mode, display_order, active_flag)
     VALUES
      ('INHOUSE', 'In-house', 'INHOUSE', 10, 'Y'),
      ('OUTSOURCE', 'Outsource', 'OUTSOURCE', 20, 'Y')
     ON DUPLICATE KEY UPDATE
      source_name=VALUES(source_name),
      costing_mode=VALUES(costing_mode),
      display_order=VALUES(display_order),
      active_flag=VALUES(active_flag)`
  );

  const placeholders = defaultOperations.map(() => "(?, ?, ?, ?)").join(", ");
  await connection.query(
    `INSERT INTO operation_master
      (operation_code, operation_name, default_source, display_order)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
      operation_name=VALUES(operation_name),
      default_source=VALUES(default_source),
      display_order=VALUES(display_order),
      active_flag='Y'`,
    defaultOperations.flat()
  );
});

console.log(`Restored ${defaultOperations.length} default operation names and 2 operation sources.`);
