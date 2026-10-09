import { Router } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./location.controller.js";

const router = Router();

router.get("/cities", asyncHandler(controller.searchCities));

export default router;
