import { api } from "./client";

export type InProcessProductionInput = {
  workOrderReference: string;
  batchReference?: string;
  partId: number;
  processPlanId: number;
  processOperationId: number;
  quantity: number;
};

export const inProcessInspectionApi = {
  parts: () => api.get("/in-process-inspection/parts").then((response) => response.data),
  processPlans: (partId: number) => api.get(`/in-process-inspection/parts/${partId}/process-plans`).then((response) => response.data),
  dashboard: () => api.get("/in-process-inspection/dashboard").then((response) => response.data),
  reportProduction: (body: InProcessProductionInput) => api.post("/in-process-inspection/production", body).then((response) => response.data),
  selectSamples: (requirementId: number, pieceIds: number[]) => api.post(`/in-process-inspection/requirements/${requirementId}/select-samples`, { pieceIds }).then((response) => response.data),
  completeInspection: (requirementId: number, body: { samples: Array<{ sampleId: number; actualValue: string; inspectionDate?: string; inspectionResult: "PASS" | "FAIL"; remarks?: string }>; failureRemarks?: string }) =>
    api.post(`/in-process-inspection/requirements/${requirementId}/complete`, body).then((response) => response.data),
  completeInspections: (body: { inspections: Array<{ requirementId: number; samples: Array<{ sampleId: number; actualValue: string; inspectionDate?: string; inspectionResult: "PASS" | "FAIL"; remarks?: string }>; failureRemarks?: string }> }) =>
    api.post("/in-process-inspection/requirements/complete-all", body).then((response) => response.data),
};
