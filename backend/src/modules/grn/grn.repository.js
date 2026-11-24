import { db } from "../../config/db.js";

export async function list({ tenantId, status = "", search = "", receiptType = "", supplier = "", rejectedInspection = false, limit = 20, offset = 0 }) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const statusClause = normalizedStatus === "READY_FOR_STOCK"
    ? "AND G.status IN ('READY_FOR_STOCK','ACCEPTED','PARTIALLY_ACCEPTED')"
    : normalizedStatus === "STOCK_POSTED"
      ? "AND G.status IN ('STOCK_POSTED','POSTED')"
      : normalizedStatus === "INSPECTION_PENDING"
        ? "AND G.status IN ('INSPECTION_PENDING','INWARD')"
        : "AND (?='' OR G.status=?)";
  const statusParams = ["READY_FOR_STOCK", "STOCK_POSTED", "INSPECTION_PENDING"].includes(normalizedStatus)
    ? []
    : [normalizedStatus, normalizedStatus];
  const where = `G.tenant_id=?
    AND (?='' OR G.grn_number LIKE CONCAT('%',?,'%') OR COALESCE(G.gate_entry_number,'') LIKE CONCAT('%',?,'%') OR COALESCE(PO.po_number,'') LIKE CONCAT('%',?,'%') OR COALESCE(G.supplier_name_snapshot,'') LIKE CONCAT('%',?,'%') OR COALESCE(G.customer_name_snapshot,'') LIKE CONCAT('%',?,'%'))
    ${statusClause}
    AND (?='' OR G.receipt_type=?)
    AND (?='' OR COALESCE(G.supplier_name_snapshot,'') LIKE CONCAT('%',?,'%'))`;
  const params = [tenantId, search, search, search, search, search, search, ...statusParams, receiptType, receiptType, supplier, supplier];
  const rejectedRowsClause = rejectedInspection ? " HAVING COALESCE(SUM(GI.rejected_quantity),0)>0" : "";
  const rejectedCountClause = rejectedInspection ? " AND EXISTS (SELECT 1 FROM goods_receipt_note_items COUNT_GI WHERE COUNT_GI.grn_id=G.grn_id AND COUNT_GI.tenant_id=G.tenant_id AND COALESCE(COUNT_GI.rejected_quantity,0)>0)" : "";
  const [rows] = await db.execute(`SELECT G.grn_id AS id,G.grn_number AS grnNumber,G.grn_date AS grnDate,G.receipt_type AS receiptType,G.purchase_approved_by AS purchaseApprovedBy,G.customer_id AS customerId,G.customer_name_snapshot AS customerName,G.gate_entry_id AS gateEntryId,G.gate_entry_number AS gateEntryNumber,G.purchase_order_id AS purchaseOrderId,PO.po_number AS poNumber,COALESCE(PO.supplier_code_snapshot,S.supplier_code) AS supplierCode,G.supplier_name_snapshot AS supplierName,G.supplier_invoice_number AS supplierInvoiceNumber,G.delivery_challan_number AS deliveryChallanNumber,G.status,G.inspection_status AS inspectionStatus,COALESCE(G.updated_at,G.created_at) AS lastUpdatedAt,COUNT(GI.grn_item_id) AS itemCount,COALESCE(SUM(GI.received_quantity),0) AS receivedQuantity,COALESCE(SUM(GI.accepted_quantity),0) AS acceptedQuantity,COALESCE(SUM(GI.rejected_quantity),0) AS rejectedQuantity FROM goods_receipt_notes G LEFT JOIN purchase_orders PO ON PO.purchase_order_id=G.purchase_order_id LEFT JOIN supplier_master S ON S.supplier_id=G.supplier_id LEFT JOIN goods_receipt_note_items GI ON GI.grn_id=G.grn_id AND GI.tenant_id=G.tenant_id WHERE ${where} GROUP BY G.grn_id${rejectedRowsClause} ORDER BY COALESCE(G.updated_at,G.created_at) DESC,G.grn_id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, params);
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM goods_receipt_notes G LEFT JOIN purchase_orders PO ON PO.purchase_order_id=G.purchase_order_id WHERE ${where}${rejectedCountClause}`, params);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function summary(tenantId) {
  const [rows] = await db.execute(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(G.status IN ('INSPECTION_PENDING','INWARD')), 0) AS inspectionPending,
      COALESCE(SUM(G.status IN ('READY_FOR_STOCK','ACCEPTED','PARTIALLY_ACCEPTED')), 0) AS readyForStock,
      COALESCE(SUM(G.status IN ('STOCK_POSTED','POSTED')), 0) AS stockPosted,
      COALESCE(SUM(EXISTS (
        SELECT 1 FROM goods_receipt_note_items GI
        WHERE GI.grn_id=G.grn_id AND GI.tenant_id=G.tenant_id
          AND COALESCE(GI.rejected_quantity, 0)>0
      )), 0) AS rejectedInspection,
      (
        SELECT COUNT(*)
        FROM purchase_order_items POI
        JOIN purchase_orders PO ON PO.purchase_order_id=POI.purchase_order_id AND PO.tenant_id=POI.tenant_id
        WHERE POI.tenant_id=?
          AND PO.status IN ('APPROVED','PARTIALLY_RECEIVED')
          AND COALESCE(POI.line_status,'OPEN') IN ('OPEN','PARTIALLY_RECEIVED')
          AND POI.ordered_quantity-COALESCE(POI.received_quantity,0)-COALESCE((
            SELECT SUM(RESERVED_GI.received_quantity)
            FROM goods_receipt_note_items RESERVED_GI
            JOIN goods_receipt_notes RESERVED_GRN
              ON RESERVED_GRN.grn_id=RESERVED_GI.grn_id
              AND RESERVED_GRN.tenant_id=RESERVED_GI.tenant_id
            WHERE RESERVED_GI.tenant_id=POI.tenant_id
              AND RESERVED_GI.purchase_order_item_id=POI.purchase_order_item_id
              AND RESERVED_GRN.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')
          ),0)>0.0001
          AND EXISTS (
            SELECT 1 FROM purchase_gate_entries GE
            WHERE GE.tenant_id=PO.tenant_id
              AND GE.purchase_order_id=PO.purchase_order_id
              AND GE.status='GATE_ENTERED'
          )
      ) AS pendingPoReceiptLines,
      (
        SELECT COUNT(DISTINCT PO.purchase_order_id)
        FROM purchase_order_items POI
        JOIN purchase_orders PO ON PO.purchase_order_id=POI.purchase_order_id AND PO.tenant_id=POI.tenant_id
        WHERE POI.tenant_id=?
          AND PO.status IN ('APPROVED','PARTIALLY_RECEIVED')
          AND COALESCE(POI.line_status,'OPEN') IN ('OPEN','PARTIALLY_RECEIVED')
          AND POI.ordered_quantity-COALESCE(POI.received_quantity,0)-COALESCE((
            SELECT SUM(RESERVED_GI.received_quantity)
            FROM goods_receipt_note_items RESERVED_GI
            JOIN goods_receipt_notes RESERVED_GRN
              ON RESERVED_GRN.grn_id=RESERVED_GI.grn_id
              AND RESERVED_GRN.tenant_id=RESERVED_GI.tenant_id
            WHERE RESERVED_GI.tenant_id=POI.tenant_id
              AND RESERVED_GI.purchase_order_item_id=POI.purchase_order_item_id
              AND RESERVED_GRN.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')
          ),0)>0.0001
          AND EXISTS (
            SELECT 1 FROM purchase_gate_entries GE
            WHERE GE.tenant_id=PO.tenant_id
              AND GE.purchase_order_id=PO.purchase_order_id
              AND GE.status='GATE_ENTERED'
          )
      ) AS pendingPoReceiptOrders
    FROM goods_receipt_notes G
    WHERE G.tenant_id=?
  `, [tenantId, tenantId, tenantId]);
  return rows[0] || {};
}

export async function listPendingPoReceipts({ tenantId, search = "", limit = 20, offset = 0 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const where = `POI.tenant_id=?
    AND PO.status IN ('APPROVED','PARTIALLY_RECEIVED')
    AND COALESCE(POI.line_status,'OPEN') IN ('OPEN','PARTIALLY_RECEIVED')
    AND POI.ordered_quantity-COALESCE(POI.received_quantity,0)-COALESCE((
      SELECT SUM(RESERVED_GI.received_quantity)
      FROM goods_receipt_note_items RESERVED_GI
      JOIN goods_receipt_notes RESERVED_GRN
        ON RESERVED_GRN.grn_id=RESERVED_GI.grn_id
        AND RESERVED_GRN.tenant_id=RESERVED_GI.tenant_id
      WHERE RESERVED_GI.tenant_id=POI.tenant_id
        AND RESERVED_GI.purchase_order_item_id=POI.purchase_order_item_id
        AND RESERVED_GRN.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')
    ),0)>0.0001
    AND EXISTS (
      SELECT 1 FROM purchase_gate_entries GE
      WHERE GE.tenant_id=PO.tenant_id
        AND GE.purchase_order_id=PO.purchase_order_id
        AND GE.status='GATE_ENTERED'
    )
    AND (?='' OR PO.po_number LIKE CONCAT('%',?,'%')
      OR PO.supplier_name_snapshot LIKE CONCAT('%',?,'%')
      OR PO.supplier_code_snapshot LIKE CONCAT('%',?,'%')
      OR POI.item_code_snapshot LIKE CONCAT('%',?,'%')
      OR POI.item_description_snapshot LIKE CONCAT('%',?,'%'))`;
  const params = [tenantId, search, search, search, search, search, search];
  const [rows] = await db.execute(`SELECT POI.purchase_order_item_id AS purchaseOrderItemId,
      PO.purchase_order_id AS purchaseOrderId,PO.po_number AS poNumber,PO.po_date AS poDate,
      PO.expected_delivery_date AS expectedDeliveryDate,PO.supplier_code_snapshot AS supplierCode,
      PO.supplier_name_snapshot AS supplierName,POI.line_number AS lineNumber,
      POI.item_code_snapshot AS itemCode,POI.item_description_snapshot AS itemDescription,
      POI.item_specification_snapshot AS itemSpecification,POI.uom_code_snapshot AS uomCode,
      POI.ordered_quantity AS orderedQuantity,COALESCE(POI.received_quantity,0) AS acceptedQuantity,
      GREATEST(POI.ordered_quantity-COALESCE(POI.received_quantity,0)-COALESCE((
        SELECT SUM(RESERVED_GI.received_quantity)
        FROM goods_receipt_note_items RESERVED_GI
        JOIN goods_receipt_notes RESERVED_GRN
          ON RESERVED_GRN.grn_id=RESERVED_GI.grn_id
          AND RESERVED_GRN.tenant_id=RESERVED_GI.tenant_id
        WHERE RESERVED_GI.tenant_id=POI.tenant_id
          AND RESERVED_GI.purchase_order_item_id=POI.purchase_order_item_id
          AND RESERVED_GRN.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')
      ),0),0) AS pendingQuantity,
      COALESCE(POI.line_status,'OPEN') AS lineStatus
    FROM purchase_order_items POI
    JOIN purchase_orders PO ON PO.purchase_order_id=POI.purchase_order_id AND PO.tenant_id=POI.tenant_id
    WHERE ${where}
    ORDER BY PO.expected_delivery_date IS NULL,PO.expected_delivery_date,PO.po_date,PO.purchase_order_id,POI.line_number
    LIMIT ${safeLimit} OFFSET ${safeOffset}`, params);
  const [[count]] = await db.execute(`SELECT COUNT(*) AS total
    FROM purchase_order_items POI
    JOIN purchase_orders PO ON PO.purchase_order_id=POI.purchase_order_id AND PO.tenant_id=POI.tenant_id
    WHERE ${where}`, params);
  return { rows, total: Number(count?.total || 0) };
}

export async function listSupplierOptions(tenantId) {
  const [rows] = await db.execute(`SELECT DISTINCT
      TRIM(COALESCE(NULLIF(G.supplier_name_snapshot,''), S.supplier_name)) AS supplierName
    FROM goods_receipt_notes G
    LEFT JOIN supplier_master S ON S.supplier_id=G.supplier_id
    WHERE G.tenant_id=?
      AND COALESCE(TRIM(G.supplier_name_snapshot),TRIM(S.supplier_name),'')<>''
    ORDER BY supplierName`, [tenantId]);
  return rows.map((row) => row.supplierName);
}

export async function get(id, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`SELECT G.*,PO.po_number AS poNumber,COALESCE(PO.supplier_code_snapshot,S.supplier_code) AS supplierCode,GE.reference_number AS gateEntryReferenceNumber FROM goods_receipt_notes G LEFT JOIN purchase_orders PO ON PO.purchase_order_id=G.purchase_order_id LEFT JOIN supplier_master S ON S.supplier_id=G.supplier_id LEFT JOIN purchase_gate_entries GE ON GE.gate_entry_id=G.gate_entry_id AND GE.tenant_id=G.tenant_id WHERE G.grn_id=? AND G.tenant_id=? ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT GI.*,I.item_code AS item_code_snapshot,I.item_specification AS item_specification_snapshot,
    COALESCE(GI.mtc_applicable,I.mtc_applicable,'N') AS item_mtc_applicable,
    G.group_code AS item_group_code
    FROM goods_receipt_note_items GI
    LEFT JOIN item_master I ON I.item_id=GI.item_id
    LEFT JOIN item_group_master G ON G.item_group_id=I.item_group_id
    WHERE GI.grn_id=? AND GI.tenant_id=? ORDER BY GI.grn_item_id`, [Number(id), tenantId]);
  const [characteristics] = await connection.execute(`SELECT * FROM grn_inspection_characteristics WHERE tenant_id=? AND grn_item_id IN (SELECT grn_item_id FROM goods_receipt_note_items WHERE grn_id=? AND tenant_id=?) ORDER BY grn_item_id,sequence_number`, [tenantId, Number(id), tenantId]);
  const [rejections] = await connection.execute(`SELECT grn_item_id,rejection_reason_id,
    rejection_disposition_id,attachment_reference FROM grn_rejection_records
    WHERE tenant_id=? AND grn_id=? AND status='OPEN'`, [tenantId,Number(id)]);
  const [rejectionAttachments] = await connection.execute(`SELECT grn_rejection_attachment_id AS rejectionAttachmentId,
    grn_item_id AS grnItemId,file_name AS fileName,mime_type AS mimeType,file_size_bytes AS fileSizeBytes,
    uploaded_by AS uploadedBy,uploaded_at AS uploadedAt,
    CONCAT('/uploads/',REPLACE(file_path,'\\\\','/')) AS fileUrl
    FROM grn_rejection_attachments WHERE tenant_id=? AND grn_id=? ORDER BY grn_rejection_attachment_id`,[tenantId,Number(id)]);
  const [mtcCertificates] = await connection.execute(`SELECT attachment_id AS attachmentId,entity_id AS grnItemId,
    attachment_type AS attachmentType,attachment_name AS attachmentName,file_name AS fileName,
    CONCAT('/uploads/',REPLACE(file_path,'\\\\','/')) AS fileUrl,mime_type AS mimeType,
    file_size_bytes AS fileSizeBytes,created_by AS uploadedBy,created_on AS uploadedAt
    FROM application_attachments
    WHERE tenant_id=? AND entity_type='GRN_ITEM' AND attachment_type='MTC_CERTIFICATE'
      AND active_flag='Y' AND entity_id IN (
        SELECT grn_item_id FROM goods_receipt_note_items WHERE grn_id=? AND tenant_id=?
      )
    ORDER BY attachment_id`, [tenantId, Number(id), tenantId]);
  const byItem = new Map();
  for (const characteristic of characteristics) {
    const key = Number(characteristic.grn_item_id);
    byItem.set(key, [...(byItem.get(key) || []), characteristic]);
  }
  const rejectionByItem = new Map(rejections.map((rejection) => [Number(rejection.grn_item_id),rejection]));
  const attachmentsByItem = new Map();
  for (const attachment of rejectionAttachments) {
    const key = Number(attachment.grnItemId);
    attachmentsByItem.set(key,[...(attachmentsByItem.get(key) || []),attachment]);
  }
  const mtcCertificatesByItem = new Map();
  for (const certificate of mtcCertificates) {
    const key = Number(certificate.grnItemId);
    mtcCertificatesByItem.set(key, [...(mtcCertificatesByItem.get(key) || []), certificate]);
  }
  for (const item of items) {
    item.inspectionCharacteristics = byItem.get(Number(item.grn_item_id)) || [];
    const rejection = rejectionByItem.get(Number(item.grn_item_id));
    if (rejection) {
      item.rejection_reason_id = rejection.rejection_reason_id;
      item.rejection_disposition_id = rejection.rejection_disposition_id;
      item.rejection_attachment_reference = rejection.attachment_reference;
    }
    item.rejection_attachments = attachmentsByItem.get(Number(item.grn_item_id)) || [];
    item.mtc_certificates = mtcCertificatesByItem.get(Number(item.grn_item_id)) || [];
  }
  return { ...headers[0], items };
}

export async function countGaugeRegistrationItems(connection, tenantId, grnId) {
  const [[row]] = await connection.execute(`SELECT COUNT(*) AS gaugeItemCount
    FROM goods_receipt_note_items GI
    JOIN item_master I ON I.item_id=GI.item_id
    JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='IG'
    WHERE GI.tenant_id=? AND GI.grn_id=? AND GI.accepted_quantity > 0`, [tenantId, Number(grnId)]);
  return Number(row?.gaugeItemCount || 0);
}

export async function getApprovedOrder(connection, tenantId, id, lock = true) {
  const [headers] = await connection.execute(`SELECT * FROM purchase_orders WHERE purchase_order_id=? AND tenant_id=? AND status IN ('APPROVED','PARTIALLY_RECEIVED') ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT POI.*,COALESCE(I.inspection_required,'N') AS item_inspection_required,
    COALESCE(I.mtc_applicable,'N') AS item_mtc_applicable
    FROM purchase_order_items POI
    LEFT JOIN item_master I ON I.item_id=POI.item_id
    WHERE POI.purchase_order_id=? AND POI.tenant_id=? AND POI.line_status IN ('OPEN','PARTIALLY_RECEIVED') ORDER BY POI.line_number`, [Number(id), tenantId]);
  return { ...headers[0], items };
}

export async function getReceivableOrder(connection, tenantId, id, lock = true) {
  const [headers] = await connection.execute(`SELECT * FROM purchase_orders WHERE purchase_order_id=? AND tenant_id=? AND status IN ('APPROVED','PARTIALLY_RECEIVED') ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const [items] = await connection.execute(`SELECT POI.*,COALESCE(I.inspection_required,'N') AS item_inspection_required,
    COALESCE(I.mtc_applicable,'N') AS item_mtc_applicable
    FROM purchase_order_items POI
    LEFT JOIN item_master I ON I.item_id=POI.item_id
    WHERE POI.purchase_order_id=? AND POI.tenant_id=? AND COALESCE(POI.line_status,'OPEN') NOT IN ('RECEIVED','CANCELLED') ORDER BY POI.line_number`, [Number(id), tenantId]);
  return items.length ? { ...headers[0], items } : null;
}

export async function getInFlightGrnQuantities(connection, tenantId, purchaseOrderId, excludedGrnId = null) {
  const [rows] = await connection.execute(`
    SELECT GI.purchase_order_item_id AS purchaseOrderItemId,
      COALESCE(SUM(GI.received_quantity),0) AS reservedQuantity
    FROM goods_receipt_note_items GI
    JOIN goods_receipt_notes G
      ON G.grn_id=GI.grn_id AND G.tenant_id=GI.tenant_id
    WHERE GI.tenant_id=?
      AND G.purchase_order_id=?
      AND GI.purchase_order_item_id IS NOT NULL
      AND G.status IN ('INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','READY_FOR_STOCK')
      AND (? IS NULL OR G.grn_id<>?)
    GROUP BY GI.purchase_order_item_id
  `, [tenantId, Number(purchaseOrderId), excludedGrnId ? Number(excludedGrnId) : null, excludedGrnId ? Number(excludedGrnId) : null]);
  return rows;
}
export async function getGateEntry(connection, tenantId, id, lock = true) {
  const [rows] = await connection.execute(`SELECT gate_entry_id,gate_entry_number,entry_type,reference_number,purchase_order_id,supplier_id,customer_id,part_id,part_number_snapshot,part_name_snapshot,part_uom_snapshot,plant_id,status FROM purchase_gate_entries WHERE gate_entry_id=? AND tenant_id=? ${lock ? "FOR UPDATE" : ""}`, [Number(id), tenantId]);
  return rows[0] || null;
}
export async function getOpenPurchaseSupplier(connection, supplierId) { const [rows] = await connection.execute(`SELECT supplier_id,supplier_name,supplier_code FROM supplier_master WHERE supplier_id=? AND active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'`, [Number(supplierId)]); return rows[0] || null; }
export async function getOpenPurchaseItems(connection, itemIds) { if (!itemIds.length) return []; const [rows] = await connection.query(`SELECT I.item_id,I.item_description,I.item_specification,U.uom_code,I.purchase_rate,I.inspection_required,I.mtc_applicable FROM item_master I JOIN uom_master U ON U.uom_id=I.uom_id WHERE I.active_flag='Y' AND I.item_id IN (${itemIds.map(() => "?").join(",")})`, itemIds); return rows; }
export async function getActiveOutsourcingPart(connection, partId) {
  const [rows] = await connection.execute(`SELECT part_id,part_number,part_name,unit_of_measurement
    FROM part_master WHERE part_id=? AND active_flag='Y' AND part_status='ACTIVE'
      AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'`, [Number(partId)]);
  return rows[0] || null;
}
export async function getOutsourcingProcessOperation(connection, partId) {
  const [rows] = await connection.execute(`SELECT PP.process_plan_id,PP.plan_code,
    PO.process_operation_id,PO.operation_number,COALESCE(OM.operation_name,D.operation_description,PO.operation_description,'Process operation') AS operation_name,
    COALESCE(PO.inspection_required,'N') AS inspection_required
    FROM part_process_plan PP
    JOIN part_process_operation PO ON PO.process_plan_id=PP.process_plan_id
    LEFT JOIN part_process_definition D ON D.process_definition_id=PO.process_definition_id
    LEFT JOIN operation_master OM ON OM.operation_master_id=COALESCE(D.operation_master_id,PO.operation_master_id)
    WHERE PP.part_id=? AND PP.plan_status='APPROVED' AND COALESCE(PP.active_flag,'Y')='Y'
      AND COALESCE(D.source_type,PO.source_type)='OUTSOURCE'
    ORDER BY PP.is_default DESC,PO.operation_number,PP.process_plan_id
    LIMIT 1`, [Number(partId)]);
  return rows[0] || null;
}

export async function insertHeader(connection, values) { const [result] = await connection.execute(`INSERT INTO goods_receipt_notes (tenant_id,company_id,plant_id,grn_number,grn_date,receipt_type,purchase_order_id,gate_entry_number,gate_entry_id,supplier_id,customer_id,outsourcing_part_id,outsourcing_part_number_snapshot,outsourcing_part_name_snapshot,outsourcing_part_uom_snapshot,outsourcing_process_plan_id,outsourcing_process_operation_id,customer_name_snapshot,customer_plant_code,supplier_name_snapshot,supplier_invoice_number,supplier_invoice_date,delivery_challan_number,received_by,inspection_status,status,remarks,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values); return result.insertId; }
export async function insertItem(connection, values) { const [result] = await connection.execute(`INSERT INTO goods_receipt_note_items (tenant_id,grn_id,purchase_order_item_id,item_id,item_description_snapshot,uom_code_snapshot,ordered_quantity,previously_received_quantity,received_quantity,direct_rate_per_qty,tax_percent,accepted_quantity,rejected_quantity,rejection_reason,replacement_required,mtc_applicable) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values); return result.insertId; }
export async function updateDraftHeader(connection, id, tenantId, values) { await connection.execute(`UPDATE goods_receipt_notes SET grn_date=?,receipt_type=?,customer_id=?,outsourcing_part_id=?,outsourcing_part_number_snapshot=?,outsourcing_part_name_snapshot=?,outsourcing_part_uom_snapshot=?,outsourcing_process_plan_id=?,outsourcing_process_operation_id=?,customer_name_snapshot=?,customer_plant_code=?,gate_entry_number=?,gate_entry_id=?,supplier_invoice_number=?,supplier_invoice_date=?,delivery_challan_number=?,received_by=?,inspection_status=?,status=?,remarks=?,updated_by=? WHERE grn_id=? AND tenant_id=? AND status='DRAFT'`, [...values, Number(id), tenantId]); }
export async function replaceItems(connection, id, tenantId) { await connection.execute(`DELETE FROM goods_receipt_note_items WHERE grn_id=? AND tenant_id=?`, [Number(id), tenantId]); }
export async function updateStatus(connection, tenantId, id, status, inspectionStatus, userCode) { await connection.execute(`UPDATE goods_receipt_notes SET status=?,inspection_status=?,updated_by=? WHERE grn_id=? AND tenant_id=?`, [status, inspectionStatus, userCode, Number(id), tenantId]); }
export async function updateInspectionItem(connection, tenantId, grnItemId, values) { await connection.execute(`UPDATE goods_receipt_note_items SET accepted_quantity=?,rejected_quantity=?,on_hold_quantity=?,rejection_reason=?,replacement_required=?,inspection_disposition=?,quality_remarks=? WHERE grn_item_id=? AND tenant_id=?`, [...values, Number(grnItemId), tenantId]); }
export async function getItemInspectionPlan(connection, itemId) {
  if (!itemId) return [];
  const [rows] = await connection.execute(`SELECT IC.item_inspection_characteristic_id,IC.sequence_number,
    CM.characteristic_code,COALESCE(NULLIF(IC.characteristic_text,''),CM.characteristic_name) AS characteristic_name,
    COALESCE(CM.characteristic_type,'FREE_TEXT') AS characteristic_type,
    IC.specified_dimension,IC.tolerance_grade_text,IC.tolerance_minus,IC.tolerance_plus,IC.lsl,IC.usl,
    IC.drawing_grid,IM.instrument_name,IC.sample_size,IC.inspection_frequency
    FROM item_incoming_inspection_characteristic IC
    LEFT JOIN inspection_characteristic_master CM ON CM.characteristic_master_id=IC.characteristic_master_id
    LEFT JOIN inspection_instrument_master IM ON IM.instrument_master_id=IC.instrument_master_id
    WHERE IC.item_id=? ORDER BY IC.sequence_number`, [Number(itemId)]);
  return rows;
}
export async function insertInspectionCharacteristics(connection, tenantId, grnItemId, rows, userCode) {
  for (const row of rows) await connection.execute(`INSERT INTO grn_inspection_characteristics (tenant_id,grn_item_id,sequence_number,source_item_inspection_characteristic_id,characteristic_code_snapshot,characteristic_name_snapshot,characteristic_type_snapshot,specified_dimension,tolerance_grade_text,tolerance_minus,tolerance_plus,lsl,usl,drawing_grid,instrument_name_snapshot,sample_size_snapshot,inspection_frequency_snapshot,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [tenantId,grnItemId,row.sequence_number,row.item_inspection_characteristic_id,row.characteristic_code,row.characteristic_name,row.characteristic_type,row.specified_dimension,row.tolerance_grade_text,row.tolerance_minus,row.tolerance_plus,row.lsl,row.usl,row.drawing_grid,row.instrument_name,row.sample_size,row.inspection_frequency,userCode]);
}
export async function updateInspectionCharacteristic(connection, tenantId, id, values, userCode) { await connection.execute(`UPDATE grn_inspection_characteristics SET actual_value=?,inspection_result=?,remarks=?,updated_by=? WHERE grn_inspection_characteristic_id=? AND tenant_id=?`, [...values, userCode, Number(id), tenantId]); }
export async function updateStockReceiptHeader(connection, tenantId, grnId, values) { await connection.execute(`UPDATE goods_receipt_notes SET stock_posting_date=?,received_by=?,stock_posted_by=?,updated_by=? WHERE grn_id=? AND tenant_id=?`, [...values, Number(grnId), tenantId]); }
export async function updateStockReceiptItem(connection, tenantId, grnItemId, values) { await connection.execute(`UPDATE goods_receipt_note_items SET warehouse_code=?,sub_inventory_code=?,bin_location=?,batch_serial_number=? WHERE grn_item_id=? AND tenant_id=?`, [...values, Number(grnItemId), tenantId]); }
export async function upsertInventoryBalance(connection, values, ownerType = "COMPANY", ownerId = 0) {
  const [result] = await connection.execute(`INSERT INTO inventory_stock_balance (tenant_id,company_id,plant_id,item_id,warehouse_code,sub_inventory_code,bin_location,stock_status,batch_serial_number,work_order_reference,quantity_on_hand,created_by,updated_by,stock_owner_type,stock_owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity_on_hand=quantity_on_hand+VALUES(quantity_on_hand),updated_by=VALUES(updated_by)`, [...values, ownerType, ownerId]);
  const [rows] = await connection.execute(`SELECT quantity_on_hand FROM inventory_stock_balance WHERE tenant_id=? AND plant_id <=> ? AND item_id=? AND warehouse_code=? AND sub_inventory_code=? AND bin_location=? AND stock_status=? AND batch_serial_number=? AND work_order_reference=? AND stock_owner_type=? AND stock_owner_id=? FOR UPDATE`, [values[0], values[2], values[3], values[4], values[5], values[6], values[7], values[8], values[9], ownerType, ownerId]);
  return { id: result.insertId || null, quantityOnHand: Number(rows[0]?.quantity_on_hand || 0) };
}
export async function insertInventoryTransaction(connection, values, ownerType = "COMPANY", ownerId = 0) { const [result] = await connection.execute(`INSERT INTO inventory_stock_transaction (tenant_id,company_id,plant_id,transaction_type,transaction_date,item_id,grn_id,grn_item_id,warehouse_code,sub_inventory_code,bin_location,stock_status,batch_serial_number,work_order_reference,quantity_in,quantity_out,balance_after_quantity,remarks,created_by,stock_owner_type,stock_owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [...values, ownerType, ownerId]); return result.insertId; }
export async function updatePoItem(connection, tenantId, id, received, status) { await connection.execute(`UPDATE purchase_order_items SET received_quantity=?,line_status=? WHERE purchase_order_item_id=? AND tenant_id=?`, [received, status, Number(id), tenantId]); }
export async function updatePoStatus(connection, tenantId, id, status, userCode) { await connection.execute(`UPDATE purchase_orders SET status=?,updated_by=? WHERE purchase_order_id=? AND tenant_id=?`, [status, userCode, Number(id), tenantId]); }

export async function getReceiptCustomer(connection, id) {
  const [rows] = await connection.execute("SELECT customer_id,customer_name FROM customer_master WHERE customer_id=? AND active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED' AND party_type IN ('CUSTOMER','BOTH')", [id]);
  return rows[0] || null;
}
export async function updateReceiptReferences(connection, id, tenantId, values) {
  await connection.execute('UPDATE goods_receipt_notes SET purchase_order_id=?,plant_id=?,supplier_id=?,supplier_name_snapshot=?,purchase_reason=?,job_reference=? WHERE grn_id=? AND tenant_id=?', [...values, id, tenantId]);
}

export async function createOutsourcingWipBalance(connection, data) {
  const [result] = await connection.execute(`INSERT INTO outsourcing_wip_balance
    (tenant_id,company_id,plant_id,grn_id,grn_item_id,gate_entry_id,supplier_id,part_id,part_number_snapshot,part_name_snapshot,uom_code_snapshot,batch_serial_number,process_plan_id,process_operation_id,process_plan_code_snapshot,operation_number_snapshot,operation_name_snapshot,inspection_required,received_quantity,quantity_in_wip,wip_status,inspection_status,created_by,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'AWAITING_PROCESS_OPERATION','NOT_STARTED',?,?)`, [
      data.tenantId,data.companyId,data.plantId,data.grnId,data.grnItemId,data.gateEntryId,data.supplierId,
      data.partId,data.partNumber,data.partName,data.uomCode,data.batchSerialNumber,data.processPlanId,
      data.processOperationId,data.processPlanCode,data.operationNumber,data.operationName,data.inspectionRequired,
      data.quantity,data.quantity,data.userCode,data.userCode,
    ]);
  const balanceId = Number(result.insertId);
  await connection.execute(`INSERT INTO outsourcing_wip_transaction
    (tenant_id,outsourcing_wip_balance_id,transaction_type,transaction_date,quantity_in,quantity_out,balance_after_quantity,remarks,created_by)
    VALUES (?,?,'GRN_WIP_RECEIPT',CURRENT_DATE,?,0,?,?,?)`, [data.tenantId,balanceId,data.quantity,data.quantity,`GRN ${data.grnNumber} received into Outsourcing WIP`,data.userCode]);
  return balanceId;
}
