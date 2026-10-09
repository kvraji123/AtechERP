import { api } from "./client";

export type SupplierListParams = {
  search?: string;
  activeFlag?: "Y" | "N" | "";
  page?: number;
  pageSize?: number;
};

export const supplierApi = {
  list: (params: SupplierListParams = {}) =>
    api.get("/suppliers", { params }).then((response) => response.data),

  getById: (supplierId: number) =>
    api.get(`/suppliers/${supplierId}`).then((response) => response.data),

  create: (body: unknown) =>
    api.post("/suppliers", body).then((response) => response.data),

  update: (supplierId: number, body: unknown) =>
    api.put(`/suppliers/${supplierId}`, body).then((response) => response.data),

  changeStatus: (supplierId: number, supplierStatus: "ACTIVE" | "INACTIVE") =>
    api
      .patch(`/suppliers/${supplierId}/status`, { supplierStatus })
      .then((response) => response.data),
};
