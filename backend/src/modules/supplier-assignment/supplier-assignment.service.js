import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import * as repository from "./supplier-assignment.repository.js";
import { validateAssignments } from "./supplier-assignment.validation.js";

export const eligibleItems = (user) => repository.eligibleItems(user.tenantId);

export async function assign(data, user) {
  const assignments = validateAssignments(data.assignments);
  return withTransaction(async (connection) => {
    const itemIds = [...new Set(assignments.map((entry) => entry.purchaseRequestItemId))];
    const lines = await repository.getLinesForUpdate(connection, user.tenantId, itemIds);
    const byId = new Map(lines.map((line) => [Number(line.purchase_request_item_id), line]));
    if (lines.length !== itemIds.length) throw new AppError("One or more selected items are not available for supplier assignment.", 409);
    for (const line of lines) {
      if (line.approval_status !== "APPROVED" || !["APPROVED", "PARTIALLY_APPROVED"].includes(line.pr_status)) throw new AppError(`Item ${line.item_type_name} is not approved for purchase.`, 409);
      const assignmentsForLine = assignments.filter((entry) => entry.purchaseRequestItemId === Number(line.purchase_request_item_id));
      if (assignmentsForLine.some((entry) => entry.assignedQuantity > Number(line.approved_quantity))) throw new AppError(`Assigned quantity exceeds approved quantity for ${line.item_type_name}.`, 409);
    }
    for (const entry of assignments) if (!await repository.getSupplier(connection, entry.supplierId)) throw new AppError(`Supplier ${entry.supplierId} is invalid or inactive.`, 409);
    await repository.replaceAssignments(connection, user.tenantId, assignments, user.userCode);
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "SUPPLIER_ASSIGNMENT", entityId: itemIds.join(","), action: "SUPPLIER_ASSIGNED", newValue: assignments, performedBy: user.userCode });
    return { assignments, items: itemIds.map((id) => byId.get(id)) };
  });
}
