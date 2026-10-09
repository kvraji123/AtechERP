import { AppError } from "../../utils/AppError.js";

const decisions = new Set(["APPROVED", "NOT_APPROVED", "CLARIFICATION"]);

export function validateLineDecisions(items) {
  if (!Array.isArray(items) || items.length === 0) throw new AppError("At least one line-item decision is required.");
  const seen = new Set();
  return items.map((item, index) => {
    const id = Number(item.purchaseRequestItemId ?? item.id);
    const status = String(item.status || "").toUpperCase();
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) throw new AppError(`Invalid or duplicate line decision at row ${index + 1}.`);
    if (!decisions.has(status)) throw new AppError(`Invalid line status at row ${index + 1}.`);
    seen.add(id);
    const reason = String(item.reason || item.comment || "").trim();
    if (["NOT_APPROVED", "CLARIFICATION"].includes(status) && !reason) throw new AppError(`Reason is required for row ${index + 1}.`);
    const approvedQuantity = item.approvedQuantity === undefined || item.approvedQuantity === "" ? null : Number(item.approvedQuantity);
    if (status === "APPROVED" && (approvedQuantity === null || !Number.isFinite(approvedQuantity) || approvedQuantity <= 0)) throw new AppError(`Approved quantity is required for row ${index + 1}.`);
    return { id, status, reason: reason || null, approvedQuantity };
  });
}
