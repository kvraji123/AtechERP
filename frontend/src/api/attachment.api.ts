import { api } from "./client";

export type StoredAttachment = {
  attachmentId: number;
  entityType: string;
  entityId: number;
  attachmentType: string;
  attachmentName?: string | null;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  createdBy?: string | null;
  createdOn?: string | null;
};

const path = (entityType: string, entityId: number | string) =>
  `/attachments/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}`;

export const attachmentApi = {
  list: (entityType: string, entityId: number | string) =>
    api.get(path(entityType, entityId)).then((response) => response.data),
  upload: (
    entityType: string,
    entityId: number | string,
    file: File,
    details: { attachmentType?: string; attachmentName?: string } = {}
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (details.attachmentType) form.append("attachmentType", details.attachmentType);
    if (details.attachmentName) form.append("attachmentName", details.attachmentName);
    return api.post(path(entityType, entityId), form).then((response) => response.data);
  },
  update: (
    entityType: string,
    entityId: number | string,
    attachmentId: number | string,
    details: { attachmentType?: string; attachmentName?: string }
  ) => api.patch(`${path(entityType, entityId)}/${encodeURIComponent(String(attachmentId))}`, details).then((response) => response.data),
  remove: (entityType: string, entityId: number | string, attachmentId: number | string) =>
    api.delete(`${path(entityType, entityId)}/${encodeURIComponent(String(attachmentId))}`).then((response) => response.data),
};
