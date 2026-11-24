import { api } from "./client";

export type MaterialOutwardType = "FINISHED_GOODS" | "OUTSOURCE_ISSUE" | "CALIBRATION_DISPATCH" | "TOOL_REGRIND";

export type MaterialOutwardLine = {
  stockBalanceId: number;
  quantity: number;
};

export type MaterialOutwardCreateInput = {
  outwardType: MaterialOutwardType;
  outwardDate: string;
  partyId: number;
  transportMode: string;
  transportReference?: string;
  remarks?: string;
  items: MaterialOutwardLine[];
};

export type CalibrationDispatchCreateInput = {
  gaugeMasterIds: number[];
  calibrationAgency: string;
  dispatchDate: string;
  expectedReturnDate: string;
  courierReference?: string;
  dispatchFrom: string;
  remarks?: string;
};

export type ToolRegrindDispatchCreateInput = {
  supplierId: number;
  dispatchDate: string;
  expectedReturnDate?: string;
  courierVehicleReference?: string;
  remarks?: string;
  items: Array<{
    itemId: number;
    quantity: number;
    sourceStockStatus: "AVAILABLE" | "REGRIND_REQUIRED";
  }>;
};

export type MaterialOutwardFilters = {
  search?: string;
  type?: MaterialOutwardType | "";
  status?: "PENDING_APPROVAL" | "APPROVED" | "DISPATCHED" | "";
  page?: number;
  pageSize?: number;
};

export type GateExitCreateInput = {
  materialOutwardDocumentId: number;
  exitDateTime: string;
  vehicleNumber?: string;
  driverName?: string;
  drivingLicenceNumber?: string;
  courierName?: string;
  courierReceiptNumber?: string;
  remarks?: string;
};

export const materialOutwardApi = {
  list: (params: MaterialOutwardFilters = {}) =>
    api.get("/material-outward", { params }).then((response) => response.data),
  get: (documentId: number | string) =>
    api.get(`/material-outward/${documentId}`).then((response) => response.data),
  create: (body: MaterialOutwardCreateInput) =>
    api.post("/material-outward", body).then((response) => response.data),
  createCalibrationDispatch: (body: CalibrationDispatchCreateInput) =>
    api.post("/material-outward/calibration-dispatch", body).then((response) => response.data),
  createToolRegrindDispatch: (body: ToolRegrindDispatchCreateInput) =>
    api.post("/material-outward/tool-regrind-dispatch", body).then((response) => response.data),
  approve: (documentId: number | string, body: { approvalRemarks?: string } = {}) =>
    api.post(`/material-outward/${documentId}/approve`, body).then((response) => response.data),
  gateExitCandidates: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api.get("/material-outward/gate-exits/candidates", { params }).then((response) => response.data),
  listGateExits: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api.get("/material-outward/gate-exits", { params }).then((response) => response.data),
  createGateExit: (body: GateExitCreateInput) =>
    api.post("/material-outward/gate-exits", body).then((response) => response.data),
  outsourceWip: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api.get("/material-outward/outsource-wip", { params }).then((response) => response.data),
};
