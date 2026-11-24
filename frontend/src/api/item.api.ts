import { api } from "./client";

export type ItemListParams = {
  search?: string;
  itemGroupId?: number;
  itemTypeId?: number;
  materialId?: number;
  uomId?: number;
  supplierId?: number;
  rateSupplierId?: number;
  inspectionRequired?: "Y" | "N" | "";
  activeFlag?: "Y" | "N" | "";
  page?: number;
  pageSize?: number;
};

export const itemApi = {
  list: (params: ItemListParams = {}) =>
    api.get("/items", { params }).then((response) => response.data),
  lookups: () => api.get("/items/lookups").then((response) => response.data),
  createCategory: (body: { itemGroupId: number; typeName: string; itemCodePrefix: string }) =>
    api.post("/items/categories", body).then((response) => response.data),
  retireCategory: (itemTypeId: number) => api.delete(`/items/categories/${itemTypeId}`).then((response) => response.data),
  addSpecificationOption: (body: { specFieldId: number; optionValue: string }) =>
    api.post("/items/specification-options", body).then((response) => response.data),
  retireSpecificationOption: (body: { specFieldId: number; optionValue: string }) =>
    api.delete("/items/specification-options", { data: body }).then((response) => response.data),
  getById: (itemId: number) => api.get(`/items/${itemId}`).then((response) => response.data),
  create: (body: unknown) => api.post("/items", body).then((response) => response.data),
  bulkUpload: (formData: FormData) => api.post("/items/bulk-upload", formData).then((response) => response.data),
  update: (itemId: number, body: unknown) => api.put(`/items/${itemId}`, body).then((response) => response.data),
  changeStatus: (itemId: number, itemStatus: "ACTIVE" | "INACTIVE" | "OBSOLETE") =>
    api.patch(`/items/${itemId}/status`, { itemStatus }).then((response) => response.data),
  uploadAttachment: (itemId: number, formData: FormData) =>
    api.post(`/items/${itemId}/attachments`, formData).then((response) => response.data),
  deleteAttachment: (itemId: number, attachmentId: number) =>
    api.delete(`/items/${itemId}/attachments/${attachmentId}`).then((response) => response.data),
};
