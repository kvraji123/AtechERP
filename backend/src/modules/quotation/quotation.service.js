import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { env } from "../../config/env.js";
import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import * as repository from "./quotation.repository.js";

const hasPermission = (user, permission) => user?.permissions?.includes(permission);
const requirePermission = (user, permission, message) => {
  if (!hasPermission(user, permission)) throw new AppError(message, 403);
};
const uniqueIds = (value) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((item) => item > 0))]
  : [];
const cleanNotes = (notes) => Array.isArray(notes)
  ? notes.map((note) => String(note || "").trim()).filter(Boolean).slice(0, 50)
  : [];
const developmentCostDisplayFields = new Set([
  "pattern_development_cost_foreign",
  "fixture_development_cost_foreign",
  "tool_development_cost_foreign",
  "gauge_development_cost_foreign",
  "trial_development_cost_foreign",
]);
const cleanDevelopmentCostDisplayFields = (fields) => Array.isArray(fields)
  ? [...new Set(fields.map(String).filter((field) => developmentCostDisplayFields.has(field)))]
  : [];
function workflow(enquiry, quotation, user) {
  const finalized = quotation?.quotation_status === "FINALIZED";
  const actions = ["CANCEL"];
  if (!finalized) {
    if (hasPermission(user, "CREATE_QUOTATION")) actions.push("SAVE_DRAFT");
    if (hasPermission(user, "FINALIZE_QUOTATION")) actions.push("FINALIZE_QUOTATION");
  } else {
    if (hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")) actions.push("UPDATE_QUOTATION");
    if (hasPermission(user, "GENERATE_QUOTATION_PDF")) actions.push("GENERATE_QUOTATION_PDF");
    if (quotation?.pdf_status === "GENERATED") actions.push("PREVIEW_QUOTATION_PDF");
    if (quotation?.pdf_status === "GENERATED" && hasPermission(user, "SEND_QUOTATION_EMAIL")) {
      actions.push("SEND_QUOTATION_EMAIL");
    }
  }
  return {
    currentStage: enquiry.current_stage,
    allowedStages: ["Enquiry", "Feasibility", "Workout", "Quotation"],
    completedStages: finalized
      ? ["Enquiry", "Feasibility", "Workout", "Quotation"]
      : ["Enquiry", "Feasibility", "Workout"],
    allowedActions: actions,
  };
}

function assertQuotationStage(enquiry, eligibleParts, quotation) {
  if (!enquiry) throw new AppError("Enquiry not found.", 404);
  if (!eligibleParts.length && !quotation) {
    throw new AppError("No feasible parts with completed Workout are available for quotation.", 409);
  }
  if (!["QUOTATION", "COMPLETED"].includes(enquiry.current_stage) && !quotation) {
    throw new AppError("Complete Workout for every feasible part before creating the quotation.", 409);
  }
}

function validateSelection(selectedIds, eligibleParts, finalize) {
  const eligibleIds = eligibleParts.map((part) => Number(part.enquiry_part_id));
  if (finalize && !selectedIds.length) throw new AppError("Select quotation items.");
  if (selectedIds.some((id) => !eligibleIds.includes(id))) {
    throw new AppError("One or more selected parts are not quotation eligible.");
  }
  if (finalize && (selectedIds.length !== eligibleIds.length || eligibleIds.some((id) => !selectedIds.includes(id)))) {
    throw new AppError("Finalize must include every feasible part with a completed Workout.");
  }
}

function validateCurrency(parts, requestedCurrency) {
  const currencies = [...new Set(parts.map((part) => part.currency_code))];
  if (currencies.length > 1) throw new AppError("Completed Workouts use different quotation currencies. Align them before quotation.");
  const currency = currencies[0] || requestedCurrency;
  if (!currency) throw new AppError("Quotation currency is required.");
  if (requestedCurrency && requestedCurrency !== currency) {
    throw new AppError("Quotation currency must match the completed Workout currency.");
  }
  return currency;
}

export async function getQuotation(enquiryId, user) {
  const enquiry = await repository.getEnquiry(enquiryId);
  if (!enquiry) throw new AppError("Enquiry not found.", 404);
  const [quotation, eligibleParts, defaultNotes] = await Promise.all([
    repository.getQuotation(enquiryId),
    repository.getEligibleParts(enquiryId),
    repository.getDefaultNotes(),
  ]);
  assertQuotationStage(enquiry, eligibleParts, quotation);
  return {
    enquiry,
    eligibleParts,
    quotation,
    defaultNotes,
    workflow: workflow(enquiry, quotation, user),
  };
}

export async function saveQuotation(enquiryId, data, user, finalize = false) {
  if (finalize) {
    requirePermission(
      user,
      "FINALIZE_QUOTATION",
      "You do not have permission to finalize quotations."
    );
  } else if (
    !hasPermission(user, "CREATE_QUOTATION") &&
    !hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")
  ) {
    throw new AppError("You do not have permission to update quotations.", 403);
  }
  if (!data.quotationDate) throw new AppError("Quotation Date is required.");
  const selectedIds = uniqueIds(data.enquiryPartIds);
  const selectedDevelopmentCostFields = cleanDevelopmentCostDisplayFields(data.developmentCostDisplayFields);

  return withTransaction(async (connection) => {
    const enquiry = await repository.getEnquiry(enquiryId, connection);
    const existing = await repository.getQuotation(enquiryId, connection);
    const allEligible = await repository.getEligibleParts(enquiryId, null, connection);
    assertQuotationStage(enquiry, allEligible, existing);
    const updatingFinalized = existing?.quotation_status === "FINALIZED";
    if (updatingFinalized && !hasPermission(user, "EDIT_ENQUIRY_ALL_STAGES")) {
      throw new AppError("Finalized quotation cannot be edited.", 409);
    }
    if (updatingFinalized && finalize) {
      throw new AppError("Finalized quotation can only be updated, not finalized again.", 409);
    }
    validateSelection(selectedIds, allEligible, finalize || updatingFinalized);
    const selectedParts = allEligible.filter((part) => selectedIds.includes(Number(part.enquiry_part_id)));
    const currencyCode = validateCurrency(selectedParts.length ? selectedParts : allEligible, data.currencyCode);
    const defaultNotes = await repository.getDefaultNotes(connection);
    const notes = cleanNotes(data.notes).length ? cleanNotes(data.notes) : defaultNotes.map((note) => note.noteText);
    const quotationNo = existing?.quotation_no || await getNextDocumentNumber(connection, "QUOTATION");

    const quotationStatus = updatingFinalized
      ? "FINALIZED"
      : finalize
        ? "FINALIZED"
        : "DRAFT";
    await repository.upsertQuotation(connection, enquiry, quotationNo, { ...data, currencyCode }, user.userCode, quotationStatus);
    const quotationId = await repository.replaceQuotationItems(
      connection,
      enquiryId,
      selectedParts,
      user.userCode,
      selectedDevelopmentCostFields
    );
    await repository.replaceQuotationNotes(connection, quotationId, notes, user.userCode);
    if (updatingFinalized) {
      await repository.invalidatePdf(connection, quotationId, user.userCode);
    }
    if (finalize) await repository.finalizeQuotation(connection, quotationId, enquiryId, selectedIds, user);
    return repository.getQuotation(enquiryId, connection);
  });
}

const PDF_LAYOUT = {
  left: 32,
  right: 810,
  width: 778,
  footerTop: 562,
  bottom: 544,
  colors: {
    navy: "#142a5e",
    red: "#bd362e",
    ink: "#1f2a3d",
    muted: "#64748b",
    border: "#d8e0eb",
    paleBlue: "#eef3fa",
    paleRed: "#fff1f0",
  },
};

const quotationHeaderImagePath = fileURLToPath(
  new URL("../../assets/atech-quotation-header.png", import.meta.url)
);

const asText = (value) => String(value ?? "").trim() || "-";
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const asAmount = (value) => asNumber(value).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const asDate = (value) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : "-";
};

function drawPdfBrandHeader(doc, quotation, continuation = false) {
  const { left, right, width, colors } = PDF_LAYOUT;
  const headerHeight = continuation ? 78 : 104;
  const imageWidth = continuation ? 520 : width;
  const imageHeight = continuation ? 54 : 80;
  const imageY = continuation ? 8 : 10;

  doc.rect(0, 0, doc.page.width, headerHeight).fill("#ffffff");
  doc.image(quotationHeaderImagePath, left, imageY, {
    fit: [imageWidth, imageHeight],
  });
  doc.rect(left - 2, imageY - 2, 9, imageHeight + 4).fill("#ffffff");
  doc.strokeColor(colors.navy).lineWidth(1).moveTo(0, headerHeight).lineTo(doc.page.width, headerHeight).stroke();
  doc.x = left;
  doc.y = continuation ? 94 : 122;
}

function addPdfHeader(doc, quotation) {
  const { left, right, width, colors } = PDF_LAYOUT;
  drawPdfBrandHeader(doc, quotation);
  const customerX = left;
  const customerWidth = 430;
  const metaX = 526;
  const metaWidth = right - metaX;
  const panelTop = 122;

  doc.font("Helvetica-Bold").fontSize(8).fillColor(colors.red)
    .text("QUOTATION TO", customerX, panelTop, { width: customerWidth, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(12).fillColor(colors.ink)
    .text(asText(quotation.customer_name_snapshot), customerX, panelTop + 15, { width: customerWidth });
  let customerY = panelTop + 31 + doc.heightOfString(asText(quotation.customer_name_snapshot), { width: customerWidth });
  if (quotation.customer_address_snapshot) {
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted)
      .text(quotation.customer_address_snapshot, customerX, customerY, { width: customerWidth });
    customerY += doc.heightOfString(quotation.customer_address_snapshot, { width: customerWidth }) + 4;
  }
  if (quotation.customer_email_snapshot) {
    doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted)
      .text(quotation.customer_email_snapshot, customerX, customerY, { width: customerWidth });
  }

  doc.roundedRect(metaX, panelTop, metaWidth, 96, 6).fill(colors.paleBlue);
  const details = [
    ["Quotation No.", quotation.quotation_no],
    ["Quotation Date", asDate(quotation.quotation_date)],
    ["Reference", quotation.reference_no || quotation.quote_for],
    ["Currency", quotation.currency_code],
  ];
  details.forEach(([label, value], index) => {
    const y = panelTop + 10 + index * 21;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(colors.muted)
      .text(label, metaX + 11, y, { width: 75, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colors.ink)
      .text(asText(value), metaX + 88, y, { width: metaWidth - 100, align: "right", lineBreak: false, ellipsis: true });
    if (index < details.length - 1) {
      doc.strokeColor("#d5deeb").lineWidth(0.5)
        .moveTo(metaX + 10, y + 16).lineTo(right - 10, y + 16).stroke();
    }
  });

  const introTop = Math.max(customerY + 20, panelTop + 112);
  doc.strokeColor(colors.border).lineWidth(0.75).moveTo(left, introTop - 9).lineTo(right, introTop - 9).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink)
    .text(asText(quotation.salutation || "Dear Sir / Madam,"), left, introTop, { width });
  const introduction = asText(quotation.introduction || "Please find our quotation for the following items.");
  const introductionY = introTop + 21;
  doc.font("Helvetica").fontSize(9).fillColor(colors.muted)
    .text(introduction, left, introductionY, { width, lineGap: 2 });
  doc.x = left;
  doc.y = introductionY + doc.heightOfString(introduction, { width, lineGap: 2 }) + 19;
}

function addPdfContinuationHeader(doc, quotation) {
  drawPdfBrandHeader(doc, quotation, true);
}

function itemQuantity(item) {
  const quantity = item.annual_quantity ?? item.required_quantity;
  const unit = String(item.unit_of_measurement || "").trim();
  return quantity === null || quantity === undefined || quantity === ""
    ? "-"
    : `${Number(quantity).toLocaleString("en-IN")} ${unit}`.trim();
}

function addPdfItems(doc, quotation) {
  const { left, right, width, bottom, colors } = PDF_LAYOUT;
  const columns = [
    { x: left, width: 30, align: "center" },
    { x: left + 30, width: 78, align: "left" },
    { x: left + 108, width: 99, align: "left" },
    { x: left + 207, width: 36, align: "center" },
    { x: left + 243, width: 116, align: "left" },
    { x: left + 359, width: 55, align: "right" },
    { x: left + 414, width: 40, align: "right" },
    { x: left + 454, width: 78, align: "left" },
    { x: left + 532, width: 45, align: "right" },
    { x: left + 577, width: 83, align: "right" },
    { x: left + 660, width: 118, align: "right" },
  ];
  const headers = [
    "S. NO.",
    "ITEM CODE NO.",
    "MACHINING DRAWING NO.",
    "REV",
    "DESCRIPTION",
    "ANNUAL QTY",
    "MOQ",
    "MATERIAL",
    "WT. IN KGS",
    `PART PRICE\nFOB CHENNAI\n${quotation.currency_code || ""}`,
    `TOTAL DEVELOPMENT\nCOST\n${quotation.currency_code || ""}`,
  ];
  const drawTableHeader = () => {
    const y = doc.y;
    doc.rect(left, y, width, 43).fill(colors.navy);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(6.7);
    headers.forEach((header, index) => {
      doc.text(header, columns[index].x + 4, y + 7, {
        width: columns[index].width - 8,
        align: columns[index].align,
        lineGap: 1,
      });
    });
    doc.x = left;
    doc.y = y + 43;
  };
  const startNextPage = () => {
    doc.addPage();
    addPdfContinuationHeader(doc, quotation);
    drawTableHeader();
  };

  drawTableHeader();
  quotation.items.forEach((item, index) => {
    const unitPrice = asNumber(item.part_price_fob_foreign);
    const values = [
      String(index + 1),
      asText(item.item_code),
      asText(item.machining_drawing_number),
      asText(item.revision_number),
      asText(item.description),
      item.annual_quantity === null || item.annual_quantity === undefined || item.annual_quantity === ""
        ? itemQuantity(item)
        : `${Number(item.annual_quantity).toLocaleString("en-IN")} ${String(item.unit_of_measurement || "").trim()}`.trim(),
      asText(item.moq),
      asText(item.material),
      asAmount(item.weight_kg),
      asAmount(unitPrice),
      asAmount(item.total_development_cost_foreign),
    ];
    doc.font("Helvetica").fontSize(8);
    const rowHeight = Math.max(37, ...values.map((value, column) =>
      doc.heightOfString(value, { width: columns[column].width - 8, lineGap: 1 }) + 13
    ));
    if (doc.y + rowHeight > bottom) startNextPage();
    const y = doc.y;
    if (index % 2 === 1) doc.rect(left, y, width, rowHeight).fill("#f8fafc");
    doc.fillColor(colors.ink).font("Helvetica").fontSize(8);
    values.forEach((value, column) => {
      doc.text(value, columns[column].x + 4, y + 7, {
        width: columns[column].width - 8,
        align: columns[column].align,
        lineGap: 1,
      });
    });
    doc.strokeColor(colors.border).lineWidth(0.5).moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).stroke();
    doc.x = left;
    doc.y = y + rowHeight;
  });
}

function addPdfTerms(doc, quotation) {
  const { left, right, width, bottom, colors } = PDF_LAYOUT;
  const notes = quotation.notes?.map((note) => String(note.noteText || "").trim()).filter(Boolean) || [];
  const terms = notes.length ? notes : ["No additional commercial terms have been specified."];
  const drawTitle = () => {
    const y = doc.y + 14;
    doc.rect(left, y, width, 25).fill(colors.paleBlue);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(colors.navy)
      .text("COMMERCIAL TERMS", left + 10, y + 8, { width: width - 20, lineBreak: false });
    doc.y = y + 37;
  };

  if (doc.y + 70 > bottom) {
    doc.addPage();
    addPdfContinuationHeader(doc, quotation);
  }
  drawTitle();
  terms.forEach((term, index) => {
    doc.font("Helvetica").fontSize(8.5);
    const text = `${index + 1}. ${term}`;
    const height = Math.max(16, doc.heightOfString(text, { width: width - 22, lineGap: 2 }) + 5);
    if (doc.y + height + 80 > bottom) {
      doc.addPage();
      addPdfContinuationHeader(doc, quotation);
      drawTitle();
    }
    const y = doc.y;
    doc.fillColor(colors.ink).text(text, left + 11, y, { width: width - 22, lineGap: 2 });
    doc.strokeColor(colors.border).lineWidth(0.5).moveTo(left, y + height).lineTo(right, y + height).stroke();
    doc.y = y + height;
  });
}

function addPdfSignature(doc, quotation) {
  const { left, right, width, bottom, colors } = PDF_LAYOUT;
  const signatureHeight = 96;
  if (doc.y + signatureHeight > bottom) {
    doc.addPage();
    addPdfContinuationHeader(doc, quotation);
  }
  const signatureTop = doc.y + 34;
  doc.strokeColor(colors.border).lineWidth(0.75).moveTo(left, signatureTop - 14).lineTo(right, signatureTop - 14).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(colors.ink)
    .text("For A Tech Automation Pvt. Ltd.", right - 192, signatureTop, { width: 192, align: "right" });
  doc.font("Helvetica").fontSize(8.5).fillColor(colors.muted)
    .text(quotation.finalized_by_name || quotation.finalized_by || "Authorized Signatory", right - 192, signatureTop + 34, {
      width: 192,
      align: "right",
    });
  doc.font("Helvetica").fontSize(7.5).fillColor(colors.muted)
    .text("Authorized Signatory", right - 192, signatureTop + 49, { width: 192, align: "right" });
  doc.x = left;
  doc.y = signatureTop + 60;
}

function addPdfFooter(doc, quotation) {
  const { left, right, width, footerTop, colors } = PDF_LAYOUT;
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.strokeColor(colors.border).lineWidth(0.75).moveTo(left, footerTop).lineTo(right, footerTop).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(colors.muted)
      .text(`Quotation ${asText(quotation.quotation_no)}  |  A Tech Automation Pvt. Ltd.`, left, footerTop + 9, {
        width: width / 2,
        lineBreak: false,
      });
    doc.text(`Page ${page + 1} of ${range.count}`, left + width / 2, footerTop + 9, {
      width: width / 2,
        align: "right",
        lineBreak: false,
      });
    doc.page.margins.bottom = bottomMargin;
  }
}

async function writePdf(quotation, absolutePath) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: PDF_LAYOUT.left,
      bufferPages: true,
      info: {
        Title: `Quotation ${quotation.quotation_no}`,
        Author: "A Tech Automation Pvt. Ltd.",
        Subject: "Customer quotation",
      },
    });
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
    addPdfHeader(doc, quotation);
    addPdfItems(doc, quotation);
    addPdfTerms(doc, quotation);
    addPdfSignature(doc, quotation);
    addPdfFooter(doc, quotation);
    doc.end();
  });
}

export async function generatePdf(enquiryId, user) {
  requirePermission(user, "GENERATE_QUOTATION_PDF", "You do not have permission to generate quotation PDFs.");
  const quotation = await repository.getQuotation(enquiryId);
  if (!quotation || quotation.quotation_status !== "FINALIZED") throw new AppError("Finalize the quotation before generating PDF.", 409);
  const directory = path.resolve(env.uploadRoot, "quotations");
  await fsPromises.mkdir(directory, { recursive: true });
  const fileName = `${quotation.quotation_no.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  const absolutePath = path.join(directory, fileName);
  await writePdf(quotation, absolutePath);
  const publicPath = `/uploads/quotations/${fileName}`;
  await withTransaction((connection) => repository.setPdfGenerated(connection, quotation.quotation_id, publicPath, user.userCode));
  return repository.getQuotation(enquiryId);
}
