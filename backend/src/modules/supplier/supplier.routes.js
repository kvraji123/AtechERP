import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAdministrator } from "../../middleware/requireAdministrator.js";
import * as controller from "./supplier.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listSuppliers));
router.get("/lookup", asyncHandler(controller.lookupActiveSuppliers));
router.get("/:supplierId", asyncHandler(controller.getSupplier));
router.post("/", asyncHandler(controller.createSupplier));
router.put("/:supplierId", asyncHandler(controller.updateSupplier));
router.delete(
  "/:supplierId",
  requireAdministrator,
  asyncHandler(controller.hardDeleteSupplier)
);
router.patch(
  "/:supplierId/status",
  asyncHandler(controller.changeSupplierStatus)
);

export default router;
