import { sendSuccess } from "../../utils/response.js";
import * as service from "./purchase-order-approval.service.js";
export async function list(req, res) { const result = await service.list(req.query, req.user); return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } }); }
export async function summary(req, res) { return sendSuccess(res, { data: await service.summary(req.user) }); }
export async function get(req, res) { return sendSuccess(res, { data: await service.get(req.params.id, req.user) }); }
export async function decide(req, res) { return sendSuccess(res, { message: "Purchase order decision recorded.", data: await service.decide(req.params.id, req.params.action, req.body, req.user) }); }
