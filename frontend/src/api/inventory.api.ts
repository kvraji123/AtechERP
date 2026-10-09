import { api } from "./client";

export type InventoryFilters = {
  search?: string;
  warehouse?: string;
  binLocation?: string;
  ownerType?: "COMPANY" | "CUSTOMER";
  page?: number;
  pageSize?: number;
  limit?: number;
};

export type InventoryDashboard = {
  stockLineCount: number;
  itemCount: number;
  quantityOnHand: number;
  customerStockLineCount: number;
  customerStockCustomerCount: number;
  customerStockQuantity: number;
  customerWipQuantity: number;
  outsourcingWipLineCount: number;
  outsourcingWipQuantity: number;
  qualityHoldLineCount: number;
  qualityHoldQuantity: number;
  rejectionInventoryLineCount: number;
  rejectionInventoryQuantity: number;
  reorderAlertCount: number;
  lastTransactionDate: string | null;
};

export const inventoryApi = {
  dashboard: () => api.get("/inventory/dashboard").then((response) => response.data),
  stock: (params: InventoryFilters = {}) => api.get("/inventory/stock", { params }).then((response) => response.data),
  transactions: (params: InventoryFilters = {}) => api.get("/inventory/transactions", { params }).then((response) => response.data),
  qualityHold: (params: Pick<InventoryFilters, "limit" | "page" | "pageSize"> = {}) => api.get("/inventory/quality-hold", { params }).then((response) => response.data),
  outsourcingWip: (params: InventoryFilters & { status?: string } = {}) => api.get("/inventory/outsourcing-wip", { params }).then((response) => response.data),
  rejectionInventory: (params: InventoryFilters & { status?: string } = {}) => api.get("/inventory/rejection-inventory", { params }).then((response) => response.data),
  customerStock: (params: InventoryFilters = {}) => api.get("/inventory/customer-stock", { params }).then((response) => response.data),
  customerReturnDocuments: (params: InventoryFilters & { status?: string } = {}) => api.get("/inventory/return-to-customer", { params }).then((response) => response.data),
  issueCustomerMaterialToJob: (body: { stockBalanceId: number; enquiryId?: number | null; jobReference: string; quantity: number; transactionDate: string; referenceNumber?: string; remarks: string }) => api.post("/inventory/customer-material-jobs/issue", body).then((response) => response.data),
  returnCustomerMaterialFromJob: (body: { customerMaterialJobBalanceId: number; quantity: number; transactionDate: string; referenceNumber?: string; remarks: string }) => api.post("/inventory/customer-material-jobs/return", body).then((response) => response.data),
  consumeCustomerMaterialForJob: (body: { customerMaterialJobBalanceId: number; quantity: number; transactionDate: string; referenceNumber?: string; remarks: string }) => api.post("/inventory/customer-material-jobs/consume", body).then((response) => response.data),
  createReturnToCustomerDocument: (body: { returnDate: string; dispatchReference?: string; transportMode: string; transportReference?: string; remarks: string; items: Array<{ balanceId: number; quantity: number }> }) => api.post("/inventory/return-to-customer", body).then((response) => response.data),
  approveReturnToCustomerDocument: (documentId: string | number, body: { approvalRemarks?: string }) => api.post(`/inventory/return-to-customer/${documentId}/approve`, body).then((response) => response.data),
  acknowledgeReturnToCustomerDocument: (documentId: string | number, body: { customerContact: string; acknowledgementReference: string }) => api.post(`/inventory/return-to-customer/${documentId}/acknowledge`, body).then((response) => response.data),
  dispatchReturnToCustomerDocument: (documentId: string | number, body: { gateExitReference: string }) => api.post(`/inventory/return-to-customer/${documentId}/dispatch`, body).then((response) => response.data),
  resolveRejectionInventory: (balanceId: string | number, body: { action: string; quantity: number; remarks: string; warehouseCode?: string; binLocation?: string; returnDate?: string; dispatchReference?: string; transportMode?: string; transportReference?: string; actionReference?: string }) => api.post(`/inventory/rejection-inventory/${balanceId}/resolve`, body).then((response) => response.data),
  approveReturnToVendor: (rtvDocumentId: string | number, body: { approvalRemarks?: string }) => api.post(`/inventory/return-to-vendor/${rtvDocumentId}/approve`, body).then((response) => response.data),
  acknowledgeReturnToVendor: (rtvDocumentId: string | number, body: { supplierContact: string; acknowledgementReference: string }) => api.post(`/inventory/return-to-vendor/${rtvDocumentId}/acknowledge`, body).then((response) => response.data),
  dispatchReturnToVendor: (rtvDocumentId: string | number) => api.post(`/inventory/return-to-vendor/${rtvDocumentId}/dispatch`).then((response) => response.data),
  approveRejectionResolution: (requestId: string | number, body: { approvalRemarks?: string }) => api.post(`/inventory/rejection-resolutions/${requestId}/approve`, body).then((response) => response.data),
  acknowledgeReturnToCustomer: (requestId: string | number, body: { partyContact: string; acknowledgementReference: string }) => api.post(`/inventory/rejection-resolutions/${requestId}/acknowledge-customer`, body).then((response) => response.data),
  executeRejectionResolution: (requestId: string | number, body: { executionReference?: string }) => api.post(`/inventory/rejection-resolutions/${requestId}/execute`, body).then((response) => response.data),
  completeRework: (reworkBalanceId: string | number, body: { remarks: string }) => api.post(`/inventory/rework-balances/${reworkBalanceId}/complete`, body).then((response) => response.data),
  reinspectRework: (reworkBalanceId: string | number, body: { decision: string; acceptedQuantity: number; rejectedQuantity: number; qualityRemarks: string; rejectionReason?: string }) => api.post(`/inventory/rework-balances/${reworkBalanceId}/reinspect`, body).then((response) => response.data),
  postReworkedStock: (reworkBalanceId: string | number, body: { stockPostingDate: string; warehouseCode: string; binLocation: string; batchSerialNumber?: string }) => api.post(`/inventory/rework-balances/${reworkBalanceId}/post`, body).then((response) => response.data),
  reorderAlerts: (params: Pick<InventoryFilters, "limit" | "page" | "pageSize"> = {}) => api.get("/inventory/reorder-alerts", { params }).then((response) => response.data),
};
