import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./quotation-comparison.controller.js";

const router = Router();
router.get("/", requirePermission("SUPPLIER_SELECT", "QUOTE_ENTER"), asyncHandler(controller.list));
router.get("/:enquiryId", requirePermission("SUPPLIER_SELECT", "QUOTE_ENTER"), asyncHandler(controller.get));
router.post("/:enquiryId/select", requirePermission("SUPPLIER_SELECT"), asyncHandler((req, res) => controller.select({ ...req, body: { ...req.body, purchaseEnquiryId: req.params.enquiryId } }, res)));
export default router;
