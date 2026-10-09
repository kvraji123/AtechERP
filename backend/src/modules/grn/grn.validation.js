import { AppError } from "../../utils/AppError.js";

export function validateGrn(data = {}) {
  const purchaseOrderId = Number(data.purchaseOrderId) || null;
  const date = String(data.grnDate || "").trim();
  const action = String(data.action || "DRAFT").toUpperCase();
  const receiptType = String(data.receiptType || "REGULAR_PURCHASE").trim().toUpperCase();
  const receiptTypes = new Set(["REGULAR_PURCHASE", "CUSTOMER_SUPPLIED", "OPEN_PURCHASE", "OUTSOURCING_PRODUCT"]);
  const customerId = Number(data.customerId) || null;
  const customerName = String(data.customerName || "").trim();
  const customerPlantCode = String(data.customerPlantCode || "").trim();
  const gateEntryId = Number(data.gateEntryId) || null;
  const isOpenPurchase = receiptType === "OPEN_PURCHASE";
  const customerSupplied = receiptType === "CUSTOMER_SUPPLIED";
  const outsourcingProduct = receiptType === "OUTSOURCING_PRODUCT";
  const direct = isOpenPurchase || customerSupplied || outsourcingProduct;
  if (!['DRAFT', 'INWARD'].includes(action)) throw new AppError('Choose a valid GRN action.');
  if (!gateEntryId) throw new AppError("Select a completed gate entry before creating a GRN.");
  if ((!direct && !purchaseOrderId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError("Purchase order and GRN date are required for regular purchases.");
  if (!receiptTypes.has(receiptType)) throw new AppError("Choose a valid receipt type.");
  if (customerSupplied && (!customerId || !customerName || !customerPlantCode)) throw new AppError("Customer name and plant code are required for customer supplied material. Select a customer from the master.");
  if (direct && purchaseOrderId) throw new AppError('This receipt type cannot reference a purchase order. Use the selected gate entry reference.');
  const jobReference = customerSupplied ? String(data.jobReference || '').trim() : '';
  if (jobReference.length > 120) throw new AppError('Job or project reference is too long.');
  if (action === 'INWARD') {
    if (!String(data.deliveryChallanNumber || '').trim()) throw new AppError('Delivery challan number is required.');
    if (!customerSupplied && (!String(data.supplierInvoiceNumber || '').trim() || !data.supplierInvoiceDate)) throw new AppError('Supplier invoice number and date are required.');
  }
  if (!Array.isArray(data.items) || !data.items.length) throw new AppError("Add at least one receipt line to the inward entry.");
  if (outsourcingProduct && data.items.length !== 1) throw new AppError("An outsourced-part GRN must contain exactly one Part Master receipt line.");
  const seen = new Set();
  const items = data.items.map((row, index) => {
    const poItemId = Number(row.purchaseOrderItemId ?? row.poItemId) || null;
    const itemId = Number(row.itemId) || null;
    const received = Number(row.receivedQuantity ?? row.quantity);
    const lineKey = outsourcingProduct ? index + 1 : direct ? itemId : poItemId;
    if (!lineKey || seen.has(lineKey)) throw new AppError(`Select a unique Item Master value at row ${index + 1}.`);
    if (!Number.isFinite(received) || (action === "INWARD" ? received <= 0 : received < 0)) throw new AppError(`Received quantity must ${action === "INWARD" ? "be greater than zero" : "not be negative"} at row ${index + 1}.`);
    const batchSerialNumber = String(row.batchSerialNumber || "").trim();
    if (outsourcingProduct && action === "INWARD" && !batchSerialNumber) throw new AppError("Batch or serial number is required for an outsourced-part receipt.");
    seen.add(lineKey);
    const rate = customerSupplied ? 0 : Number(row.directRatePerQty ?? row.ratePerQty ?? 0);
    const tax = customerSupplied ? 0 : Number(row.taxPercent ?? 0);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) throw new AppError(`Enter a non-negative rate and tax between 0 and 100 at row ${index + 1}.`);
    return { ...row, itemId: outsourcingProduct ? null : itemId, purchaseOrderItemId: direct ? null : poItemId, batchSerialNumber, receivedQuantity: received, directRatePerQty: rate, taxPercent: tax, acceptedQuantity: 0, rejectedQuantity: 0 };
  });
  if ((isOpenPurchase || outsourcingProduct) && !Number(data.supplierId)) throw new AppError("Select a supplier for this receipt type.");
  return { ...data, purchaseOrderId, supplierId: customerSupplied ? null : Number(data.supplierId) || null, gateEntryId, grnDate: date, receiptType, customerId: customerSupplied ? customerId : null, customerName: customerSupplied ? customerName : null, customerPlantCode: customerSupplied ? customerPlantCode : null, supplierInvoiceNumber: customerSupplied ? null : data.supplierInvoiceNumber, supplierInvoiceDate: customerSupplied ? null : data.supplierInvoiceDate, jobReference, items, action };
}

export function validateGrnStockPosting(data = {}) {
  const stockPostingDate = String(data.stockPostingDate || "").trim();
  const receivedBy = String(data.receivedBy || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stockPostingDate)) throw new AppError("A valid stock posting date is required.");
  if (!receivedBy) throw new AppError("Received by is required for stock posting.");
  if (!Array.isArray(data.items) || !data.items.length) throw new AppError("Provide a stock location for every accepted GRN line.");
  const seen = new Set();
  const items = data.items.map((row, index) => {
    const grnItemId = Number(row.grnItemId);
    const warehouseCode = String(row.warehouseCode || row.warehouse || "").trim();
    const binLocation = String(row.binLocation || "").trim();
    const batchSerialNumber = String(row.batchSerialNumber || "").trim();
    if (!grnItemId || seen.has(grnItemId)) throw new AppError(`Invalid or duplicate stock receipt line at row ${index + 1}.`);
    if (!warehouseCode || !binLocation) throw new AppError(`Warehouse and bin location are required at row ${index + 1}.`);
    seen.add(grnItemId);
    return { grnItemId, warehouseCode, binLocation, batchSerialNumber };
  });
  return { stockPostingDate, receivedBy, items };
}
