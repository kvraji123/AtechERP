import { api } from "./client";

export type PurchaseRequestPayload = {
  action: "DRAFT" | "SUBMIT";
  requestedBy?: string;
  plantCode?: string;
  department: string;
  requisitionType: "NEW_ITEM" | "EXISTING_ITEM";
  priority: "LOW" | "MEDIUM" | "HIGH";
  requestDate: string;
  requiredDate: string;
  preferredSupplierId?: number | null;
  quoteReference?: string | null;
  remarks?: string | null;
  items: Array<{
    purchaseRequestItemId?: number;
    itemId: number;
    requestedQuantity: number;
    estimatedRatePerQty?: number;
    taxPercent?: number;
    purpose: string;
  }>;
};

export type ApprovalDecisionPayload = {
  reason?: string;
  items: Array<{
    purchaseRequestItemId: number;
    status: "APPROVED" | "NOT_APPROVED" | "CLARIFICATION";
    approvedQuantity?: number | null;
    reason?: string | null;
  }>;
};

export type PurchaseOrderListRow = {
  id: number;
  poNumber: string;
  poDate: string;
  supplierName: string;
  supplierCode: string;
  itemCategory?: string;
  sourceReference: string;
  expectedDeliveryDate: string;
  grandTotalAmount: number | string;
  status: string;
  itemCount: number | string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  lastUpdatedAt?: string | null;
};

export type PurchaseOrderDetail = Record<string, unknown> & {
  purchase_order_id?: number;
  po_number?: string;
  po_date?: string;
  supplier_name_snapshot?: string;
  supplier_code_snapshot?: string;
  source_reference?: string;
  expected_delivery_date?: string;
  grand_total_amount?: number | string;
  status?: string;
  items?: Array<Record<string, unknown>>;
};

export type SupplierAssignmentEligibleItem = {
  purchaseRequestItemId: number;
  purchaseRequestId: number;
  prNumber: string;
  prStatus: string;
  itemId: number;
  itemCode?: string | null;
  itemType?: string | null;
  itemDescription: string;
  itemSpecification?: string | null;
  approvedQuantity: number | string;
  uomCode: string;
  requiredDate?: string | null;
  assignedSupplierIds?: string | null;
  lastUpdatedAt?: string | null;
};

export type RfqPayload = {
  action?: "DRAFT" | "SEND";
  enquiryDate: string;
  quoteDueDate: string;
  subject?: string;
  deliveryRequiredBy?: string;
  deliveryLocation?: string;
  commercialTerms?: string;
  notes?: string;
  items: Array<{ purchaseRequestItemId: number; quantity: number; supplierIds: number[] }>;
};

export type SupplierQuotationPayload = {
  purchaseEnquiryId: number;
  supplierId: number;
  supplierQuotationNumber?: string;
  supplierQuotationDate?: string;
  quotationValidUntil?: string;
  paymentTerms?: string;
  attachmentFileName?: string;
  attachmentFileUrl?: string;
  remarks?: string;
  items: Array<{
    purchaseEnquiryItemId: number;
    quoteResponse: "QUOTED" | "NOT_QUOTED";
    quotedQuantity?: number;
    unitPrice?: number;
    discountAmount?: number;
    taxPercent?: number;
    freightAmount?: number;
    packingAmount?: number;
    otherChargesAmount?: number;
    deliveryLeadDays?: number;
    warrantyMonths?: number;
  }>;
};

export const purchaseApi = {
  createRequisition: (body: PurchaseRequestPayload) =>
    api.post("/purchase-requisitions", body).then((response) => response.data),
  updateRequisition: (id: string | number, body: PurchaseRequestPayload) =>
    api.put(`/purchase-requisitions/${id}`, body).then((response) => response.data),
  listRequisitions: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-requisitions", { params }).then((response) => response.data),
  purchaseRequisitionSummary: () =>
    api.get("/purchase-requisitions/summary").then((response) => response.data),
  getRequisition: (id: string | number) =>
    api.get(`/purchase-requisitions/${id}`).then((response) => response.data),
  listApprovals: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-approvals", { params }).then((response) => response.data),
  getApproval: (id: string | number) =>
    api.get(`/purchase-approvals/${id}`).then((response) => response.data),
  decideApproval: (id: string | number, body: ApprovalDecisionPayload) =>
    api.post(`/purchase-approvals/${id}/decide`, body).then((response) => response.data),
  listPurchaseOrders: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-orders", { params }).then((response) => response.data),
  purchaseOrderSummary: () =>
    api.get("/purchase-orders/summary").then((response) => response.data),
  listPurchaseOrderSuppliers: () =>
    api.get("/purchase-orders/suppliers").then((response) => response.data),
  generatePurchaseOrders: (body: { purchaseRequestItemIds?: number[]; purchaseEnquiryId?: number }) =>
    api.post("/purchase-orders/generate", body).then((response) => response.data),
  getPurchaseOrder: (id: string | number) =>
    api.get(`/purchase-orders/${id}`).then((response) => response.data),
  updatePurchaseOrder: (id: string | number, body: Record<string, unknown>) =>
    api.put(`/purchase-orders/${id}`, body).then((response) => response.data),
  submitPurchaseOrder: (id: string | number) =>
    api.post(`/purchase-orders/${id}/submit`).then((response) => response.data),
  listPurchaseOrderApprovals: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-order-approvals", { params }).then((response) => response.data),
  purchaseOrderApprovalSummary: () =>
    api.get("/purchase-order-approvals/summary").then((response) => response.data),
  getPurchaseOrderApproval: (id: string | number) =>
    api.get(`/purchase-order-approvals/${id}`).then((response) => response.data),
  decidePurchaseOrderApproval: (id: string | number, action: "approve" | "return" | "reject", body: { reason?: string }) =>
    api.post(`/purchase-order-approvals/${id}/${action}`, body).then((response) => response.data),
  listGateEntries: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-gate-entries", { params }).then((response) => response.data),
  gateEntrySummary: () =>
    api.get("/purchase-gate-entries/summary").then((response) => response.data),
  listGateEntrySuppliers: () =>
    api.get("/purchase-gate-entries/suppliers").then((response) => response.data),
  getGateEntry: (id: string | number) =>
    api.get(`/purchase-gate-entries/${id}`).then((response) => response.data),
  listEligibleGateOrders: () =>
    api.get("/purchase-gate-entries/eligible-orders").then((response) => response.data),
  createGateEntry: (body: Record<string, unknown>) =>
    api.post("/purchase-gate-entries", body).then((response) => response.data),
  updateGateEntry: (id: string | number, body: Record<string, unknown>) =>
    api.put(`/purchase-gate-entries/${id}`, body).then((response) => response.data),
  listGrns: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-grns", { params }).then((response) => response.data),
  grnSummary: () =>
    api.get("/purchase-grns/summary").then((response) => response.data),
  listGrnSuppliers: () =>
    api.get("/purchase-grns/suppliers").then((response) => response.data),
  getGrn: (id: string | number) =>
    api.get(`/purchase-grns/${id}`).then((response) => response.data),
  createGrn: (body: Record<string, unknown>) =>
    api.post("/purchase-grns", body).then((response) => response.data),
  updateGrn: (id: string | number, body: Record<string, unknown>) =>
    api.put(`/purchase-grns/${id}`, body).then((response) => response.data),
  inspectGrn: (id: string | number, body: Record<string, unknown>) =>
    api.post(`/purchase-grns/${id}/inspect`, body).then((response) => response.data),
  listGrnRejections: (id: string | number) =>
    api.get(`/purchase-grns/${id}/rejections`).then((response) => response.data),
  uploadGrnRejectionAttachment: (grnId: string | number, grnItemId: string | number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/purchase-grns/${grnId}/items/${grnItemId}/rejection-attachments`, form).then((response) => response.data);
  },
  deleteGrnRejectionAttachment: (grnId: string | number, grnItemId: string | number, attachmentId: string | number) =>
    api.delete(`/purchase-grns/${grnId}/items/${grnItemId}/rejection-attachments/${attachmentId}`).then((response) => response.data),
  postGrn: (id: string | number, body: Record<string, unknown>) =>
    api.post(`/purchase-grns/${id}/post`, body).then((response) => response.data),
  approveGrnPurchase: (id: string | number) =>
    api.post(`/purchase-grns/${id}/approve-purchase`).then((response) => response.data),
  listSupplierAssignmentEligibleItems: () =>
    api.get("/purchase-supplier-assignments/eligible-items").then((response) => response.data),
  saveSupplierAssignments: (body: { assignments: Array<{ purchaseRequestItemId: number; supplierId: number; assignedQuantity: number }> }) =>
    api.post("/purchase-supplier-assignments", body).then((response) => response.data),
  createRfq: (body: RfqPayload) =>
    api.post("/purchase-rfqs", body).then((response) => response.data),
  listRfqs: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-rfqs", { params }).then((response) => response.data),
  sendRfq: (id: string | number) =>
    api.post(`/purchase-rfqs/${id}/send`).then((response) => response.data),
  listRfqTracking: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-rfqs/tracking", { params }).then((response) => response.data),
  rfqTrackingSummary: () =>
    api.get("/purchase-rfqs/tracking/summary").then((response) => response.data),
  listRfqTrackingSuppliers: () =>
    api.get("/purchase-rfqs/tracking/suppliers").then((response) => response.data),
  listRfqEmailOutbox: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-rfqs/email-outbox", { params }).then((response) => response.data),
  retryRfqEmail: (id: string | number) =>
    api.post(`/purchase-rfqs/email-outbox/${id}/retry`).then((response) => response.data),
  getRfq: (id: string | number) =>
    api.get(`/purchase-rfqs/${id}`).then((response) => response.data),
  listRfqDocuments: (id: string | number) =>
    api.get(`/purchase-rfqs/${id}/documents`).then((response) => response.data),
  listSupplierQuotations: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-supplier-quotations", { params }).then((response) => response.data),
  getSupplierQuotation: (id: string | number) =>
    api.get(`/purchase-supplier-quotations/${id}`).then((response) => response.data),
  createSupplierQuotation: (body: SupplierQuotationPayload) =>
    api.post("/purchase-supplier-quotations", body).then((response) => response.data),
  uploadSupplierQuotationAttachment: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/purchase-supplier-quotations/attachments", form).then((response) => response.data);
  },
  listQuoteComparisons: (params: Record<string, string | number> = {}) =>
    api.get("/purchase-quote-comparisons", { params }).then((response) => response.data),
  getQuoteComparison: (enquiryId: string | number) =>
    api.get(`/purchase-quote-comparisons/${enquiryId}`).then((response) => response.data),
  saveQuoteSelections: (enquiryId: string | number, body: { selections: Array<{ purchaseEnquiryItemId: number; supplierQuotationItemId: number; selectedQuantity: number; selectionReason?: string }> }) =>
    api.post(`/purchase-quote-comparisons/${enquiryId}/select`, body).then((response) => response.data),
};
