import { api } from "./client";

export type TechnicalMasterKind = "operations"|"instruments"|"tolerance-grades"|"rejection-reasons"|"rejection-dispositions";
export type OperationSourceOption = { sourceCode:string; sourceName:string;
  costingMode:"INHOUSE"|"OUTSOURCE"; displayOrder:number; activeFlag:"Y"|"N" };

export const technicalMasterApi = {
  listSources: (includeInactive = false) => api.get("/technical-masters/operation-sources",
    { params:{ includeInactive } }).then((response) => response.data),
  list: (kind:TechnicalMasterKind,params:{ search?:string; status?:string; page?:number; pageSize?:number } = {}) =>
    api.get(`/technical-masters/${kind}`,{ params }).then((response) => response.data),
  create: (kind:TechnicalMasterKind,body:unknown) =>
    api.post(`/technical-masters/${kind}`,body).then((response) => response.data),
  update: (kind:TechnicalMasterKind,id:number,body:unknown) =>
    api.put(`/technical-masters/${kind}/${id}`,body).then((response) => response.data),
};
