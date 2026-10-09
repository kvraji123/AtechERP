import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./feasibility.controller.js";

const router = Router();

router.get(
  "/:enquiryPartId/feasibility",
  asyncHandler(controller.getFeasibility)
);

router.put(
  "/:enquiryPartId/feasibility",
  asyncHandler(controller.saveFeasibility)
);

router.post(
  "/:enquiryPartId/feasibility/submit",
  asyncHandler(controller.submitFeasibility)
);

router.post(
  "/:enquiryPartId/feasibility/regret-letter/generate",
  asyncHandler(controller.generateRegretLetter)
);

router.get(
  "/:enquiryPartId/feasibility/regret-letter/preview",
  asyncHandler(controller.previewRegretLetter)
);

router.post(
  "/:enquiryPartId/feasibility/regret-letter/approve",
  asyncHandler(controller.approveRegretLetter)
);

router.post(
  "/:enquiryPartId/feasibility/regret-letter/sent",
  asyncHandler(controller.markRegretLetterSent)
);

export default router;
