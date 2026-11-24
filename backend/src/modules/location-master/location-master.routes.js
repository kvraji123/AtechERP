import { Router } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./location-master.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listLocations));
router.get("/warehouses", asyncHandler(controller.listWarehouseNames));
router.get("/subinventories", asyncHandler(controller.listSubinventories));
router.post("/", asyncHandler(controller.createLocation));
router.put("/:locationMasterId", asyncHandler(controller.updateLocation));

export default router;
