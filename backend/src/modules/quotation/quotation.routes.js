import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./quotation.controller.js";

const router = Router();

router.get(
  "/:enquiryId/quotation",
  asyncHandler(controller.getQuotation)
);

router.put(
  "/:enquiryId/quotation",
  asyncHandler(controller.saveQuotation)
);

router.post(
  "/:enquiryId/quotation/submit",
  asyncHandler(controller.submitQuotation)
);

router.post(
  "/:enquiryId/quotation/pdf",
  asyncHandler(controller.generateQuotationPdf)
);

export default router;
