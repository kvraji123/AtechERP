import { AppError } from "../../utils/AppError.js";
export function validateRfq(data = {}) {
  const date = String(data.enquiryDate || "").trim(); const due = String(data.quoteDueDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new AppError("Enquiry date and quotation due date must be in YYYY-MM-DD format.");
  if (due < date) throw new AppError("Quotation due date cannot be before enquiry date.");
  if (!Array.isArray(data.items) || !data.items.length) throw new AppError("Select at least one approved purchase request item.");
  const fallbackSuppliers = Array.isArray(data.suppliers) ? data.suppliers.map(Number).filter(Number.isFinite) : [];
  const items = data.items.map((item) => ({
    ...item,
    purchaseRequestItemId: Number(item.purchaseRequestItemId ?? item.itemId),
    quantity: Number(item.quantity),
    supplierIds: Array.isArray(item.supplierIds) ? item.supplierIds.map(Number).filter(Number.isFinite) : fallbackSuppliers,
  }));
  if (items.some((item) => !Number.isInteger(item.purchaseRequestItemId) || item.purchaseRequestItemId <= 0 || !Number.isFinite(item.quantity) || item.quantity <= 0)) throw new AppError("Each RFQ item must have a valid approved quantity.");
  if (items.some((item) => !item.supplierIds.length)) throw new AppError("Assign at least one supplier to every selected RFQ item.");
  return { ...data, items, suppliers: fallbackSuppliers, enquiryDate: date, quoteDueDate: due };
}
