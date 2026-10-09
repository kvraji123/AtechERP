import { sendSuccess } from "../../utils/response.js";
import * as service from "./workout.service.js";

export async function getWorkout(req, res) {
  return sendSuccess(res, {
    data: await service.getWorkout(req.params.enquiryPartId, req.user),
  });
}

export async function saveWorkout(req, res) {
  return sendSuccess(res, {
    message: "Workout draft saved successfully.",
    data: await service.saveWorkout(
      req.params.enquiryPartId,
      req.body,
      req.user,
      false
    ),
  });
}

export async function submitWorkout(req, res) {
  return sendSuccess(res, {
    message: "Workout completed successfully.",
    data: await service.saveWorkout(
      req.params.enquiryPartId,
      req.body,
      req.user,
      true
    ),
  });
}
