import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./machine.controller.js";

const router = Router();
router.get("/lookups", asyncHandler(controller.getLookups));
router.get("/", asyncHandler(controller.listMachines));
router.get("/:machineMasterId", asyncHandler(controller.getMachine));
router.post("/", asyncHandler(controller.createMachine));
router.put("/:machineMasterId", asyncHandler(controller.updateMachine));
router.delete("/:machineMasterId", asyncHandler(controller.deleteMachine));
export default router;

