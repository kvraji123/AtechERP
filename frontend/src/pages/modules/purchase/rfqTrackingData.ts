import type { SupplierRfqItem } from "./components/SupplierRfqPreviewDialog";

// API view model for supplier-wise RFQ tracking.  It intentionally contains no
// browser storage or demo records; all state originates from purchase RFQ APIs.
export type RfqTrackingStatus = "AWAITING_RESPONSE" | "PARTIAL_RESPONSE" | "QUOTES_RECEIVED" | "OVERDUE";

export type RfqTrackingRecord = {
  id: string;
  enquiryId: number;
  supplierId: number;
  rfqNumber: string;
  revision: string;
  enquiryNumber: string;
  prNumbers: string;
  supplierName: string;
  supplierCode: string;
  supplierEmail?: string | null;
  itemCount: number;
  itemSummary: string;
  items: SupplierRfqItem[];
  sentDate: string;
  dueDate: string;
  response: string;
  status: RfqTrackingStatus;
  subject?: string | null;
  deliveryRequiredBy?: string | null;
  deliveryLocation?: string | null;
  commercialTerms?: string | null;
  notes?: string | null;
  supplierQuotationId?: number | null;
  supplierQuotationNumber?: string | null;
  quotationStatus?: string | null;
  quotationReceivedOn?: string | null;
  emailJobStatus?: string | null;
  emailQueuedAt?: string | null;
  emailCompletedAt?: string | null;
  emailLastError?: string | null;
  lastUpdatedAt?: string | null;
};
