import { Router } from "express";
import { uploadExcel, uploadSingle } from "../../middleware/upload.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./item.controller.js";

const router = Router();
router.get("/lookups", asyncHandler(controller.getLookups));
router.post("/categories", asyncHandler(controller.createItemCategory));
router.post("/bulk-upload", uploadExcel, asyncHandler(controller.bulkUploadItems));
router.get("/", asyncHandler(controller.listItems));
router.get("/:itemId", asyncHandler(controller.getItem));
router.post("/", asyncHandler(controller.createItem));
router.put("/:itemId", asyncHandler(controller.updateItem));
router.patch("/:itemId/status", asyncHandler(controller.changeStatus));
router.post("/:itemId/attachments", (req, res, next) => {
  req.params.moduleName = "items";
  uploadSingle(req, res, next);
}, asyncHandler(controller.addAttachment));
router.delete("/:itemId/attachments/:attachmentId", asyncHandler(controller.removeAttachment));
export default router;
