import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAdministrator } from "../../middleware/requireAdministrator.js";
import * as controller from "./customer.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listCustomers));
router.get("/lookup", asyncHandler(controller.lookupActiveCustomers));
router.get("/:customerId", asyncHandler(controller.getCustomer));
router.post("/", asyncHandler(controller.createCustomer));
router.put("/:customerId", asyncHandler(controller.updateCustomer));
router.delete(
  "/:customerId",
  requireAdministrator,
  asyncHandler(controller.hardDeleteCustomer)
);
router.patch(
  "/:customerId/status",
  asyncHandler(controller.changeCustomerStatus)
);

export default router;
