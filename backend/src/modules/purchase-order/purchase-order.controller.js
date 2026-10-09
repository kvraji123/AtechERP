import { sendSuccess } from "../../utils/response.js";
import * as service from "./purchase-order.service.js";
export async function list(req, res) { const result = await service.list(req.query, req.user); return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } }); }
export async function summary(req, res) { return sendSuccess(res, { data: await service.summary(req.user) }); }
export async function listSupplierOptions(req, res) { return sendSuccess(res, { data: await service.listSupplierOptions(req.user) }); }
export async function get(req, res) { return sendSuccess(res, { data: await service.get(req.params.id, req.user) }); }
export async function generate(req, res) { return sendSuccess(res, { statusCode: 201, message: "Supplier-wise purchase order drafts generated.", data: await service.generate(req.body, req.user) }); }
export async function update(req, res) { return sendSuccess(res, { message: "Purchase order draft updated.", data: await service.update(req.params.id, req.body, req.user) }); }
export async function submit(req, res) { return sendSuccess(res, { message: "Purchase order submitted for approval.", data: await service.submit(req.params.id, req.user) }); }
