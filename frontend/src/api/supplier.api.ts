import { api } from "./client";

export type SupplierListParams = {
  search?: string;
  activeFlag?: "Y" | "N" | "";
  saveStatus?: "DRAFT" | "SUBMITTED" | "";
  includeDraft?: boolean;
  page?: number;
  pageSize?: number;
};

export type SupplierLookupOption = {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  supplierCategory?: string | null;
};

export const supplierApi = {
  list: (params: SupplierListParams = {}) =>
    api.get("/suppliers", { params }).then((response) => response.data),

  lookup: (search: string) =>
    api.get("/suppliers/lookup", { params: { search } }).then((response) => response.data),

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

  hardDelete: (supplierId: number) =>
    api.delete(`/suppliers/${supplierId}`).then((response) => response.data),

};
