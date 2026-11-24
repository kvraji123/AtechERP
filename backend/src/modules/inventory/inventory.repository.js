import { cmsDb, db } from "../../config/db.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";

const cmsDatabaseName = String(process.env.CMS_DB_NAME || "cms_erp").trim();
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cmsDatabaseName)) {
  throw new Error("CMS_DB_NAME must be a valid MySQL identifier.");
}
const cmsSchema = `\`${cmsDatabaseName}\``;

function filterClause(filters, alias = "B") {
  const clauses = [];
  const params = [];
  const search = String(filters.search || "").trim();

  if (search) {
    clauses.push(`(I.item_code LIKE ? OR I.item_description LIKE ? OR ${alias}.warehouse_code LIKE ? OR ${alias}.bin_location LIKE ?)`);
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (filters.warehouse) {
    clauses.push(`${alias}.warehouse_code = ?`);
    params.push(filters.warehouse);
  }
  if (filters.binLocation) {
    clauses.push(`${alias}.bin_location = ?`);
    params.push(filters.binLocation);
  }

  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

export async function getDashboard(tenantId) {
  const [[stock]] = await db.execute(
    `SELECT COUNT(*) AS stockLineCount,
            COUNT(DISTINCT item_id) AS itemCount,
            COALESCE(SUM(quantity_on_hand), 0) AS quantityOnHand
       FROM inventory_stock_balance
      WHERE tenant_id=? AND stock_owner_type='COMPANY' AND quantity_on_hand > 0`,
    [tenantId]
  );
  const [[hold]] = await db.execute(
    `SELECT COUNT(*) AS qualityHoldLineCount,
            COALESCE(SUM(GI.on_hold_quantity), 0) AS qualityHoldQuantity
       FROM goods_receipt_notes G
       JOIN goods_receipt_note_items GI ON GI.grn_id=G.grn_id AND GI.tenant_id=G.tenant_id
      WHERE G.tenant_id=? AND G.status='INSPECTION_HOLD' AND GI.on_hold_quantity > 0`,
    [tenantId]
  );
  const [[customerStock]] = await db.execute(
    `SELECT COUNT(*) AS customerStockLineCount,
            COUNT(DISTINCT stock_owner_id) AS customerStockCustomerCount,
            COALESCE(SUM(quantity_on_hand), 0) AS customerStockQuantity
       FROM inventory_stock_balance
      WHERE tenant_id=? AND stock_owner_type='CUSTOMER' AND quantity_on_hand > 0`,
    [tenantId]
  );
  let customerWip = { customerWipQuantity: 0 };
  let outsourcingWip = { outsourcingWipLineCount: 0, outsourcingWipQuantity: 0 };
  try {
    const [[row]] = await db.execute(
      `SELECT COALESCE(SUM(quantity_in_process), 0) AS customerWipQuantity
         FROM customer_material_job_balance
        WHERE tenant_id=? AND status='OPEN' AND quantity_in_process > 0`,
      [tenantId]
    );
    customerWip = row || customerWip;
  } catch (error) {
    // This keeps the existing dashboard available during a staged deployment where
    // application code is deployed before the customer-material migration.
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
  }
  try {
    const [[row]] = await db.execute(
      `SELECT COUNT(*) AS outsourcingWipLineCount,COALESCE(SUM(quantity_in_wip),0) AS outsourcingWipQuantity
         FROM outsourcing_wip_balance
        WHERE tenant_id=? AND wip_status IN ('AWAITING_PROCESS_OPERATION','IN_PROCESS','PROCESS_INSPECTION_PENDING')
          AND quantity_in_wip>0`,
      [tenantId]
    );
    outsourcingWip = row || outsourcingWip;
  } catch (error) {
    // Supports deployments where the UI arrives before the WIP migration.
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
  }
  const [[rejection]] = await db.execute(
    `SELECT COUNT(*) AS rejectionInventoryLineCount,
            COALESCE(SUM(quantity_on_hand),0) AS rejectionInventoryQuantity
       FROM inventory_rejection_balance
      WHERE tenant_id=? AND status='OPEN' AND quantity_on_hand > 0`,
    [tenantId]
  );
  const [[reorder]] = await db.execute(
    `SELECT COUNT(*) AS reorderAlertCount
       FROM (
         SELECT I.item_id
           FROM item_master I
           LEFT JOIN inventory_stock_balance B ON B.item_id=I.item_id AND B.tenant_id=? AND B.stock_owner_type='COMPANY'
          WHERE I.active_flag='Y' AND COALESCE(I.reorder_level, 0) > 0
          GROUP BY I.item_id, I.reorder_level
         HAVING COALESCE(SUM(B.quantity_on_hand), 0) <= I.reorder_level
       ) AS reorder_items`,
    [tenantId]
  );
  const [[movement]] = await db.execute(
    `SELECT MAX(transaction_date) AS lastTransactionDate
       FROM inventory_stock_transaction
      WHERE tenant_id=?`,
    [tenantId]
  );

  return {
    stockLineCount: Number(stock?.stockLineCount || 0),
    itemCount: Number(stock?.itemCount || 0),
    quantityOnHand: Number(stock?.quantityOnHand || 0),
    customerStockLineCount: Number(customerStock?.customerStockLineCount || 0),
    customerStockCustomerCount: Number(customerStock?.customerStockCustomerCount || 0),
    customerStockQuantity: Number(customerStock?.customerStockQuantity || 0),
    customerWipQuantity: Number(customerWip?.customerWipQuantity || 0),
    outsourcingWipLineCount: Number(outsourcingWip?.outsourcingWipLineCount || 0),
    outsourcingWipQuantity: Number(outsourcingWip?.outsourcingWipQuantity || 0),
    qualityHoldLineCount: Number(hold?.qualityHoldLineCount || 0),
    qualityHoldQuantity: Number(hold?.qualityHoldQuantity || 0),
    rejectionInventoryLineCount: Number(rejection?.rejectionInventoryLineCount || 0),
    rejectionInventoryQuantity: Number(rejection?.rejectionInventoryQuantity || 0),
    reorderAlertCount: Number(reorder?.reorderAlertCount || 0),
    lastTransactionDate: movement?.lastTransactionDate || null,
  };
}

export async function listOutsourcingWip({ tenantId, filters, limit }) {
  const clauses = [];
  const params = [tenantId];
  const search = String(filters.search || "").trim();
  if (search) {
    const term = `%${search}%`;
    clauses.push("(W.part_number_snapshot LIKE ? OR W.part_name_snapshot LIKE ? OR G.grn_number LIKE ? OR GE.gate_entry_number LIKE ? OR S.supplier_name LIKE ? OR W.batch_serial_number LIKE ?)");
    params.push(term, term, term, term, term, term);
  }
  if (filters.status) { clauses.push("W.wip_status=?"); params.push(filters.status); }
  const [rows] = await db.execute(`SELECT W.outsourcing_wip_balance_id AS id,W.grn_id AS grnId,W.grn_item_id AS grnItemId,
      G.grn_number AS grnNumber,G.grn_date AS grnDate,G.supplier_invoice_number AS supplierInvoiceNumber,
      G.supplier_invoice_date AS supplierInvoiceDate,G.delivery_challan_number AS deliveryChallanNumber,
      GE.gate_entry_number AS gateEntryNumber,S.supplier_name AS supplierName,S.supplier_code AS supplierCode,
      W.part_id AS partId,W.part_number_snapshot AS partNumber,W.part_name_snapshot AS partName,
      W.uom_code_snapshot AS uomCode,W.batch_serial_number AS batchSerialNumber,W.received_quantity AS receivedQuantity,
      W.quantity_in_wip AS quantityInWip,W.wip_status AS wipStatus,W.inspection_status AS inspectionStatus,
      W.process_plan_id AS processPlanId,W.process_plan_code_snapshot AS processPlanCode,
      W.process_operation_id AS processOperationId,W.operation_number_snapshot AS operationNumber,
      W.operation_name_snapshot AS operationName,W.inspection_required AS inspectionRequired,W.received_at AS receivedAt,
      W.updated_at AS lastUpdatedAt
    FROM outsourcing_wip_balance W
    JOIN goods_receipt_notes G ON G.grn_id=W.grn_id AND G.tenant_id=W.tenant_id
    JOIN purchase_gate_entries GE ON GE.gate_entry_id=W.gate_entry_id AND GE.tenant_id=W.tenant_id
    JOIN supplier_master S ON S.supplier_id=W.supplier_id
    WHERE W.tenant_id=?${clauses.length ? ` AND ${clauses.join(" AND ")}` : ""}
    ORDER BY W.updated_at DESC,W.outsourcing_wip_balance_id DESC
    LIMIT ${Number(limit)}`, params);
  return rows;
}

export async function syncRejectionInventory(connection, data) {
  const [existingRows] = await connection.execute(`SELECT rejection_inventory_balance_id,
    quantity_on_hand FROM inventory_rejection_balance WHERE grn_rejection_id=? FOR UPDATE`,
  [Number(data.grnRejectionId)]);
  const existing = existingRows[0];
  if (existing) {
    await connection.execute(`UPDATE inventory_rejection_balance SET quantity_on_hand=?,status='OPEN',
      updated_by=? WHERE rejection_inventory_balance_id=?`,
    [data.rejectedQuantity,data.userCode,existing.rejection_inventory_balance_id]);
    return Number(existing.rejection_inventory_balance_id);
  }
  const [inserted] = await connection.execute(`INSERT INTO inventory_rejection_balance
    (tenant_id,grn_rejection_id,grn_id,grn_item_id,item_id,item_description_snapshot,uom_code_snapshot,
     warehouse_code,bin_location,batch_serial_number,stock_owner_type,stock_owner_id,quantity_on_hand,
     status,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,'REJECTION INVENTORY','QUARANTINE',?,?,?,?, 'OPEN',?,?)`,
  [data.tenantId,data.grnRejectionId,data.grnId,data.grnItemId,data.itemId,data.itemDescription,
    data.uomCode,data.batchSerialNumber || "",data.stockOwnerType,data.stockOwnerId || 0,
    data.rejectedQuantity,data.userCode,data.userCode]);
  const balanceId = Number(inserted.insertId);
  await insertRejectionTransaction(connection, {
    tenantId:data.tenantId,balanceId,grnRejectionId:data.grnRejectionId,transactionType:"GRN_REJECTION",
    quantityIn:data.rejectedQuantity,quantityOut:0,balanceAfter:data.rejectedQuantity,
    remarks:"Quantity rejected during GRN inspection",userCode:data.userCode,
  });
  return balanceId;
}

export async function cancelRejectionInventoryForItem(connection, tenantId, grnItemId, userCode) {
  const [rows] = await connection.execute(`SELECT rejection_inventory_balance_id,grn_rejection_id,
    quantity_on_hand FROM inventory_rejection_balance WHERE tenant_id=? AND grn_item_id=?
    AND status='OPEN' FOR UPDATE`,[tenantId,Number(grnItemId)]);
  const balance = rows[0];
  if (!balance) return;
  await connection.execute(`UPDATE inventory_rejection_balance SET quantity_on_hand=0,status='CANCELLED',
    updated_by=? WHERE rejection_inventory_balance_id=?`,[userCode,balance.rejection_inventory_balance_id]);
  if (Number(balance.quantity_on_hand) > 0) await insertRejectionTransaction(connection, {
    tenantId,balanceId:balance.rejection_inventory_balance_id,grnRejectionId:balance.grn_rejection_id,
    transactionType:"ADJUSTMENT",quantityIn:0,quantityOut:Number(balance.quantity_on_hand),balanceAfter:0,
    remarks:"Rejection allocation cancelled during inspection update",userCode,
  });
}

export async function listRejectionInventory({ tenantId, filters, limit }) {
  const clauses = [];
  const params = [tenantId];
  const search = String(filters.search || "").trim();
  if (search) {
    const term = `%${search}%`;
    clauses.push("(R.grn_rejection_id LIKE ? OR G.grn_number LIKE ? OR I.item_code LIKE ? OR I.item_description LIKE ? OR R.rejection_reason_name_snapshot LIKE ? OR R.rejection_disposition_name_snapshot LIKE ?)");
    params.push(term,term,term,term,term,term);
  }
  if (filters.warehouse) { clauses.push("B.warehouse_code=?"); params.push(filters.warehouse); }
  if (filters.status) { clauses.push("B.status=?"); params.push(filters.status); }
  if (filters.stockOwnerType) { clauses.push("B.stock_owner_type=?"); params.push(filters.stockOwnerType); }
  const [rows] = await db.execute(`SELECT B.rejection_inventory_balance_id AS id,
    B.grn_rejection_id AS grnRejectionId,B.warehouse_code AS warehouseCode,B.bin_location AS binLocation,
    B.batch_serial_number AS batchSerialNumber,B.stock_owner_type AS stockOwnerType,
    B.stock_owner_id AS stockOwnerId,B.quantity_on_hand AS quantityOnHand,
    COALESCE(B.quantity_reserved,0) AS quantityReserved,
    GREATEST(B.quantity_on_hand-COALESCE(B.quantity_reserved,0),0) AS availableQuantity,B.status AS inventoryStatus,
    G.grn_number AS grnNumber,G.grn_date AS grnDate,G.receipt_type AS receiptType,G.supplier_id AS supplierId,G.customer_id AS customerId,
    I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,U.uom_code AS uomCode,
    R.rejection_reason_name_snapshot AS rejectionReason,R.rejection_disposition_name_snapshot AS followUpAction,
    R.responsible_party AS responsibleParty,R.quality_remarks AS qualityRemarks,
    COALESCE(C.customer_name,S.supplier_name) AS stockOwnerName,B.updated_at AS lastUpdatedAt,
    (SELECT D.rtv_document_id FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvDocumentId,
    (SELECT D.rtv_number FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvNumber,
    (SELECT D.document_status FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvStatus,
    (SELECT D.rtv_date FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvDate,
    (SELECT D.dispatch_reference FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvDispatchReference,
    (SELECT D.transport_reference FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvTransportReference,
    (SELECT D.supplier_contact FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvSupplierContact,
    (SELECT D.supplier_acknowledgement_reference FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvAcknowledgementReference,
    (SELECT CONCAT('/uploads/',REPLACE(D.pdf_file_path,'\\\\','/')) FROM return_to_vendor_documents D
      WHERE D.tenant_id=B.tenant_id AND D.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY D.rtv_document_id DESC LIMIT 1) AS latestRtvFileUrl
    ,(SELECT Q.rejection_resolution_request_id FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionRequestId
    ,(SELECT Q.resolution_number FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionNumber
    ,(SELECT Q.resolution_action FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionAction
    ,(SELECT Q.resolution_status FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionStatus
    ,(SELECT Q.warehouse_code FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionWarehouseCode
    ,(SELECT Q.bin_location FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionBinLocation
    ,(SELECT Q.party_contact FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionPartyContact
    ,(SELECT Q.acknowledgement_reference FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionAcknowledgementReference
    ,(SELECT Q.execution_reference FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionExecutionReference
    ,(SELECT W.inventory_rework_balance_id FROM inventory_rework_balance W
      JOIN rejection_resolution_requests Q ON Q.rejection_resolution_request_id=W.rejection_resolution_request_id
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY W.inventory_rework_balance_id DESC LIMIT 1) AS latestReworkBalanceId
    ,(SELECT W.status FROM inventory_rework_balance W
      JOIN rejection_resolution_requests Q ON Q.rejection_resolution_request_id=W.rejection_resolution_request_id
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY W.inventory_rework_balance_id DESC LIMIT 1) AS latestReworkStatus
    ,(SELECT W.quantity_in_process FROM inventory_rework_balance W
      JOIN rejection_resolution_requests Q ON Q.rejection_resolution_request_id=W.rejection_resolution_request_id
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY W.inventory_rework_balance_id DESC LIMIT 1) AS latestReworkQuantity
    ,(SELECT W.accepted_quantity FROM inventory_rework_balance W
      JOIN rejection_resolution_requests Q ON Q.rejection_resolution_request_id=W.rejection_resolution_request_id
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY W.inventory_rework_balance_id DESC LIMIT 1) AS latestReworkAcceptedQuantity
    ,(SELECT W.rejected_quantity FROM inventory_rework_balance W
      JOIN rejection_resolution_requests Q ON Q.rejection_resolution_request_id=W.rejection_resolution_request_id
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY W.inventory_rework_balance_id DESC LIMIT 1) AS latestReworkRejectedQuantity
    ,(SELECT CONCAT('/uploads/',REPLACE(Q.pdf_file_path,'\\\\','/')) FROM rejection_resolution_requests Q
      WHERE Q.tenant_id=B.tenant_id AND Q.rejection_inventory_balance_id=B.rejection_inventory_balance_id
      ORDER BY Q.rejection_resolution_request_id DESC LIMIT 1) AS latestResolutionFileUrl
    FROM inventory_rejection_balance B
    JOIN grn_rejection_records R ON R.grn_rejection_id=B.grn_rejection_id
    JOIN goods_receipt_notes G ON G.grn_id=B.grn_id AND G.tenant_id=B.tenant_id
    JOIN item_master I ON I.item_id=B.item_id
    LEFT JOIN uom_master U ON U.uom_id=I.uom_id
    LEFT JOIN customer_master C ON C.customer_id=B.stock_owner_id AND B.stock_owner_type='CUSTOMER'
    LEFT JOIN supplier_master S ON S.supplier_id=G.supplier_id AND B.stock_owner_type='COMPANY'
    WHERE B.tenant_id=?${clauses.length ? ` AND ${clauses.join(" AND ")}` : ""}
    ORDER BY B.updated_at DESC,B.rejection_inventory_balance_id DESC
    LIMIT ${Number(limit)}`,params);
  return rows;
}

export async function getRejectionInventoryForUpdate(connection, tenantId, balanceId) {
  const [rows] = await connection.execute(`SELECT B.*,R.responsible_party,R.rejection_reason_name_snapshot,
    G.company_id,G.plant_id,G.supplier_id,G.customer_id,G.grn_number,G.gate_entry_number,
    S.supplier_name,S.supplier_code,S.allowed_transport_modes AS supplier_allowed_transport_modes,S.transport_mode AS supplier_transport_mode,C.customer_name,C.allowed_transport_modes AS customer_allowed_transport_modes,C.transport_mode AS customer_transport_mode,I.item_code FROM inventory_rejection_balance B
    JOIN grn_rejection_records R ON R.grn_rejection_id=B.grn_rejection_id
    JOIN goods_receipt_notes G ON G.grn_id=B.grn_id AND G.tenant_id=B.tenant_id
    JOIN item_master I ON I.item_id=B.item_id
    LEFT JOIN supplier_master S ON S.supplier_id=G.supplier_id
    LEFT JOIN customer_master C ON C.customer_id=G.customer_id
    WHERE B.rejection_inventory_balance_id=? AND B.tenant_id=? FOR UPDATE`,[Number(balanceId),tenantId]);
  return rows[0] || null;
}

export async function getRtvDocumentForUpdate(connection, tenantId, rtvDocumentId) {
  const [rows] = await connection.execute(`SELECT D.*,B.quantity_on_hand,B.quantity_reserved,B.status AS rejection_inventory_status,
    G.grn_number,G.gate_entry_number,S.supplier_name,S.supplier_code,
    DI.grn_item_id,DI.item_id,DI.item_code_snapshot,DI.item_description_snapshot,DI.uom_code_snapshot,
    DI.returned_quantity,DI.rejection_reason_snapshot
    FROM return_to_vendor_documents D
    JOIN inventory_rejection_balance B ON B.rejection_inventory_balance_id=D.rejection_inventory_balance_id AND B.tenant_id=D.tenant_id
    JOIN goods_receipt_notes G ON G.grn_id=D.grn_id AND G.tenant_id=D.tenant_id
    JOIN supplier_master S ON S.supplier_id=D.supplier_id
    JOIN return_to_vendor_document_items DI ON DI.rtv_document_id=D.rtv_document_id
    WHERE D.rtv_document_id=? AND D.tenant_id=? FOR UPDATE`,[Number(rtvDocumentId),tenantId]);
  return rows[0] || null;
}

export async function updateRejectionBalance(connection, balanceId, quantityOnHand, status, userCode) {
  await connection.execute(`UPDATE inventory_rejection_balance SET quantity_on_hand=?,status=?,updated_by=?
    WHERE rejection_inventory_balance_id=?`,[quantityOnHand,status,userCode,Number(balanceId)]);
}

export async function reserveRejectionBalance(connection, balanceId, quantity, userCode) {
  await connection.execute(`UPDATE inventory_rejection_balance SET quantity_reserved=quantity_reserved+?,updated_by=?
    WHERE rejection_inventory_balance_id=?`,[quantity,userCode,Number(balanceId)]);
}

export async function consumeReservedRejectionBalance(connection, balanceId, quantityOnHand, quantityReserved, status, userCode) {
  await connection.execute(`UPDATE inventory_rejection_balance SET quantity_on_hand=?,quantity_reserved=?,status=?,updated_by=?
    WHERE rejection_inventory_balance_id=?`,[quantityOnHand,quantityReserved,status,userCode,Number(balanceId)]);
}

export async function closeGrnRejectionRecord(connection, tenantId, grnRejectionId, userCode) {
  await connection.execute(`UPDATE grn_rejection_records SET status='CLOSED',closed_by=?,closed_at=CURRENT_TIMESTAMP,
    updated_by=? WHERE grn_rejection_id=? AND tenant_id=?`,[userCode,userCode,Number(grnRejectionId),tenantId]);
}

export async function insertRejectionTransaction(connection, data) {
  await connection.execute(`INSERT INTO inventory_rejection_transaction
    (tenant_id,rejection_inventory_balance_id,grn_rejection_id,transaction_type,transaction_date,
     quantity_in,quantity_out,balance_after_quantity,remarks,created_by)
    VALUES (?,?,?, ?,CURRENT_DATE,?,?,?,?,?)`,
  [data.tenantId,data.balanceId,data.grnRejectionId,data.transactionType,data.quantityIn,data.quantityOut,
    data.balanceAfter,data.remarks || null,data.userCode]);
}

export async function insertRtvDocument(connection, data) {
  const [result] = await connection.execute(`INSERT INTO return_to_vendor_documents
    (tenant_id,rtv_number,rtv_date,document_status,rejection_inventory_balance_id,grn_rejection_id,
     grn_id,supplier_id,dispatch_reference,transport_mode,transport_reference,remarks,created_by)
    VALUES (?,?,?,'PENDING_APPROVAL',?,?,?,?,?,?,?, ?,?)`,
  [data.tenantId,data.rtvNumber,data.rtvDate,data.balanceId,data.grnRejectionId,data.grnId,data.supplierId,
    data.dispatchReference || null,data.transportMode || null,data.transportReference || null,data.remarks || null,data.userCode]);
  return Number(result.insertId);
}

export async function insertRtvDocumentItem(connection, data) {
  await connection.execute(`INSERT INTO return_to_vendor_document_items
    (rtv_document_id,grn_item_id,item_id,item_code_snapshot,item_description_snapshot,uom_code_snapshot,
     returned_quantity,rejection_reason_snapshot)
    VALUES (?,?,?,?,?,?,?,?)`,
  [data.rtvDocumentId,data.grnItemId,data.itemId,data.itemCode || null,data.itemDescription,data.uomCode,
    data.quantity,data.rejectionReason || null]);
}

export async function updateRtvDocumentFile(connection, rtvDocumentId, data) {
  await connection.execute(`UPDATE return_to_vendor_documents SET pdf_file_name=?,pdf_file_path=?,
    pdf_file_size_bytes=? WHERE rtv_document_id=?`,
  [data.fileName,data.filePath,data.fileSizeBytes,Number(rtvDocumentId)]);
}

export async function approveRtvDocument(connection, rtvDocumentId, data) {
  await connection.execute(`UPDATE return_to_vendor_documents SET document_status='APPROVED',approval_remarks=?,approved_by=?,
    approved_at=CURRENT_TIMESTAMP,pdf_file_name=?,pdf_file_path=?,pdf_file_size_bytes=? WHERE rtv_document_id=?`,
  [data.approvalRemarks || null,data.userCode,data.pdf.fileName,data.pdf.filePath,data.pdf.fileSizeBytes,Number(rtvDocumentId)]);
}

export async function acknowledgeRtvDocument(connection, rtvDocumentId, data) {
  await connection.execute(`UPDATE return_to_vendor_documents SET document_status='ACKNOWLEDGED',supplier_contact=?,
    supplier_acknowledgement_reference=?,supplier_acknowledged_by=?,supplier_acknowledged_at=CURRENT_TIMESTAMP
    WHERE rtv_document_id=?`,[data.supplierContact,data.acknowledgementReference,data.userCode,Number(rtvDocumentId)]);
}

export async function dispatchRtvDocument(connection, rtvDocumentId, userCode) {
  await connection.execute(`UPDATE return_to_vendor_documents SET document_status='DISPATCHED',dispatched_by=?,
    dispatched_at=CURRENT_TIMESTAMP WHERE rtv_document_id=?`,[userCode,Number(rtvDocumentId)]);
}

export async function insertRejectionResolutionRequest(connection, data) {
  const [result] = await connection.execute(`INSERT INTO rejection_resolution_requests
    (tenant_id,resolution_number,resolution_action,resolution_date,resolution_status,rejection_inventory_balance_id,
     grn_rejection_id,grn_id,grn_item_id,item_id,customer_id,quantity,item_code_snapshot,item_description_snapshot,
     uom_code_snapshot,rejection_reason_snapshot,warehouse_code,bin_location,dispatch_reference,transport_reference,
     action_reference,remarks,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [data.tenantId,data.resolutionNumber,data.action,data.resolutionDate,"PENDING_APPROVAL",data.balanceId,data.grnRejectionId,data.grnId,
    data.grnItemId,data.itemId,data.customerId || null,data.quantity,data.itemCode || null,data.itemDescription,data.uomCode,
    data.rejectionReason || null,data.warehouseCode || null,data.binLocation || null,data.dispatchReference || null,
    data.transportReference || null,data.actionReference || null,data.remarks,data.userCode,data.userCode]);
  return Number(result.insertId);
}

export async function getRejectionResolutionForUpdate(connection, tenantId, requestId) {
  const [rows] = await connection.execute(`SELECT Q.*,B.quantity_on_hand,B.quantity_reserved,B.status AS rejection_inventory_status,
    B.batch_serial_number AS balance_batch_serial_number,B.stock_owner_type AS balance_stock_owner_type,
    B.stock_owner_id AS balance_stock_owner_id,
    G.company_id,G.plant_id,G.grn_number,G.gate_entry_number,C.customer_name
    FROM rejection_resolution_requests Q
    JOIN inventory_rejection_balance B ON B.rejection_inventory_balance_id=Q.rejection_inventory_balance_id AND B.tenant_id=Q.tenant_id
    JOIN goods_receipt_notes G ON G.grn_id=Q.grn_id AND G.tenant_id=Q.tenant_id
    LEFT JOIN customer_master C ON C.customer_id=Q.customer_id
    WHERE Q.rejection_resolution_request_id=? AND Q.tenant_id=? FOR UPDATE`,[Number(requestId),tenantId]);
  return rows[0] || null;
}

export async function approveRejectionResolution(connection, requestId, data) {
  await connection.execute(`UPDATE rejection_resolution_requests SET resolution_status='APPROVED',approval_remarks=?,approved_by=?,
    approved_at=CURRENT_TIMESTAMP,pdf_file_name=?,pdf_file_path=?,pdf_file_size_bytes=?,updated_by=?
    WHERE rejection_resolution_request_id=?`,
  [data.approvalRemarks || null,data.userCode,data.pdf.fileName,data.pdf.filePath,data.pdf.fileSizeBytes,data.userCode,Number(requestId)]);
}

export async function acknowledgeCustomerReturn(connection, requestId, data) {
  await connection.execute(`UPDATE rejection_resolution_requests SET resolution_status='ACKNOWLEDGED',party_contact=?,
    acknowledgement_reference=?,acknowledged_by=?,acknowledged_at=CURRENT_TIMESTAMP,updated_by=?
    WHERE rejection_resolution_request_id=?`,
  [data.partyContact,data.acknowledgementReference,data.userCode,data.userCode,Number(requestId)]);
}

export async function setResolutionExecution(connection, requestId, status, data) {
  await connection.execute(`UPDATE rejection_resolution_requests SET resolution_status=?,execution_reference=?,executed_by=?,
    executed_at=CURRENT_TIMESTAMP,updated_by=? WHERE rejection_resolution_request_id=?`,
  [status,data.executionReference || null,data.userCode,data.userCode,Number(requestId)]);
}

export async function setResolutionStatus(connection, requestId, status, userCode) {
  await connection.execute(`UPDATE rejection_resolution_requests SET resolution_status=?,updated_by=?
    WHERE rejection_resolution_request_id=?`,[status,userCode,Number(requestId)]);
}

export async function insertReworkBalance(connection, data) {
  const [result] = await connection.execute(`INSERT INTO inventory_rework_balance
    (tenant_id,rejection_resolution_request_id,rejection_inventory_balance_id,grn_rejection_id,item_id,
     quantity_in_process,work_reference,started_by)
    VALUES (?,?,?,?,?,?,?,?)`,
  [data.tenantId,data.requestId,data.balanceId,data.grnRejectionId,data.itemId,data.quantity,data.workReference,data.userCode]);
  return Number(result.insertId);
}

export async function getReworkBalanceForUpdate(connection, tenantId, reworkBalanceId) {
  const [rows] = await connection.execute(`SELECT W.*,Q.quantity,Q.resolution_number,Q.rejection_resolution_request_id,Q.grn_id,Q.grn_item_id,
    B.quantity_on_hand,B.quantity_reserved,B.status AS rejection_inventory_status,
    B.batch_serial_number AS balance_batch_serial_number,B.stock_owner_type AS balance_stock_owner_type,
    B.stock_owner_id AS balance_stock_owner_id,G.company_id,G.plant_id,G.grn_number,G.gate_entry_number
    FROM inventory_rework_balance W
    JOIN rejection_resolution_requests Q ON Q.rejection_resolution_request_id=W.rejection_resolution_request_id AND Q.tenant_id=W.tenant_id
    JOIN inventory_rejection_balance B ON B.rejection_inventory_balance_id=W.rejection_inventory_balance_id AND B.tenant_id=W.tenant_id
    JOIN goods_receipt_notes G ON G.grn_id=Q.grn_id AND G.tenant_id=Q.tenant_id
    WHERE W.inventory_rework_balance_id=? AND W.tenant_id=? FOR UPDATE`,[Number(reworkBalanceId),tenantId]);
  return rows[0] || null;
}

export async function completeReworkBalance(connection, reworkBalanceId, data) {
  await connection.execute(`UPDATE inventory_rework_balance SET status='AWAITING_REINSPECTION',completed_by=?,completed_at=CURRENT_TIMESTAMP,
    completion_remarks=? WHERE inventory_rework_balance_id=?`,[data.userCode,data.remarks,Number(reworkBalanceId)]);
}

export async function recordReworkReinspection(connection, reworkBalanceId, data) {
  await connection.execute(`UPDATE inventory_rework_balance SET status=?,accepted_quantity=?,rejected_quantity=?,
    reinspection_remarks=?,reinspection_rejection_reason=?,reinspected_by=?,reinspected_at=CURRENT_TIMESTAMP
    WHERE inventory_rework_balance_id=?`,[data.status,data.acceptedQuantity,data.rejectedQuantity,
    data.qualityRemarks,data.rejectionReason || null,data.userCode,Number(reworkBalanceId)]);
}

export async function recordReworkStockPosting(connection, reworkBalanceId, data) {
  await connection.execute(`UPDATE inventory_rework_balance SET status='POSTED',stock_posting_date=?,warehouse_code=?,
    bin_location=?,batch_serial_number=?,stock_posted_by=?,stock_posted_at=CURRENT_TIMESTAMP
    WHERE inventory_rework_balance_id=?`,[data.stockPostingDate,data.warehouseCode,data.binLocation,
    data.batchSerialNumber || null,data.userCode,Number(reworkBalanceId)]);
}

export async function returnReworkedQuantityToQuarantine(connection, balanceId, quantity, userCode) {
  await connection.execute(`UPDATE inventory_rejection_balance SET quantity_on_hand=quantity_on_hand+?,status='OPEN',updated_by=?
    WHERE rejection_inventory_balance_id=?`,[quantity,userCode,Number(balanceId)]);
}

export async function releaseRejectionToAvailableStock(connection, data) {
  await connection.execute(`INSERT INTO inventory_stock_balance
    (tenant_id,company_id,plant_id,item_id,warehouse_code,bin_location,batch_serial_number,
     quantity_on_hand,created_by,updated_by,stock_owner_type,stock_owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE quantity_on_hand=quantity_on_hand+VALUES(quantity_on_hand),updated_by=VALUES(updated_by)`,
  [data.tenantId,data.companyId,data.plantId || "",data.itemId,data.warehouseCode,data.binLocation,
    data.batchSerialNumber || "",data.quantity,data.userCode,data.userCode,data.stockOwnerType,data.stockOwnerId || 0]);
  const [balances] = await connection.execute(`SELECT quantity_on_hand FROM inventory_stock_balance
    WHERE tenant_id=? AND plant_id <=> ? AND item_id=? AND warehouse_code=? AND bin_location=?
      AND batch_serial_number=? AND stock_owner_type=? AND stock_owner_id=? FOR UPDATE`,
  [data.tenantId,data.plantId || "",data.itemId,data.warehouseCode,data.binLocation,data.batchSerialNumber || "",
    data.stockOwnerType,data.stockOwnerId || 0]);
  const balanceAfter = Number(balances[0]?.quantity_on_hand || 0);
  await connection.execute(`INSERT INTO inventory_stock_transaction
    (tenant_id,company_id,plant_id,transaction_type,transaction_date,item_id,grn_id,grn_item_id,
     warehouse_code,bin_location,batch_serial_number,quantity_in,quantity_out,balance_after_quantity,
     remarks,created_by,stock_owner_type,stock_owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [data.tenantId,data.companyId,data.plantId || null,data.transactionType || "REJECTION_RELEASE",data.transactionDate || todayInAppTimeZone(),data.itemId,data.grnId,data.grnItemId,data.warehouseCode,
    data.binLocation,data.batchSerialNumber || "",data.quantity,0,balanceAfter,data.remarks || "Released from rejection inventory",data.userCode,data.stockOwnerType,data.stockOwnerId || 0]);
  return balanceAfter;
}

export async function listStock({ tenantId, filters, limit }) {
  const filter = filterClause(filters);
  const [rows] = await db.execute(
    `SELECT B.inventory_stock_balance_id AS id,
            I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
            I.item_specification AS specification,U.uom_code AS uomCode,
            B.warehouse_code AS warehouseCode,B.bin_location AS binLocation,
            B.batch_serial_number AS batchSerialNumber,B.quantity_on_hand AS quantityOnHand,
            I.minimum_stock AS minimumStock,I.reorder_level AS reorderLevel,
            CASE WHEN B.stock_owner_type='CUSTOMER' THEN 'CUSTOMER_OWNED' WHEN COALESCE(I.reorder_level,0)>0 AND B.quantity_on_hand<=I.reorder_level THEN 'REORDER' ELSE 'AVAILABLE' END AS stockStatus,
            B.stock_owner_type AS stockOwnerType,B.stock_owner_id AS stockOwnerId,
            (SELECT C.customer_name FROM customer_master C WHERE C.customer_id=B.stock_owner_id) AS stockOwnerName,B.updated_at AS lastUpdatedAt
       FROM inventory_stock_balance B
       JOIN item_master I ON I.item_id=B.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE B.tenant_id=? AND B.stock_owner_type=? AND B.quantity_on_hand <> 0${filter.sql}
      ORDER BY B.updated_at DESC,B.inventory_stock_balance_id DESC
      LIMIT ${Number(limit)}`,
    [tenantId, filters.stockOwnerType || "COMPANY", ...filter.params]
  );
  return rows;
}

export async function listCustomerStock({ tenantId, filters, limit }) {
  const clauses = [];
  const params = [tenantId, tenantId];
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    clauses.push("(S.customerCode LIKE ? OR S.customerName LIKE ? OR S.itemCode LIKE ? OR S.itemDescription LIKE ? OR S.warehouseCode LIKE ? OR S.binLocation LIKE ?)");
    params.push(term, term, term, term, term, term);
  }
  if (filters.warehouseCode) {
    clauses.push("S.warehouseCode=?");
    params.push(String(filters.warehouseCode));
  }
  if (filters.binLocation) {
    clauses.push("S.binLocation=?");
    params.push(String(filters.binLocation));
  }
  const [rows] = await db.execute(
    `SELECT * FROM (
      SELECT B.inventory_stock_balance_id AS id,B.inventory_stock_balance_id AS inventoryStockBalanceId,
            B.stock_owner_id AS customerId,C.customer_code AS customerCode,C.customer_name AS customerName,
            I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
            I.item_specification AS specification,U.uom_code AS uomCode,
            B.warehouse_code AS warehouseCode,B.bin_location AS binLocation,B.batch_serial_number AS batchSerialNumber,
            B.quantity_on_hand AS quantityOnHand,
            COALESCE((SELECT SUM(J.quantity_in_process) FROM customer_material_job_balance J
              WHERE J.tenant_id=B.tenant_id AND J.inventory_stock_balance_id=B.inventory_stock_balance_id
                AND J.status='OPEN'),0) AS quantityInJob,
            B.updated_at AS lastUpdatedAt
       FROM inventory_stock_balance B
       JOIN customer_master C ON C.customer_id=B.stock_owner_id
       JOIN item_master I ON I.item_id=B.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE B.tenant_id=? AND B.stock_owner_type='CUSTOMER' AND B.quantity_on_hand > 0
      UNION ALL
      SELECT CONCAT('catalog-',CSI.item_id) AS id,NULL AS inventoryStockBalanceId,
            CSI.customer_id AS customerId,C.customer_code AS customerCode,C.customer_name AS customerName,
            I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
            I.item_specification AS specification,U.uom_code AS uomCode,
            'Awaiting receipt' AS warehouseCode,'' AS binLocation,'' AS batchSerialNumber,
            0 AS quantityOnHand,0 AS quantityInJob,CSI.updated_on AS lastUpdatedAt
       FROM customer_supplied_item CSI
       JOIN customer_master C ON C.customer_id=CSI.customer_id
       JOIN item_master I ON I.item_id=CSI.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory_stock_balance B
         WHERE B.tenant_id=? AND B.item_id=CSI.item_id AND B.stock_owner_type='CUSTOMER'
           AND B.stock_owner_id=CSI.customer_id AND B.quantity_on_hand > 0
      )
    ) S
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY S.lastUpdatedAt DESC,S.itemCode ASC
      LIMIT ${Number(limit)}`,
    params
  );
  return rows;
}

export async function listCustomerMaterialJobs({ tenantId, filters, limit }) {
  const clauses = [];
  const params = [tenantId];
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    clauses.push("(J.job_reference LIKE ? OR COALESCE(E.doc_no,CE.doc_no) LIKE ? OR C.customer_name LIKE ? OR I.item_code LIKE ? OR I.item_description LIKE ?)");
    params.push(term, term, term, term, term);
  }
  const [rows] = await db.execute(
    `SELECT J.customer_material_job_balance_id AS id,J.customer_material_job_balance_id AS customerMaterialJobBalanceId,
            J.customer_id AS customerId,C.customer_code AS customerCode,C.customer_name AS customerName,
            J.enquiry_id AS enquiryId,COALESCE(E.doc_no,CE.doc_no) AS enquiryNumber,J.job_reference AS jobReference,
            J.quantity_in_process AS quantityInProcess,J.status,J.issued_at AS issuedAt,J.updated_at AS lastUpdatedAt,
            B.inventory_stock_balance_id AS inventoryStockBalanceId,B.warehouse_code AS sourceWarehouseCode,
            B.bin_location AS sourceBinLocation,B.batch_serial_number AS batchSerialNumber,
            I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,U.uom_code AS uomCode
       FROM customer_material_job_balance J
       JOIN customer_master C ON C.customer_id=J.customer_id
       JOIN inventory_stock_balance B ON B.inventory_stock_balance_id=J.inventory_stock_balance_id
       JOIN item_master I ON I.item_id=J.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
       LEFT JOIN marketing_enquiries E ON E.enquiry_id=J.enquiry_id
       LEFT JOIN ${cmsSchema}.marketing_enquiries CE ON CE.enquiry_id=J.enquiry_id
      WHERE J.tenant_id=? AND J.status='OPEN' AND J.quantity_in_process > 0${clauses.length ? ` AND ${clauses.join(" AND ")}` : ""}
      ORDER BY J.updated_at DESC,J.customer_material_job_balance_id DESC
      LIMIT ${Number(limit)}`,
    params
  );
  return rows;
}

export async function getCustomerStockBalanceForUpdate(connection, tenantId, inventoryStockBalanceId) {
  const [rows] = await connection.execute(
    `SELECT B.*,C.customer_id AS customer_id,C.customer_name,C.customer_code,I.item_code,I.item_description,
            U.uom_code
       FROM inventory_stock_balance B
       JOIN customer_master C ON C.customer_id=B.stock_owner_id
       JOIN item_master I ON I.item_id=B.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE B.tenant_id=? AND B.inventory_stock_balance_id=? AND B.stock_owner_type='CUSTOMER'
      FOR UPDATE`,
    [tenantId, Number(inventoryStockBalanceId)]
  );
  return rows[0] || null;
}

export async function reduceCustomerStockBalance(connection, inventoryStockBalanceId, quantity, userCode) {
  await connection.execute(
    `UPDATE inventory_stock_balance SET quantity_on_hand=quantity_on_hand-?,updated_by=?
      WHERE inventory_stock_balance_id=?`,
    [quantity, userCode, Number(inventoryStockBalanceId)]
  );
}

export async function restoreCustomerStockBalance(connection, inventoryStockBalanceId, quantity, userCode) {
  await connection.execute(
    `UPDATE inventory_stock_balance SET quantity_on_hand=quantity_on_hand+?,updated_by=?
      WHERE inventory_stock_balance_id=?`,
    [quantity, userCode, Number(inventoryStockBalanceId)]
  );
}

export async function insertCustomerMaterialJobBalance(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO customer_material_job_balance
      (tenant_id,customer_id,enquiry_id,job_reference,inventory_stock_balance_id,item_id,quantity_in_process,issued_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [data.tenantId, data.customerId, data.enquiryId || null, data.jobReference, data.inventoryStockBalanceId,
      data.itemId, data.quantity, data.userCode, data.userCode]
  );
  return Number(result.insertId);
}

export async function getCustomerMaterialJobBalanceForUpdate(connection, tenantId, customerMaterialJobBalanceId) {
  const [rows] = await connection.execute(
    `SELECT J.*,C.customer_name,C.customer_code,COALESCE(E.doc_no,CE.doc_no) AS enquiry_number,I.item_code,I.item_description,U.uom_code
       FROM customer_material_job_balance J
       JOIN customer_master C ON C.customer_id=J.customer_id
       JOIN item_master I ON I.item_id=J.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
       LEFT JOIN marketing_enquiries E ON E.enquiry_id=J.enquiry_id
       LEFT JOIN ${cmsSchema}.marketing_enquiries CE ON CE.enquiry_id=J.enquiry_id
      WHERE J.tenant_id=? AND J.customer_material_job_balance_id=?
      FOR UPDATE`,
    [tenantId, Number(customerMaterialJobBalanceId)]
  );
  return rows[0] || null;
}

export async function updateCustomerMaterialJobBalance(connection, customerMaterialJobBalanceId, quantityInProcess, userCode) {
  const closed = Number(quantityInProcess) <= 0;
  await connection.execute(
    `UPDATE customer_material_job_balance
        SET quantity_in_process=?,status=?,updated_by=?,closed_by=?,closed_at=${closed ? "CURRENT_TIMESTAMP" : "NULL"}
      WHERE customer_material_job_balance_id=?`,
    [quantityInProcess, closed ? "CLOSED" : "OPEN", userCode, closed ? userCode : null, Number(customerMaterialJobBalanceId)]
  );
}

export async function insertCustomerMaterialJobTransaction(connection, data) {
  await connection.execute(
    `INSERT INTO customer_material_job_transaction
      (tenant_id,customer_material_job_balance_id,transaction_type,transaction_date,quantity_in,quantity_out,
       balance_after_quantity,reference_number,remarks,created_by)
     VALUES (?,?,?,CURRENT_DATE,?,?,?,?,?,?)`,
    [data.tenantId, data.customerMaterialJobBalanceId, data.transactionType, data.quantityIn, data.quantityOut,
      data.balanceAfter, data.referenceNumber || null, data.remarks || null, data.userCode]
  );
}

export async function insertCustomerStockTransaction(connection, data) {
  await connection.execute(
    `INSERT INTO inventory_stock_transaction
      (tenant_id,company_id,plant_id,transaction_type,transaction_date,item_id,grn_id,grn_item_id,
       warehouse_code,bin_location,batch_serial_number,quantity_in,quantity_out,balance_after_quantity,
       remarks,created_by,stock_owner_type,stock_owner_id)
     VALUES (?,?,?,?,?, ?,NULL,NULL, ?,?,?,?,?,?,?,?, 'CUSTOMER',?)`,
    [data.tenantId, data.companyId || null, data.plantId || null, data.transactionType, data.transactionDate,
      data.itemId, data.warehouseCode, data.binLocation, data.batchSerialNumber || "", data.quantityIn,
      data.quantityOut, data.balanceAfter, data.remarks || null, data.userCode, data.customerId]
  );
}

export async function getEnquiryForCustomer(connection, enquiryId, customerId) {
  const [rows] = await connection.execute(
    `SELECT enquiry_id,doc_no FROM marketing_enquiries WHERE enquiry_id=? AND customer_id=?`,
    [Number(enquiryId), Number(customerId)]
  );
  if (rows[0]) return rows[0];

  const [cmsRows] = await cmsDb.execute(
    `SELECT enquiry_id,doc_no FROM marketing_enquiries WHERE enquiry_id=? AND customer_id=?`,
    [Number(enquiryId), Number(customerId)]
  );
  return cmsRows[0] || null;
}

export async function insertReturnToCustomerDocument(connection, data) {
  const [result] = await connection.execute(
    `INSERT INTO return_to_customer_documents
      (tenant_id,rtc_number,rtc_date,customer_id,customer_code_snapshot,customer_name_snapshot,
       dispatch_reference,transport_mode,transport_reference,remarks,created_by,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [data.tenantId, data.rtcNumber, data.rtcDate, data.customerId, data.customerCode || null, data.customerName,
      data.dispatchReference || null, data.transportMode || null, data.transportReference || null, data.remarks, data.userCode, data.userCode]
  );
  return Number(result.insertId);
}

export async function insertReturnToCustomerDocumentItem(connection, data) {
  await connection.execute(
    `INSERT INTO return_to_customer_document_items
      (return_to_customer_document_id,rejection_inventory_balance_id,grn_rejection_id,grn_id,grn_item_id,item_id,
       grn_number_snapshot,item_code_snapshot,item_description_snapshot,uom_code_snapshot,returned_quantity,rejection_reason_snapshot)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [data.documentId, data.balanceId, data.grnRejectionId, data.grnId, data.grnItemId, data.itemId,
      data.grnNumber, data.itemCode || null, data.itemDescription, data.uomCode, data.quantity, data.rejectionReason || null]
  );
}

export async function listReturnToCustomerDocuments({ tenantId, filters, limit }) {
  const clauses = [];
  const params = [tenantId];
  if (filters.status) { clauses.push("D.document_status=?"); params.push(filters.status); }
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    clauses.push("(D.rtc_number LIKE ? OR D.customer_name_snapshot LIKE ? OR DI.grn_number_snapshot LIKE ? OR DI.item_description_snapshot LIKE ?)");
    params.push(term, term, term, term);
  }
  const [rows] = await db.execute(
    `SELECT D.return_to_customer_document_id AS id,D.return_to_customer_document_id AS returnToCustomerDocumentId,
            D.rtc_number AS rtcNumber,D.rtc_date AS rtcDate,D.document_status AS documentStatus,D.updated_at AS lastUpdatedAt,
            D.customer_id AS customerId,D.customer_code_snapshot AS customerCode,D.customer_name_snapshot AS customerName,
            D.dispatch_reference AS dispatchReference,D.transport_mode AS transportMode,D.transport_reference AS transportReference,D.gate_exit_reference AS gateExitReference,
            D.remarks,D.approval_remarks AS approvalRemarks,D.customer_contact AS customerContact,
            D.customer_acknowledgement_reference AS acknowledgementReference,D.pdf_file_name AS fileName,
            D.pdf_file_path AS filePath,D.pdf_file_size_bytes AS fileSizeBytes,
            CASE WHEN D.pdf_file_path IS NULL THEN NULL ELSE CONCAT('/uploads/',REPLACE(D.pdf_file_path,'\\\\','/')) END AS fileUrl,
            COUNT(DI.return_to_customer_document_item_id) AS itemCount,COALESCE(SUM(DI.returned_quantity),0) AS totalQuantity,
            GROUP_CONCAT(CONCAT(DI.item_code_snapshot,' · ',DI.returned_quantity,' ',DI.uom_code_snapshot) ORDER BY DI.return_to_customer_document_item_id SEPARATOR ' | ') AS itemSummary
       FROM return_to_customer_documents D
       JOIN return_to_customer_document_items DI ON DI.return_to_customer_document_id=D.return_to_customer_document_id
      WHERE D.tenant_id=?${clauses.length ? ` AND ${clauses.join(" AND ")}` : ""}
      GROUP BY D.return_to_customer_document_id
      ORDER BY D.updated_at DESC,D.return_to_customer_document_id DESC
      LIMIT ${Number(limit)}`,
    params
  );
  return rows;
}

export async function getReturnToCustomerDocumentForUpdate(connection, tenantId, documentId) {
  const [headers] = await connection.execute(
    `SELECT D.* FROM return_to_customer_documents D
      WHERE D.tenant_id=? AND D.return_to_customer_document_id=? FOR UPDATE`,
    [tenantId, Number(documentId)]
  );
  const document = headers[0];
  if (!document) return null;
  const [items] = await connection.execute(
    `SELECT DI.*,B.quantity_on_hand,B.quantity_reserved,B.status AS rejection_inventory_status
       FROM return_to_customer_document_items DI
       JOIN inventory_rejection_balance B ON B.rejection_inventory_balance_id=DI.rejection_inventory_balance_id
      WHERE DI.return_to_customer_document_id=? FOR UPDATE`,
    [Number(documentId)]
  );
  return { ...document, items };
}

export async function approveReturnToCustomerDocument(connection, documentId, data) {
  await connection.execute(
    `UPDATE return_to_customer_documents SET document_status='APPROVED',approval_remarks=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,
       pdf_file_name=?,pdf_file_path=?,pdf_file_size_bytes=?,updated_by=? WHERE return_to_customer_document_id=?`,
    [data.approvalRemarks || null, data.userCode, data.pdf.fileName, data.pdf.filePath, data.pdf.fileSizeBytes, data.userCode, Number(documentId)]
  );
}

export async function acknowledgeReturnToCustomerDocument(connection, documentId, data) {
  await connection.execute(
    `UPDATE return_to_customer_documents SET document_status='ACKNOWLEDGED',customer_contact=?,customer_acknowledgement_reference=?,
       customer_acknowledged_by=?,customer_acknowledged_at=CURRENT_TIMESTAMP,updated_by=? WHERE return_to_customer_document_id=?`,
    [data.customerContact, data.acknowledgementReference, data.userCode, data.userCode, Number(documentId)]
  );
}

export async function dispatchReturnToCustomerDocument(connection, documentId, data) {
  await connection.execute(
    `UPDATE return_to_customer_documents SET document_status='DISPATCHED',gate_exit_reference=?,dispatched_by=?,dispatched_at=CURRENT_TIMESTAMP,
       updated_by=? WHERE return_to_customer_document_id=?`,
    [data.gateExitReference, data.userCode, data.userCode, Number(documentId)]
  );
}

export async function listTransactions({ tenantId, filters, limit }) {
  const clauses = [];
  const params = [tenantId];
  const search = String(filters.search || "").trim();
  if (search) {
    clauses.push("(I.item_code LIKE ? OR I.item_description LIKE ? OR T.warehouse_code LIKE ? OR T.bin_location LIKE ? OR G.grn_number LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  if (filters.warehouse) {
    clauses.push("T.warehouse_code=?");
    params.push(filters.warehouse);
  }
  const [rows] = await db.execute(
    `SELECT T.inventory_stock_transaction_id AS id,T.transaction_type AS transactionType,
            T.transaction_date AS transactionDate,T.quantity_in AS quantityIn,T.quantity_out AS quantityOut,
            T.balance_after_quantity AS balanceAfterQuantity,T.warehouse_code AS warehouseCode,
            T.bin_location AS binLocation,T.batch_serial_number AS batchSerialNumber,T.remarks,
            I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
            U.uom_code AS uomCode,G.grn_number AS grnNumber,T.stock_owner_type AS stockOwnerType,G.customer_name_snapshot AS stockOwnerName,
            T.created_at AS lastUpdatedAt
       FROM inventory_stock_transaction T
       JOIN item_master I ON I.item_id=T.item_id
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
       LEFT JOIN goods_receipt_notes G ON G.grn_id=T.grn_id AND G.tenant_id=T.tenant_id
      WHERE T.tenant_id=?${clauses.length ? ` AND ${clauses.join(" AND ")}` : ""}
      ORDER BY T.created_at DESC,T.inventory_stock_transaction_id DESC
      LIMIT ${Number(limit)}`,
    params
  );
  return rows;
}

export async function listQualityHold({ tenantId, limit }) {
  const [rows] = await db.execute(
    `SELECT GI.grn_item_id AS grnItemId,G.grn_id AS grnId,G.grn_number AS grnNumber,
            G.grn_date AS grnDate,G.supplier_name_snapshot AS supplierName,
            GI.item_id AS itemId,GI.item_description_snapshot AS itemDescription,
            GI.uom_code_snapshot AS uomCode,GI.received_quantity AS receivedQuantity,
            GI.accepted_quantity AS acceptedQuantity,GI.rejected_quantity AS rejectedQuantity,
            GI.on_hold_quantity AS onHoldQuantity,GI.inspection_disposition AS disposition,
            GI.rejection_reason AS rejectionReason,GI.quality_remarks AS qualityRemarks,
            GREATEST(G.updated_at,GI.updated_at) AS lastUpdatedAt
       FROM goods_receipt_notes G
       JOIN goods_receipt_note_items GI ON GI.grn_id=G.grn_id AND GI.tenant_id=G.tenant_id
      WHERE G.tenant_id=? AND G.status='INSPECTION_HOLD' AND GI.on_hold_quantity > 0
      ORDER BY lastUpdatedAt DESC,G.grn_id DESC,GI.grn_item_id DESC
      LIMIT ${Number(limit)}`,
    [tenantId]
  );
  return rows;
}

export async function listReorderAlerts({ tenantId, limit }) {
  const [rows] = await db.execute(
    `SELECT I.item_id AS itemId,I.item_code AS itemCode,I.item_description AS itemDescription,
            U.uom_code AS uomCode,I.minimum_stock AS minimumStock,I.reorder_level AS reorderLevel,
            COALESCE(SUM(B.quantity_on_hand),0) AS quantityOnHand,
            CASE
              WHEN COALESCE(MAX(B.updated_at),'1000-01-01') > COALESCE(I.updated_on,'1000-01-01') THEN MAX(B.updated_at)
              ELSE I.updated_on
            END AS lastUpdatedAt,
            CASE WHEN COALESCE(SUM(B.quantity_on_hand),0)=0 THEN 'OUT_OF_STOCK' ELSE 'BELOW_REORDER' END AS alertStatus
       FROM item_master I
       LEFT JOIN inventory_stock_balance B ON B.item_id=I.item_id AND B.tenant_id=? AND B.stock_owner_type='COMPANY'
       LEFT JOIN uom_master U ON U.uom_id=I.uom_id
      WHERE I.active_flag='Y' AND COALESCE(I.reorder_level,0)>0
      GROUP BY I.item_id,I.item_code,I.item_description,U.uom_code,I.minimum_stock,I.reorder_level,I.updated_on
     HAVING COALESCE(SUM(B.quantity_on_hand),0)<=I.reorder_level
      ORDER BY lastUpdatedAt DESC,I.item_id DESC
      LIMIT ${Number(limit)}`,
    [tenantId]
  );
  return rows;
}
