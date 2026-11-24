import { sendSuccess } from "../../utils/response.js";
import * as service from "./location-master.service.js";

export async function listLocations(req, res) {
  const result = await service.listLocations(req.query, req.user);
  return sendSuccess(res, {
    data: result.rows,
    meta: { total: result.total, page: result.page, pageSize: result.pageSize },
  });
}

export async function listWarehouseNames(req, res) {
  return sendSuccess(res, { data: await service.listWarehouseNames(req.user) });
}

export async function listSubinventories(req, res) {
  return sendSuccess(res, { data: await service.listSubinventories(req.user) });
}

export async function createLocation(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Location Master record created successfully.",
    data: await service.saveLocation(0, req.body, req.user),
  });
}

export async function updateLocation(req, res) {
  return sendSuccess(res, {
    message: "Location Master record updated successfully.",
    data: await service.saveLocation(req.params.locationMasterId, req.body, req.user),
  });
}
