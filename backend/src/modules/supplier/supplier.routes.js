import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./supplier.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listSuppliers));
router.get("/:supplierId", asyncHandler(controller.getSupplier));
router.post("/", asyncHandler(controller.createSupplier));
router.put("/:supplierId", asyncHandler(controller.updateSupplier));
router.patch(
  "/:supplierId/status",
  asyncHandler(controller.changeSupplierStatus)
);

export default router;
