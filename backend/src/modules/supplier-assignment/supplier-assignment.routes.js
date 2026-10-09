import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./supplier-assignment.controller.js";
const router = Router();
router.get("/eligible-items", requirePermission("SUPPLIER_SELECT"), asyncHandler(controller.eligible));
router.post("/", requirePermission("SUPPLIER_SELECT"), asyncHandler(controller.assign));
export default router;
