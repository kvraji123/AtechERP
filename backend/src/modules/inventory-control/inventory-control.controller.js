import { sendSuccess } from "../../utils/response.js";
import * as service from "./inventory-control.service.js";

export async function lookups(req, res) { return sendSuccess(res, { data: await service.lookups(req.user) }); }
export async function balances(req, res) { return sendSuccess(res, { data: await service.balances(req.query, req.user) }); }
export async function rejectionCases(req, res) { return sendSuccess(res, { data: await service.rejectionCases(req.query, req.user) }); }
export async function transfer(req, res) { return sendSuccess(res, { statusCode: 201, message: "Internal stock transfer posted.", data: await service.transfer(req.body, req.user) }); }
export async function issueToProduction(req, res) { return sendSuccess(res, { statusCode: 201, message: "Material issued to work order.", data: await service.issueToProduction(req.body, req.user) }); }
export async function returnFromProduction(req, res) { return sendSuccess(res, { statusCode: 201, message: "Production return posted to Quality hold.", data: await service.returnFromProduction(req.body, req.user) }); }
export async function releaseQualityHold(req, res) { return sendSuccess(res, { statusCode: 201, message: "Quality release posted to available stock.", data: await service.releaseQualityHold(req.body, req.user) }); }
export async function completeProduction(req, res) { return sendSuccess(res, { statusCode: 201, message: "Production completion posted to finished goods.", data: await service.completeProduction(req.body, req.user) }); }
export async function reportRejection(req, res) { return sendSuccess(res, { statusCode: 201, message: "Production rejection quarantined.", data: await service.reportRejection(req.body, req.user) }); }
export async function resolveRejection(req, res) { return sendSuccess(res, { message: "Rejection disposition posted.", data: await service.resolveRejection(req.body, req.params.caseId, req.user) }); }
