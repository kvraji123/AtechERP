import { sendSuccess } from "../../utils/response.js";
import * as service from "./supplier-assignment.service.js";
export async function eligible(req, res) { return sendSuccess(res, { data: await service.eligibleItems(req.user) }); }
export async function assign(req, res) { return sendSuccess(res, { message: "Supplier assignments saved.", data: await service.assign(req.body, req.user) }); }
