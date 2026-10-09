import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import * as repository from "./quotation-comparison.repository.js";
import { validateSelections } from "./quotation-comparison.validation.js";

export async function list(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 100), 1), 100);
  const result = await repository.listComparisons({ tenantId: user.tenantId, limit: pageSize, offset: (page - 1) * pageSize });
  return { ...result, page, pageSize };
}

export async function get(enquiryId, user) {
  const result = await repository.getComparison(undefined, user.tenantId, enquiryId);
  if (!result) throw new AppError("Purchase enquiry not found.", 404);
  return result;
}

export async function select(raw, user) {
  const { enquiryId, selections } = validateSelections(raw);
  return withTransaction(async (connection) => {
    const comparison = await repository.getComparison(connection, user.tenantId, enquiryId);
    if (!comparison) throw new AppError("Purchase enquiry not found.", 404);
    if (["CANCELLED"].includes(comparison.status)) {
      throw new AppError("This purchase enquiry is no longer open for supplier selection.", 409);
    }
    const itemIds = selections.map((entry) => entry.purchaseEnquiryItemId);
    const lines = await repository.getLinesForUpdate(connection, user.tenantId, enquiryId, itemIds);
    if (lines.length !== itemIds.length) throw new AppError("One or more selected enquiry items are invalid.", 409);
    const lineById = new Map(lines.map((line) => [Number(line.purchaseEnquiryItemId), line]));
    const selectedTotals = new Map();
    for (const entry of selections) {
      const row = comparison.rows.find((candidate) => Number(candidate.purchaseEnquiryItemId) === entry.purchaseEnquiryItemId && Number(candidate.supplierQuotationItemId) === entry.supplierQuotationItemId);
      if (!row || row.quoteResponse !== "QUOTED") throw new AppError("Every selection must reference a quoted supplier line.", 409);
      const total = (selectedTotals.get(entry.purchaseEnquiryItemId) || 0) + entry.selectedQuantity;
      selectedTotals.set(entry.purchaseEnquiryItemId, total);
      const line = lineById.get(entry.purchaseEnquiryItemId);
      if (total > Number(line.enquiryQuantity) || total > Number(line.approvedQuantity)) {
        throw new AppError(`Selected quantity exceeds the approved quantity for ${row.itemDescription}.`, 409);
      }
      if (Number(row.supplierId) <= 0) throw new AppError("Supplier is missing from a quotation line.", 409);
    }
    await repository.clearSelections(connection, user.tenantId, itemIds, user.userCode);
    for (const entry of selections) {
      const row = comparison.rows.find((candidate) => Number(candidate.purchaseEnquiryItemId) === entry.purchaseEnquiryItemId && Number(candidate.supplierQuotationItemId) === entry.supplierQuotationItemId);
      await repository.insertSelection(connection, [user.tenantId, entry.purchaseEnquiryItemId, entry.supplierQuotationItemId, row.supplierId, entry.selectedQuantity, entry.selectionReason, user.userCode]);
      const line = lineById.get(entry.purchaseEnquiryItemId);
      await repository.updateLineStatus(connection, user.tenantId, entry.purchaseEnquiryItemId, Math.abs(Number(selectedTotals.get(entry.purchaseEnquiryItemId)) - Number(line.enquiryQuantity)) < 0.0001 ? "SELECTED" : "QUOTED", user.userCode);
    }
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "QUOTE_COMPARISON", entityId: enquiryId, action: "SUPPLIER_SELECTION_SAVED", newValue: { selections }, performedBy: user.userCode });
    return repository.getComparison(connection, user.tenantId, enquiryId);
  });
}
