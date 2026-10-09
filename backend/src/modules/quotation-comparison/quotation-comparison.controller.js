import { sendSuccess } from "../../utils/response.js";
import * as service from "./quotation-comparison.service.js";

export async function list(req, res) {
  const result = await service.list(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function get(req, res) {
  return sendSuccess(res, { data: await service.get(req.params.enquiryId, req.user) });
}

export async function select(req, res) {
  return sendSuccess(res, { message: "Supplier selection saved.", data: await service.select(req.body, req.user) });
}
