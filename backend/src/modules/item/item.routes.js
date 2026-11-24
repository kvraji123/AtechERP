import { Router } from "express";
import { uploadExcel, uploadSingle } from "../../middleware/upload.js";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./item.controller.js";

const router = Router();
const requireAdministrator = (req, _res, next) => {
  const role = String(req.user?.role || "").trim().toUpperCase().replace(/\s+/g, "_");
  return role === "ADMINISTRATOR"
    ? next()
    : next(new AppError("Only administrators can manage Item Master list values.", 403));
};
router.get("/lookups", asyncHandler(controller.getLookups));
router.post("/categories", requireAdministrator, asyncHandler(controller.createItemCategory));
router.delete("/categories/:itemTypeId", requireAdministrator, asyncHandler(controller.retireItemCategory));
router.post("/specification-options", requireAdministrator, asyncHandler(controller.addSpecificationOption));
router.delete("/specification-options", requireAdministrator, asyncHandler(controller.retireSpecificationOption));
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
