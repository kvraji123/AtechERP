import { withTransaction } from "../../config/db.js";
import { getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { transitionOrThrow } from "../../shared/services/workflow.service.js";
import { PO_TRANSITIONS, calculateLineAmounts } from "../../shared/constants/purchase.js";
import { assertPartyTransportMode } from "../../utils/transport-modes.js";
import * as assignmentRepository from "../supplier-assignment/supplier-assignment.repository.js";
import * as comparisonRepository from "../quotation-comparison/quotation-comparison.repository.js";
import * as repository from "./purchase-order.repository.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
import { validatePoLines } from "./purchase-order.validation.js";

const today = todayInAppTimeZone;

export async function list(query, user) {
  const page = Math.max(Number(query.page || 1), 1); const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const result = await repository.listOrders({ tenantId: user.tenantId, search: String(query.search || "").trim(), status: String(query.status || "").trim().toUpperCase(), source: String(query.source || "").trim().toUpperCase(), supplier: String(query.supplier || "").trim(), limit: pageSize, offset: (page - 1) * pageSize });
  return { ...result, page, pageSize };
}
export async function summary(user) { return repository.summary(user.tenantId); }
export async function listSupplierOptions(user) { return repository.listSupplierOptions(user.tenantId); }
export async function get(id, user) { const result = await repository.getOrder(id, user.tenantId); if (!result) throw new AppError("Purchase order not found.", 404); return result; }

export async function generate(data, user) {
  const requestedItemIds = (Array.isArray(data.purchaseRequestItemIds) ? data.purchaseRequestItemIds : []).map(Number).filter(Boolean);
  const enquiryId = Number(data.purchaseEnquiryId || 0);
  const itemIds = requestedItemIds;
  if (!itemIds.length && !enquiryId) throw new AppError("Select approved purchase request items or a purchase enquiry to generate purchase orders.");
  return withTransaction(async (connection) => {
    let assignments;
    let lines;
    if (enquiryId) {
      const selectedLines = await comparisonRepository.getSelectedLines(connection, user.tenantId, enquiryId);
      assignments = selectedLines.map((entry) => ({
        purchase_request_item_id: entry.purchaseRequestItemId,
        supplier_id: entry.supplierId,
        assigned_quantity: entry.assignedQuantity,
        unit_price: entry.unitPrice,
        discount_amount: entry.discountAmount,
        tax_percent: entry.taxPercent,
        freight_amount: entry.freightAmount,
        packing_amount: entry.packingAmount,
        other_charges_amount: entry.otherChargesAmount,
        delivery_date: entry.deliveryDate,
        delivery_lead_days: entry.deliveryLeadDays,
        payment_terms: entry.paymentTerms,
        warranty_months: entry.warrantyMonths,
        currency_code: entry.currencyCode,
      }));
      if (!assignments.length) throw new AppError("Save supplier selections in quote comparison before generating POs.", 409);
    } else {
      lines = await assignmentRepository.getLinesForUpdate(connection, user.tenantId, itemIds);
      assignments = await assignmentRepository.getActiveAssignments(connection, user.tenantId, itemIds);
      const assignedItemIds = new Set(assignments.map((entry) => Number(entry.purchase_request_item_id)));
      for (const line of lines) {
        if (assignedItemIds.has(Number(line.purchase_request_item_id))) continue;
        if (String(line.requisitionType || "").toUpperCase() !== "EXISTING_ITEM" || !line.preferredSupplierId) continue;
        assignments.push({
          purchase_request_item_id: line.purchase_request_item_id,
          supplier_id: line.preferredSupplierId,
          assigned_quantity: line.approved_quantity,
          unit_price: line.masterPurchaseRate ?? line.estimated_rate_per_qty ?? 0,
          discount_amount: 0,
          tax_percent: line.tax_percent ?? 0,
          freight_amount: 0,
          packing_amount: 0,
          other_charges_amount: 0,
          delivery_date: line.requestRequiredDate,
          payment_terms: "As per supplier terms",
        });
      }
    }
    const resolvedItemIds = itemIds.length ? itemIds : [...new Set(assignments.map((entry) => Number(entry.purchase_request_item_id)))];
    if (!assignments.length) throw new AppError("Assign suppliers to the selected approved items before generating POs.", 409);
    lines ||= await assignmentRepository.getLinesForUpdate(connection, user.tenantId, resolvedItemIds);
    const lineById = new Map(lines.map((line) => [Number(line.purchase_request_item_id), line]));
    const totalByLine = new Map(); assignments.forEach((entry) => totalByLine.set(Number(entry.purchase_request_item_id), (totalByLine.get(Number(entry.purchase_request_item_id)) || 0) + Number(entry.assigned_quantity)));
    for (const id of resolvedItemIds) {
      const line = lineById.get(id);
      const approvalStatus = String(line?.approval_status || "").trim().toUpperCase();
      if (!line || approvalStatus !== "APPROVED") {
        throw new AppError(`Line ${line?.item_type_name || id} is not approved for purchase-order generation (status: ${approvalStatus || "UNKNOWN"}).`, 409);
      }
      if (Math.abs(Number(line.approved_quantity) - Number(totalByLine.get(id) || 0)) > 0.0001) throw new AppError(`Supplier allocation must equal approved quantity for ${line.item_type_name}.`, 409);
      if (await repository.findExistingForLine(connection, user.tenantId, id)) throw new AppError(`A purchase order already exists for ${line.item_type_name}.`, 409);
    }
    const groups = new Map(); assignments.forEach((entry) => groups.set(Number(entry.supplier_id), [...(groups.get(Number(entry.supplier_id)) || []), entry]));
    const created = [];
    for (const [supplierId, supplierAssignments] of groups) {
      const supplier = await assignmentRepository.getSupplier(connection, supplierId);
      if (!supplier) throw new AppError("Supplier is invalid or inactive.", 409);
      const financialYear = getFinancialYear(); const poNumber = await getNextDocumentNumber(connection, "PURCHASE_ORDER", financialYear);
      let subtotal = 0; let discount = 0; let tax = 0; let packing = 0; let freight = 0; let other = 0; let grandTotal = 0;
      const poDate = today(); const requestNumbers = [...new Set(supplierAssignments.map((entry) => lineById.get(Number(entry.purchase_request_item_id))?.prNumber).filter(Boolean))];
      const sourceReference = enquiryId ? `RFQ/${enquiryId} · ${requestNumbers.join(", ")}` : requestNumbers.join(", ");
      const orderId = await repository.insertHeader(connection, [user.tenantId, user.companyId, lineById.get(Number(supplierAssignments[0].purchase_request_item_id))?.plantId || null, poNumber, financialYear, poDate, supplierId, supplier.supplierCode, supplier.supplierName, supplier.billingAddress || supplier.deliveryAddress || "", supplier.gstNumber || null, sourceReference, "Atech Automation, Coimbatore", "Atech Automation, Coimbatore / Main Stores", supplierAssignments[0]?.payment_terms || "As per supplier quotation", "Standard delivery terms", null, supplierAssignments.map((entry) => entry.delivery_date || lineById.get(Number(entry.purchase_request_item_id))?.requestRequiredDate).sort().at(-1) || null, `Generated from approved existing-item requisitions ${requestNumbers.join(", ")}.`, "Mention PO number on invoice and delivery challan.", 0, 0, 0, 0, 0, 0, 0, "DRAFT", user.userCode]);
      for (let index = 0; index < supplierAssignments.length; index += 1) {
        const assignment = supplierAssignments[index]; const line = lineById.get(Number(assignment.purchase_request_item_id));
        const quantity = Number(assignment.assigned_quantity); const rate = Number(assignment.unit_price ?? line.masterPurchaseRate ?? 0); const taxPercent = Number(assignment.tax_percent ?? line.tax_percent ?? 0); const amounts = calculateLineAmounts({ quantity, unitPrice: rate, discount: assignment.discount_amount, taxPercent, freight: assignment.freight_amount, packing: assignment.packing_amount, otherCharges: assignment.other_charges_amount });
        subtotal += amounts.basicAmount - amounts.discountAmount; discount += amounts.discountAmount; tax += amounts.taxAmount; packing += amounts.packingAmount; freight += amounts.freightAmount; other += amounts.otherChargesAmount; grandTotal += amounts.lineTotalAmount;
        await repository.upsertItemSupplierRate(connection, {
          itemId: line.item_id,
          supplierId,
          purchaseRate: rate,
          currencyCode: assignment.currency_code || assignment.currencyCode || supplier.currencyCode || "INR",
          leadTimeDays: assignment.delivery_lead_days ?? assignment.deliveryLeadDays ?? null,
        }, user.userCode);
        const poItemId = await repository.insertItem(connection, [user.tenantId, orderId, line.purchase_request_item_id, index + 1, line.item_id, line.itemCode || "", line.item_type_name, line.item_description, line.item_specification, line.uom_code, line.hsn_code, quantity, rate, amounts.discountAmount, taxPercent, amounts.taxAmount, amounts.packingAmount, amounts.freightAmount, amounts.otherChargesAmount, amounts.lineTotalAmount, assignment.delivery_date || line.requestRequiredDate, "OPEN"]);
        await repository.insertSource(connection, [user.tenantId, orderId, poItemId, line.requestId, line.purchase_request_item_id, quantity]);
      }
      await connection.execute(`UPDATE purchase_orders SET subtotal_amount=?,discount_amount=?,tax_amount=?,packing_amount=?,freight_amount=?,other_charges_amount=?,grand_total_amount=? WHERE purchase_order_id=? AND tenant_id=?`, [subtotal, discount, tax, packing, freight, other, grandTotal, orderId, user.tenantId]);
      await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_ORDER", entityId: orderId, action: "PO_DRAFT_CREATED", newValue: { poNumber, supplierId, requestNumbers }, performedBy: user.userCode });
      created.push(await repository.getOrder(orderId, user.tenantId, connection));
    }
    return created;
  });
}

export async function update(id, data, user) {
  const lines = validatePoLines(data.items || data.lines);
  return withTransaction(async (connection) => {
    const order = await repository.getOrder(id, user.tenantId, connection, true); if (!order) throw new AppError("Purchase order not found.", 404);
    if (!["DRAFT", "RETURNED"].includes(order.status)) throw new AppError("Only draft or returned POs can be edited.", 409);
    const supplier = await assignmentRepository.getSupplier(connection, order.supplier_id);
    if (!supplier) throw new AppError("Supplier is invalid or inactive.", 409);
    const transportMode = await assertPartyTransportMode({ selectedMode: data.transportMode ?? order.transport_mode, allowedModes: supplier.allowedTransportModes || supplier.transportMode, partyLabel: "Supplier", connection });
    await repository.updateHeader(connection, id, user.tenantId, [data.expectedDeliveryDate || order.expected_delivery_date, data.paymentTerms ?? order.payment_terms, data.deliveryTerms ?? order.delivery_terms, transportMode, data.billingAddress ?? order.billing_address_snapshot, data.deliveryAddress ?? order.delivery_address_snapshot, data.remarks ?? order.remarks, data.specialInstructions ?? order.special_instructions, user.userCode]);
    const byId = new Map(order.items.map((line) => [Number(line.purchase_order_item_id), line])); let subtotal = 0; let discount = 0; let tax = 0; let packing = 0; let freight = 0; let other = 0; let grandTotal = 0;
    for (const input of lines) {
      const current = byId.get(Number(input.purchaseOrderItemId ?? input.id)); if (!current) throw new AppError("PO item does not belong to this order.", 409);
      const amounts = calculateLineAmounts({ quantity: input.quantity, unitPrice: input.rate, discount: input.discount, taxPercent: input.taxPercent, freight: input.freight, packing: input.packing, otherCharges: input.otherCharges }); subtotal += amounts.basicAmount - amounts.discountAmount; discount += amounts.discountAmount; tax += amounts.taxAmount; packing += amounts.packingAmount; freight += amounts.freightAmount; other += amounts.otherChargesAmount; grandTotal += amounts.lineTotalAmount;
      await repository.updateItem(connection, current.purchase_order_item_id, user.tenantId, [input.quantity, input.rate, amounts.discountAmount, input.taxPercent, amounts.taxAmount, amounts.packingAmount, amounts.freightAmount, amounts.otherChargesAmount, amounts.lineTotalAmount]);
    }
    await connection.execute(`UPDATE purchase_orders SET subtotal_amount=?,discount_amount=?,tax_amount=?,packing_amount=?,freight_amount=?,other_charges_amount=?,grand_total_amount=?,updated_by=? WHERE purchase_order_id=? AND tenant_id=?`, [subtotal, discount, tax, packing, freight, other, grandTotal, user.userCode, id, user.tenantId]);
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_ORDER", entityId: id, action: "PO_DRAFT_UPDATED", performedBy: user.userCode });
    return repository.getOrder(id, user.tenantId, connection);
  });
}

export async function submit(id, user) {
  return withTransaction(async (connection) => { const order = await repository.getOrder(id, user.tenantId, connection, true); if (!order) throw new AppError("Purchase order not found.", 404); const supplier = await assignmentRepository.getSupplier(connection, order.supplier_id); if (!supplier) throw new AppError("Supplier is invalid or inactive.", 409); await assertPartyTransportMode({ selectedMode: order.transport_mode, allowedModes: supplier.allowedTransportModes || supplier.transportMode, partyLabel: "Supplier", connection }); transitionOrThrow(PO_TRANSITIONS, order.status, "SUBMITTED"); await repository.setStatus(connection, id, user.tenantId, "SUBMITTED", user.userCode); await repository.insertHistory(connection, [user.tenantId, id, "SUBMITTED", null, order.status, "SUBMITTED", user.userCode]); await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "PURCHASE_ORDER", entityId: id, action: "PO_SUBMITTED", oldValue: { status: order.status }, newValue: { status: "SUBMITTED" }, performedBy: user.userCode }); return repository.getOrder(id, user.tenantId, connection); });
}
