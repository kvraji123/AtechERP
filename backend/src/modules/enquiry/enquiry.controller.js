import { sendSuccess } from "../../utils/response.js";
import * as service from "./enquiry.service.js";

export async function dashboardSummary(_req, res) {
  return sendSuccess(res, { data: await service.dashboardSummary() });
}

export async function listEnquiries(req, res) {
  const result = await service.listEnquiries(req.query, req.user);

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
    data: await service.getEnquiry(req.params.enquiryId, req.user),
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
        : "Enquiry saved successfully.",
    data: await service.createEnquiry(req.body, req.user),
  });
}

export async function updateEnquiry(req, res) {
  return sendSuccess(res, {
    message:
      req.body.action === "SUBMIT"
        ? "Enquiry submitted successfully."
        : "Enquiry changes saved successfully.",
    data: await service.updateEnquiry(
      req.params.enquiryId,
      req.body,
      req.user
    ),
  });
}

export async function deleteEnquiry(req, res) {
  await service.deleteEnquiry(req.params.enquiryId, req.user.userCode);

  return sendSuccess(res, {
    message: "Enquiry deleted successfully.",
  });
}

export async function hardDeleteEnquiry(req, res) {
  const result = await service.hardDeleteEnquiry(req.params.enquiryId, req.user);

  return sendSuccess(res, {
    message: result.fileCleanupPending
      ? "Enquiry permanently deleted, but some stored files could not be removed. Contact support to finish file cleanup."
      : "Inactive enquiry and its enquiry workflow permanently deleted.",
  });
}


export async function changeEnquiryStatus(req, res) {
  return sendSuccess(res, {
    message: "Enquiry status updated successfully.",
    data: await service.changeEnquiryStatus(
      req.params.enquiryId,
      req.body.enquiryStatus,
      req.user
    ),
  });
}

export async function submitEnquiry(req, res) {
  return sendSuccess(res, {
    message: "Enquiry submitted successfully.",
    data: await service.submitEnquiry(
      req.params.enquiryId,
      req.user
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
