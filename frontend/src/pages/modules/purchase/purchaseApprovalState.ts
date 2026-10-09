import { purchaseApprovalRequests } from "./purchaseData";
import type { PurchaseApprovalRequest } from "./types";
import { formatDate, formatDateTime } from "../../../utils/formatDateTime";

export type PurchaseApprovalApiRow = {
  id: number | string;
  prNumber: string;
  plantCode?: string;
  department?: string;
  requestedBy?: string;
  submittedOn?: string;
  lastUpdatedAt?: string | null;
  requiredDate?: string;
  priority?: string;
  requisitionType?: string;
  itemCount?: number;
  estimatedTotalAmount?: number;
  preferredSupplierId?: number | string;
  preferredSupplierName?: string;
  preferredSupplierCode?: string;
  status?: string;
};

const dateLabel = (value?: string) => {
  if (!value) return "-";
  return formatDate(value);
};

export const mapApprovalRequest = (row: PurchaseApprovalApiRow): PurchaseApprovalRequest => ({
  id: String(row.id), prNumber: row.prNumber, plant: row.plantCode || "-",
  department: row.department || "-", requestedBy: row.requestedBy || "-",
  submittedDate: dateLabel(row.submittedOn), submittedTime: row.submittedOn ? formatDateTime(row.submittedOn).slice(-5) : "-",
  itemCount: Number(row.itemCount || 0), requiredDate: dateLabel(row.requiredDate),
  amount: Number(row.estimatedTotalAmount || 0), priority: (String(row.priority || "MEDIUM").toLowerCase().replace(/^./, (value) => value.toUpperCase()) as PurchaseApprovalRequest["priority"]),
  preferredSupplierId: row.preferredSupplierId == null ? undefined : String(row.preferredSupplierId),
  preferredSupplier: row.preferredSupplierName ? { name: row.preferredSupplierName, code: row.preferredSupplierCode || "" } : undefined,
  status: row.status === "RETURNED" ? "Returned" : "Pending",
  requisitionType: String(row.requisitionType || "EXISTING_ITEM") === "NEW_ITEM" ? "New Item" : "Existing Item",
  lastUpdatedAt: row.lastUpdatedAt || row.submittedOn || null,
});

const STORAGE_KEY = "atech.purchase.pr-approval-statuses.v1";

type StoredApprovalStatus = Record<string, PurchaseApprovalRequest["status"]>;

export const loadPurchaseApprovalQueue = (): PurchaseApprovalRequest[] => {
  try {
    const statuses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as StoredApprovalStatus;
    return purchaseApprovalRequests.map((request) => ({ ...request, status: statuses[request.id] || request.status }));
  } catch {
    return purchaseApprovalRequests;
  }
};

export const savePurchaseApprovalStatus = (requestId: string, status: PurchaseApprovalRequest["status"]) => {
  let statuses: StoredApprovalStatus = {};
  try { statuses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as StoredApprovalStatus; } catch { statuses = {}; }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...statuses, [requestId]: status }));
};
