import { api } from "./client";

export type InventoryControlDestination = {
  destinationWarehouseCode: string;
  destinationSubinventoryCode: string;
  destinationBinLocation: string;
  destinationStockStatus: string;
};

export const inventoryControlApi = {
  lookups: () => api.get("/inventory/control/lookups").then((response) => response.data),
  balances: (params: { search?: string; ownerType?: string; workOrderReference?: string; limit?: number } = {}) =>
    api.get("/inventory/control/balances", { params }).then((response) => response.data),
  rejections: (params: { status?: string; limit?: number } = {}) =>
    api.get("/inventory/control/rejections", { params }).then((response) => response.data),
  transfer: (body: { sourceBalanceId: number; quantity: number; movementDate: string; referenceNumber?: string; remarks: string } & InventoryControlDestination) =>
    api.post("/inventory/control/transfers", body).then((response) => response.data),
  issueToProduction: (body: { sourceBalanceId: number; quantity: number; movementDate: string; workOrderReference: string; referenceNumber?: string; remarks: string } & InventoryControlDestination) =>
    api.post("/inventory/control/production-issues", body).then((response) => response.data),
  returnFromProduction: (body: { returnType: "MTR" | "PRR"; sourceBalanceId: number; quantity: number; movementDate: string; workOrderReference: string; referenceNumber?: string; remarks: string } & InventoryControlDestination) =>
    api.post("/inventory/control/production-returns", body).then((response) => response.data),
  releaseQualityHold: (body: { sourceBalanceId: number; quantity: number; movementDate: string; referenceNumber?: string; remarks: string } & InventoryControlDestination) =>
    api.post("/inventory/control/quality-releases", body).then((response) => response.data),
  completeProduction: (body: { movementDate: string; workOrderReference: string; referenceNumber?: string; remarks: string; inputLines: Array<{ sourceBalanceId: number; quantity: number }>; finishedGood: { itemId: number; quantity: number; batchSerialNumber?: string; warehouseCode: string; subinventoryCode: string; binLocation: string; stockStatus: string } }) =>
    api.post("/inventory/control/production-completions", body).then((response) => response.data),
  reportRejection: (body: { sourceBalanceId: number; quantity: number; movementDate: string; rejectionType: "MATERIAL" | "PROCESS"; sourceType: string; workOrderReference?: string; operationReference?: string; machineReference?: string; processCardReference?: string; rejectionReportReference?: string; remarks: string } & InventoryControlDestination) =>
    api.post("/inventory/control/rejections", body).then((response) => response.data),
  resolveRejection: (caseId: number, body: { lineId: number; disposition: string; quantity: number; movementDate: string; referenceNumber?: string; remarks: string } & Partial<InventoryControlDestination>) =>
    api.post(`/inventory/control/rejections/${caseId}/resolve`, body).then((response) => response.data),
};
