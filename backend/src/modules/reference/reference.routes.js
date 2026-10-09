import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./reference.controller.js";

const router = Router();
router.get("/", asyncHandler(controller.getReferenceData));
export default router;
