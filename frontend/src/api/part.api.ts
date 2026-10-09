import { api } from "./client";

export type PartListParams = {
  search?: string;
  customerId?: number;
  activeFlag?: "Y" | "N" | "";
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
  sampleSizes: Array<{ value:string; label:string }>;
  frequencies: Array<{ value:string; label:string }>;
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

  create: (body: unknown) =>
    api.post("/parts", body).then((response) => response.data),

  update: (partId: number, body: unknown) =>
    api.put(`/parts/${partId}`, body).then((response) => response.data),

  changeStatus: (partId: number, partStatus: "ACTIVE" | "INACTIVE") =>
    api
      .patch(`/parts/${partId}/status`, { partStatus })
      .then((response) => response.data),
};
