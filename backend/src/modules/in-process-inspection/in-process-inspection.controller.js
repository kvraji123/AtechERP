import { sendSuccess } from "../../utils/response.js";
import * as service from "./in-process-inspection.service.js";

export async function listParts(req, res) { return sendSuccess(res, { data: await service.listParts(req.user) }); }
export async function listProcessPlans(req, res) { return sendSuccess(res, { data: await service.listProcessPlans(req.params.partId) }); }
export async function dashboard(req, res) { return sendSuccess(res, { data: await service.dashboard(req.user) }); }
export async function reportProduction(req, res) { return sendSuccess(res, { statusCode: 201, message: "Production pieces reported and inspection requirements created.", data: await service.reportProduction(req.body, req.user) }); }
export async function selectSamples(req, res) { return sendSuccess(res, { message: "Sample pieces selected for inspection.", data: await service.selectSamples(req.params.requirementId, req.body, req.user) }); }
export async function completeInspection(req, res) { return sendSuccess(res, { message: "In-process inspection recorded.", data: await service.completeInspection(req.params.requirementId, req.body, req.user) }); }
export async function completeInspections(req, res) { return sendSuccess(res, { message: "In-process inspections recorded.", data: await service.completeInspections(req.body, req.user) }); }
