import { sendSuccess } from "../../utils/response.js";
import * as service from "./material-outward.service.js";

export async function list(req, res) {
  const result = await service.list(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function get(req, res) {
  return sendSuccess(res, { data: await service.get(req.params.documentId, req.user) });
}

export async function create(req, res) {
  return sendSuccess(res, { statusCode: 201, message: "Material Outward submitted for approval. Stock remains unchanged until dispatch.", data: await service.create(req.body, req.user) });
}

export async function createCalibrationDispatch(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Calibration Dispatch Challan created in GRN Outward.",
    data: await service.create({
      ...req.body,
      outwardType: "CALIBRATION_DISPATCH",
      // The dispatch-challan UI calls this field Dispatch Date; Material Outward
      // persists it as its standard outward date.
      outwardDate: req.body?.dispatchDate,
      transportReference: req.body?.courierReference,
    }, req.user),
  });
}

export async function createToolRegrindDispatch(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Tool Regrinding DC created in GRN Outward.",
    data: await service.create({
      ...req.body,
      outwardType: "TOOL_REGRIND",
      outwardDate: req.body?.dispatchDate,
      partyId: req.body?.supplierId,
      transportReference: req.body?.courierVehicleReference,
    }, req.user),
  });
}

export async function outsourceWip(req, res) {
  const result = await service.outsourceWip(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function gateExitCandidates(req, res) {
  const result = await service.gateExitCandidates(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function listGateExits(req, res) {
  const result = await service.listGateExits(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function createGateExit(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Gate exit recorded and GRN Outward dispatched.",
    data: await service.createGateExit(req.body, req.user),
  });
}

export async function approve(req, res) {
  return sendSuccess(res, { message: "Material Outward approved. Stock will reduce only when dispatched.", data: await service.approve(req.params.documentId, req.body, req.user) });
}

