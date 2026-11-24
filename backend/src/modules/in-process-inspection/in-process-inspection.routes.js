import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./in-process-inspection.controller.js";

const router = Router();

router.get("/parts", requirePermission("GRN_POST"), asyncHandler(controller.listParts));
router.get("/parts/:partId/process-plans", requirePermission("GRN_POST"), asyncHandler(controller.listProcessPlans));
router.get("/dashboard", requirePermission("GRN_POST"), asyncHandler(controller.dashboard));
router.post("/production", requirePermission("GRN_POST"), asyncHandler(controller.reportProduction));
router.post("/requirements/:requirementId/select-samples", requirePermission("GRN_POST"), asyncHandler(controller.selectSamples));
router.post("/requirements/complete-all", requirePermission("GRN_POST"), asyncHandler(controller.completeInspections));
router.post("/requirements/:requirementId/complete", requirePermission("GRN_POST"), asyncHandler(controller.completeInspection));

export default router;
