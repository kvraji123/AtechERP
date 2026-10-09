import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./enquiry.controller.js";

const router = Router();

router.get("/", asyncHandler(controller.listEnquiries));
router.get("/filter-options", asyncHandler(controller.listEnquiryFilterOptions));
router.get("/dashboard-summary", asyncHandler(controller.dashboardSummary));
router.get(
  "/:enquiryId/quotation-eligible-parts",
  asyncHandler(controller.eligibleQuotationParts)
);
router.get(
  "/:enquiryId/revisions",
  asyncHandler(controller.getEnquiryRevisions)
);
router.get("/:enquiryId", asyncHandler(controller.getEnquiry));
router.post("/", asyncHandler(controller.createEnquiry));
router.put("/:enquiryId", asyncHandler(controller.updateEnquiry));
router.patch(
  "/:enquiryId/status",
  asyncHandler(controller.changeEnquiryStatus)
);
router.post(
  "/:enquiryId/submit",
  asyncHandler(controller.submitEnquiry)
);

export default router;
