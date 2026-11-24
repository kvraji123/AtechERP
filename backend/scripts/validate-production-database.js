import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const databaseName = `atech_production_validation_${Date.now()}`;
const demoMode = process.argv.includes("--demo");
const deploymentMode = process.argv.includes("--deployment");
if (!/^atech_production_validation_\d+$/.test(databaseName)) {
  throw new Error("Unsafe validation database name.");
}

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  multipleStatements: true,
});

async function executeSqlScript(sql) {
  let delimiter = ";";
  let statement = "";
  for (const line of sql.split(/\r?\n/)) {
    const directive = line.trim().match(/^DELIMITER\s+(.+)$/i);
    if (directive) {
      if (statement.trim()) {
        await connection.query(statement);
        statement = "";
      }
      delimiter = directive[1];
      continue;
    }
    statement += `${line}\n`;
    if (statement.trimEnd().endsWith(delimiter)) {
      const executable = statement.trimEnd().slice(0, -delimiter.length).trim();
      if (executable) await connection.query(executable);
      statement = "";
    }
  }
  if (statement.trim()) await connection.query(statement);
}

try {
  let sql = await fs.readFile(
    new URL(`../database/${demoMode ? "atech-demo-complete.sql" : deploymentMode ? "atech-production-deployment.sql" : "atech-production-complete.sql"}`, import.meta.url),
    "utf8"
  );
  sql = sql
    .replace("CREATE DATABASE IF NOT EXISTS `atech_erp`", `CREATE DATABASE IF NOT EXISTS \`${databaseName}\``)
    .replace("USE `atech_erp`;", `USE \`${databaseName}\`;`);
  await executeSqlScript(sql);
  if (deploymentMode) await executeSqlScript(sql);
  const [tables] = await connection.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema=?`,
    [databaseName]
  );
  const names = new Set(tables.map((row) => row.TABLE_NAME || row.table_name));
  const required = [
    "customer_master", "supplier_master", "part_master", "material_grade_master", "item_master", "item_incoming_inspection_characteristic", "part_bill_of_material",
    "machine_type_master", "machine_master", "machine_unit",
    "marketing_enquiries", "marketing_feasibilities", "marketing_workouts",
    "marketing_workout_subparts", "marketing_quotations", "marketing_reference_values",
    "purchase_requests", "purchase_request_items", "purchase_request_approval_history",
    "purchase_enquiries", "purchase_enquiry_items", "purchase_enquiry_item_suppliers",
    "supplier_quotations", "supplier_quotation_items", "purchase_supplier_selections", "grn_inspection_characteristics", "inventory_stock_balance", "inventory_stock_transaction", "gauge_movement_batches",
    "rejection_reason_master", "rejection_disposition_master", "grn_rejection_records", "grn_rejection_attachments", "inventory_rejection_balance", "inventory_rejection_transaction", "return_to_vendor_documents", "return_to_vendor_document_items", "rejection_resolution_requests", "inventory_rework_balance", "customer_material_job_balance", "customer_material_job_transaction", "return_to_customer_documents", "return_to_customer_document_items", "outsourcing_wip_balance", "outsourcing_wip_transaction", "material_outward_documents", "material_outward_document_items", "outsourcing_issue_wip_balance",
    "tooling_stock_balance", "tooling_item_metrics", "tooling_regrind_batches", "tooling_regrind_batch_items", "tooling_stock_movements", "tooling_regrind_inspection_measurements",
  ];
  const missing = required.filter((name) => !names.has(name));
  if (missing.length) throw new Error(`Missing production tables: ${missing.join(", ")}`);
  const [gaugeHistoryColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='gauge_history'`,
    [databaseName]
  );
  const gaugeHistoryColumnNames = new Set(gaugeHistoryColumns.map((row) => row.COLUMN_NAME || row.column_name));
  const missingGaugeCertificateColumns = ["certificate_file_name", "certificate_file_path", "certificate_file_size_bytes"]
    .filter((name) => !gaugeHistoryColumnNames.has(name));
  if (missingGaugeCertificateColumns.length) {
    throw new Error(`Missing Gauge calibration certificate columns: ${missingGaugeCertificateColumns.join(", ")}`);
  }
  const [gaugeDispatchColumns] = await connection.query(
    `SELECT column_name AS columnName, column_type AS columnType
     FROM information_schema.columns WHERE table_schema=? AND table_name='gauge_movement_batches'`,
    [databaseName]
  );
  const dispatchColumnMap = new Map(gaugeDispatchColumns.map((row) => [row.columnName || row.COLUMN_NAME, row.columnType || row.COLUMN_TYPE]));
  const missingGaugeDispatchColumns = ["calibration_agency", "service_purchase_order_id", "service_po_number_snapshot", "challan_number", "expected_return_date", "courier_reference", "dispatch_status"]
    .filter((name) => !dispatchColumnMap.has(name));
  if (missingGaugeDispatchColumns.length) {
    throw new Error(`Missing Gauge calibration dispatch columns: ${missingGaugeDispatchColumns.join(", ")}`);
  }
  if (!String(dispatchColumnMap.get("movement_type") || "").includes("CALIBRATION_DISPATCH")) {
    throw new Error("Gauge movement type does not support CALIBRATION_DISPATCH.");
  }
  const [supplierForeignKeys] = await connection.query(`
    SELECT table_name AS tableName, column_name AS columnName,
      referenced_table_name AS referencedTableName
    FROM information_schema.key_column_usage
    WHERE table_schema=?
      AND column_name LIKE '%supplier_id'
      AND referenced_table_name IS NOT NULL
    ORDER BY table_name, column_name
  `, [databaseName]);
  const incorrectSupplierForeignKeys = supplierForeignKeys.filter((key) => key.referencedTableName !== "supplier_master");
  if (incorrectSupplierForeignKeys.length) {
    throw new Error(`Supplier foreign keys must reference supplier_master: ${JSON.stringify(incorrectSupplierForeignKeys)}`);
  }
  const [rtvColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='return_to_vendor_documents'`,
    [databaseName]
  );
  const rtvColumnNames = new Set(rtvColumns.map((row) => row.COLUMN_NAME || row.column_name));
  const missingRtvColumns = ["document_status", "approved_by", "approved_at", "supplier_contact", "supplier_acknowledgement_reference", "supplier_acknowledged_at", "dispatched_at"].filter((name) => !rtvColumnNames.has(name));
  if (missingRtvColumns.length) throw new Error(`Missing RTV workflow columns: ${missingRtvColumns.join(", ")}`);
  const [rejectionColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='inventory_rejection_balance'`,
    [databaseName]
  );
  if (!rejectionColumns.some((row) => (row.COLUMN_NAME || row.column_name) === "quantity_reserved")) {
    throw new Error("Missing rejection inventory reservation column.");
  }
  const [resolutionColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='rejection_resolution_requests'`,
    [databaseName]
  );
  const resolutionColumnNames = new Set(resolutionColumns.map((row) => row.COLUMN_NAME || row.column_name));
  const missingResolutionColumns = ["resolution_action", "resolution_status", "quantity", "approved_by", "executed_by", "pdf_file_path"].filter((name) => !resolutionColumnNames.has(name));
  if (missingResolutionColumns.length) throw new Error(`Missing rejection resolution workflow columns: ${missingResolutionColumns.join(", ")}`);
  const [reworkColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='inventory_rework_balance'`,
    [databaseName]
  );
  const reworkColumnNames = new Set(reworkColumns.map((row) => row.COLUMN_NAME || row.column_name));
  const missingReworkColumns = ["accepted_quantity", "rejected_quantity", "reinspected_at", "stock_posting_date", "stock_posted_at"].filter((name) => !reworkColumnNames.has(name));
  if (missingReworkColumns.length) throw new Error(`Missing rework re-inspection columns: ${missingReworkColumns.join(", ")}`);
  const [outsourcingColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='outsourcing_wip_balance'`,
    [databaseName]
  );
  const outsourcingColumnNames = new Set(outsourcingColumns.map((row) => row.COLUMN_NAME || row.column_name));
  const missingOutsourcingColumns = ["grn_id", "part_id", "batch_serial_number", "process_plan_id", "process_operation_id", "quantity_in_wip", "wip_status", "inspection_status"].filter((name) => !outsourcingColumnNames.has(name));
  if (missingOutsourcingColumns.length) throw new Error(`Missing Outsourcing WIP columns: ${missingOutsourcingColumns.join(", ")}`);
  const [gateEntryColumns] = await connection.query(
    `SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=? AND table_name='purchase_gate_entries'`,
    [databaseName]
  );
  const gateEntryColumnTypes = new Map(gateEntryColumns.map((row) => [row.COLUMN_NAME || row.column_name, String(row.DATA_TYPE || row.data_type || "").toLowerCase()]));
  const missingGateEntryColumns = ["part_id", "part_number_snapshot", "part_name_snapshot", "part_uom_snapshot"].filter((name) => !gateEntryColumnTypes.has(name));
  if (missingGateEntryColumns.length) throw new Error(`Missing outsourced Gate Entry columns: ${missingGateEntryColumns.join(", ")}`);
  if (!gateEntryColumnTypes.get("status")?.includes("char")) throw new Error("Gate Entry status must support the Outsourcing WIP state.");
  const [grnOutsourcingColumns] = await connection.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name='goods_receipt_notes'`,
    [databaseName]
  );
  const grnOutsourcingColumnNames = new Set(grnOutsourcingColumns.map((row) => row.COLUMN_NAME || row.column_name));
  const missingGrnOutsourcingColumns = ["outsourcing_part_id", "outsourcing_part_number_snapshot", "outsourcing_process_plan_id", "outsourcing_process_operation_id"].filter((name) => !grnOutsourcingColumnNames.has(name));
  if (missingGrnOutsourcingColumns.length) throw new Error(`Missing outsourced GRN columns: ${missingGrnOutsourcingColumns.join(", ")}`);
  const [stockIndexes] = await connection.query(
    `SELECT index_name FROM information_schema.statistics WHERE table_schema=? AND table_name='inventory_stock_transaction'`,
    [databaseName]
  );
  const stockIndexNames = new Set(stockIndexes.map((row) => row.INDEX_NAME || row.index_name));
  if (stockIndexNames.has("uq_inventory_stock_transaction_grn_line") || !stockIndexNames.has("ix_inventory_stock_transaction_grn_line")) {
    throw new Error("Rework stock transactions require a non-unique GRN-line transaction index.");
  }
  if (!demoMode) {
    let sampleSql = await fs.readFile(
      new URL("../database/atech-production-sample-data.sql", import.meta.url),
      "utf8"
    );
    sampleSql = sampleSql.replace("USE `atech_erp`;", `USE \`${databaseName}\`;`);
    await connection.query(sampleSql);
  }
  const [[sample]] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM customer_master WHERE customer_code LIKE '%-DEMO-%') AS customers,
    (SELECT COUNT(*) FROM part_master WHERE part_number='PRT-DEMO-0001') AS parts,
    (SELECT COUNT(*) FROM item_master WHERE item_code='RM-DEMO-0001') AS items,
    (SELECT COUNT(*) FROM marketing_enquiries WHERE doc_no='ENQ-DEMO-0001') AS enquiries`);
  if (Number(sample.customers) !== 1 || Number(sample.parts) !== 1 ||
      Number(sample.items) !== 1 || Number(sample.enquiries) !== 1) {
    throw new Error(`Sample-data validation failed: ${JSON.stringify(sample)}`);
  }
  const [[workflow]] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM purchase_orders
      WHERE tenant_id='DEFAULT' AND po_number='PO-DEMO-REGULAR-001' AND status='APPROVED') AS approvedRegularOrders,
    (SELECT COUNT(*) FROM purchase_gate_entries
      WHERE tenant_id='DEFAULT'
        AND gate_entry_number IN ('GE-DEMO-REGULAR-READY','GE-DEMO-OPEN-READY','GE-DEMO-CUSTOMER-READY','GE-DEMO-OUTSOURCE-READY')
        AND status='GATE_ENTERED') AS readyGateEntries,
    (SELECT COUNT(*) FROM goods_receipt_notes
      WHERE tenant_id='DEFAULT' AND grn_number='GRN-DEMO-PENDING-001'
        AND receipt_type='OPEN_PURCHASE' AND status='INSPECTION_PENDING' AND inspection_status='PENDING') AS pendingGrns,
    (SELECT COUNT(*) FROM goods_receipt_notes G
      JOIN goods_receipt_note_items GI ON GI.grn_id=G.grn_id AND GI.tenant_id=G.tenant_id
      WHERE G.tenant_id='DEFAULT' AND G.grn_number='GRN-DEMO-REJECTED-001'
        AND G.status='REJECTED' AND G.inspection_status='FAILED'
        AND GI.rejected_quantity=8.000 AND GI.inspection_disposition='REJECT_LOT') AS rejectedGrns,
    (SELECT COUNT(*) FROM inventory_rejection_balance B
      JOIN grn_rejection_records R ON R.grn_rejection_id=B.grn_rejection_id
      JOIN goods_receipt_notes G ON G.grn_id=B.grn_id
      WHERE B.tenant_id='DEFAULT' AND G.grn_number='GRN-DEMO-REJECTED-001'
        AND B.warehouse_code='REJECTION INVENTORY' AND B.bin_location='QUARANTINE'
        AND B.quantity_on_hand=8.000 AND B.status='OPEN'
        AND R.rejection_reason_code_snapshot='DIMENSION_OUT'
        AND R.rejection_disposition_code_snapshot='REWORK') AS rejectionBalances,
    (SELECT COUNT(*) FROM inventory_rejection_transaction T
      JOIN inventory_rejection_balance B ON B.rejection_inventory_balance_id=T.rejection_inventory_balance_id
      JOIN goods_receipt_notes G ON G.grn_id=B.grn_id
      WHERE T.tenant_id='DEFAULT' AND G.grn_number='GRN-DEMO-REJECTED-001'
        AND T.transaction_type='GRN_REJECTION' AND T.quantity_in=8.000
        AND T.quantity_out=0.000 AND T.balance_after_quantity=8.000) AS rejectionTransactions,
    (SELECT COUNT(*) FROM grn_inspection_characteristics C
      JOIN goods_receipt_note_items GI ON GI.grn_item_id=C.grn_item_id
      JOIN goods_receipt_notes G ON G.grn_id=GI.grn_id
      WHERE G.tenant_id='DEFAULT'
        AND G.grn_number IN ('GRN-DEMO-PENDING-001','GRN-DEMO-REJECTED-001')) AS inspectionSnapshots`);
  if (Number(workflow.approvedRegularOrders) !== 1 || Number(workflow.readyGateEntries) !== 4 || Number(workflow.pendingGrns) !== 1 ||
      Number(workflow.rejectedGrns) !== 1 || Number(workflow.rejectionBalances) !== 1 ||
      Number(workflow.rejectionTransactions) !== 1 || Number(workflow.inspectionSnapshots) !== 2) {
    throw new Error(`GRN workflow sample validation failed: ${JSON.stringify(workflow)}`);
  }
  console.log(`${demoMode ? "Demo" : deploymentMode ? "Production deployment" : "Production"} SQL validation passed with ${tables.length} tables; sample data also passed.`);
} finally {
  await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  await connection.end();
}
