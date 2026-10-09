export type RfqPurchaseRequestStatus = "PENDING" | "APPROVED" | "PARTIALLY_APPROVED" | "RETURNED";
export type RfqCreationStatus = "NOT_CREATED" | "CREATED" | "NOT_REQUIRED";

export type RfqPurchaseRequest = {
  id: string;
  prNumber: string;
  requestedBy: string;
  department: string;
  itemCount: number;
  itemSummary: string;
  requiredDate: string;
  priority: "Low" | "Medium" | "High";
  status: RfqPurchaseRequestStatus;
  rfqStatus: RfqCreationStatus;
  submittedDate: string;
  lastUpdatedAt?: string | null;
  requisitionType?: "NEW_ITEM" | "EXISTING_ITEM";
  assignedSuppliers?: string;
};

export type ApiPurchaseRequisitionRow = {
  id: number | string;
  prNumber: string;
  requestedBy?: string | null;
  department?: string | null;
  itemCount?: number | string | null;
  approvedItemCount?: number | string | null;
  approvedItemSummary?: string | null;
  requiredDate?: string | null;
  priority?: string | null;
  status?: string | null;
  rfqStatus?: string | null;
  poReadiness?: string | null;
  submittedOn?: string | null;
  lastUpdatedAt?: string | null;
  requestDate?: string | null;
  requisitionType?: string | null;
  preferredSupplierId?: number | string | null;
  preferredSupplierName?: string | null;
  preferredSupplierCode?: string | null;
  assignedSuppliers?: string | null;
};

const formatDate = (value: string | null | undefined, style: "numeric" | "short" = "numeric") => {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const [, year, month, day] = match;
  if (style === "numeric") return `${day}-${month}-${year}`;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

export const mapApiRfqPurchaseRequest = (row: ApiPurchaseRequisitionRow): RfqPurchaseRequest => {
  const backendStatus = String(row.status || "").toUpperCase();
  const status: RfqPurchaseRequestStatus = backendStatus === "APPROVED"
    ? "APPROVED"
    : backendStatus === "PARTIALLY_APPROVED"
      ? "PARTIALLY_APPROVED"
      : ["RETURNED", "REJECTED", "CANCELLED"].includes(backendStatus)
        ? "RETURNED"
        : "PENDING";
  const approvedItemCount = Number(row.approvedItemCount || 0);
  const requestedItemCount = Number(row.itemCount || 0);
  const itemCount = status === "APPROVED" || status === "PARTIALLY_APPROVED"
    ? approvedItemCount
    : requestedItemCount;
  const rawPriority = String(row.priority || "LOW").toUpperCase();
  const priority: RfqPurchaseRequest["priority"] = rawPriority === "HIGH"
    ? "High"
    : rawPriority === "MEDIUM"
      ? "Medium"
      : "Low";
  const rawRfqStatus = String(row.rfqStatus || "NOT_CREATED").toUpperCase();
  const rfqStatus: RfqCreationStatus = rawRfqStatus === "CREATED"
    ? "CREATED"
    : rawRfqStatus === "NOT_REQUIRED"
      ? "NOT_REQUIRED"
      : "NOT_CREATED";

  return {
    id: String(row.id),
    prNumber: row.prNumber,
    requestedBy: row.requestedBy || "-",
    department: row.department || "-",
    itemCount,
    itemSummary: row.approvedItemSummary?.trim() || `${itemCount} ${itemCount === 1 ? "item" : "items"}`,
    requiredDate: formatDate(row.requiredDate),
    priority,
    status,
    rfqStatus,
    submittedDate: formatDate(row.submittedOn || row.requestDate, "short"),
    lastUpdatedAt: row.lastUpdatedAt || row.submittedOn || row.requestDate || null,
    requisitionType: String(row.requisitionType || "NEW_ITEM").toUpperCase() === "EXISTING_ITEM" ? "EXISTING_ITEM" : "NEW_ITEM",
    assignedSuppliers: row.assignedSuppliers?.trim() || "",
  };
};

type StoredRfqPurchaseRequest = Omit<RfqPurchaseRequest, "priority"> & { priority: string };

const STORAGE_KEY = "atech.purchase.rfq-pr-list.v1";
const APPROVED_LINES_KEY = "atech.purchase.approved-pr-lines.v1";

export type ApprovedPrLine = {
  id: number;
  prNumber: string;
  itemCode: string;
  itemName: string;
  itemDescription: string;
  quantity: number;
  uom: string;
  requisitionType: "New Item" | "Existing Item";
};

const legacyDefaultRequests: RfqPurchaseRequest[] = [
  { id: "PR-0057", prNumber: "PR/0057/26-27", requestedBy: "Karthik Raj", department: "Production — Assembly", itemCount: 2, itemSummary: "Pneumatic Cylinder, Solenoid Valve", requiredDate: "06-09-2026", priority: "High", status: "APPROVED", rfqStatus: "NOT_CREATED", submittedDate: "22 Aug 2026" },
  { id: "PR-0048", prNumber: "PR/0048/26-27", requestedBy: "Prasad Kumar", department: "Production — Assembly", itemCount: 2, itemSummary: "Servo Motor, Linear Guide", requiredDate: "27-08-2026", priority: "High", status: "APPROVED", rfqStatus: "NOT_CREATED", submittedDate: "19 Aug 2026" },
  { id: "PR-0054", prNumber: "PR/0054/26-27", requestedBy: "Suresh Babu", department: "Machine Shop", itemCount: 2, itemSummary: "Cutting Inserts, Drill Chuck", requiredDate: "30-08-2026", priority: "Medium", status: "APPROVED", rfqStatus: "NOT_CREATED", submittedDate: "18 Aug 2026" },
  { id: "PR-0053", prNumber: "PR/0053/26-27", requestedBy: "Ravi Kumar", department: "Maintenance", itemCount: 5, itemSummary: "Bearings and consumables", requiredDate: "22-08-2026", priority: "High", status: "PENDING", rfqStatus: "NOT_CREATED", submittedDate: "19 Aug 2026" },
  { id: "PR-0051", prNumber: "PR/0051/26-27", requestedBy: "Meena S", department: "Quality", itemCount: 1, itemSummary: "Bearing Set", requiredDate: "02-09-2026", priority: "Medium", status: "APPROVED", rfqStatus: "NOT_REQUIRED", submittedDate: "18 Aug 2026" },
  { id: "PR-0046", prNumber: "PR/0046/26-27", requestedBy: "Anand Raj", department: "Production — Assembly", itemCount: 3, itemSummary: "Electrical consumables", requiredDate: "05-09-2026", priority: "Low", status: "APPROVED", rfqStatus: "CREATED", submittedDate: "17 Aug 2026" },
];

export const loadRfqPurchaseRequests = (): RfqPurchaseRequest[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const storedRequests = (JSON.parse(stored) as StoredRfqPurchaseRequest[]).map((request): RfqPurchaseRequest => ({
      ...request,
      priority: request.priority === "Emergency" ? "High" : request.priority === "Normal" ? "Low" : request.priority as RfqPurchaseRequest["priority"],
    }));
    const storedIds = new Set(storedRequests.map((request) => request.id));
    return storedRequests;
  } catch {
    return [];
  }
};

export const markPurchaseRequestsRfqCreated = (prNumbers: string[]) => {
  const updated = loadRfqPurchaseRequests().map((request) => prNumbers.includes(request.prNumber) ? { ...request, rfqStatus: "CREATED" as const } : request);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const savePurchaseRequestApprovalOutcome = (request: RfqPurchaseRequest, approvedLines: ApprovedPrLine[]) => {
  const requests = loadRfqPurchaseRequests();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...requests.filter((entry) => entry.prNumber !== request.prNumber), request]));
  let storedLines: ApprovedPrLine[] = [];
  try { storedLines = JSON.parse(localStorage.getItem(APPROVED_LINES_KEY) || "[]") as ApprovedPrLine[]; } catch { storedLines = []; }
  localStorage.setItem(APPROVED_LINES_KEY, JSON.stringify([...storedLines.filter((line) => line.prNumber !== request.prNumber), ...approvedLines]));
};

export const loadApprovedPrLines = (prNumbers: string[]) => {
  try {
    const lines = JSON.parse(localStorage.getItem(APPROVED_LINES_KEY) || "[]") as ApprovedPrLine[];
    return lines.filter((line) => prNumbers.includes(line.prNumber));
  } catch {
    return [];
  }
};
