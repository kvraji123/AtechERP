import { api } from "./client";

export const toolingApi = {
  dashboard: () => api.get("/tooling/dashboard").then((response) => response.data),
  lookups: () => api.get("/tooling/lookups").then((response) => response.data),
  issuedReturnOptions: (itemId: number) => api.get("/tooling/issued-return-options", { params: { itemId } }).then((response) => response.data),
  items: (params: Record<string, string | number | boolean> = {}) => api.get("/tooling/items", { params }).then((response) => response.data),
  movements: (params: Record<string, string | number> = {}) => api.get("/tooling/movements", { params }).then((response) => response.data),
  issuedTools: (params: Record<string, string | number> = {}) => api.get("/tooling/issued-tools", { params }).then((response) => response.data),
  regrindBatches: () => api.get("/tooling/regrind-batches").then((response) => response.data),
  regrindBatch: (batchId: number) => api.get(`/tooling/regrind-batches/${batchId}`).then((response) => response.data),
  issue: (body: unknown) => api.post("/tooling/issue", body).then((response) => response.data),
  returnFromProduction: (body: unknown) => api.post("/tooling/return", body).then((response) => response.data),
  dispatchRegrind: (body: unknown) => api.post("/tooling/regrind-batches", body).then((response) => response.data),
  receiveRegrind: (batchId: number, body: unknown) => api.post(`/tooling/regrind-batches/${batchId}/receive`, body).then((response) => response.data),
  inspectRegrind: (batchId: number, body: unknown) => api.post(`/tooling/regrind-batches/${batchId}/inspect`, body).then((response) => response.data),
};
