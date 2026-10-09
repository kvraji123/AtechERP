import { sendSuccess } from "../../utils/response.js";
import * as service from "./enquiry.service.js";

export async function dashboardSummary(_req, res) {
  return sendSuccess(res, { data: await service.dashboardSummary() });
}

export async function listEnquiries(req, res) {
  const result = await service.listEnquiries(req.query);

  return sendSuccess(res, {
    data: result.rows,
    meta: {
      total: result.total,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 20),
    },
  });
}

export async function listEnquiryFilterOptions(_req, res) {
  return sendSuccess(res, {
    data: await service.listEnquiryFilterOptions(),
  });
}

export async function getEnquiry(req, res) {
  return sendSuccess(res, {
    data: await service.getEnquiry(req.params.enquiryId),
  });
}

export async function getEnquiryRevisions(req, res) {
  return sendSuccess(res, {
    data: await service.getEnquiryRevisions(req.params.enquiryId),
  });
}

export async function createEnquiry(req, res) {
  return sendSuccess(res, {
    statusCode: 201,
    message:
      req.body.action === "SUBMIT"
        ? "Enquiry submitted successfully."
        : "Enquiry draft saved successfully.",
    data: await service.createEnquiry(req.body, req.user.userCode),
  });
}

export async function updateEnquiry(req, res) {
  return sendSuccess(res, {
    message:
      req.body.action === "SUBMIT"
        ? "Enquiry submitted successfully."
        : "Enquiry draft updated successfully.",
    data: await service.updateEnquiry(
      req.params.enquiryId,
      req.body,
      req.user.userCode
    ),
  });
}

export async function changeEnquiryStatus(req, res) {
  return sendSuccess(res, {
    message: "Enquiry status updated successfully.",
    data: await service.changeEnquiryStatus(
      req.params.enquiryId,
      req.body.enquiryStatus,
      req.user.userCode
    ),
  });
}

export async function submitEnquiry(req, res) {
  return sendSuccess(res, {
    message: "Enquiry submitted successfully.",
    data: await service.submitEnquiry(
      req.params.enquiryId,
      req.user.userCode
    ),
  });
}

export async function eligibleQuotationParts(req, res) {
  return sendSuccess(res, {
    data: await service.getEligibleQuotationParts(
      req.params.enquiryId
    ),
  });
}
