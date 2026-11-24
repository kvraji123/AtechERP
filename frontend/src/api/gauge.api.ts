import { api } from "./client";

export type GaugeListParams = {
  search?: string;
  gaugeId?: string;
  instrument?: string;
  grnNumber?: string;
  calibrationDueDate?: string;
  location?: string;
  operationalStatus?: string;
  /** Physical workflow state, independent of the computed display status. */
  lifecycleStatus?: string;
  calibrationCondition?: string;
  page?: number;
  pageSize?: number;
};

export const gaugeApi = {
  lookups: () => api.get("/gauges/lookups").then((response) => response.data),
  alerts: () => api.get("/gauges/alerts").then((response) => response.data),
  calibrationWorkflowSummary: () => api.get("/gauges/calibration-workflow-summary").then((response) => response.data),
  list: (params: GaugeListParams = {}) => api.get("/gauges", { params }).then((response) => response.data),
  getById: (gaugeMasterId: number) => api.get(`/gauges/${gaugeMasterId}`).then((response) => response.data),
  register: (body: unknown) => api.post("/gauges/register", body).then((response) => response.data),
  update: (gaugeMasterId: number, body: unknown) => api.put(`/gauges/${gaugeMasterId}`, body).then((response) => response.data),
  issue: (gaugeMasterId: number, body: unknown) => api.post(`/gauges/${gaugeMasterId}/issue`, body).then((response) => response.data),
  returnGauge: (gaugeMasterId: number, body: unknown) => api.post(`/gauges/${gaugeMasterId}/return`, body).then((response) => response.data),
  retire: (gaugeMasterId: number, body: unknown = {}) => api.post(`/gauges/${gaugeMasterId}/retire`, body).then((response) => response.data),
  bulkIssue: (body: unknown) => api.post("/gauges/bulk/issue", body).then((response) => response.data),
  bulkReturn: (body: unknown) => api.post("/gauges/bulk/return", body).then((response) => response.data),
  bulkCollectForCalibration: (body: unknown) => api.post("/gauges/bulk/collect-for-calibration", body).then((response) => response.data),
  calibrationDispatchLookups: () => api.get("/gauges/calibration-dispatches/lookups").then((response) => response.data),
  listCalibrationDispatches: (params: Record<string, string | number> = {}) => api.get("/gauges/calibration-dispatches", { params }).then((response) => response.data),
  createCalibrationDispatch: (body: unknown) => api.post("/gauges/calibration-dispatches", body).then((response) => response.data),
  getCalibrationDispatch: (calibrationDispatchId: number) => api.get(`/gauges/calibration-dispatches/${calibrationDispatchId}`).then((response) => response.data),
  createCalibrationReturnGrn: (calibrationDispatchId: number, body: unknown) => api.post(`/gauges/calibration-dispatches/${calibrationDispatchId}/return-grns`, body).then((response) => response.data),
  collectForCalibration: (gaugeMasterId: number, body: unknown) => api.post(`/gauges/${gaugeMasterId}/collect-for-calibration`, body).then((response) => response.data),
  startCalibration: (gaugeMasterId: number, body: unknown) => api.post(`/gauges/${gaugeMasterId}/start-calibration`, body).then((response) => response.data),
  recordCalibration: (gaugeMasterId: number, body: FormData) => api.post(`/gauges/${gaugeMasterId}/calibrations`, body).then((response) => response.data),
  startService: (gaugeMasterId: number, body: unknown) => api.post(`/gauges/${gaugeMasterId}/start-service`, body).then((response) => response.data),
};
