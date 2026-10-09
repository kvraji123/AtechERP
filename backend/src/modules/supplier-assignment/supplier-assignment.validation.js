import { AppError } from "../../utils/AppError.js";

export function validateAssignments(assignments) {
  if (!Array.isArray(assignments) || assignments.length === 0) throw new AppError("Add at least one supplier assignment.");
  return assignments.map((entry, index) => {
    const purchaseRequestItemId = Number(entry.purchaseRequestItemId ?? entry.itemId);
    const supplierId = Number(entry.supplierId);
    const assignedQuantity = Number(entry.assignedQuantity ?? entry.quantity);
    if (!Number.isInteger(purchaseRequestItemId) || purchaseRequestItemId <= 0) throw new AppError(`Invalid purchase request item at row ${index + 1}.`);
    if (!Number.isInteger(supplierId) || supplierId <= 0) throw new AppError(`Invalid supplier at row ${index + 1}.`);
    if (!Number.isFinite(assignedQuantity) || assignedQuantity <= 0) throw new AppError(`Assigned quantity must be greater than zero at row ${index + 1}.`);
    return { purchaseRequestItemId, supplierId, assignedQuantity };
  });
}
