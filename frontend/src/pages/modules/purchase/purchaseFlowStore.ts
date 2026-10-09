import { quotationComparisonItems } from "./quotationComparisonData";
import type { SupplierPurchaseOrderDraft } from "./purchaseOrderTypes";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";

export type PurchaseSupplierDecision = {
  itemId: string;
  itemCode: string;
  itemName: string;
  specification: string;
  allocatedQuantity: number;
  uom: string;
  requiredDate: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  baseAmount: number;
  discount: number;
  tax: number;
  freightAndOther: number;
  paymentTerms: string;
  deliveryDays: number;
  reason: string;
  sourceReference: string;
};

const DECISIONS_KEY = "atech.purchase.comparison-decisions.v1";
const APPROVALS_KEY = "atech.purchase.po-approvals.v1";

export type PurchaseOrderApprovalRecord = SupplierPurchaseOrderDraft & {
  backendId?: number;
  itemCategory?: string;
  submittedBy: string;
  submittedDate: string;
  submittedTime: string;
  lastUpdatedAt?: string | null;
  itemCount?: number;
  grandTotalAmount?: number;
  otherChargesAmount?: number;
  decisionReason?: string;
};

export const buildComparisonDecisions = (selectedSuppliers: Record<string, string>, reasons: Record<string, string>): PurchaseSupplierDecision[] => quotationComparisonItems.flatMap((item) => {
  const supplier = item.quotations.find((entry) => entry.supplierId === selectedSuppliers[item.id]);
  if (!supplier) return [];
  return [{
    itemId: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    specification: item.specification,
    allocatedQuantity: item.quantity,
    uom: item.uom,
    requiredDate: item.requiredDate,
    supplierId: supplier.supplierId,
    supplierCode: supplier.supplierCode,
    supplierName: supplier.supplierName,
    baseAmount: supplier.baseAmount,
    discount: supplier.discount,
    tax: supplier.tax,
    freightAndOther: supplier.freightAndOther,
    paymentTerms: supplier.paymentTerms,
    deliveryDays: supplier.deliveryDays,
    reason: reasons[item.id] || "",
    sourceReference: "RFQ/PE/0024/26-27",
  }];
});

export const getDefaultComparisonDecisions = () => buildComparisonDecisions(
  Object.fromEntries(quotationComparisonItems.map((item) => [item.id, item.quotations.find((entry) => entry.isRecommended)?.supplierId || item.quotations[0].supplierId])),
  {},
);

export const loadComparisonDecisions = (): PurchaseSupplierDecision[] => {
  try {
    const stored = localStorage.getItem(DECISIONS_KEY);
    return stored ? JSON.parse(stored) as PurchaseSupplierDecision[] : [];
  } catch {
    return [];
  }
};

export const saveComparisonDecisions = (decisions: PurchaseSupplierDecision[]) => localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));

const toIsoDate = (value: string) => {
  const [day, month, year] = value.split("-");
  return year && month && day ? `${year}-${month}-${day}` : value;
};

export const createSupplierWisePoDrafts = (decisions: PurchaseSupplierDecision[]): SupplierPurchaseOrderDraft[] => {
  const groups = new Map<string, PurchaseSupplierDecision[]>();
  decisions.forEach((decision) => groups.set(decision.supplierId, [...(groups.get(decision.supplierId) || []), decision]));
  const today = todayInAppTimeZone();
  return Array.from(groups.entries()).map(([supplierId, supplierDecisions], index) => {
    const first = supplierDecisions[0];
    const requiredDates = supplierDecisions.map((decision) => toIsoDate(decision.requiredDate)).sort();
    const latestRequiredDate = requiredDates[requiredDates.length - 1] || "";
    return {
      id: `PO-DRAFT-${supplierId}`,
      supplierId,
      supplierCode: first.supplierCode,
      status: "DRAFT",
      form: {
        mode: "COMPARISON",
        poNumber: `PO/2026/${String(301 + index).padStart(4, "0")}`,
        poDate: today,
        supplierName: `${first.supplierName} · ${first.supplierCode}`,
        sourceReference: Array.from(new Set(supplierDecisions.map((decision) => decision.sourceReference))).join(", ") + " · Approved supplier decisions",
        expectedDelivery: latestRequiredDate,
        paymentTerms: first.paymentTerms,
        transportMode: "",
        billingAddress: "Atech Automation · Coimbatore",
        deliveryAddress: "Atech Coimbatore / Main Stores",
        remarks: `Generated from approved supplier comparison for ${first.sourceReference}.`,
        specialInstructions: "Mention PO number on invoice and delivery challan. Supply as per the accepted quotation and committed delivery schedule.",
      },
      lines: supplierDecisions.map((decision, lineIndex) => {
        const taxableAmount = Math.max(0, decision.baseAmount - decision.discount);
        const taxPercent = taxableAmount ? Math.round(decision.tax / taxableAmount * 100) : 0;
        return {
          id: lineIndex + 1,
          sourceItemId: decision.itemId,
          enquiryNumber: decision.sourceReference.replace("RFQ/", ""),
          itemCode: decision.itemCode,
          itemName: decision.itemName,
          specification: decision.specification,
          quantity: decision.allocatedQuantity,
          uom: decision.uom,
          rate: decision.allocatedQuantity ? decision.baseAmount / decision.allocatedQuantity : 0,
          taxPercent,
          discount: decision.discount,
          freightAndOther: decision.freightAndOther,
        };
      }),
    };
  });
};

export const loadPurchaseOrderApprovals = (): PurchaseOrderApprovalRecord[] => {
  try {
    const stored = localStorage.getItem(APPROVALS_KEY);
    if (stored) return JSON.parse(stored) as PurchaseOrderApprovalRecord[];
  } catch {
    // Storage may be unavailable in private browsing.
  }
  return [];
};

export const savePurchaseOrderApprovals = (records: PurchaseOrderApprovalRecord[]) => localStorage.setItem(APPROVALS_KEY, JSON.stringify(records));

export const submitPurchaseOrderForApproval = (draft: SupplierPurchaseOrderDraft) => {
  const records = loadPurchaseOrderApprovals();
  const now = new Date();
  const submitted: PurchaseOrderApprovalRecord = {
    ...draft,
    status: "SUBMITTED",
    submittedBy: "Ramesh Kumar",
    submittedDate: now.toLocaleDateString("en-GB"),
    submittedTime: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    decisionReason: "",
  };
  savePurchaseOrderApprovals([...records.filter((record) => record.id !== draft.id), submitted]);
};

export const updatePurchaseOrderApproval = (record: PurchaseOrderApprovalRecord) => {
  const records = loadPurchaseOrderApprovals();
  savePurchaseOrderApprovals(records.map((current) => current.id === record.id ? record : current));
};
