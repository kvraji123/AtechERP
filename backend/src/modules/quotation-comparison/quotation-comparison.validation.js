import { AppError } from "../../utils/AppError.js";

export function validateSelections(data = {}) {
  const enquiryId = Number(data.purchaseEnquiryId);
  if (!enquiryId) throw new AppError("Purchase enquiry is required.");
  if (!Array.isArray(data.selections) || !data.selections.length) {
    throw new AppError("Select at least one supplier quotation line.");
  }
  const seen = new Set();
  const selections = data.selections.map((row, index) => {
    const itemId = Number(row.purchaseEnquiryItemId);
    const quoteItemId = Number(row.supplierQuotationItemId);
    const quantity = Number(row.selectedQuantity);
    if (!itemId || !quoteItemId || seen.has(itemId)) {
      throw new AppError(`Each enquiry item must have one decision (row ${index + 1}).`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(`Selected quantity must be greater than zero (row ${index + 1}).`);
    }
    seen.add(itemId);
    return {
      purchaseEnquiryItemId: itemId,
      supplierQuotationItemId: quoteItemId,
      selectedQuantity: quantity,
      selectionReason: row.selectionReason ? String(row.selectionReason).trim() : null,
    };
  });
  return { enquiryId, selections };
}
