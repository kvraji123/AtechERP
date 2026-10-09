import { sendSuccess } from "../../utils/response.js";
import * as service from "./purchase-requisition.service.js";

export async function list(req, res) {
  const result = await service.listRequests(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}
export async function summary(req, res) { return sendSuccess(res, { data: await service.summary(req.user) }); }
export async function get(req, res) { return sendSuccess(res, { data: await service.getRequest(req.params.id, req.user) }); }
export async function create(req, res) {
  const submitted = String(req.body.action || "DRAFT").toUpperCase() === "SUBMIT";
  return sendSuccess(res, { statusCode: 201, message: submitted ? "Purchase requisition submitted." : "Purchase requisition draft saved.", data: submitted ? await service.createAndSubmit(req.body, req.user) : await service.createDraft(req.body, req.user) });
}
export async function update(req, res) {
  const submitted = String(req.body.action || "DRAFT").toUpperCase() === "SUBMIT";
  return sendSuccess(res, { message: submitted ? "Purchase requisition submitted." : "Purchase requisition draft updated.", data: await service.updateDraft(req.params.id, req.body, req.user) });
}
export async function submit(req, res) { return sendSuccess(res, { message: "Purchase requisition submitted.", data: await service.updateDraft(req.params.id, { ...req.body, action: "SUBMIT" }, req.user) }); }
