import { Router } from "express";
import { uploadPdf } from "../../middleware/upload.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./supplier-quotation.controller.js";

const router=Router();
router.get("/",requirePermission("QUOTE_ENTER","SUPPLIER_SELECT"),asyncHandler(controller.list));
router.post("/attachments",requirePermission("QUOTE_ENTER"),(req,res,next)=>{req.params.moduleName="purchase-quotations";uploadPdf(req,res,next);},asyncHandler(controller.uploadAttachment));
router.post("/",requirePermission("QUOTE_ENTER"),asyncHandler(controller.create));
router.get("/:id",requirePermission("QUOTE_ENTER","SUPPLIER_SELECT"),asyncHandler(controller.get));
export default router;
