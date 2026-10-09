export type PurchaseOrderMode = "COMPARISON" | "ENQUIRY" | "DIRECT_PR";

export type PurchaseOrderLine = {
  id: number;
  enquiryNumber: string;
  itemCode: string;
  itemName: string;
  specification: string;
  quantity: number;
  uom: string;
  rate: number;
  taxPercent: number;
  discount?: number;
  freightAndOther?: number;
  sourceItemId?: string;
};

export type PurchaseOrderFormState = {
  mode: PurchaseOrderMode;
  poNumber: string;
  poDate: string;
  supplierName: string;
  sourceReference: string;
  expectedDelivery: string;
  paymentTerms: string;
  transportMode: string;
  billingAddress: string;
  deliveryAddress: string;
  packingCharges?: number;
  freightCharges?: number;
  otherCharges?: number;
  remarks: string;
  specialInstructions: string;
};

export type SupplierPurchaseOrderDraft = {
  id: string;
  supplierId: string;
  supplierCode: string;
  form: PurchaseOrderFormState;
  lines: PurchaseOrderLine[];
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" | "REJECTED";
};

export const initialPurchaseOrderLines: PurchaseOrderLine[] = [
  { id: 1, enquiryNumber: "PE/0024/26-27", itemCode: "ITM-EL-001", itemName: "Servo Motor", specification: "1.5 kW, 3000 RPM with encoder", quantity: 10, uom: "Nos", rate: 12300, taxPercent: 18 },
  { id: 2, enquiryNumber: "PE/0027/26-27", itemCode: "ITM-ME-014", itemName: "Linear Guide", specification: "HGR25CA, 1000 mm rail", quantity: 20, uom: "Nos", rate: 4050, taxPercent: 18 },
];
