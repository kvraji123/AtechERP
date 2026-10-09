import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./approval.controller.js";
const router = Router();
router.get("/", requirePermission("PR_APPROVE"), asyncHandler(controller.list));
router.get("/:id", requirePermission("PR_APPROVE"), asyncHandler(controller.get));
router.post("/:id/decide", requirePermission("PR_APPROVE"), asyncHandler(controller.decide));
export default router;
