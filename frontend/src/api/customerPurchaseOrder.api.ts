import { api } from "./client";

export type CustomerPurchaseOrderItem = {
  id?: number;
  quotationItemId: number;
  enquiryPartId: number;
  lineNumber: number;
  itemCode?: string | null;
  drawingNumber: string;
  revisionNumber?: string | null;
  description: string;
  material?: string | null;
  unitOfMeasurement?: string | null;
  requiredQuantity: number | string;
  availableQuantity?: number | string;
  orderedQuantity: number | string;
  convertedQuantity?: number | string;
  unitPrice: number | string;
  developmentCost: number | string;
  lineTotalAmount: number | string;
  lineStatus?: string;
};

export type CustomerPurchaseOrderSource = {
  enquiryId: number;
  docNo: string;
  customerId: number;
  customerCode?: string | null;
  customerName: string;
  orderType: string;
  requiredDate?: string | null;
  enquiryStatus: string;
  quotationId: number;
  quotationNo: string;
  currencyCode: string;
  items: CustomerPurchaseOrderItem[];
};

export type CustomerPurchaseOrder = {
  id: number;
  cpoNumber: string;
  financialYear?: string;
  customerPoNumber?: string | null;
  customerPoDate?: string | null;
  enquiryId: number;
  enquiryDocNo: string;
  quotationId: number;
  quotationNo: string;
  customerId: number;
  customerCode?: string | null;
  customerName: string;
  orderType: string;
  currencyCode: string;
  requiredDeliveryDate?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  attachmentReference?: string | null;
  remarks?: string | null;
  subtotalAmount: number | string;
  developmentCostAmount: number | string;
  grandTotalAmount: number | string;
  status: string;
  confirmedBy?: string | null;
  confirmedOn?: string | null;
  createdOn?: string | null;
  updatedOn?: string | null;
  items: CustomerPurchaseOrderItem[];
  salesOrders?: SalesOrder[];
};

export type CustomerPurchaseOrderListRow = Omit<CustomerPurchaseOrder, "items" | "salesOrders"> & {
  itemCount: number | string;
};

export type SalesOrder = {
  id: number;
  salesOrderNumber: string;
  salesOrderDate: string;
  customerPurchaseOrderId: number;
  cpoNumber: string;
  customerPoNumber?: string | null;
  enquiryDocNo: string;
  customerName: string;
  orderType: string;
  currencyCode: string;
  grandTotalAmount: number | string;
  status: string;
  createdOn?: string;
};

export type CustomerPurchaseOrderPayload = {
  enquiryId: number;
  customerPoNumber?: string | null;
  customerPoDate?: string | null;
  requiredDeliveryDate?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  attachmentReference?: string | null;
  remarks?: string | null;
  items: Array<{ quotationItemId: number; orderedQuantity: number }>;
};

export const customerPurchaseOrderApi = {
  listEligibleEnquiries: () =>
    api.get("/customer-purchase-orders/eligible-enquiries").then((response) => response.data),
  getEnquirySource: (enquiryId: string | number) =>
    api.get(`/customer-purchase-orders/enquiry-source/${enquiryId}`).then((response) => response.data),
  list: (params: Record<string, string | number> = {}) =>
    api.get("/customer-purchase-orders", { params }).then((response) => response.data),
  get: (id: string | number) =>
    api.get(`/customer-purchase-orders/${id}`).then((response) => response.data),
  create: (body: CustomerPurchaseOrderPayload) =>
    api.post("/customer-purchase-orders", body).then((response) => response.data),
  update: (id: string | number, body: CustomerPurchaseOrderPayload) =>
    api.put(`/customer-purchase-orders/${id}`, body).then((response) => response.data),
  confirm: (id: string | number) =>
    api.post(`/customer-purchase-orders/${id}/confirm`).then((response) => response.data),
  convertToSalesOrder: (id: string | number) =>
    api.post(`/customer-purchase-orders/${id}/convert-to-sales-order`, {}).then((response) => response.data),
  listSalesOrders: (params: Record<string, string | number> = {}) =>
    api.get("/customer-purchase-orders/sales-orders", { params }).then((response) => response.data),
};
