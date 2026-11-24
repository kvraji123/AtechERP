import { api } from "./client";

export type LocationMasterRow = {
  locationMasterId: number;
  warehouseName: string;
  subinventoryCode: string;
  locationName: string;
  activeFlag: "Y" | "N";
  lastUpdated?: string | null;
};

export type LocationMasterListParams = {
  search?: string;
  status?: "Y" | "N" | "";
  page?: number;
  pageSize?: number;
};

export const locationMasterApi = {
  list: (params: LocationMasterListParams = {}) =>
    api.get("/location-masters", { params }).then((response) => response.data),
  warehouses: () => api.get("/location-masters/warehouses").then((response) => response.data),
  subinventories: () => api.get("/location-masters/subinventories").then((response) => response.data),
  create: (body: Pick<LocationMasterRow, "warehouseName" | "subinventoryCode" | "locationName" | "activeFlag">) =>
    api.post("/location-masters", body).then((response) => response.data),
  update: (locationMasterId: number, body: Pick<LocationMasterRow, "warehouseName" | "subinventoryCode" | "locationName" | "activeFlag">) =>
    api.put(`/location-masters/${locationMasterId}`, body).then((response) => response.data),
};

export async function listAllActiveLocationMasters(): Promise<LocationMasterRow[]> {
  const firstPage = await locationMasterApi.list({ status: "Y", page: 1, pageSize: 100 });
  const firstRows = firstPage?.data || [];
  const total = Number(firstPage?.meta?.total || firstRows.length);
  const remainingPages = Array.from({ length: Math.ceil(total / 100) - 1 }, (_, index) => index + 2);
  const remainingResponses = await Promise.all(remainingPages.map((page) => locationMasterApi.list({ status: "Y", page, pageSize: 100 })));
  return [...firstRows, ...remainingResponses.flatMap((response) => response?.data || [])];
}
