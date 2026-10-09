import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./workout.controller.js";

const router = Router();

router.get(
  "/:enquiryPartId/workout",
  asyncHandler(controller.getWorkout)
);

router.put(
  "/:enquiryPartId/workout",
  asyncHandler(controller.saveWorkout)
);

router.post(
  "/:enquiryPartId/workout/submit",
  asyncHandler(controller.submitWorkout)
);

export default router;
