import type { PurchaseOrderApprovalRecord } from "./purchaseFlowStore";

export type GateEntryStatus = "DRAFT" | "GATE_ENTERED" | "GRN_CREATED" | "OUTSOURCING_WIP" | "STOCK_POSTED";
export type GateEntryType = "REGULAR_PURCHASE" | "CUSTOMER_PURCHASE" | "OPEN_PURCHASE" | "OUTSOURCING_PARTS";

export type GateEntryRecord = {
  id: string;
  gateEntryNumber: string;
  entryType?: GateEntryType;
  referenceNumber?: string;
  poNumber: string;
  poId: string;
  supplierId?: number | null;
  partId?: number | null;
  partNumber?: string;
  partName?: string;
  partUom?: string;
  itemCategory?: string;
  supplierName: string;
  supplierCode: string;
  customerId?: number | null;
  customerName?: string;
  transportMode?: string;
  entryDateTime: string;
  lastUpdatedAt?: string | null;
  vehicleNumber: string;
  driverName: string;
  drivingLicenceNumber: string;
  itemCount: number;
  totalQuantity: number;
  deliveryLocation: string;
  status: GateEntryStatus;
};

const STORAGE_KEY = "atech.purchase.gate-entries.v1";

const legacySeedRecords: GateEntryRecord[] = [
  { id: "GE-0025", gateEntryNumber: "GE/2026-27/0025", poNumber: "PO/2026/0296", poId: "PO-DRAFT-SUP-005", supplierName: "Bharat Electricals", supplierCode: "SUP-005", entryDateTime: "2026-08-24T08:40", vehicleNumber: "TN 37 CM 8452", driverName: "S. Prakash", drivingLicenceNumber: "TN3720120006541", itemCount: 4, totalQuantity: 320, deliveryLocation: "Atech Coimbatore / Main Stores", status: "GATE_ENTERED" },
  { id: "GE-0024", gateEntryNumber: "GE/2026-27/0024", poNumber: "PO/2026/0292", poId: "PO-DRAFT-SUP-003", supplierName: "Axis Automation", supplierCode: "SUP-003", entryDateTime: "2026-08-23T15:15", vehicleNumber: "TN 38 AB 2146", driverName: "R. Murugan", drivingLicenceNumber: "TN3820140007892", itemCount: 2, totalQuantity: 30, deliveryLocation: "Atech Coimbatore / Main Stores", status: "GRN_CREATED" },
  { id: "GE-0026", gateEntryNumber: "GE/2026-27/0026", poNumber: "PO/2026/0302", poId: "PO-DRAFT-SUP-004", supplierName: "MechPro Components", supplierCode: "SUP-004", entryDateTime: "2026-08-24T09:20", vehicleNumber: "", driverName: "", drivingLicenceNumber: "", itemCount: 1, totalQuantity: 20, deliveryLocation: "Atech Coimbatore / Main Stores", status: "DRAFT" },
];

export const loadGateEntries = (): GateEntryRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as GateEntryRecord[] : [];
  } catch {
    return [];
  }
};

export const saveGateEntry = (record: GateEntryRecord) => {
  const current = loadGateEntries();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...current.filter((entry) => entry.id !== record.id)]));
};

export const updateGateEntryStatus = (id: string, status: GateEntryStatus) => {
  const current = loadGateEntries();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current.map((entry) => entry.id === id ? { ...entry, status } : entry)));
};

export const createGateEntryNumber = () => {
  const next = loadGateEntries().reduce((maximum, entry) => {
    const segments = entry.gateEntryNumber.split("/");
    const number = Number(segments[segments.length - 1]) || 0;
    return Math.max(maximum, number);
  }, 0) + 1;
  return `GE/2026-27/${String(next).padStart(4, "0")}`;
};

export const gateEntryFromPo = (po: PurchaseOrderApprovalRecord, values: { gateEntryNumber: string; entryDateTime: string; vehicleNumber: string; driverName: string; drivingLicenceNumber: string }, status: GateEntryStatus): GateEntryRecord => ({
  id: values.gateEntryNumber.split("/").join("-"),
  gateEntryNumber: values.gateEntryNumber,
  poNumber: po.form.poNumber,
  poId: po.id,
  supplierName: po.form.supplierName.split(" · ")[0],
  supplierCode: po.supplierCode,
  entryDateTime: values.entryDateTime,
  vehicleNumber: values.vehicleNumber.trim().toUpperCase(),
  driverName: values.driverName.trim(),
  drivingLicenceNumber: values.drivingLicenceNumber.trim().toUpperCase(),
  itemCount: po.lines.length,
  totalQuantity: po.lines.reduce((sum, line) => sum + line.quantity, 0),
  deliveryLocation: po.form.deliveryAddress,
  status,
});
