import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./tooling.controller.js";

const router = Router();

// Tooling uses the existing inventory / GRN posting permission until a dedicated role is configured.
router.get("/dashboard", requirePermission("GRN_POST"), asyncHandler(controller.dashboard));
router.get("/lookups", requirePermission("GRN_POST"), asyncHandler(controller.lookups));
router.get("/issued-return-options", requirePermission("GRN_POST"), asyncHandler(controller.issuedReturnOptions));
router.get("/items", requirePermission("GRN_POST"), asyncHandler(controller.items));
router.get("/movements", requirePermission("GRN_POST"), asyncHandler(controller.movements));
router.get("/issued-tools", requirePermission("GRN_POST"), asyncHandler(controller.issuedTools));
router.get("/regrind-batches", requirePermission("GRN_POST"), asyncHandler(controller.regrindBatches));
router.get("/regrind-batches/:batchId", requirePermission("GRN_POST"), asyncHandler(controller.regrindBatch));
router.post("/issue", requirePermission("GRN_POST"), asyncHandler(controller.issue));
router.post("/return", requirePermission("GRN_POST"), asyncHandler(controller.returnFromProduction));
router.post("/regrind-batches", requirePermission("GRN_POST"), asyncHandler(controller.dispatchRegrind));
router.post("/regrind-batches/:batchId/receive", requirePermission("GRN_POST"), asyncHandler(controller.receiveRegrind));
router.post("/regrind-batches/:batchId/inspect", requirePermission("GRN_POST"), asyncHandler(controller.inspectRegrind));

export default router;
