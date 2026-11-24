import { withTransaction } from "../../config/db.js";
import { getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { transitionOrThrow } from "../../shared/services/workflow.service.js";
import { PR_TRANSITIONS, calculateLineAmounts } from "../../shared/constants/purchase.js";
import * as repository from "./purchase-requisition.repository.js";
import { normalizeRequest } from "./purchase-requisition.validation.js";

const clean = (value) => value === undefined || value === null ? null : String(value).trim() || null;

function pagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function resolveItems(connection, data) {
  return Promise.all(data.items.map(async (input, index) => {
    const item = await repository.getItemSnapshot(input.itemId, connection);
    if (!item) throw new AppError(`Item Master item is invalid for row ${index + 1}.`, 409);
    const quantity = Number(input.requestedQuantity ?? input.quantity);
    const rate = Number(input.estimatedRatePerQty ?? input.ratePerQty ?? item.purchaseRate ?? 0);
    const taxPercent = Number(input.taxPercent ?? item.taxPercent ?? 0);
    const amounts = calculateLineAmounts({ quantity, unitPrice: rate, taxPercent });
    return { input, item, quantity, rate, taxPercent, amounts };
  }));
}

async function saveRequest(existingId, rawData, user, action) {
  const data = normalizeRequest({ ...rawData, action });
  const financialYear = getFinancialYear(new Date(`${data.requestDate}T00:00:00`));
  return withTransaction(async (connection) => {
    const department = await repository.getActiveDepartmentByName(connection, data.department);
    if (!department) throw new AppError("Select an active Department Master value.", 409);
    data.department = department.departmentName;
    data.departmentId = department.departmentCode;
    let requestId = Number(existingId || 0);
    let existing = requestId ? await repository.getRequest(requestId, user.tenantId, connection, true) : null;
    if (requestId && !existing) throw new AppError("Purchase requisition not found.", 404);
    const revisionSource = existing;
    const isRevision = Boolean(existing && action === "SUBMIT" && (existing.items || []).some((item) => String(item.approval_status || "").toUpperCase() === "CLARIFICATION"));
    let withdrawnForEditing = false;
    if (existing) {
      const currentStatus = String(existing.pr_status || "").toUpperCase();
      const hasClarification = (existing.items || []).some((item) => String(item.approval_status || "").toUpperCase() === "CLARIFICATION");
      const effectiveStatus = hasClarification && ["APPROVED", "PARTIALLY_APPROVED", "RETURNED"].includes(currentStatus) ? "PARTIALLY_APPROVED" : currentStatus;
      if (!["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "RETURNED", "PARTIALLY_APPROVED"].includes(effectiveStatus)) {
        throw new AppError("Only a draft, a request awaiting approval, or a returned requisition can be edited.", 409);
      }
      if (!isRevision) {
        await repository.updateDraft(connection, requestId, user.tenantId, [data.plantCode || "", data.plantId || null, data.department || "", data.departmentId || null, data.requestDate, data.requiredDate, data.requisitionType, data.priority, data.preferredSupplierId || null, clean(data.quoteReference), clean(data.remarks), user.userCode]);
        await connection.execute("DELETE FROM purchase_request_items WHERE purchase_request_id=? AND tenant_id=?", [requestId, user.tenantId]);
        if (action === "DRAFT" && ["SUBMITTED", "PENDING_APPROVAL"].includes(currentStatus)) {
          await connection.execute(`
            UPDATE purchase_requests
            SET pr_status='DRAFT', submitted_on=NULL, updated_by=?
            WHERE purchase_request_id=? AND tenant_id=?
          `, [user.userCode, requestId, user.tenantId]);
          withdrawnForEditing = true;
        }
      }
    }
    if (!existing || isRevision) {
      let versionedPrNumber = isRevision ? null : await getNextDocumentNumber(connection, "PURCHASE_REQUEST", financialYear);
      if (isRevision) {
        const baseNumber = String(existing.pr_number).replace(/-R\d+$/, "");
        const [versions] = await connection.execute("SELECT pr_number FROM purchase_requests WHERE tenant_id=? AND (pr_number=? OR pr_number LIKE CONCAT(?, '-R%'))", [user.tenantId, baseNumber, baseNumber]);
        const nextRevision = versions.reduce((max, row) => Math.max(max, Number(String(row.pr_number).match(/-R(\d+)$/)?.[1] || 0)), 0) + 1;
        versionedPrNumber = `${baseNumber}-R${nextRevision}`;
      }
      requestId = await repository.insertRequest(connection, [
        user.tenantId, user.companyId, data.plantId || null, versionedPrNumber, financialYear, data.plantCode || "",
        data.department || "", data.departmentId || null, clean(data.requestedBy) || user.employeeName,
        data.requestDate, data.requiredDate, data.requisitionType, data.priority, data.preferredSupplierId || null,
        clean(data.quoteReference), clean(data.remarks), 0, 0, 0, "DRAFT", user.userCode,
      ]);
    }
    const resolvedItems = await resolveItems(connection, data);
    const itemsForRequest = isRevision
      ? resolvedItems.filter((_, index) => String(revisionSource.items?.[index]?.approval_status || "").toUpperCase() === "CLARIFICATION")
      : resolvedItems;
    if (isRevision && !itemsForRequest.length) throw new AppError("No clarification lines are available for revision.", 409);
    let subtotal = 0; let taxTotal = 0; let grandTotal = 0;
    const replacedAttachmentItemIds = new Set();
    for (let index = 0; index < itemsForRequest.length; index += 1) {
      const { input, item, quantity, rate, taxPercent, amounts } = itemsForRequest[index];
      subtotal += amounts.basicAmount - amounts.discountAmount;
      taxTotal += amounts.taxAmount;
      grandTotal += amounts.lineTotalAmount;
      const insertedItemId = await repository.insertItem(connection, [
        user.tenantId, user.companyId, requestId, index + 1, item.itemId, item.itemGroupName,
        item.itemTypeName, item.itemDescription, item.itemSpecification, quantity, item.uomCode,
        rate, taxPercent, amounts.taxAmount, amounts.lineTotalAmount, item.hsnCode,
        String(input.purpose).trim(), user.userCode,
      ]);
      const priorItemId = Number(input.purchaseRequestItemId || 0);
      if (existing && !isRevision && priorItemId && (existing.items || []).some((row) => Number(row.purchase_request_item_id) === priorItemId)) {
        await connection.execute(
          `UPDATE application_attachments
              SET entity_id=?
            WHERE tenant_id=? AND entity_type='PURCHASE_REQUEST_ITEM' AND entity_id=? AND active_flag='Y'`,
          [insertedItemId, user.tenantId, priorItemId]
        );
        replacedAttachmentItemIds.add(priorItemId);
      }
      // Keep previously approved lines approved when a requester edits only
      // clarification lines and resubmits the same requisition.
    }
    if (existing && !isRevision) {
      const removedItemIds = (existing.items || [])
        .map((row) => Number(row.purchase_request_item_id))
        .filter((itemId) => !replacedAttachmentItemIds.has(itemId));
      if (removedItemIds.length) {
        await connection.execute(
          `UPDATE application_attachments
              SET active_flag='N'
            WHERE tenant_id=? AND entity_type='PURCHASE_REQUEST_ITEM' AND active_flag='Y'
              AND entity_id IN (${removedItemIds.map(() => "?").join(",")})`,
          [user.tenantId, ...removedItemIds]
        );
      }
    }
    await connection.execute(`UPDATE purchase_requests SET estimated_subtotal=?, estimated_tax_amount=?, estimated_total_amount=?, updated_by=? WHERE purchase_request_id=? AND tenant_id=?`, [subtotal, taxTotal, grandTotal, user.userCode, requestId, user.tenantId]);
    if (action === "SUBMIT") {
      const current = isRevision ? "DRAFT" : existing ? ((existing.items || []).some((item) => String(item.approval_status || "").toUpperCase() === "CLARIFICATION") && ["APPROVED", "PARTIALLY_APPROVED", "RETURNED"].includes(existing.pr_status) ? "PARTIALLY_APPROVED" : existing.pr_status) : "DRAFT";
      // A request that has not yet received an approval decision may be
      // corrected and submitted again without first being withdrawn to draft.
      if (!["SUBMITTED", "PENDING_APPROVAL"].includes(current)) transitionOrThrow(PR_TRANSITIONS, current, "SUBMITTED");
      await connection.execute(`UPDATE purchase_requests SET pr_status='SUBMITTED', submitted_on=CURRENT_TIMESTAMP, updated_by=? WHERE purchase_request_id=? AND tenant_id=?`, [user.userCode, requestId, user.tenantId]);
      await repository.insertHeaderHistory(connection, [requestId, "SUBMITTED", null, user.userCode, current, "SUBMITTED"]);
      await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_REQUISITION", entityId: requestId, action: ["SUBMITTED", "PENDING_APPROVAL"].includes(current) ? "PR_RESUBMITTED" : "PR_SUBMITTED", oldValue: { status: current }, newValue: { status: "SUBMITTED" }, performedBy: user.userCode });
    } else {
      await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_REQUISITION", entityId: requestId, action: existing ? (withdrawnForEditing ? "PR_WITHDRAWN_TO_DRAFT" : "PR_DRAFT_UPDATED") : "PR_DRAFT_CREATED", performedBy: user.userCode });
    }
    return repository.getRequest(requestId, user.tenantId, connection);
  });
}

export async function listRequests(query, user) {
  const { page, pageSize, offset } = pagination(query);
  const result = await repository.listRequests({ tenantId: user.tenantId, search: clean(query.search) || "", status: clean(query.status) || "", plant: clean(query.plant) || "", department: clean(query.department) || "", priority: clean(query.priority)?.toUpperCase() || "", rfqEligible: String(query.rfqEligible || "").trim().toLowerCase() === "true", pendingApproval: String(query.pendingApproval || "").trim().toLowerCase() === "true", clarificationOnly: String(query.clarificationOnly || "").trim().toLowerCase() === "true", limit: pageSize, offset });
  return { ...result, page, pageSize };
}

export async function summary(user) { return repository.summary(user.tenantId); }

export async function getRequest(id, user) {
  const result = await repository.getRequest(id, user.tenantId);
  if (!result) throw new AppError("Purchase requisition not found.", 404);
  return result;
}

export async function deleteDraft(id, user) {
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId < 1) throw new AppError("Purchase requisition is not valid.", 400);
  return withTransaction(async (connection) => {
    const existing = await repository.getRequest(requestId, user.tenantId, connection, true);
    if (!existing) throw new AppError("Purchase requisition not found.", 404);
    if (!["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(String(existing.pr_status).toUpperCase())) {
      throw new AppError("Only a draft or a purchase requisition awaiting approval can be deleted.", 409);
    }

    // A draft should never have downstream documents. Keep this guard so a
    // concurrent or legacy linkage cannot be removed accidentally.
    const [linkedRows] = await connection.execute(`
      SELECT 1
      FROM purchase_enquiry_requests
      WHERE purchase_request_id=? AND tenant_id=?
      UNION
      SELECT 1
      FROM purchase_order_sources
      WHERE purchase_request_id=? AND tenant_id=?
      LIMIT 1
    `, [requestId, user.tenantId, requestId, user.tenantId]);
    if (linkedRows.length) {
      throw new AppError("This purchase requisition is already linked to procurement documents and cannot be deleted.", 409);
    }

    const itemIds = (existing.items || []).map((item) => Number(item.purchase_request_item_id)).filter(Number.isInteger);
    if (itemIds.length) {
      await connection.execute(`
        UPDATE application_attachments
        SET active_flag='N'
        WHERE tenant_id=? AND entity_type='PURCHASE_REQUEST_ITEM' AND active_flag='Y'
          AND entity_id IN (${itemIds.map(() => "?").join(",")})
      `, [user.tenantId, ...itemIds]);
    }
    await connection.execute(
      "DELETE FROM purchase_requests WHERE purchase_request_id=? AND tenant_id=? AND pr_status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL')",
      [requestId, user.tenantId]
    );
    await recordAudit({
      connection,
      tenantId: user.tenantId,
      module: "PURCHASE",
      entityType: "PURCHASE_REQUISITION",
      entityId: requestId,
      action: "PR_DELETED_BEFORE_APPROVAL",
      oldValue: { prNumber: existing.pr_number, status: existing.pr_status },
      performedBy: user.userCode,
    });
    return { purchaseRequestId: requestId, prNumber: existing.pr_number };
  });
}
export const createDraft = (data, user) => saveRequest(null, data, user, "DRAFT");
export const createAndSubmit = (data, user) => saveRequest(null, data, user, "SUBMIT");
export const updateDraft = (id, data, user) => saveRequest(id, data, user, data.action === "SUBMIT" ? "SUBMIT" : "DRAFT");
