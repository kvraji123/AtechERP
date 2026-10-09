import { api } from "./client";

export type CustomerListParams = {
  search?: string;
  activeFlag?: "Y" | "N" | "";
  page?: number;
  pageSize?: number;
};

export const customerApi = {
  list: (params: CustomerListParams = {}) =>
    api.get("/customers", { params }).then((response) => response.data),

  getById: (customerId: number) =>
    api.get(`/customers/${customerId}`).then((response) => response.data),

  create: (body: unknown) =>
    api.post("/customers", body).then((response) => response.data),

  update: (customerId: number, body: unknown) =>
    api.put(`/customers/${customerId}`, body).then((response) => response.data),

  changeStatus: (customerId: number, customerStatus: "ACTIVE" | "INACTIVE") =>
    api
      .patch(`/customers/${customerId}/status`, { customerStatus })
      .then((response) => response.data),
};
