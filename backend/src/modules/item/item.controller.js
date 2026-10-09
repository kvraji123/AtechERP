import { sendSuccess } from "../../utils/response.js";
import * as service from "./item.service.js";

export async function listItems(req, res) {
  const result = await service.listItems(req.query);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total,
    page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20) } });
}
export async function getLookups(_req, res) { return sendSuccess(res, { data: await service.getLookups() }); }
export async function createItemCategory(req, res) { return sendSuccess(res, { statusCode: 201,
  message: "Item Category added successfully.", data: await service.createItemCategory(req.body, req.user.userCode) }); }
export async function getItem(req, res) { return sendSuccess(res, { data: await service.getItem(req.params.itemId) }); }
export async function createItem(req, res) { return sendSuccess(res, { statusCode: 201,
  message: "Item created successfully.", data: await service.createItem(req.body, req.user.userCode) }); }
export async function bulkUploadItems(req, res) {
  const result = await service.bulkUploadItems(req.file, req.user.userCode);
  return sendSuccess(res, { statusCode: result.importedCount ? 201 : 200,
    message: result.errors.length
      ? "No items were imported. Correct the listed rows and upload the file again."
      : `${result.importedCount} Item Master record(s) imported successfully.`,
    data: result });
}
export async function updateItem(req, res) { return sendSuccess(res, { message: "Item updated successfully.",
  data: await service.updateItem(req.params.itemId, req.body, req.user.userCode) }); }
export async function changeStatus(req, res) { return sendSuccess(res, { message: "Item status updated successfully.",
  data: await service.changeStatus(req.params.itemId, req.body, req.user.userCode) }); }
export async function addAttachment(req, res) { return sendSuccess(res, { statusCode: 201,
  message: "Attachment uploaded successfully.", data: await service.addAttachment(req.params.itemId, req.file, req.body, req.user.userCode) }); }
export async function removeAttachment(req, res) { await service.removeAttachment(req.params.itemId, req.params.attachmentId);
  return sendSuccess(res, { message: "Attachment deleted successfully." }); }
