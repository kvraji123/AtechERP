import type { PurchaseOrderDetail, PurchaseOrderListRow } from "../../../api/purchase.api";
import type { PurchaseOrderApprovalRecord } from "./purchaseFlowStore";
import { formatDate, formatDateTime } from "../../../utils/formatDateTime";

type BackendPurchaseOrderDetail = PurchaseOrderDetail & Record<string, unknown>;

const inputDate = (value: unknown) => String(value || "").slice(0, 10);

const submittedParts = (value: unknown) => {
  if (!value || formatDate(value) === "—") return { submittedDate: "—", submittedTime: "—" };
  const formatted = formatDateTime(value);
  return {
    submittedDate: formatDate(value),
    submittedTime: formatted.slice(-5),
  };
};

const sourceReference = (order: BackendPurchaseOrderDetail) => String(order.source_reference || order.sourceReference || "") || [...new Set(((order.sources as Array<Record<string, unknown>> | undefined) || [])
  .map((source) => String(source.prNumber || source.pr_number || "").trim())
  .filter(Boolean))].join(", ");

const itemCategory = (order: BackendPurchaseOrderDetail) => {
  const types = new Set(((order.sources as Array<Record<string, unknown>> | undefined) || [])
    .map((source) => String(source.requisitionType || source.requisition_type || "").toUpperCase())
    .filter(Boolean));
  if (types.size > 1) return "Mixed Items";
  if (types.has("NEW_ITEM")) return "New Item";
  if (types.has("EXISTING_ITEM")) return "Existing Item";
  return "Item type unavailable";
};

const statusValue = (value: unknown): PurchaseOrderApprovalRecord["status"] => {
  const status = String(value || "SUBMITTED").toUpperCase();
  return ["DRAFT", "SUBMITTED", "APPROVED", "RETURNED", "REJECTED"].includes(status)
    ? status as PurchaseOrderApprovalRecord["status"]
    : "SUBMITTED";
};

export const mapPurchaseOrderApprovalRow = (row: PurchaseOrderListRow): PurchaseOrderApprovalRecord => {
  const submitted = submittedParts(row.submittedAt);
  return {
    id: String(row.id),
    backendId: Number(row.id),
    supplierId: "",
    supplierCode: row.supplierCode || "",
    itemCategory: row.itemCategory || "Item type unavailable",
    status: statusValue(row.status),
    form: {
      mode: /RFQ|PE\//i.test(row.sourceReference || "") ? "COMPARISON" : "DIRECT_PR",
      poNumber: row.poNumber || "",
      poDate: inputDate(row.poDate),
      supplierName: `${row.supplierName || ""}${row.supplierCode ? ` · ${row.supplierCode}` : ""}`,
      sourceReference: row.sourceReference || "",
      expectedDelivery: inputDate(row.expectedDeliveryDate),
      paymentTerms: "",
      transportMode: "",
      billingAddress: "",
      deliveryAddress: "",
      remarks: "",
      specialInstructions: "",
    },
    lines: [],
    submittedBy: row.submittedBy || "System Administrator",
    ...submitted,
    lastUpdatedAt: row.lastUpdatedAt || row.submittedAt || null,
    itemCount: Number(row.itemCount || 0),
    grandTotalAmount: Number(row.grandTotalAmount || 0),
  };
};

export const mapPurchaseOrderApprovalDetail = (order: BackendPurchaseOrderDetail): PurchaseOrderApprovalRecord => {
  const id = Number(order.purchase_order_id || order.id || 0);
  const supplierCode = String(order.supplier_code_snapshot || order.supplierCode || "");
  const supplierName = String(order.supplier_name_snapshot || order.supplierName || "");
  const reference = sourceReference(order);
  const submitted = submittedParts(order.submitted_at || order.submittedAt);
  const items = (order.items as Array<Record<string, unknown>> | undefined) || [];
  const approvalHistory = (order.approvalHistory as Array<Record<string, unknown>> | undefined) || [];
  const latestApproval = approvalHistory.length ? approvalHistory[approvalHistory.length - 1] : undefined;
  return {
    id: String(id),
    backendId: id,
    supplierId: String(order.supplier_id || order.supplierId || ""),
    supplierCode,
    itemCategory: itemCategory(order),
    status: statusValue(order.status),
    form: {
      mode: /RFQ|PE\//i.test(reference) ? "COMPARISON" : "DIRECT_PR",
      poNumber: String(order.po_number || order.poNumber || ""),
      poDate: inputDate(order.po_date || order.poDate),
      supplierName: `${supplierName}${supplierCode ? ` · ${supplierCode}` : ""}`,
      sourceReference: reference,
      expectedDelivery: inputDate(order.expected_delivery_date || order.expectedDeliveryDate),
      paymentTerms: String(order.payment_terms || order.paymentTerms || ""),
      transportMode: String(order.transport_mode || order.transportMode || ""),
      billingAddress: String(order.billing_address_snapshot || order.billingAddress || ""),
      deliveryAddress: String(order.delivery_address_snapshot || order.deliveryAddress || ""),
      remarks: String(order.remarks || ""),
      specialInstructions: String(order.special_instructions || order.specialInstructions || ""),
    },
    lines: items.map((item) => ({
      id: Number(item.purchase_order_item_id || item.id || 0),
      sourceItemId: String(item.purchase_request_item_id || ""),
      enquiryNumber: reference,
      itemCode: String(item.item_code_snapshot || item.itemCode || ""),
      itemName: String(item.item_description_snapshot || item.itemName || ""),
      specification: String(item.item_specification_snapshot || item.specification || ""),
      quantity: Number(item.ordered_quantity || item.quantity || 0),
      uom: String(item.uom_code_snapshot || item.uom || ""),
      rate: Number(item.unit_price || item.rate || 0),
      taxPercent: Number(item.tax_percent || item.taxPercent || 0),
      discount: Number(item.discount_amount || item.discount || 0),
      freightAndOther: Number(item.packing_amount || 0) + Number(item.freight_amount || 0) + Number(item.other_charges_amount || 0),
    })),
    submittedBy: String(order.submitted_by || order.submittedBy || "System Administrator"),
    ...submitted,
    lastUpdatedAt: String(order.updated_at || order.lastUpdatedAt || order.submitted_at || order.submittedAt || "") || null,
    itemCount: items.length,
    grandTotalAmount: Number(order.grand_total_amount || order.grandTotalAmount || 0),
    otherChargesAmount: Number(order.packing_amount || 0) + Number(order.freight_amount || 0) + Number(order.other_charges_amount || 0),
    decisionReason: String(latestApproval?.reason || ""),
  };
};
