import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./feasibility.repository.js";
import { APP_TIME_ZONE, todayInAppTimeZone } from "../../utils/dateTime.js";

const clean = (value, max = 1000) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

const yesNo = (value) => (["YES", "NO"].includes(value) ? value : null);
const optionalNonNegativeNumber = (value, label) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) throw new AppError(`${label} must be zero or positive.`);
  return parsed;
};
const hasPermission = (user, permission) =>
  Array.isArray(user?.permissions) && user.permissions.includes(permission);

function requirePermission(user, permission, message) {
  if (!hasPermission(user, permission)) throw new AppError(message, 403);
}

function normalized(data, submit) {
  const result = {
    feasibilityDate: data.feasibilityDate || todayInAppTimeZone(),
    communicationAddress: clean(data.communicationAddress),
    contactPerson: clean(data.contactPerson, 200),
    telephoneNumber: clean(data.telephoneNumber, 50),
    faxNumber: clean(data.faxNumber, 50),
    emailAddress: clean(data.emailAddress, 200),
    isNewCustomer: yesNo(data.isNewCustomer),
    existingProductsDetails: clean(data.existingProductsDetails),
    similarProductProcessing: yesNo(data.similarProductProcessing),
    similarProductDetails: clean(data.similarProductDetails),
    drawingReviewedCompletely: yesNo(data.drawingReviewedCompletely),
    drawingRequirementsUnderstood: yesNo(data.drawingRequirementsUnderstood),
    customerClarificationRequired: clean(data.customerClarificationRequired),
    productTechnicallyFeasible: yesNo(data.productTechnicallyFeasible),
    rawMaterialSource: ["CUSTOMER", "PURCHASE"].includes(data.rawMaterialSource)
      ? data.rawMaterialSource
      : null,
    purchaseSourceAvailable: yesNo(data.purchaseSourceAvailable),
    materialSourceDetails: clean(data.materialSourceDetails),
    outsourceProcessRequired: yesNo(data.outsourceProcessRequired),
    outsourceSourceDetails: clean(data.outsourceSourceDetails),
    toleranceAchievable: yesNo(data.toleranceAchievable),
    acceptanceCriteriaUnderstood: yesNo(data.acceptanceCriteriaUnderstood),
    customerSpecialCharacteristics: yesNo(data.customerSpecialCharacteristics),
    specialCharacteristicsDetails: clean(data.specialCharacteristicsDetails),
    customerFinalInspectionFormat: yesNo(data.customerFinalInspectionFormat),
    finalInspectionFormatDetails: clean(data.finalInspectionFormatDetails),
    batchSupplyReports: clean(data.batchSupplyReports),
    customerRequiredVolume: optionalNonNegativeNumber(data.customerRequiredVolume, "Customer required volume"),
    volumeUom: clean(data.volumeUom, 30),
    statutoryRequirements: clean(data.statutoryRequirements),
    customerSpecifiedPacking: yesNo(data.customerSpecifiedPacking),
    packingDetails: clean(data.packingDetails),
    customerSpecifiedLabelling: yesNo(data.customerSpecifiedLabelling),
    labellingDetails: clean(data.labellingDetails),
    transportationMode: clean(data.transportationMode, 100),
    customerSpecifiedTransporter: yesNo(data.customerSpecifiedTransporter),
    transporterDetails: clean(data.transporterDetails),
    freightPaidBy: ["BY_COMPANY", "BY_CUSTOMER", "NOT_APPLICABLE"].includes(data.freightPaidBy)
      ? data.freightPaidBy
      : null,
    paymentTerms: clean(data.paymentTerms),
    feasibilityDecision: ["FEASIBLE", "NOT_FEASIBLE"].includes(data.feasibilityDecision)
      ? data.feasibilityDecision
      : null,
    regretReason: clean(data.regretReason),
    finalRemarks: clean(data.finalRemarks),
    saveStatus: submit ? "CLOSED" : "DRAFT",
  };

  if (result.isNewCustomer === "YES") result.existingProductsDetails = null;
  if (result.similarProductProcessing !== "YES") result.similarProductDetails = null;
  if (result.drawingReviewedCompletely !== "YES") result.drawingRequirementsUnderstood = null;
  if (
    result.drawingReviewedCompletely === "YES" &&
    result.drawingRequirementsUnderstood === "YES"
  ) {
    result.customerClarificationRequired = null;
  }
  if (result.rawMaterialSource !== "PURCHASE") {
    result.purchaseSourceAvailable = null;
  }
  if (result.outsourceProcessRequired !== "YES") {
    result.outsourceSourceDetails = null;
  }
  if (result.customerSpecialCharacteristics !== "YES") result.specialCharacteristicsDetails = null;
  if (result.customerFinalInspectionFormat !== "YES") result.finalInspectionFormatDetails = null;
  if (result.customerRequiredVolume === null) result.volumeUom = null;
  if (result.customerSpecifiedPacking !== "YES") result.packingDetails = null;
  if (result.customerSpecifiedLabelling !== "YES") result.labellingDetails = null;
  if (result.customerSpecifiedTransporter !== "YES") result.transporterDetails = null;
  if (result.feasibilityDecision !== "NOT_FEASIBLE") result.regretReason = null;
  return result;
}

function requireValue(value, message) {
  if (!value) throw new AppError(message);
}

function validate(data, submit, { isLabourOrder = false } = {}) {
  if (data.emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress)) {
    throw new AppError("Enter a valid email address.");
  }
  if (!submit) return;

  requireValue(data.drawingReviewedCompletely, "Question 9 is required.");
  if (data.drawingReviewedCompletely === "YES") requireValue(data.drawingRequirementsUnderstood, "The drawing review and requirements question is required.");
  requireValue(data.productTechnicallyFeasible, "Question 10 is required.");
  if (!isLabourOrder) {
    requireValue(data.rawMaterialSource, "Question 11 is required.");
    requireValue(data.outsourceProcessRequired, "Question 12 is required.");
    if (data.outsourceProcessRequired === "YES") {
      requireValue(data.outsourceSourceDetails, "Enter outsource details.");
    }
  }
  requireValue(data.toleranceAchievable, "Question 13 is required.");
  requireValue(data.acceptanceCriteriaUnderstood, "The tolerance and acceptance criteria question is required.");
  requireValue(data.customerSpecialCharacteristics, "Question 14 is required.");
  if (data.customerSpecialCharacteristics === "YES") requireValue(data.specialCharacteristicsDetails, "Question 15 details are required.");
  requireValue(data.customerSpecifiedPacking, "Question 17 is required.");
  requireValue(data.customerSpecifiedLabelling, "The packing / labelling requirement question is required.");
  requireValue(data.freightPaidBy, "Question 18 is required.");
  requireValue(data.feasibilityDecision, "Feasibility decision is required.");

  if (data.feasibilityDecision === "FEASIBLE") {
    if (data.productTechnicallyFeasible === "NO") {
      throw new AppError("A technically infeasible product cannot be closed as FEASIBLE.");
    }
    if (
      [data.toleranceAchievable, data.acceptanceCriteriaUnderstood].includes("NO") &&
      !data.finalRemarks?.trim()
    ) {
      throw new AppError("Record the authorized clarification or deviation in Final Remarks before feasible closure.");
    }
  }
  if (data.feasibilityDecision === "NOT_FEASIBLE") {
    requireValue(data.regretReason, "Regret reason is required.");
  }
}

function allowedWorkflow(part, feasibility, regretLetter, user) {
  const allowedStages = ["Enquiry", "Feasibility"];
  if (
    part.part_status === "FEASIBLE" ||
    (part.part_status !== "NOT_FEASIBLE" && ["WORKOUT", "QUOTATION", "COMPLETED"].includes(part.current_stage))
  ) {
    allowedStages.push("Workout");
  }
  if (["QUOTATION", "COMPLETED"].includes(part.current_stage) && part.part_status !== "NOT_FEASIBLE") {
    allowedStages.push("Quotation");
  }

  const allowedActions = ["CANCEL"];
  if (feasibility?.save_status !== "CLOSED") {
    allowedActions.push("SAVE_DRAFT");
    if (hasPermission(user, "CLOSE_FEASIBILITY")) allowedActions.push("CLOSE_FEASIBILITY");
  } else if (hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")) {
    allowedActions.push("UPDATE_FEASIBILITY");
  }
  if (regretLetter) {
    if (
      ["NOT_GENERATED", "DRAFTED"].includes(regretLetter.letter_status) &&
      hasPermission(user, "GENERATE_REGRET_LETTER")
    ) {
      allowedActions.push("GENERATE_REGRET_LETTER");
    }
    if (["DRAFTED", "APPROVED", "SENT"].includes(regretLetter.letter_status)) {
      allowedActions.push("PREVIEW_REGRET_LETTER");
    }
    if (regretLetter.letter_status === "DRAFTED" && hasPermission(user, "APPROVE_REGRET_LETTER")) {
      allowedActions.push("APPROVE_REGRET_LETTER");
    }
    if (regretLetter.letter_status === "APPROVED" && hasPermission(user, "SEND_REGRET_LETTER")) {
      allowedActions.push("SEND_REGRET_LETTER");
    }
  }

  return {
    currentStage: part.current_stage,
    completedStages:
      feasibility?.save_status === "CLOSED" ? ["Enquiry", "Feasibility"] : ["Enquiry"],
    allowedStages,
    allowedActions,
  };
}

function groupMasters(rows) {
  return {
    transportationModes: rows
      .filter((row) => row.referenceType === "TRANSPORT_MODE")
      .map((row) => ({ value: row.valueCode, label: row.displayLabel })),
    paymentTerms: rows
      .filter((row) => row.referenceType === "PAYMENT_TERM")
      .map((row) => ({ value: row.displayLabel, label: row.displayLabel })),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildRegretLetter(part, feasibility) {
  const date = new Date().toLocaleDateString("en-IN", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Regret Letter - ${escapeHtml(part.doc_no)}</title>
<style>body{font-family:Arial,sans-serif;color:#202634;max-width:760px;margin:36px auto;line-height:1.6}header{border-bottom:3px solid #b8322a;padding-bottom:14px;margin-bottom:28px}h1{font-size:22px;margin:0;color:#253a83}.meta{color:#657087;font-size:13px}.subject{font-weight:700;margin:24px 0 16px}.signature{margin-top:44px}.reason{padding:12px 14px;background:#f7f8fb;border-left:4px solid #b8322a}</style></head>
<body><header><h1>A Tech Automation Pvt. Ltd.</h1><div class="meta">Feasibility Review Regret Letter</div></header>
<p>Date: ${escapeHtml(date)}</p><p>To,<br><strong>${escapeHtml(part.customer_name_snapshot)}</strong><br>${escapeHtml(feasibility.communication_address || "")}</p>
<p class="subject">Subject: Regret against enquiry ${escapeHtml(part.doc_no)} - ${escapeHtml(part.product_description)}</p>
<p>Dear Sir / Madam,</p><p>Thank you for giving us the opportunity to review the following requirement:</p>
<p><strong>Drawing:</strong> ${escapeHtml(part.drawing_number)} ${part.drawing_revision_number ? `/ Rev. ${escapeHtml(part.drawing_revision_number)}` : ""}<br><strong>Material:</strong> ${escapeHtml(part.material_and_grade)}</p>
<p>After completing our technical and commercial feasibility review, we regret that we are unable to proceed with this requirement at present.</p>
<div class="reason"><strong>Reason:</strong><br>${escapeHtml(feasibility.regret_reason)}</div>
<p>We appreciate your enquiry and look forward to supporting your future requirements.</p>
<p class="signature">For A Tech Automation Pvt. Ltd.<br><strong>${escapeHtml(feasibility.closed_by_name || feasibility.closed_by_code)}</strong><br>${escapeHtml(feasibility.closed_by_role || "Authorized Approver")}</p></body></html>`;
}

async function loadContext(enquiryPartId, connection) {
  const part = await repository.getPart(enquiryPartId, connection);
  if (!part) throw new AppError("Enquiry part not found.", 404);
  if (part.enquiry_save_status !== "SUBMITTED") {
    throw new AppError("Submit the enquiry before starting feasibility review.", 409);
  }
  const feasibility = await repository.getFeasibility(enquiryPartId, connection);
  const regretLetter = await repository.getRegretLetter(feasibility?.feasibility_id, connection);
  return { part, feasibility, regretLetter };
}

export async function getFeasibility(enquiryPartId, user) {
  const { part, feasibility, regretLetter } = await loadContext(enquiryPartId);
  const [items, references] = await Promise.all([
    repository.getEnquiryParts(part.enquiry_id),
    repository.getReferenceValues(),
  ]);
  return {
    part,
    items,
    feasibility,
    regretLetter,
    masters: groupMasters(references),
    workflow: allowedWorkflow(part, feasibility, regretLetter, user),
  };
}

export async function saveFeasibility(enquiryPartId, data, user, submit = false) {
  if (submit) {
    requirePermission(user, "CLOSE_FEASIBILITY", "You do not have permission to close feasibility.");
  }
  return withTransaction(async (connection) => {
    const { part, feasibility: existing } = await loadContext(enquiryPartId, connection);
    const updatingClosed = existing?.save_status === "CLOSED";
    if (updatingClosed && !hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")) {
      throw new AppError("Closed feasibility cannot be edited.", 409);
    }

    const prepared = normalized(data, submit);
    if (updatingClosed) {
      if (submit) {
        throw new AppError("Closed feasibility can only be updated, not closed again.", 409);
      }
      if (prepared.feasibilityDecision !== existing.feasibility_decision) {
        throw new AppError("The completed Feasibility decision cannot be changed.", 409);
      }
      prepared.saveStatus = "CLOSED";
    }
    validate(prepared, submit, { isLabourOrder: String(part.order_type || "").toUpperCase() === "LABOUR" });
    await repository.upsertFeasibility(connection, part, prepared, user.userCode);
    if (submit) {
      await repository.closeFeasibility(
        connection,
        part,
        prepared.feasibilityDecision,
        prepared.regretReason,
        { code: user.userCode, name: user.employeeName, role: user.role }
      );
    }
    return repository.getFeasibility(enquiryPartId, connection);
  });
}

export async function generateRegretLetter(enquiryPartId, user) {
  requirePermission(user, "GENERATE_REGRET_LETTER", "You do not have permission to generate regret letters.");
  return withTransaction(async (connection) => {
    const { part, feasibility, regretLetter } = await loadContext(enquiryPartId, connection);
    if (!feasibility || feasibility.save_status !== "CLOSED" || feasibility.feasibility_decision !== "NOT_FEASIBLE") {
      throw new AppError("Regret letter is available only for a closed NOT_FEASIBLE review.", 409);
    }
    if (!regretLetter) throw new AppError("Regret-letter tracking record was not initialized.", 409);
    if (["APPROVED", "SENT"].includes(regretLetter.letter_status)) {
      throw new AppError("Approved or sent regret letters cannot be regenerated.", 409);
    }

    const content = buildRegretLetter(part, feasibility);
    const fileName = `regret-${part.doc_no.replace(/[^a-z0-9]+/gi, "-")}-${part.enquiry_part_id}.html`;
    const directory = path.resolve(env.uploadRoot, "regret-letters");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, fileName), content, "utf8");
    const publicPath = `/uploads/regret-letters/${fileName}`;
    await repository.generateRegretLetter(
      connection,
      feasibility.feasibility_id,
      content,
      publicPath,
      user.userCode
    );
    return repository.getRegretLetter(feasibility.feasibility_id, connection);
  });
}

export async function previewRegretLetter(enquiryPartId) {
  const { feasibility, regretLetter } = await loadContext(enquiryPartId);
  if (!feasibility || !regretLetter?.letter_content) {
    throw new AppError("Generate the regret letter before previewing it.", 409);
  }
  return {
    status: regretLetter.letter_status,
    html: regretLetter.letter_content,
    filePath: regretLetter.file_path,
  };
}

export async function approveRegretLetter(enquiryPartId, user) {
  requirePermission(user, "APPROVE_REGRET_LETTER", "You do not have permission to approve regret letters.");
  return withTransaction(async (connection) => {
    const { feasibility, regretLetter } = await loadContext(enquiryPartId, connection);
    if (!feasibility || regretLetter?.letter_status !== "DRAFTED") {
      throw new AppError("Only a drafted regret letter can be approved.", 409);
    }
    await repository.approveRegretLetter(connection, feasibility.feasibility_id, user.userCode);
    return repository.getRegretLetter(feasibility.feasibility_id, connection);
  });
}

export async function markRegretLetterSent(enquiryPartId, user) {
  requirePermission(user, "SEND_REGRET_LETTER", "You do not have permission to mark regret letters as sent.");
  return withTransaction(async (connection) => {
    const { feasibility, regretLetter } = await loadContext(enquiryPartId, connection);
    if (!feasibility || regretLetter?.letter_status !== "APPROVED") {
      throw new AppError("Approve the regret letter before marking it as sent.", 409);
    }
    await repository.markRegretLetterSent(connection, feasibility.feasibility_id, user.userCode);
    return repository.getRegretLetter(feasibility.feasibility_id, connection);
  });
}
