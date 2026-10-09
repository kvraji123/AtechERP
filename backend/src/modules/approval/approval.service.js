import { db, withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { transitionOrThrow, requireReason } from "../../shared/services/workflow.service.js";
import { PR_TRANSITIONS } from "../../shared/constants/purchase.js";
import * as repository from "./approval.repository.js";
import { validateLineDecisions } from "./approval.validation.js";

export async function listQueue(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const result = await repository.listQueue({
    tenantId: user.tenantId,
    search: String(query.search || "").trim(),
    status: String(query.status || "").trim().toUpperCase(),
    plant: String(query.plant || "").trim(),
    department: String(query.department || "").trim(),
    priority: String(query.priority || "").trim().toUpperCase(),
    supplier: String(query.supplier || "").trim(),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, page, pageSize };
}
export async function get(id, user) {
  const result = await repository.getForUpdate(db, id, user.tenantId);
  if (!result) throw new AppError("Purchase requisition not found.", 404);
  return result;
}

export async function decide(id, data, user) {
  const decisions = validateLineDecisions(data.items);
  return withTransaction(async (connection) => {
    const request = await repository.getForUpdate(connection, id, user.tenantId);
    if (!request) throw new AppError("Purchase requisition not found.", 404);
    if (!["SUBMITTED", "PENDING_APPROVAL", "RETURNED"].includes(request.pr_status)) throw new AppError("This requisition is not awaiting approval.", 409);
    const itemById = new Map(request.items.map((item) => [Number(item.purchase_request_item_id), item]));
    for (const decision of decisions) {
      const current = itemById.get(decision.id);
      if (!current) throw new AppError(`Line item ${decision.id} does not belong to this requisition.`, 409);
      if (decision.status === "APPROVED" && decision.approvedQuantity > Number(current.requested_quantity)) throw new AppError(`Approved quantity cannot exceed requested quantity for line ${current.line_number}.`, 409);
      const next = { ...decision, tenantId: user.tenantId };
      await repository.updateLine(connection, next, user.userCode);
      await repository.insertLineHistory(connection, [user.tenantId, id, decision.id, decision.status, decision.approvedQuantity, decision.reason || "Approved", current.approval_status, decision.status, user.userCode]);
    }
    // Rejected lines are removed from the working PR so they cannot move to
    // RFQ/PO. The approval history remains available for audit.
    const [freshItemsBeforeRemoval] = await connection.execute(`SELECT purchase_request_item_id, approval_status FROM purchase_request_items WHERE purchase_request_id=? AND tenant_id=?`, [Number(id), user.tenantId]);
    const rejectedLineIds = freshItemsBeforeRemoval.filter((item) => item.approval_status === "NOT_APPROVED").map((item) => Number(item.purchase_request_item_id));
    if (rejectedLineIds.length) {
      await connection.query(`DELETE FROM purchase_request_items WHERE purchase_request_id=? AND tenant_id=? AND approval_status='NOT_APPROVED'`, [Number(id), user.tenantId]);
    }
    const [freshItems] = await connection.execute(`SELECT approval_status FROM purchase_request_items WHERE purchase_request_id=? AND tenant_id=?`, [Number(id), user.tenantId]);
    const approved = freshItems.filter((item) => item.approval_status === "APPROVED").length;
    const clarification = freshItems.filter((item) => item.approval_status === "CLARIFICATION").length;
    let nextStatus = freshItems.length === 0 ? "REJECTED" : "PARTIALLY_APPROVED";
    if (freshItems.length > 0 && approved === freshItems.length) nextStatus = "APPROVED";
    else if (freshItems.length > 0 && !approved && clarification === freshItems.length) nextStatus = "RETURNED";
    transitionOrThrow(PR_TRANSITIONS, request.pr_status, nextStatus);
    const reason = String(data.reason || "").trim() || (nextStatus === "REJECTED" ? requireReason(data.reason, "A rejection reason is required.") : null);
    await connection.execute(`UPDATE purchase_requests SET pr_status=?, approved_by=?, approved_on=CASE WHEN ? IN ('APPROVED','PARTIALLY_APPROVED') THEN CURRENT_TIMESTAMP ELSE approved_on END, updated_by=? WHERE purchase_request_id=? AND tenant_id=?`, [nextStatus, user.userCode, nextStatus, user.userCode, Number(id), user.tenantId]);
    await connection.execute(`INSERT INTO purchase_request_approval_history (purchase_request_id,decision,decision_reason,decided_by,from_status,to_status) VALUES (?,?,?,?,?,?)`, [Number(id), nextStatus === "APPROVED" || nextStatus === "PARTIALLY_APPROVED" ? "APPROVED" : nextStatus === "RETURNED" ? "RETURNED" : "REJECTED", reason, user.userCode, request.pr_status, nextStatus]);
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_REQUISITION", entityId: id, action: `PR_${nextStatus}`, oldValue: { status: request.pr_status }, newValue: { status: nextStatus }, performedBy: user.userCode, remarks: reason });
    return repository.getForUpdate(connection, id, user.tenantId);
  });
}
