export type RequisitionType = "NEW_ITEM" | "EXISTING_ITEM";

export type PurchaseRequestDetailsState = {
  prNumber: string;
  requestedBy: string;
  department: string;
  requisitionType: RequisitionType;
  priority: "LOW" | "MEDIUM" | "HIGH";
  requestDate: string;
  requiredDate: string;
  preferredSupplier: string;
  remarks: string;
  quoteReference: string;
};

export type PurchaseRequestLine = {
  id: number;
  purchaseRequestItemId?: number;
  clarificationReason?: string;
  editable?: boolean;
  itemId?: number;
  itemCode?: string;
  itemGroup: string;
  itemType: string;
  itemDescription: string;
  specification: string;
  quantity: string;
  uom: string;
  ratePerQty: string;
  taxPercent: string;
  hsnCode: string;
  purpose: string;
  attachment: string;
  attachmentId?: number;
  attachmentUrl?: string;
  attachmentFile?: File | null;
};

export type SupplierQuote = {
  supplierId: string;
  supplierName: string;
  price: number | null;
  attachmentName?: string;
  attachmentUrl?: string;
};

export type PurchaseEnquiryLine = {
  id: number;
  prNumber: string;
  itemCode: string;
  itemName: string;
  itemDescription: string;
  quantity: number;
  uom: string;
  requisitionType: "New Item" | "Existing Item";
  enquiryRequired: boolean;
  selected: boolean;
  selectedSupplierIds: string[];
  enquiryStatus: "Ready" | "Sent" | "Not Required";
  quotes: SupplierQuote[];
  lastUpdatedAt?: string | null;
};

export type SupplierOption = {
  id: string;
  name: string;
  code: string;
  rating: number;
  leadTime: string;
};

export type PurchaseApprovalRequest = {
  id: string;
  prNumber: string;
  plant: string;
  department: string;
  requestedBy: string;
  submittedDate: string;
  submittedTime: string;
  itemCount: number;
  requiredDate: string;
  amount: number;
  preferredSupplier?: {
    code: string;
    name: string;
  };
  preferredSupplierId?: string;
  priority: "Low" | "Medium" | "High";
  status: "Pending" | "Returned" | "Approved" | "Partially Approved" | "Rejected";
  requisitionType: "New Item" | "Existing Item";
  lastUpdatedAt?: string | null;
};
