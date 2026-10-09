import { Router } from "express";
import { uploadGaugeCertificate } from "../../middleware/upload.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./gauge.controller.js";

const router = Router();

router.get("/lookups", asyncHandler(controller.getLookups));
router.get("/alerts", asyncHandler(controller.getCalibrationAlerts));
router.get("/calibration-workflow-summary", asyncHandler(controller.getCalibrationWorkflowSummary));
router.get("/calibration-dispatches/lookups", asyncHandler(controller.getCalibrationDispatchLookups));
router.get("/calibration-dispatches", asyncHandler(controller.listCalibrationDispatches));
router.post("/calibration-dispatches", asyncHandler(controller.createCalibrationDispatch));
router.get("/calibration-dispatches/:calibrationDispatchId", asyncHandler(controller.getCalibrationDispatch));
router.get("/", asyncHandler(controller.list));
router.post("/bulk/issue", asyncHandler(controller.bulkIssue));
router.post("/bulk/return", asyncHandler(controller.bulkReturn));
router.get("/:gaugeMasterId", asyncHandler(controller.get));
router.post("/register", asyncHandler(controller.register));
router.put("/:gaugeMasterId", asyncHandler(controller.update));
router.post("/:gaugeMasterId/issue", asyncHandler(controller.issue));
router.post("/:gaugeMasterId/return", asyncHandler(controller.returnGauge));
router.post("/:gaugeMasterId/collect-for-calibration", asyncHandler(controller.collectForCalibration));
router.post("/:gaugeMasterId/start-calibration", asyncHandler(controller.startCalibration));
router.post("/:gaugeMasterId/calibrations", uploadGaugeCertificate, asyncHandler(controller.recordCalibration));
router.post("/:gaugeMasterId/start-service", asyncHandler(controller.startService));

export default router;
