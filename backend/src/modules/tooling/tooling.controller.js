import { sendSuccess } from "../../utils/response.js";
import * as service from "./tooling.service.js";

export async function dashboard(req, res) { return sendSuccess(res, { data: await service.getDashboard(req.user) }); }
export async function lookups(req, res) { return sendSuccess(res, { data: await service.getLookups(req.user) }); }
export async function issuedReturnOptions(req, res) { return sendSuccess(res, { data: await service.listIssuedReturnOptions(req.query.itemId, req.user) }); }
export async function items(req, res) { return sendSuccess(res, { data: await service.listToolItems(req.query, req.user) }); }
export async function movements(req, res) { return sendSuccess(res, { data: await service.listMovements(req.query, req.user) }); }
export async function issuedTools(req, res) { return sendSuccess(res, { data: await service.listIssuedTools(req.query, req.user) }); }
export async function regrindBatches(req, res) { return sendSuccess(res, { data: await service.listRegrindBatches(req.user) }); }
export async function regrindBatch(req, res) { return sendSuccess(res, { data: await service.getRegrindBatch(req.params.batchId, req.user) }); }
export async function issue(req, res) { return sendSuccess(res, { statusCode: 201, message: "Tool quantity issued.", data: await service.issue(req.body, req.user) }); }
export async function returnFromProduction(req, res) { return sendSuccess(res, { statusCode: 201, message: "Tool return recorded.", data: await service.returnFromProduction(req.body, req.user) }); }
export async function dispatchRegrind(req, res) { return sendSuccess(res, { statusCode: 201, message: "Tool regrinding DC created.", data: await service.dispatchRegrind(req.body, req.user) }); }
export async function receiveRegrind(req, res) { return sendSuccess(res, { message: "Regrinding DC received and queued for inspection.", data: await service.receiveRegrind(req.params.batchId, req.body, req.user) }); }
export async function inspectRegrind(req, res) { return sendSuccess(res, { message: "Regrinding inspection posted.", data: await service.inspectRegrind(req.params.batchId, req.body, req.user) }); }
