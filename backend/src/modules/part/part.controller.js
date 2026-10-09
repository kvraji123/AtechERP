import { sendSuccess } from "../../utils/response.js";
import * as service from "./part.service.js";

export async function listParts(req, res) {
  const result = await service.listParts(req.query);

  return sendSuccess(res, {
    data: result.rows,
    meta: {
      total: result.total,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 20),
    },
  });
}

export async function searchBomOptions(req, res) {
  return sendSuccess(res, {
    data: await service.searchBomOptions(req.query),
  });
}

export async function getProcessMasters(req, res) {
  return sendSuccess(res, { data: await service.getProcessMasters() });
}

export async function getPart(req, res) {
  return sendSuccess(res, {
    data: await service.getPart(req.params.partId),
  });
}

export async function getBomHierarchy(req, res) {
  return sendSuccess(res, {
    data: await service.getBomHierarchy(req.params.partId),
  });
}

export async function createPart(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Part created successfully.",
    data: await service.createPart(req.body, req.user),
  });
}

export async function updatePart(req, res) {
  return sendSuccess(res, {
    message: "Part updated successfully.",
    data: await service.updatePart(
      req.params.partId,
      req.body,
      req.user
    ),
  });
}

export async function changePartStatus(req, res) {
  return sendSuccess(res, {
    message: "Part status updated successfully.",
    data: await service.changePartStatus(
      req.params.partId,
      req.body,
      req.user.userCode
    ),
  });
}
