import { sendSuccess } from "../../utils/response.js";
import * as service from "./part.service.js";

export async function listParts(req, res) {
  const result = await service.listParts(req.query, req.user);

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

export async function createToolList(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Tool List created successfully.",
    data: await service.createToolList(req.params.processDefinitionId, req.user),
  });
}

export async function getToolListEditorConfig(req, res) {
  return sendSuccess(res, {
    data: await service.getToolListEditorConfig(req.params.processDefinitionId, req.user),
  });
}

export async function getToolListEditorFile(req, res) {
  const file = await service.getToolListEditorFile(
    req.params.processDefinitionId,
    req.query.session
  );
  res.type(file.mimeType);
  return res.download(file.absolutePath, file.fileName);
}

export async function saveToolListEditorFile(req, res) {
  try {
    await service.saveToolListFromOnlyOffice(
      req.params.processDefinitionId,
      req.query.session,
      req.body
    );
    return res.status(200).json({ error: 0 });
  } catch (error) {
    // ONLYOFFICE expects this exact response shape. It will retry the callback
    // when it receives error: 1, while the full error remains in server logs.
    console.error("Unable to save Tool List from ONLYOFFICE.", error);
    return res.status(200).json({ error: 1 });
  }
}

export async function getPart(req, res) {
  return sendSuccess(res, {
    data: await service.getPart(req.params.partId),
  });
}

export async function getRevisionWarnings(req, res) {
  return sendSuccess(res, {
    data: await service.getRevisionWarnings(req.query),
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

export async function clonePartForRevision(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message: "Drawing revision created. The original Part is now inactive.",
    data: await service.clonePartForRevision(req.params.partId, req.body, req.user),
  });
}

export async function releaseRevisionBom(req, res) {
  return sendSuccess(res, {
    message: "Bill of Material approved and released.",
    data: await service.releaseRevisionBom(req.params.partId, req.user),
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
