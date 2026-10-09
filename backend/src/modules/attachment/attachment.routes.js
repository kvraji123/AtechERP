import { Router } from "express";

import { uploadSingle } from "../../middleware/upload.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./attachment.controller.js";

const router = Router();

function requireEntityPermission(req, res, next) {
  const type = String(req.params.entityType || "").trim().toUpperCase();
  if (type === "PURCHASE_REQUEST_ITEM") return requirePermission("PR_CREATE", "PR_APPROVE")(req, res, next);
  if (type === "PURCHASE_ORDER") return requirePermission("PO_CREATE", "PO_APPROVE")(req, res, next);
  return next();
}

router.get("/:entityType/:entityId", requireEntityPermission, asyncHandler(controller.list));
router.post("/:entityType/:entityId", requireEntityPermission, (req, res, next) => {
  req.params.moduleName = `attachments-${req.params.entityType}`;
  uploadSingle(req, res, next);
}, asyncHandler(controller.upload));
router.patch("/:entityType/:entityId/:attachmentId", requireEntityPermission, asyncHandler(controller.update));
router.delete("/:entityType/:entityId/:attachmentId", requireEntityPermission, asyncHandler(controller.remove));

export default router;
