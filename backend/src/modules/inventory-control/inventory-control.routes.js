import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./inventory-control.controller.js";

const router = Router();

router.get("/lookups", requirePermission("GRN_POST"), asyncHandler(controller.lookups));
router.get("/balances", requirePermission("GRN_POST"), asyncHandler(controller.balances));
router.get("/rejections", requirePermission("GRN_POST"), asyncHandler(controller.rejectionCases));
router.post("/transfers", requirePermission("GRN_POST"), asyncHandler(controller.transfer));
router.post("/production-issues", requirePermission("GRN_POST"), asyncHandler(controller.issueToProduction));
router.post("/production-returns", requirePermission("GRN_POST"), asyncHandler(controller.returnFromProduction));
router.post("/quality-releases", requirePermission("PO_APPROVE"), asyncHandler(controller.releaseQualityHold));
router.post("/production-completions", requirePermission("GRN_POST"), asyncHandler(controller.completeProduction));
router.post("/rejections", requirePermission("GRN_POST"), asyncHandler(controller.reportRejection));
router.post("/rejections/:caseId/resolve", requirePermission("PO_APPROVE"), asyncHandler(controller.resolveRejection));

export default router;
