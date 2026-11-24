import { Router } from "express";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./material-outward.controller.js";

const router = Router();

router.get("/", requirePermission("GRN_POST"), asyncHandler(controller.list));
router.get("/outsource-wip", requirePermission("GRN_POST"), asyncHandler(controller.outsourceWip));
router.get("/gate-exits", requirePermission("GRN_POST"), asyncHandler(controller.listGateExits));
router.get("/gate-exits/candidates", requirePermission("GRN_POST"), asyncHandler(controller.gateExitCandidates));
router.post("/gate-exits", requirePermission("GRN_POST"), asyncHandler(controller.createGateExit));
router.get("/:documentId", requirePermission("GRN_POST"), asyncHandler(controller.get));
router.post("/calibration-dispatch", requirePermission("GRN_POST"), asyncHandler(controller.createCalibrationDispatch));
router.post("/tool-regrind-dispatch", requirePermission("GRN_POST"), asyncHandler(controller.createToolRegrindDispatch));
router.post("/", requirePermission("GRN_POST"), asyncHandler(controller.create));
router.post("/:documentId/approve", requirePermission("PO_APPROVE"), asyncHandler(controller.approve));

export default router;
