import { db } from "../../config/db.js";

const confirmedStatuses = "'CONFIRMED','PARTIALLY_CONVERTED','CONVERTED'";

export async function listEligibleEnquiries(tenantId, connection = db) {
  const [rows] = await connection.execute(`
    SELECT E.enquiry_id AS enquiryId,
      E.doc_no AS docNo,
      E.customer_id AS customerId,
      E.customer_name_snapshot AS customerName,
      E.order_type AS orderType,
      Q.quotation_id AS quotationId,
      Q.quotation_no AS quotationNo,
      Q.currency_code AS currencyCode,
      COUNT(QI.quotation_item_id) AS lineCount,
      SUM(GREATEST(
        COALESCE(QI.required_quantity, QI.annual_quantity, QI.moq, 0) - COALESCE(ALLOC.allocatedQuantity, 0), 0
      )) AS availableQuantity
    FROM marketing_enquiries E
    INNER JOIN marketing_quotations Q
      ON Q.enquiry_id=E.enquiry_id
     AND Q.active_flag='Y'
     AND Q.quotation_status='FINALIZED'
    INNER JOIN marketing_quotation_items QI
      ON QI.quotation_id=Q.quotation_id
     AND QI.active_flag='Y'
    LEFT JOIN (
      SELECT CPOI.quotation_item_id,
        SUM(CPOI.ordered_quantity) AS allocatedQuantity
      FROM customer_purchase_order_items CPOI
      INNER JOIN customer_purchase_orders CPO
        ON CPO.customer_purchase_order_id=CPOI.customer_purchase_order_id
       AND CPO.tenant_id=CPOI.tenant_id
      WHERE CPOI.tenant_id=?
        AND CPO.status IN (${confirmedStatuses})
      GROUP BY CPOI.quotation_item_id
    ) ALLOC ON ALLOC.quotation_item_id=QI.quotation_item_id
    WHERE E.active_flag='Y'
      AND E.enquiry_status='ORDER_RECEIVED'
    GROUP BY E.enquiry_id, E.doc_no, E.customer_id, E.customer_name_snapshot,
      E.order_type, Q.quotation_id, Q.quotation_no, Q.currency_code
    HAVING availableQuantity > 0
    ORDER BY E.updated_on DESC, E.enquiry_id DESC
  `, [tenantId]);
  return rows;
}

export async function getEligibleSource(enquiryId, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`
    SELECT E.enquiry_id AS enquiryId,
      E.doc_no AS docNo,
      E.customer_id AS customerId,
      E.customer_code_snapshot AS customerCode,
      E.customer_name_snapshot AS customerName,
      E.order_type AS orderType,
      E.required_date AS requiredDate,
      E.enquiry_status AS enquiryStatus,
      Q.quotation_id AS quotationId,
      Q.quotation_no AS quotationNo,
      Q.currency_code AS currencyCode,
      Q.quotation_date AS quotationDate
    FROM marketing_enquiries E
    INNER JOIN marketing_quotations Q
      ON Q.enquiry_id=E.enquiry_id
     AND Q.active_flag='Y'
     AND Q.quotation_status='FINALIZED'
    WHERE E.enquiry_id=? AND E.active_flag='Y'
    ${lock ? "FOR UPDATE" : ""}
  `, [Number(enquiryId)]);
  if (!headers[0]) return null;

  const source = headers[0];
  const [items] = await connection.execute(`
    SELECT QI.quotation_item_id AS quotationItemId,
      QI.enquiry_part_id AS enquiryPartId,
      QI.line_number AS lineNumber,
      QI.item_code AS itemCode,
      QI.machining_drawing_number AS drawingNumber,
      QI.revision_number AS revisionNumber,
      QI.description,
      QI.material,
      EP.unit_of_measurement AS unitOfMeasurement,
      COALESCE(QI.required_quantity, QI.annual_quantity, QI.moq, 0) AS requiredQuantity,
      QI.part_price_fob_foreign AS unitPrice,
      QI.total_development_cost_foreign AS developmentCost,
      COALESCE(ALLOC.allocatedQuantity, 0) AS allocatedQuantity,
      GREATEST(
        COALESCE(QI.required_quantity, QI.annual_quantity, QI.moq, 0) - COALESCE(ALLOC.allocatedQuantity, 0), 0
      ) AS availableQuantity
    FROM marketing_quotation_items QI
    LEFT JOIN marketing_enquiry_parts EP ON EP.enquiry_part_id=QI.enquiry_part_id
    LEFT JOIN (
      SELECT CPOI.quotation_item_id,
        SUM(CPOI.ordered_quantity) AS allocatedQuantity
      FROM customer_purchase_order_items CPOI
      INNER JOIN customer_purchase_orders CPO
        ON CPO.customer_purchase_order_id=CPOI.customer_purchase_order_id
       AND CPO.tenant_id=CPOI.tenant_id
      WHERE CPOI.tenant_id=?
        AND CPO.status IN (${confirmedStatuses})
      GROUP BY CPOI.quotation_item_id
    ) ALLOC ON ALLOC.quotation_item_id=QI.quotation_item_id
    WHERE QI.quotation_id=? AND QI.active_flag='Y'
    ORDER BY QI.line_number
    ${lock ? "FOR UPDATE" : ""}
  `, [tenantId, Number(source.quotationId)]);

  return { ...source, items };
}

export async function getCustomerPurchaseOrder(id, tenantId, connection = db, lock = false) {
  const [headers] = await connection.execute(`
    SELECT CPO.customer_purchase_order_id AS id,
      CPO.cpo_number AS cpoNumber,
      CPO.financial_year AS financialYear,
      CPO.customer_po_number AS customerPoNumber,
      CPO.customer_po_date AS customerPoDate,
      CPO.enquiry_id AS enquiryId,
      CPO.enquiry_doc_no_snapshot AS enquiryDocNo,
      CPO.quotation_id AS quotationId,
      CPO.quotation_no_snapshot AS quotationNo,
      CPO.customer_id AS customerId,
      CPO.customer_code_snapshot AS customerCode,
      CPO.customer_name_snapshot AS customerName,
      CPO.order_type_snapshot AS orderType,
      CPO.currency_code AS currencyCode,
      CPO.required_delivery_date AS requiredDeliveryDate,
      CPO.payment_terms AS paymentTerms,
      CPO.delivery_terms AS deliveryTerms,
      CPO.attachment_reference AS attachmentReference,
      CPO.remarks,
      CPO.subtotal_amount AS subtotalAmount,
      CPO.development_cost_amount AS developmentCostAmount,
      CPO.grand_total_amount AS grandTotalAmount,
      CPO.status,
      CPO.confirmed_by AS confirmedBy,
      CPO.confirmed_on AS confirmedOn,
      CPO.created_by AS createdBy,
      CPO.created_on AS createdOn,
      CPO.updated_by AS updatedBy,
      CPO.updated_on AS updatedOn
    FROM customer_purchase_orders CPO
    WHERE CPO.customer_purchase_order_id=? AND CPO.tenant_id=?
    ${lock ? "FOR UPDATE" : ""}
  `, [Number(id), tenantId]);
  if (!headers[0]) return null;
  const header = headers[0];
  const [items, salesOrders] = await Promise.all([
    connection.execute(`
      SELECT CPOI.customer_purchase_order_item_id AS id,
        CPOI.quotation_item_id AS quotationItemId,
        CPOI.enquiry_part_id AS enquiryPartId,
        CPOI.line_number AS lineNumber,
        CPOI.item_code_snapshot AS itemCode,
        CPOI.drawing_number_snapshot AS drawingNumber,
        CPOI.revision_number_snapshot AS revisionNumber,
        CPOI.description_snapshot AS description,
        CPOI.material_snapshot AS material,
        CPOI.uom_snapshot AS unitOfMeasurement,
        CPOI.required_quantity_snapshot AS requiredQuantity,
        CPOI.ordered_quantity AS orderedQuantity,
        CPOI.converted_quantity AS convertedQuantity,
        CPOI.unit_price AS unitPrice,
        CPOI.development_cost_amount AS developmentCost,
        CPOI.line_total_amount AS lineTotalAmount,
        CPOI.line_status AS lineStatus
      FROM customer_purchase_order_items CPOI
      WHERE CPOI.customer_purchase_order_id=? AND CPOI.tenant_id=?
      ORDER BY CPOI.line_number
    `, [Number(id), tenantId]).then(([rows]) => rows),
    connection.execute(`
      SELECT sales_order_id AS id, sales_order_number AS salesOrderNumber,
        sales_order_date AS salesOrderDate, grand_total_amount AS grandTotalAmount,
        status, created_on AS createdOn
      FROM sales_orders
      WHERE customer_purchase_order_id=? AND tenant_id=?
      ORDER BY sales_order_id DESC
    `, [Number(id), tenantId]).then(([rows]) => rows),
  ]);
  return { ...header, items, salesOrders };
}

export async function listCustomerPurchaseOrders({ tenantId, search, status, limit, offset }, connection = db) {
  const where = `CPO.tenant_id=?
    AND (?='' OR CPO.cpo_number LIKE CONCAT('%', ?, '%')
      OR CPO.customer_po_number LIKE CONCAT('%', ?, '%')
      OR CPO.enquiry_doc_no_snapshot LIKE CONCAT('%', ?, '%')
      OR CPO.customer_name_snapshot LIKE CONCAT('%', ?, '%'))
    AND (?='' OR CPO.status=?)`;
  const params = [tenantId, search, search, search, search, search, status, status];
  const [rows, countRows] = await Promise.all([
    connection.execute(`
      SELECT CPO.customer_purchase_order_id AS id,
        CPO.cpo_number AS cpoNumber,
        CPO.customer_po_number AS customerPoNumber,
        CPO.customer_po_date AS customerPoDate,
        CPO.enquiry_doc_no_snapshot AS enquiryDocNo,
        CPO.customer_name_snapshot AS customerName,
        CPO.order_type_snapshot AS orderType,
        CPO.currency_code AS currencyCode,
        CPO.grand_total_amount AS grandTotalAmount,
        CPO.status,
        CPO.required_delivery_date AS requiredDeliveryDate,
        CPO.created_on AS createdOn,
        CPO.updated_on AS updatedOn,
        COUNT(CPOI.customer_purchase_order_item_id) AS itemCount
      FROM customer_purchase_orders CPO
      LEFT JOIN customer_purchase_order_items CPOI
        ON CPOI.customer_purchase_order_id=CPO.customer_purchase_order_id
       AND CPOI.tenant_id=CPO.tenant_id
      WHERE ${where}
      GROUP BY CPO.customer_purchase_order_id
      ORDER BY CPO.updated_on DESC, CPO.customer_purchase_order_id DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `, params).then(([result]) => result),
    connection.execute(`
      SELECT COUNT(*) AS total
      FROM customer_purchase_orders CPO
      WHERE ${where}
    `, params).then(([result]) => result),
  ]);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function insertCustomerPurchaseOrder(connection, values) {
  const [result] = await connection.execute(`
    INSERT INTO customer_purchase_orders (
      tenant_id,cpo_number,financial_year,customer_po_number,customer_po_date,
      enquiry_id,enquiry_doc_no_snapshot,quotation_id,quotation_no_snapshot,
      customer_id,customer_code_snapshot,customer_name_snapshot,order_type_snapshot,
      currency_code,required_delivery_date,payment_terms,delivery_terms,attachment_reference,
      remarks,subtotal_amount,development_cost_amount,grand_total_amount,status,created_by,updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, values);
  return result.insertId;
}

export async function updateCustomerPurchaseOrder(connection, id, tenantId, values) {
  await connection.execute(`
    UPDATE customer_purchase_orders
    SET customer_po_number=?, customer_po_date=?, required_delivery_date=?,
      payment_terms=?, delivery_terms=?, attachment_reference=?, remarks=?,
      subtotal_amount=?, development_cost_amount=?, grand_total_amount=?, updated_by=?
    WHERE customer_purchase_order_id=? AND tenant_id=? AND status='DRAFT'
  `, [...values, Number(id), tenantId]);
}

export async function replaceCustomerPurchaseOrderItems(connection, orderId, tenantId, items, userCode) {
  await connection.execute(`
    DELETE FROM customer_purchase_order_items
    WHERE customer_purchase_order_id=? AND tenant_id=?
  `, [Number(orderId), tenantId]);
  for (const [index, item] of items.entries()) {
    await connection.execute(`
      INSERT INTO customer_purchase_order_items (
        tenant_id,customer_purchase_order_id,quotation_item_id,enquiry_part_id,line_number,
        item_code_snapshot,drawing_number_snapshot,revision_number_snapshot,description_snapshot,
        material_snapshot,uom_snapshot,required_quantity_snapshot,ordered_quantity,
        unit_price,development_cost_amount,line_total_amount,created_by,updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      tenantId, Number(orderId), item.quotationItemId, item.enquiryPartId, index + 1,
      item.itemCode, item.drawingNumber, item.revisionNumber, item.description,
      item.material, item.unitOfMeasurement, item.requiredQuantity, item.orderedQuantity,
      item.unitPrice, item.developmentCost, item.lineTotalAmount, userCode, userCode,
    ]);
  }
}

export async function confirmCustomerPurchaseOrder(connection, id, tenantId, userCode) {
  await connection.execute(`
    UPDATE customer_purchase_orders
    SET status='CONFIRMED', confirmed_by=?, confirmed_on=CURRENT_TIMESTAMP, updated_by=?
    WHERE customer_purchase_order_id=? AND tenant_id=? AND status='DRAFT'
  `, [userCode, userCode, Number(id), tenantId]);
}

export async function insertSalesOrder(connection, values) {
  const [result] = await connection.execute(`
    INSERT INTO sales_orders (
      tenant_id,sales_order_number,financial_year,sales_order_date,
      customer_purchase_order_id,customer_purchase_order_number_snapshot,customer_po_number_snapshot,
      enquiry_id,enquiry_doc_no_snapshot,quotation_id,quotation_no_snapshot,
      customer_id,customer_code_snapshot,customer_name_snapshot,order_type_snapshot,
      currency_code,required_delivery_date,payment_terms,delivery_terms,remarks,
      grand_total_amount,status,created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, values);
  return result.insertId;
}

export async function insertSalesOrderItems(connection, salesOrderId, tenantId, items, userCode) {
  for (const [index, item] of items.entries()) {
    await connection.execute(`
      INSERT INTO sales_order_items (
        tenant_id,sales_order_id,customer_purchase_order_item_id,line_number,
        item_code_snapshot,drawing_number_snapshot,revision_number_snapshot,description_snapshot,
        material_snapshot,uom_snapshot,ordered_quantity,unit_price,development_cost_amount,
        line_total_amount,created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      tenantId, Number(salesOrderId), item.id, index + 1,
      item.itemCode, item.drawingNumber, item.revisionNumber, item.description,
      item.material, item.unitOfMeasurement, item.quantity, item.unitPrice,
      item.developmentCost, item.lineTotalAmount, userCode,
    ]);
  }
}

export async function updateConversionQuantities(connection, orderId, tenantId, conversionLines, userCode) {
  for (const line of conversionLines) {
    const nextQuantity = Number(line.convertedQuantity) + Number(line.quantity);
    const nextStatus = nextQuantity >= Number(line.orderedQuantity) - 0.0001
      ? "CONVERTED"
      : "PARTIALLY_CONVERTED";
    await connection.execute(`
      UPDATE customer_purchase_order_items
      SET converted_quantity=?, line_status=?, updated_by=?
      WHERE customer_purchase_order_item_id=? AND customer_purchase_order_id=? AND tenant_id=?
    `, [nextQuantity, nextStatus, userCode, line.id, Number(orderId), tenantId]);
  }
  const [rows] = await connection.execute(`
    SELECT COUNT(*) AS openLines
    FROM customer_purchase_order_items
    WHERE customer_purchase_order_id=? AND tenant_id=?
      AND converted_quantity < ordered_quantity - 0.0001
  `, [Number(orderId), tenantId]);
  const status = Number(rows[0]?.openLines || 0) > 0 ? "PARTIALLY_CONVERTED" : "CONVERTED";
  await connection.execute(`
    UPDATE customer_purchase_orders
    SET status=?, updated_by=?
    WHERE customer_purchase_order_id=? AND tenant_id=?
  `, [status, userCode, Number(orderId), tenantId]);
  return status;
}

export async function listSalesOrders({ tenantId, customerPurchaseOrderId = null }, connection = db) {
  const [rows] = await connection.execute(`
    SELECT SO.sales_order_id AS id,
      SO.sales_order_number AS salesOrderNumber,
      SO.sales_order_date AS salesOrderDate,
      SO.customer_purchase_order_id AS customerPurchaseOrderId,
      SO.customer_purchase_order_number_snapshot AS cpoNumber,
      SO.customer_po_number_snapshot AS customerPoNumber,
      SO.enquiry_doc_no_snapshot AS enquiryDocNo,
      SO.customer_name_snapshot AS customerName,
      SO.order_type_snapshot AS orderType,
      SO.currency_code AS currencyCode,
      SO.grand_total_amount AS grandTotalAmount,
      SO.status
    FROM sales_orders SO
    WHERE SO.tenant_id=?
      AND (? IS NULL OR SO.customer_purchase_order_id=?)
    ORDER BY SO.sales_order_id DESC
  `, [tenantId, customerPurchaseOrderId, customerPurchaseOrderId]);
  return rows;
}
