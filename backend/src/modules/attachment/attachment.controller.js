import { sendSuccess } from "../../utils/response.js";
import * as service from "./attachment.service.js";

export async function list(req, res) {
  return sendSuccess(res, { data: await service.listAttachments(req.params.entityType, req.params.entityId, req.user) });
}

export async function upload(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Attachment uploaded successfully.",
    data: await service.addAttachment(req.params.entityType, req.params.entityId, req.file, req.body, req.user),
  });
}

export async function update(req, res) {
  return sendSuccess(res, {
    message: "Attachment details updated successfully.",
    data: await service.updateAttachment(req.params.entityType, req.params.entityId, req.params.attachmentId, req.body, req.user),
  });
}

export async function remove(req, res) {
  await service.removeAttachment(req.params.entityType, req.params.entityId, req.params.attachmentId, req.user);
  return sendSuccess(res, { message: "Attachment deleted successfully." });
}
