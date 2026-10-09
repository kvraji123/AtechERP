import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { transitionOrThrow, requireReason } from "../../shared/services/workflow.service.js";
import { PO_TRANSITIONS } from "../../shared/constants/purchase.js";
import * as repository from "./purchase-order.repository.js";

export async function list(query, user) {
  const page = Math.max(Number(query.page || 1), 1); const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const requestedStatus = String(query.status || "").trim().toUpperCase();
  const result = await repository.listOrders({ tenantId: user.tenantId, search: String(query.search || "").trim(), status: requestedStatus === "ALL" ? "" : requestedStatus, supplier: String(query.supplier || "").trim(), dateRange: String(query.dateRange || "").trim(), approvalOnly: true, limit: pageSize, offset: (page - 1) * pageSize });
  const categories = await repository.listOrderItemCategories(user.tenantId, result.rows.map((row) => row.id));
  const byPurchaseOrderId = new Map(categories.map((row) => [Number(row.purchaseOrderId), row.itemCategory]));
  const rows = result.rows.map((row) => ({ ...row, itemCategory: byPurchaseOrderId.get(Number(row.id)) || "Item type unavailable" }));
  return { ...result, rows, page, pageSize };
}

export async function summary(user) {
  const rows = await repository.approvalSummary(user.tenantId);
  const byStatus = new Map(rows.map((row) => [String(row.status), row]));
  const value = (status) => Number(byStatus.get(status)?.totalValue || 0);
  const count = (status) => Number(byStatus.get(status)?.count || 0);
  return {
    total: { count: rows.reduce((sum, row) => sum + Number(row.count || 0), 0), value: rows.reduce((sum, row) => sum + Number(row.totalValue || 0), 0) },
    pending: { count: count("SUBMITTED"), value: value("SUBMITTED") },
    approved: { count: count("APPROVED"), value: value("APPROVED") },
  };
}

export const get = async (id, user) => {
  const result = await repository.getOrder(id, user.tenantId); if (!result) throw new AppError("Purchase order not found.", 404); return result;
};

export async function decide(id, action, data, user) {
  const next = action === "approve" ? "APPROVED" : action === "return" ? "RETURNED" : "REJECTED";
  const reason = ["RETURNED", "REJECTED"].includes(next) ? requireReason(data.reason, `A reason is required to ${action} the purchase order.`) : String(data.reason || "").trim() || null;
  return withTransaction(async (connection) => {
    const order = await repository.getOrder(id, user.tenantId, connection, true); if (!order) throw new AppError("Purchase order not found.", 404);
    transitionOrThrow(PO_TRANSITIONS, order.status, next);
    await repository.setStatus(connection, id, user.tenantId, next, user.userCode);
    await repository.insertHistory(connection, [user.tenantId, id, next, reason, order.status, next, user.userCode]);
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_ORDER", entityId: id, action: `PO_${next}`, oldValue: { status: order.status }, newValue: { status: next }, performedBy: user.userCode, remarks: reason });
    return repository.getOrder(id, user.tenantId, connection);
  });
}
