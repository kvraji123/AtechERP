import type { GateEntryRecord } from "./gateEntryData";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import { updateGateEntryStatus } from "./gateEntryData";
import type { PurchaseOrderApprovalRecord } from "./purchaseFlowStore";

export type GrnStatus = "DRAFT" | "INSPECTION_PENDING" | "INSPECTION_HOLD" | "READY_FOR_STOCK" | "OUTSOURCING_WIP" | "REJECTED" | "STOCK_POSTED";
export type GrnListFilter = "ALL" | GrnStatus | "REJECTED_INSPECTION";
export type InspectionResult = "PENDING" | "ACCEPTED" | "PARTIAL" | "REJECTED" | "ON_HOLD";
export type InspectionCharacteristicResult = "PENDING" | "PASS" | "FAIL";
export type InspectionDisposition = "PENDING" | "HOLD" | "FULL_INSPECTION" | "REJECT_LOT" | "PARTIAL_ACCEPT" | "DEVIATION_ACCEPT";
export type GrnReceiptType = "REGULAR_PURCHASE" | "CUSTOMER_SUPPLIED" | "OPEN_PURCHASE" | "OUTSOURCING_PRODUCT";

export type GrnInspectionCharacteristic = {
  id: number;
  characteristicCode: string;
  characteristicName: string;
  characteristicType: string;
  specifiedDimension: number | null;
  toleranceGrade: string;
  toleranceMinus: number | null;
  tolerancePlus: number | null;
  lsl: number | null;
  usl: number | null;
  drawingGrid: string;
  instrument: string;
  sampleSize: string;
  inspectionFrequency: string;
  actualValue: string;
  inspectionResult: InspectionCharacteristicResult;
  remarks: string;
};

export type GrnRejectionAttachment = {
  rejectionAttachmentId: number;
  grnItemId: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
};

export type GrnItem = {
  id: number;
  itemId?: number;
  purchaseOrderItemId?: number;
  itemCode: string;
  itemName: string;
  specification: string;
  uom: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  currentReceivedQuantity: number;
  directRatePerQty?: number;
  taxPercent?: number;
  batchSerialNumber: string;
  inspectionRequired: boolean;
  acceptedQuantity: number;
  rejectedQuantity: number;
  onHoldQuantity: number;
  inspectionResult: InspectionResult;
  inspectionDisposition?: InspectionDisposition;
  inspectionCharacteristics?: GrnInspectionCharacteristic[];
  rejectionReasonId?: number;
  rejectionDispositionId?: number;
  rejectionReason: string;
  rejectionAttachmentReference?: string;
  rejectionAttachments?: GrnRejectionAttachment[];
  qualityRemarks: string;
  warehouse: string;
  binLocation: string;
};

export type GrnRecord = {
  id: string;
  grnNumber: string;
  gateEntryId: string;
  gateEntryNumber: string;
  gateEntryReferenceNumber?: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  supplierCode: string;
  supplierId?: number | null;
  outsourcingPartId?: number | null;
  outsourcingPartNumber?: string;
  outsourcingPartName?: string;
  outsourcingPartUom?: string;
  outsourcingProcessPlanId?: number | null;
  outsourcingProcessPlanCode?: string;
  outsourcingProcessOperationId?: number | null;
  receiptType: GrnReceiptType;
  customerId: number | null;
  customerName: string;
  customerPlantCode: string;
  purchaseReason?: string;
  purchaseApprovedBy?: string;
  jobReference?: string;
  receiptDate: string;
  lastUpdatedAt?: string | null;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  deliveryChallanNumber: string;
  attachmentName: string;
  receivedBy: string;
  stockPostingDate: string;
  remarks: string;
  status: GrnStatus;
  items: GrnItem[];
};

const STORAGE_KEY = "atech.purchase.grn-records.v1";

const legacySeedRecords: GrnRecord[] = [
  {
    id: "GRN-0023", grnNumber: "GRN/2026-27/0023", gateEntryId: "GE-0024", gateEntryNumber: "GE/2026-27/0024", poId: "PO-DRAFT-SUP-003", poNumber: "PO/2026/0292", supplierName: "Axis Automation", supplierCode: "SUP-003", receiptType: "REGULAR_PURCHASE", customerId: null, customerName: "", customerPlantCode: "", receiptDate: "2026-08-23", supplierInvoiceNumber: "AX/INV/1842", supplierInvoiceDate: "2026-08-22", deliveryChallanNumber: "AX/DC/902", attachmentName: "axis-invoice-1842.pdf", receivedBy: "Stores User", stockPostingDate: "", remarks: "Material received in sealed packages.", status: "INSPECTION_PENDING",
    items: [
      { id: 1, itemCode: "ITM-EL-001", itemName: "Servo Motor", specification: "1.5 kW, 3000 RPM with encoder", uom: "Nos", orderedQuantity: 10, previouslyReceivedQuantity: 0, currentReceivedQuantity: 10, batchSerialNumber: "SM-AUG26", inspectionRequired: true, acceptedQuantity: 0, rejectedQuantity: 0, onHoldQuantity: 0, inspectionResult: "PENDING", rejectionReason: "", qualityRemarks: "", warehouse: "Main Stores", binLocation: "" },
      { id: 2, itemCode: "ITM-ME-014", itemName: "Linear Guide", specification: "HGR25CA, 1000 mm rail", uom: "Nos", orderedQuantity: 20, previouslyReceivedQuantity: 0, currentReceivedQuantity: 20, batchSerialNumber: "LG-0826", inspectionRequired: true, acceptedQuantity: 0, rejectedQuantity: 0, onHoldQuantity: 0, inspectionResult: "PENDING", rejectionReason: "", qualityRemarks: "", warehouse: "Main Stores", binLocation: "" },
    ],
  },
  {
    id: "GRN-0022", grnNumber: "GRN/2026-27/0022", gateEntryId: "GE-0023", gateEntryNumber: "GE/2026-27/0023", poId: "PO-DRAFT-SUP-001", poNumber: "PO/2026/0289", supplierName: "Nova Industrial Supply", supplierCode: "SUP-001", receiptType: "REGULAR_PURCHASE", customerId: null, customerName: "", customerPlantCode: "", receiptDate: "2026-08-22", supplierInvoiceNumber: "NIS/INV/776", supplierInvoiceDate: "2026-08-21", deliveryChallanNumber: "NIS/DC/381", attachmentName: "nova-invoice-776.pdf", receivedBy: "Quality User", stockPostingDate: "", remarks: "One item partly rejected.", status: "READY_FOR_STOCK",
    items: [{ id: 1, itemCode: "ITM-TF-015", itemName: "Cutting Inserts", specification: "CNMG carbide inserts", uom: "Nos", orderedQuantity: 100, previouslyReceivedQuantity: 0, currentReceivedQuantity: 100, batchSerialNumber: "CI-776", inspectionRequired: true, acceptedQuantity: 96, rejectedQuantity: 4, onHoldQuantity: 0, inspectionResult: "PARTIAL", rejectionReason: "Four inserts have chipped edges", qualityRemarks: "Accepted quantity may be stocked.", warehouse: "Main Stores", binLocation: "" }],
  },
  {
    id: "GRN-0021", grnNumber: "GRN/2026-27/0021", gateEntryId: "GE-0022", gateEntryNumber: "GE/2026-27/0022", poId: "PO-DRAFT-SUP-005", poNumber: "PO/2026/0284", supplierName: "Bharat Electricals", supplierCode: "SUP-005", receiptType: "REGULAR_PURCHASE", customerId: null, customerName: "", customerPlantCode: "", receiptDate: "2026-08-21", supplierInvoiceNumber: "BE/INV/2418", supplierInvoiceDate: "2026-08-20", deliveryChallanNumber: "BE/DC/118", attachmentName: "bharat-invoice-2418.pdf", receivedBy: "Stores User", stockPostingDate: "2026-08-22", remarks: "Stock posting completed.", status: "STOCK_POSTED",
    items: [{ id: 1, itemCode: "ITM-EC-031", itemName: "Power Cable", specification: "4 sq.mm copper flexible cable", uom: "Mtr", orderedQuantity: 200, previouslyReceivedQuantity: 0, currentReceivedQuantity: 200, batchSerialNumber: "PC-2418", inspectionRequired: false, acceptedQuantity: 200, rejectedQuantity: 0, onHoldQuantity: 0, inspectionResult: "ACCEPTED", rejectionReason: "", qualityRemarks: "Inspection not required.", warehouse: "Main Stores", binLocation: "ELEC-A-04" }],
  },
];

export const loadGrnRecords = (): GrnRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as GrnRecord[] : [];
  } catch {
    return [];
  }
};

export const saveGrnRecord = (record: GrnRecord) => {
  const current = loadGrnRecords();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...current.filter((entry) => entry.id !== record.id)]));
  if (record.status === "DRAFT") return;
  updateGateEntryStatus(record.gateEntryId, record.status === "STOCK_POSTED" ? "STOCK_POSTED" : "GRN_CREATED");
};

export const findGrnByGateEntry = (gateEntryId: string) => loadGrnRecords().find((record) => record.gateEntryId === gateEntryId);

export const createGrnNumber = () => {
  const next = loadGrnRecords().reduce((maximum, record) => {
    const parts = record.grnNumber.split("/");
    return Math.max(maximum, Number(parts[parts.length - 1]) || 0);
  }, 0) + 1;
  return `GRN/2026-27/${String(next).padStart(4, "0")}`;
};

export const createGrnDraft = (gateEntry: GateEntryRecord, po?: PurchaseOrderApprovalRecord): GrnRecord => {
  const grnNumber = createGrnNumber();
  const sourceItems = po?.lines.length ? po.lines.map((line) => ({ itemCode: line.itemCode, itemName: line.itemName, specification: line.specification, uom: line.uom, quantity: line.quantity })) : Array.from({ length: Math.max(1, gateEntry.itemCount) }, (_, index) => ({ itemCode: `ITEM-${String(index + 1).padStart(3, "0")}`, itemName: `Received Item ${index + 1}`, specification: "Refer approved purchase order", uom: "Nos", quantity: Math.max(1, Math.round(gateEntry.totalQuantity / Math.max(1, gateEntry.itemCount))) }));
  return {
    id: grnNumber.split("/").join("-"), grnNumber, gateEntryId: gateEntry.id, gateEntryNumber: gateEntry.gateEntryNumber, poId: gateEntry.poId, poNumber: gateEntry.poNumber, supplierName: gateEntry.supplierName, supplierCode: gateEntry.supplierCode, receiptType: "REGULAR_PURCHASE", customerId: null, customerName: "", customerPlantCode: "", receiptDate: todayInAppTimeZone(), supplierInvoiceNumber: "", supplierInvoiceDate: "", deliveryChallanNumber: "", attachmentName: "", receivedBy: "Stores User", stockPostingDate: "", remarks: "", status: "DRAFT",
    items: sourceItems.map((item, index) => ({ id: index + 1, itemCode: item.itemCode, itemName: item.itemName, specification: item.specification, uom: item.uom, orderedQuantity: item.quantity, previouslyReceivedQuantity: 0, currentReceivedQuantity: 0, batchSerialNumber: "", inspectionRequired: true, acceptedQuantity: 0, rejectedQuantity: 0, onHoldQuantity: 0, inspectionResult: "PENDING", rejectionReason: "", qualityRemarks: "", warehouse: "Main Stores", binLocation: "" })),
  };
};
