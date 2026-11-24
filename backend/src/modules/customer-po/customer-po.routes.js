import { Router } from "express";

import { requirePermission } from "../../shared/middleware/requirePermission.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./customer-po.controller.js";

const router = Router();

router.get("/eligible-enquiries", requirePermission("CUSTOMER_PO_CREATE", "CUSTOMER_PO_VIEW"), asyncHandler(controller.listEligibleEnquiries));
router.get("/enquiry-source/:enquiryId", requirePermission("CUSTOMER_PO_CREATE", "CUSTOMER_PO_VIEW"), asyncHandler(controller.getEnquirySource));
router.get("/sales-orders", requirePermission("CUSTOMER_PO_CREATE", "CUSTOMER_PO_VIEW", "SALES_ORDER_VIEW"), asyncHandler(controller.listSalesOrders));
router.get("/", requirePermission("CUSTOMER_PO_CREATE", "CUSTOMER_PO_VIEW"), asyncHandler(controller.list));
router.get("/:id", requirePermission("CUSTOMER_PO_CREATE", "CUSTOMER_PO_VIEW"), asyncHandler(controller.get));
router.post("/", requirePermission("CUSTOMER_PO_CREATE"), asyncHandler(controller.create));
router.put("/:id", requirePermission("CUSTOMER_PO_CREATE"), asyncHandler(controller.update));
router.post("/:id/confirm", requirePermission("CUSTOMER_PO_CREATE"), asyncHandler(controller.confirm));
router.post("/:id/convert-to-sales-order", requirePermission("SALES_ORDER_CREATE"), asyncHandler(controller.convert));

export default router;
