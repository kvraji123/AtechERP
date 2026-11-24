import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./part.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listParts));
router.get("/bom-options/search", asyncHandler(controller.searchBomOptions));
router.get("/process-masters", asyncHandler(controller.getProcessMasters));
router.get("/revision-warnings", asyncHandler(controller.getRevisionWarnings));
router.post("/process-definitions/:processDefinitionId/tool-list", asyncHandler(controller.createToolList));
router.get("/process-definitions/:processDefinitionId/tool-list/editor-config", asyncHandler(controller.getToolListEditorConfig));
router.get("/process-definitions/:processDefinitionId/tool-list/editor-file", asyncHandler(controller.getToolListEditorFile));
router.post("/process-definitions/:processDefinitionId/tool-list/editor-callback", controller.saveToolListEditorFile);
router.get("/:partId/bom-hierarchy", asyncHandler(controller.getBomHierarchy));
router.get("/:partId", asyncHandler(controller.getPart));
router.post("/", asyncHandler(controller.createPart));
router.post("/:partId/clone-revision", asyncHandler(controller.clonePartForRevision));
router.put("/:partId", asyncHandler(controller.updatePart));
router.patch("/:partId/revision-bom-release", asyncHandler(controller.releaseRevisionBom));
router.patch("/:partId/status", asyncHandler(controller.changePartStatus));

export default router;
