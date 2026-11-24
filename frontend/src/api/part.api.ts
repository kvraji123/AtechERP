import { api } from "./client";
import type { OnlyOfficeEditorConfig } from "../components/OnlyOfficeToolListEditor";

export type PartListParams = {
  search?: string;
  customerId?: number;
  activeFlag?: "Y" | "N" | "";
  partStatus?: "ACTIVE" | "INACTIVE" | "DRAWING_UNDER_REVISION" | "";
  saveStatus?: "DRAFT" | "SUBMITTED" | "";
  includeDraft?: boolean;
  page?: number;
  pageSize?: number;
};

export type BomSearchOption = {
  componentType: "PART" | "ITEM";
  componentId: number;
  componentCode: string;
  componentDescription: string;
  uomId: number | null;
  uomCode: string;
};

export type ProcessMasters = {
  operations: Array<{ operationMasterId:number; operationCode:string; operationName:string; defaultSource:"INHOUSE"|"OUTSOURCE"; sourceName:string; costingMode:"INHOUSE"|"OUTSOURCE" }>;
  sources: Array<{ sourceCode:"INHOUSE"|"OUTSOURCE"; sourceName:string; costingMode:"INHOUSE"|"OUTSOURCE" }>;
  machineTypes: Array<{ machineTypeId:number; machineTypeCode:string; machineTypeName:string; hourlyCostInr:number }>;
  characteristics: Array<{ characteristicMasterId:number; characteristicCode:string; characteristicName:string; characteristicType:"VARIABLE"|"ATTRIBUTE" }>;
  instruments: Array<{ instrumentMasterId:number; instrumentCode:string; instrumentName:string }>;
  toleranceGrades: Array<{ toleranceGradeId:number; gradeCode:string; basicSizeFrom:number; basicSizeTo:number; lowerDeviationMicrons:number; upperDeviationMicrons:number }>;
  toleranceStandards: Array<{ toleranceStandardId:number; standardCode:string; standardName:string }>;
  toleranceStandardBands: Array<{ toleranceStandardBandId:number; toleranceStandardId:number; characteristicType:string; rangeLabel:string; nominalFrom:number|null; nominalTo:number|null; minimumInclusive:"Y"|"N"; maximumInclusive:"Y"|"N"; toleranceMinusMm:number|null; tolerancePlusMm:number|null; toleranceDisplay:string }>;
  sampleSizes: Array<{ value:string; label:string }>;
  frequencies: Array<{ value:string; label:string }>;
};

export type ToolListEditorResponse = {
  enabled: boolean;
  message?: string;
  documentServerUrl?: string;
  config?: OnlyOfficeEditorConfig;
};

export const partApi = {
  list: (params: PartListParams = {}) =>
    api.get("/parts", { params }).then((response) => response.data),

  getById: (partId: number) =>
    api.get(`/parts/${partId}`).then((response) => response.data),

  getBomHierarchy: (partId: number) =>
    api.get(`/parts/${partId}/bom-hierarchy`).then((response) => response.data),

  searchBomOptions: (params: { search?: string; excludePartId?: number } = {}) =>
    api.get("/parts/bom-options/search", { params }).then((response) => response.data),

  getProcessMasters: () =>
    api.get("/parts/process-masters").then((response) => response.data),

  createToolList: (processDefinitionId: number) =>
    api.post(`/parts/process-definitions/${processDefinitionId}/tool-list`).then((response) => response.data),

  getToolListEditorConfig: (processDefinitionId: number) =>
    api.get(`/parts/process-definitions/${processDefinitionId}/tool-list/editor-config`).then((response) => response.data),

  create: (body: unknown) =>
    api.post("/parts", body).then((response) => response.data),

  update: (partId: number, body: unknown) =>
    api.put(`/parts/${partId}`, body).then((response) => response.data),

  cloneForRevision: (partId: number, body: {
    partNumber: string;
    drawingNumber?: string | null;
    drawingRevisionNumber: string;
    drawingRevisionDate?: string | null;
  }) => api.post(`/parts/${partId}/clone-revision`, body).then((response) => response.data),

  releaseRevisionBom: (partId: number) =>
    api.patch(`/parts/${partId}/revision-bom-release`).then((response) => response.data),

  changeStatus: (partId: number, partStatus: "ACTIVE" | "INACTIVE") =>
    api
      .patch(`/parts/${partId}/status`, { partStatus })
      .then((response) => response.data),
};
