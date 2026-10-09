import { api } from "./client";

export type MachineListParams = {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "";
  page?: number;
  pageSize?: number;
};

export const machineApi = {
  list: (params: MachineListParams = {}) =>
    api.get("/machines", { params }).then((response) => response.data),
  lookups: () => api.get("/machines/lookups").then((response) => response.data),
  getById: (machineMasterId: number) =>
    api.get(`/machines/${machineMasterId}`).then((response) => response.data),
  create: (body: unknown) => api.post("/machines", body).then((response) => response.data),
  update: (machineMasterId: number, body: unknown) =>
    api.put(`/machines/${machineMasterId}`, body).then((response) => response.data),
  remove: (machineMasterId: number) =>
    api.delete(`/machines/${machineMasterId}`).then((response) => response.data),
};

