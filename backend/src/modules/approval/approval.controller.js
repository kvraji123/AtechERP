import { sendSuccess } from "../../utils/response.js";
import * as service from "./approval.service.js";
export async function list(req, res) { const result = await service.listQueue(req.query, req.user); return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } }); }
export async function get(req, res) { return sendSuccess(res, { data: await service.get(req.params.id, req.user) }); }
export async function decide(req, res) { return sendSuccess(res, { message: "Purchase requisition decision recorded.", data: await service.decide(req.params.id, req.body, req.user) }); }
