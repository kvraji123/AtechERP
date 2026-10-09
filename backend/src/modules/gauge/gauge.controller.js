import fs from "node:fs/promises";
import { sendSuccess } from "../../utils/response.js";
import * as service from "./gauge.service.js";

export async function getLookups(req, res) {
  return sendSuccess(res, { data: await service.getLookups(req.user) });
}

export async function getCalibrationAlerts(req, res) {
  return sendSuccess(res, { data: await service.getCalibrationAlerts(req.user) });
}

export async function getCalibrationWorkflowSummary(req, res) {
  return sendSuccess(res, { data: await service.getCalibrationWorkflowSummary(req.user) });
}

export async function list(req, res) {
  const result = await service.list(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function getCalibrationDispatchLookups(req, res) {
  return sendSuccess(res, { data: await service.getCalibrationDispatchLookups(req.user) });
}

export async function listCalibrationDispatches(req, res) {
  const result = await service.listCalibrationDispatches(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function getCalibrationDispatch(req, res) {
  return sendSuccess(res, { data: await service.getCalibrationDispatch(req.params.calibrationDispatchId, req.user) });
}

export async function createCalibrationDispatch(req, res) {
  const data = await service.createCalibrationDispatch(req.body, req.user);
  return sendSuccess(res, { statusCode: 201, message: `Calibration dispatch challan ${data.challanNumber} created.`, data });
}

export async function get(req, res) {
  return sendSuccess(res, { data: await service.getGauge(req.params.gaugeMasterId, req.user) });
}

export async function register(req, res) {
  return sendSuccess(res, { statusCode: 201, message: "Gauge Master records created from the posted GRN.", data: await service.register(req.body, req.user) });
}

export async function update(req, res) {
  return sendSuccess(res, { message: "Gauge Master record updated.", data: await service.updateGauge(req.params.gaugeMasterId, req.body, req.user) });
}

export async function issue(req, res) {
  return sendSuccess(res, { message: "Gauge issued for use.", data: await service.issueGauge(req.params.gaugeMasterId, req.body, req.user) });
}

export async function returnGauge(req, res) {
  return sendSuccess(res, { message: "Gauge returned to its location.", data: await service.returnGauge(req.params.gaugeMasterId, req.body, req.user) });
}

export async function bulkIssue(req, res) {
  const data = await service.bulkIssueGauges(req.body, req.user);
  return sendSuccess(res, { message: `${data.gaugeCount} gauge(s) issued under ${data.movementNumber}.`, data });
}

export async function bulkReturn(req, res) {
  const data = await service.bulkReturnGauges(req.body, req.user);
  return sendSuccess(res, { message: `${data.gaugeCount} gauge(s) returned under ${data.movementNumber}.`, data });
}

export async function collectForCalibration(req, res) {
  return sendSuccess(res, { message: "Gauge collected for calibration.", data: await service.collectForCalibration(req.params.gaugeMasterId, req.body, req.user) });
}

export async function startCalibration(req, res) {
  return sendSuccess(res, { message: "Gauge moved under calibration.", data: await service.startCalibration(req.params.gaugeMasterId, req.body, req.user) });
}

export async function recordCalibration(req, res) {
  const certificateFile = req.file ? {
    fileName: req.file.originalname,
    filePath: `gauges/calibration-certificates/${req.file.filename}`,
    fileSizeBytes: req.file.size,
  } : null;
  try {
    const data = await service.recordCalibration(req.params.gaugeMasterId, { ...req.body, certificateFile }, req.user);
    return sendSuccess(res, { message: "Calibration result recorded.", data });
  } catch (error) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
}

export async function startService(req, res) {
  return sendSuccess(res, { message: "Gauge moved under service.", data: await service.startService(req.params.gaugeMasterId, req.body, req.user) });
}
