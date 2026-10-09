import { sendSuccess } from "../../utils/response.js";
import * as service from "./machine.service.js";

export async function listMachines(req, res) {
  const result = await service.listMachines(req.query);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total,
    page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20) } });
}
export async function getLookups(_req, res) { return sendSuccess(res, { data: await service.getLookups() }); }
export async function getMachine(req, res) { return sendSuccess(res, { data: await service.getMachine(req.params.machineMasterId) }); }
export async function createMachine(req, res) { return sendSuccess(res, { statusCode: 201,
  message: "Machine Master created successfully.", data: await service.createMachine(req.body, req.user.userCode) }); }
export async function updateMachine(req, res) { return sendSuccess(res, { message: "Machine Master updated successfully.",
  data: await service.updateMachine(req.params.machineMasterId, req.body, req.user.userCode) }); }
export async function deleteMachine(req, res) { await service.deleteMachine(req.params.machineMasterId);
  return sendSuccess(res, { message: "Machine Master deleted successfully." }); }

