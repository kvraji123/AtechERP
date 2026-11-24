import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./purchase-requisition.controller.js";

const router = Router();
router.get("/", asyncHandler(controller.list));
router.get("/summary", asyncHandler(controller.summary));
router.get("/:id", asyncHandler(controller.get));
router.post("/", requirePermission("PR_CREATE"), asyncHandler(controller.create));
router.put("/:id", requirePermission("PR_CREATE"), asyncHandler(controller.update));
router.delete("/:id", requirePermission("PR_CREATE"), asyncHandler(controller.remove));
router.post("/:id/submit", requirePermission("PR_SUBMIT"), asyncHandler(controller.submit));
export default router;
