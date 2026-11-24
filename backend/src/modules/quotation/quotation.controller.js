import { sendSuccess } from "../../utils/response.js";
import * as service from "./quotation.service.js";

export async function getQuotation(req, res) {
  return sendSuccess(res, {
    data: await service.getQuotation(req.params.enquiryId, req.user),
  });
}

export async function saveQuotation(req, res) {
  return sendSuccess(res, {
    message: "Quotation draft saved successfully.",
    data: await service.saveQuotation(
      req.params.enquiryId,
      req.body,
      req.user,
      false
    ),
  });
}

export async function submitQuotation(req, res) {
  return sendSuccess(res, {
    message: "Quotation finalized successfully.",
    data: await service.saveQuotation(
      req.params.enquiryId,
      req.body,
      req.user,
      true
    ),
  });
}

export async function generateQuotationPdf(req, res) {
  return sendSuccess(res, {
    message: "Quotation PDF generated successfully.",
    data: await service.generatePdf(req.params.enquiryId, req.user),
  });
}

export async function sendQuotationEmail(req, res) {
  return sendSuccess(res, {
    message: "Quotation email sent successfully.",
    data: await service.sendEmail(req.params.enquiryId, req.body, req.user),
  });
}
