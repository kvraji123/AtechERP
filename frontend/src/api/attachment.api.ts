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

/**
 * Attachment APIs store upload paths relative to the API server (for example,
 * `/uploads/marketing/...`).  The web app and API use different ports in
 * local development and in the current production deployment, so a relative
 * link would otherwise be opened against the frontend server and result in a
 * 404.  Resolve only relative upload paths against the configured API origin.
 */
export function attachmentFileUrl(fileUrl: string | null | undefined) {
  const value = String(fileUrl || "").trim();
  if (!value || /^https?:\/\//i.test(value)) return value;

  try {
    return new URL(value, api.defaults.baseURL).toString();
  } catch {
    return value;
  }
}

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
