import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./part.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listParts));
router.get("/bom-options/search", asyncHandler(controller.searchBomOptions));
router.get("/process-masters", asyncHandler(controller.getProcessMasters));
router.get("/:partId/bom-hierarchy", asyncHandler(controller.getBomHierarchy));
router.get("/:partId", asyncHandler(controller.getPart));
router.post("/", asyncHandler(controller.createPart));
router.put("/:partId", asyncHandler(controller.updatePart));
router.patch("/:partId/status", asyncHandler(controller.changePartStatus));

export default router;
