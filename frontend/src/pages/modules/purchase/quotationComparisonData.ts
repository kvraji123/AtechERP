// Shared view-model types for the backend quotation-comparison response.
export type QuotationComparisonSupplier = {
  supplierId: string;
  supplierQuotationItemId?: number;
  supplierQuotationId?: number;
  supplierName: string;
  supplierCode: string;
  baseAmount: number;
  discount: number;
  tax: number;
  freightAndOther: number;
  landedCost: number;
  deliveryDays: number;
  deliveryNote: string;
  paymentTerms: string;
  rating: number;
  score: number;
  isL1?: boolean;
  isRecommended?: boolean;
  isSelected?: boolean;
};

export type QuotationComparisonItem = {
  id: string;
  purchaseEnquiryItemId?: number;
  prNumber: string;
  priority: "Low" | "Medium" | "High";
  lineNumber: number;
  itemName: string;
  itemCode: string;
  specification: string;
  quantity: number;
  uom: string;
  requiredDate: string;
  approvalStatus?: string;
  quotations: QuotationComparisonSupplier[];
};

// Comparisons are fetched from purchase-quote-comparisons; no local demo rows.
export const quotationComparisonItems: QuotationComparisonItem[] = [];
