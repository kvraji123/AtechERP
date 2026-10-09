import { sendSuccess } from "../../utils/response.js";
import * as service from "./feasibility.service.js";

export async function getFeasibility(req, res) {
  return sendSuccess(res, {
    data: await service.getFeasibility(req.params.enquiryPartId, req.user),
  });
}

export async function saveFeasibility(req, res) {
  return sendSuccess(res, {
    message: "Feasibility draft saved successfully.",
    data: await service.saveFeasibility(
      req.params.enquiryPartId,
      req.body,
      req.user,
      false
    ),
  });
}

export async function submitFeasibility(req, res) {
  return sendSuccess(res, {
    message:
      req.body.feasibilityDecision === "FEASIBLE"
        ? "Feasibility closed. Workout stage is available when all items are feasible."
        : "Feasibility closed as not feasible. Regret-letter flow has been initiated.",
    data: await service.saveFeasibility(
      req.params.enquiryPartId,
      req.body,
      req.user,
      true
    ),
  });
}

export async function generateRegretLetter(req, res) {
  return sendSuccess(res, {
    message: "Regret letter generated as a draft.",
    data: await service.generateRegretLetter(req.params.enquiryPartId, req.user),
  });
}

export async function previewRegretLetter(req, res) {
  return sendSuccess(res, {
    data: await service.previewRegretLetter(req.params.enquiryPartId),
  });
}

export async function approveRegretLetter(req, res) {
  return sendSuccess(res, {
    message: "Regret letter approved successfully.",
    data: await service.approveRegretLetter(req.params.enquiryPartId, req.user),
  });
}

export async function markRegretLetterSent(req, res) {
  return sendSuccess(res, {
    message: "Regret letter marked as sent.",
    data: await service.markRegretLetterSent(req.params.enquiryPartId, req.user),
  });
}
