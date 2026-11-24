import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import * as repository from "./customer-po.repository.js";

const EPSILON = 0.0001;
const clean = (value) => value === undefined || value === null ? null : String(value).trim() || null;
const number = (value) => Number(value || 0);

function pageRequest(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function assertDate(value, label, required = false) {
  const date = clean(value);
  if (!date && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    throw new AppError(`${label} must be in YYYY-MM-DD format.`);
  }
  return date;
}

function normalizeItems(value) {
  if (!Array.isArray(value) || !value.length) {
    throw new AppError("Select at least one quoted item for the Customer PO.");
  }
  const seen = new Set();
  return value.map((item, index) => {
    const quotationItemId = Number(item.quotationItemId ?? item.quotation_item_id);
    const orderedQuantity = number(item.orderedQuantity ?? item.quantity);
    if (!Number.isInteger(quotationItemId) || quotationItemId <= 0) {
      throw new AppError(`Invalid quotation line at row ${index + 1}.`);
    }
    if (seen.has(quotationItemId)) {
      throw new AppError("Each quotation line can only appear once in a Customer PO.");
    }
    if (!Number.isFinite(orderedQuantity) || orderedQuantity <= 0) {
      throw new AppError(`Ordered quantity must be greater than zero for row ${index + 1}.`);
    }
    seen.add(quotationItemId);
    return { quotationItemId, orderedQuantity };
  });
}

function normalizeBody(raw = {}, requireCustomerReference = false) {
  const enquiryId = Number(raw.enquiryId);
  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    throw new AppError("Select an Order Received enquiry.");
  }
  const customerPoNumber = clean(raw.customerPoNumber);
  if (requireCustomerReference && !customerPoNumber) {
    throw new AppError("Customer PO number is required before confirmation.");
  }
  return {
    enquiryId,
    customerPoNumber,
    customerPoDate: assertDate(raw.customerPoDate, "Customer PO date", requireCustomerReference),
    requiredDeliveryDate: assertDate(raw.requiredDeliveryDate, "Required delivery date"),
    paymentTerms: clean(raw.paymentTerms),
    deliveryTerms: clean(raw.deliveryTerms),
    attachmentReference: clean(raw.attachmentReference),
    remarks: clean(raw.remarks),
    items: normalizeItems(raw.items),
  };
}

function buildLineSnapshots(source, requestedItems) {
  if (source.enquiryStatus !== "ORDER_RECEIVED") {
    throw new AppError("Only enquiries with Order Received status can create a Customer PO.", 409);
  }
  const linesById = new Map(source.items.map((item) => [Number(item.quotationItemId), item]));
  return requestedItems.map((requested) => {
    const line = linesById.get(requested.quotationItemId);
    if (!line) throw new AppError("One or more selected lines do not belong to the finalized quotation.", 409);
    const availableQuantity = number(line.availableQuantity);
    if (requested.orderedQuantity > availableQuantity + EPSILON) {
      throw new AppError(
        `Ordered quantity for ${line.itemCode || line.drawingNumber || "the selected line"} exceeds the available quoted quantity of ${availableQuantity}.`,
        409
      );
    }
    const unitPrice = number(line.unitPrice);
    const developmentCost = number(line.developmentCost);
    return {
      ...line,
      orderedQuantity: requested.orderedQuantity,
      unitPrice,
      developmentCost,
      lineTotalAmount: requested.orderedQuantity * unitPrice + developmentCost,
    };
  });
}

function total(lines) {
  return lines.reduce((result, line) => ({
    subtotal: result.subtotal + number(line.orderedQuantity) * number(line.unitPrice),
    development: result.development + number(line.developmentCost),
    grandTotal: result.grandTotal + number(line.lineTotalAmount),
  }), { subtotal: 0, development: 0, grandTotal: 0 });
}

async function ensureSequence(connection, key, prefix, financialYear) {
  await ensureDocumentSequence(connection, key, financialYear, prefix);
  return getNextDocumentNumber(connection, key, financialYear);
}

export async function listEligibleEnquiries(user) {
  return repository.listEligibleEnquiries(user.tenantId);
}

export async function getEnquirySource(enquiryId, user) {
  const source = await repository.getEligibleSource(enquiryId, user.tenantId);
  if (!source || source.enquiryStatus !== "ORDER_RECEIVED") {
    throw new AppError("Order Received enquiry with a finalized quotation was not found.", 404);
  }
  return source;
}

export async function listCustomerPurchaseOrders(query, user) {
  const { page, pageSize, offset } = pageRequest(query);
  const result = await repository.listCustomerPurchaseOrders({
    tenantId: user.tenantId,
    search: String(query.search || "").trim(),
    status: String(query.status || "").trim().toUpperCase(),
    limit: pageSize,
    offset,
  });
  return { ...result, page, pageSize };
}

export async function getCustomerPurchaseOrder(id, user) {
  const order = await repository.getCustomerPurchaseOrder(id, user.tenantId);
  if (!order) throw new AppError("Customer PO not found.", 404);
  return order;
}

export async function createCustomerPurchaseOrder(rawData, user) {
  const data = normalizeBody(rawData, false);
  return withTransaction(async (connection) => {
    const source = await repository.getEligibleSource(data.enquiryId, user.tenantId, connection, true);
    if (!source) throw new AppError("Order Received enquiry with a finalized quotation was not found.", 404);
    const lines = buildLineSnapshots(source, data.items);
    const amounts = total(lines);
    const financialYear = getFinancialYear(new Date(`${data.customerPoDate || todayInAppTimeZone()}T00:00:00`));
    const cpoNumber = await ensureSequence(connection, "CUSTOMER_PURCHASE_ORDER", "CPO", financialYear);
    const orderId = await repository.insertCustomerPurchaseOrder(connection, [
      user.tenantId, cpoNumber, financialYear, data.customerPoNumber, data.customerPoDate,
      source.enquiryId, source.docNo, source.quotationId, source.quotationNo,
      source.customerId, source.customerCode, source.customerName, source.orderType,
      source.currencyCode, data.requiredDeliveryDate, data.paymentTerms, data.deliveryTerms,
      data.attachmentReference, data.remarks, amounts.subtotal, amounts.development,
      amounts.grandTotal, "DRAFT", user.userCode, user.userCode,
    ]);
    await repository.replaceCustomerPurchaseOrderItems(connection, orderId, user.tenantId, lines, user.userCode);
    await recordAudit({
      connection, tenantId: user.tenantId, module: "SALES", entityType: "CUSTOMER_PURCHASE_ORDER",
      entityId: orderId, action: "CUSTOMER_PO_DRAFT_CREATED",
      newValue: { cpoNumber, enquiryId: source.enquiryId, quotationNo: source.quotationNo },
      performedBy: user.userCode,
    });
    return repository.getCustomerPurchaseOrder(orderId, user.tenantId, connection);
  });
}

export async function updateCustomerPurchaseOrder(id, rawData, user) {
  const data = normalizeBody(rawData, false);
  return withTransaction(async (connection) => {
    const order = await repository.getCustomerPurchaseOrder(id, user.tenantId, connection, true);
    if (!order) throw new AppError("Customer PO not found.", 404);
    if (order.status !== "DRAFT") throw new AppError("Only draft Customer POs can be edited.", 409);
    if (Number(order.enquiryId) !== data.enquiryId) {
      throw new AppError("The source enquiry cannot be changed after a Customer PO draft is created.", 409);
    }
    const source = await repository.getEligibleSource(data.enquiryId, user.tenantId, connection, true);
    if (!source) throw new AppError("Order Received enquiry with a finalized quotation was not found.", 404);
    const lines = buildLineSnapshots(source, data.items);
    const amounts = total(lines);
    await repository.updateCustomerPurchaseOrder(connection, id, user.tenantId, [
      data.customerPoNumber, data.customerPoDate, data.requiredDeliveryDate,
      data.paymentTerms, data.deliveryTerms, data.attachmentReference, data.remarks,
      amounts.subtotal, amounts.development, amounts.grandTotal, user.userCode,
    ]);
    await repository.replaceCustomerPurchaseOrderItems(connection, id, user.tenantId, lines, user.userCode);
    await recordAudit({
      connection, tenantId: user.tenantId, module: "SALES", entityType: "CUSTOMER_PURCHASE_ORDER",
      entityId: id, action: "CUSTOMER_PO_DRAFT_UPDATED", performedBy: user.userCode,
    });
    return repository.getCustomerPurchaseOrder(id, user.tenantId, connection);
  });
}

export async function confirmCustomerPurchaseOrder(id, user) {
  return withTransaction(async (connection) => {
    const order = await repository.getCustomerPurchaseOrder(id, user.tenantId, connection, true);
    if (!order) throw new AppError("Customer PO not found.", 404);
    if (order.status !== "DRAFT") throw new AppError("Only a draft Customer PO can be confirmed.", 409);
    if (!clean(order.customerPoNumber) || !order.customerPoDate) {
      throw new AppError("Customer PO number and Customer PO date are required before confirmation.");
    }
    const source = await repository.getEligibleSource(order.enquiryId, user.tenantId, connection, true);
    if (!source) throw new AppError("The source Order Received enquiry is no longer available.", 409);
    const lines = buildLineSnapshots(source, order.items.map((item) => ({
      quotationItemId: item.quotationItemId,
      orderedQuantity: item.orderedQuantity,
    })));
    const amounts = total(lines);
    await repository.updateCustomerPurchaseOrder(connection, id, user.tenantId, [
      order.customerPoNumber, order.customerPoDate, order.requiredDeliveryDate,
      order.paymentTerms, order.deliveryTerms, order.attachmentReference, order.remarks,
      amounts.subtotal, amounts.development, amounts.grandTotal, user.userCode,
    ]);
    await repository.confirmCustomerPurchaseOrder(connection, id, user.tenantId, user.userCode);
    await recordAudit({
      connection, tenantId: user.tenantId, module: "SALES", entityType: "CUSTOMER_PURCHASE_ORDER",
      entityId: id, action: "CUSTOMER_PO_CONFIRMED",
      oldValue: { status: "DRAFT" }, newValue: { status: "CONFIRMED" }, performedBy: user.userCode,
    });
    return repository.getCustomerPurchaseOrder(id, user.tenantId, connection);
  });
}

function requestedConversionLines(rawItems, orderItems) {
  const byId = new Map(orderItems.map((item) => [Number(item.id), item]));
  const requested = Array.isArray(rawItems) && rawItems.length
    ? rawItems.map((item) => ({ id: Number(item.customerPurchaseOrderItemId ?? item.id), quantity: number(item.quantity) }))
    : orderItems.map((item) => ({ id: Number(item.id), quantity: number(item.orderedQuantity) - number(item.convertedQuantity) }));
  const seen = new Set();
  return requested.map((entry) => {
    if (!Number.isInteger(entry.id) || seen.has(entry.id)) throw new AppError("Sales Order conversion lines are invalid.");
    const line = byId.get(entry.id);
    if (!line) throw new AppError("A selected Customer PO line no longer belongs to this order.", 409);
    const remaining = number(line.orderedQuantity) - number(line.convertedQuantity);
    if (entry.quantity <= 0 || entry.quantity > remaining + EPSILON) {
      throw new AppError(`Conversion quantity for ${line.itemCode || line.drawingNumber} must be within the remaining ordered quantity.`, 409);
    }
    seen.add(entry.id);
    return {
      ...line,
      quantity: entry.quantity,
      developmentCost: number(line.convertedQuantity) > EPSILON ? 0 : number(line.developmentCost),
      lineTotalAmount: entry.quantity * number(line.unitPrice)
        + (number(line.convertedQuantity) > EPSILON ? 0 : number(line.developmentCost)),
    };
  });
}

export async function convertToSalesOrder(id, rawData, user) {
  return withTransaction(async (connection) => {
    const order = await repository.getCustomerPurchaseOrder(id, user.tenantId, connection, true);
    if (!order) throw new AppError("Customer PO not found.", 404);
    if (!["CONFIRMED", "PARTIALLY_CONVERTED"].includes(order.status)) {
      throw new AppError("Confirm the Customer PO before converting it to a Sales Order.", 409);
    }
    const lines = requestedConversionLines(rawData?.items, order.items);
    if (!lines.length) throw new AppError("No remaining Customer PO quantity is available for conversion.", 409);
    const financialYear = getFinancialYear();
    const salesOrderNumber = await ensureSequence(connection, "SALES_ORDER", "SO", financialYear);
    const grandTotal = lines.reduce((sum, line) => sum + number(line.lineTotalAmount), 0);
    const salesOrderId = await repository.insertSalesOrder(connection, [
      user.tenantId, salesOrderNumber, financialYear, todayInAppTimeZone(),
      order.id, order.cpoNumber, order.customerPoNumber, order.enquiryId, order.enquiryDocNo,
      order.quotationId, order.quotationNo, order.customerId, order.customerCode, order.customerName,
      order.orderType, order.currencyCode, order.requiredDeliveryDate, order.paymentTerms,
      order.deliveryTerms, order.remarks, grandTotal, "OPEN", user.userCode,
    ]);
    await repository.insertSalesOrderItems(connection, salesOrderId, user.tenantId, lines, user.userCode);
    const status = await repository.updateConversionQuantities(connection, id, user.tenantId,
      lines.map((line) => ({
        id: line.id, quantity: line.quantity, convertedQuantity: line.convertedQuantity,
        orderedQuantity: line.orderedQuantity,
      })), user.userCode);
    await recordAudit({
      connection, tenantId: user.tenantId, module: "SALES", entityType: "SALES_ORDER",
      entityId: salesOrderId, action: "SALES_ORDER_CREATED_FROM_CUSTOMER_PO",
      newValue: { salesOrderNumber, customerPurchaseOrderId: order.id, customerPoStatus: status },
      performedBy: user.userCode,
    });
    return { salesOrderId, salesOrderNumber, customerPurchaseOrderStatus: status };
  });
}

export async function listSalesOrders(query, user) {
  const customerPurchaseOrderId = Number(query.customerPurchaseOrderId || 0) || null;
  return repository.listSalesOrders({ tenantId: user.tenantId, customerPurchaseOrderId });
}
