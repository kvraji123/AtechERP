import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { db, withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { isValidDateOnly, todayInAppTimeZone } from "../../utils/dateTime.js";
import { amountInWords } from "../../utils/amountInWords.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import * as enquiryRepository from "../enquiry/enquiry.repository.js";
import { findMarketingDatabaseByEnquiryId } from "../marketing/marketing-database.js";
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
const developmentCostLabels = {
  PATTERN: "Pattern Cost",
  FIXTURE: "Fixture Cost",
  TOOL: "Tool Cost",
  GAUGE: "Gauge Cost",
  TRIAL: "Trial Cost",
};
const cleanDevelopmentCostDisplayFields = (fields) => Array.isArray(fields)
  ? [...new Set(fields.map(String).filter((field) => developmentCostDisplayFields.has(field)))]
  : [];
const ensureNotFutureDate = (value, label) => {
  const date = String(value || "").trim();
  if (!date) return;
  if (!isValidDateOnly(date)) throw new AppError(`${label} must be a valid date.`);
  if (date > todayInAppTimeZone()) throw new AppError(`${label} cannot be a future date.`);
};
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
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  const enquiry = await repository.getEnquiry(enquiryId, marketingDatabase.pool, db);
  if (!enquiry) throw new AppError("Enquiry not found.", 404);
  const [quotation, eligibleParts, defaultNotes] = await Promise.all([
    repository.getQuotation(enquiryId, marketingDatabase.pool),
    repository.getEligibleParts(enquiryId, null, marketingDatabase.pool),
    repository.getDefaultNotes(db),
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
  const quotationDate = String(data.quotationDate || "").trim() || todayInAppTimeZone();
  if (finalize && !data.quotationDate) throw new AppError("Quotation Date is required.");
  ensureNotFutureDate(quotationDate, "Quotation Date");
  const selectedIds = uniqueIds(data.enquiryPartIds);
  const selectedDevelopmentCostFields = cleanDevelopmentCostDisplayFields(data.developmentCostDisplayFields);

  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  return marketingDatabase.withTransaction(async (connection) => {
    const enquiry = await repository.getEnquiry(enquiryId, connection, db);
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
    const defaultNotes = await repository.getDefaultNotes(db);
    const notes = cleanNotes(data.notes).length ? cleanNotes(data.notes) : defaultNotes.map((note) => note.noteText);
    const quotationNo = existing?.quotation_no || (marketingDatabase.key === "ATECH"
      ? await getNextDocumentNumber(connection, "QUOTATION")
      : await withTransaction((masterConnection) => getNextDocumentNumber(masterConnection, "QUOTATION")));

    const quotationStatus = updatingFinalized
      ? "FINALIZED"
      : finalize
        ? "FINALIZED"
        : "DRAFT";
    await repository.upsertQuotation(connection, enquiry, quotationNo, {
      ...data,
      quotationDate,
      currencyCode,
    }, user.userCode, quotationStatus);
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
    const savedQuotation = await repository.getQuotation(enquiryId, connection);
    await enquiryRepository.appendEnquiryRevision(connection, {
      enquiryId: Number(enquiryId),
      revisionAction: finalize ? "QUOTATION_FINALIZED" : "QUOTATION_SAVED",
      saveStatus: enquiry.save_status,
      snapshot: {
        stage: "QUOTATION",
        selectedEnquiryPartIds: selectedIds,
        quotation: savedQuotation,
      },
      userCode: user.userCode,
    });
    return savedQuotation;
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
    tableHeader: "#dce9f7",
    tableHeaderBorder: "#b8cae1",
    tableGrid: "#334155",
    paleRed: "#fff1f0",
  },
};

const quotationHeaderImagePath = fileURLToPath(
  new URL("../../assets/atech-quotation-header.png", import.meta.url)
);
const cmsQuotationHeaderImagePath = fileURLToPath(
  new URL("../../assets/cms-quotation-header.jpeg", import.meta.url)
);
const quotationUnivers45FontPath = fileURLToPath(
  new URL("../../assets/Univers-45-Light.ttf", import.meta.url)
);
const hasQuotationUnivers45Font = fs.existsSync(quotationUnivers45FontPath);
const quotationFont = (weight = "regular") => hasQuotationUnivers45Font
  ? "Univers45"
  : weight === "bold" ? "Helvetica-Bold" : "Helvetica";

function registerQuotationFont(doc) {
  if (hasQuotationUnivers45Font) doc.registerFont("Univers45", quotationUnivers45FontPath);
}

const asText = (value) => String(value ?? "").trim() || "-";
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const asAmount = (value) => asNumber(value).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quotedQuantity = (item) => asNumber(item.annual_quantity ?? item.required_quantity);
const quotedLineTotal = (item) => quotedQuantity(item) * asNumber(item.part_price_fob_foreign);
const sampleCostInQuotationCurrency = (item) => {
  const sampleCostInr = asNumber(item.sample_cost_inr);
  const fobPriceInr = asNumber(item.part_price_fob_inr);
  const fobPriceForeign = asNumber(item.part_price_fob_foreign);
  return fobPriceInr > 0 ? sampleCostInr * fobPriceForeign / fobPriceInr : 0;
};
const asDate = (value) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : "-";
};

export function quotationBrand(quotation) {
  // The resolved marketing database is the source of truth.  This also keeps
  // the correct branding for an older CMS enquiry whose stored order_type is
  // missing or was entered incorrectly before CMS routing was introduced.
  const isCmsDatabase = String(
    quotation.marketingDatabaseKey || quotation.marketing_database_key || ""
  ).trim().toUpperCase() === "CMS";
  const isCmsOrderType = String(quotation.enquiry_order_type || quotation.order_type || "")
    .trim()
    .toUpperCase() === "LABOUR";
  const isCmsQuotation = isCmsDatabase || isCmsOrderType;
  return isCmsQuotation
    ? {
      address: "65B, Athipalayam Road, Chinnavedampatty, Coimbatore - 641 006.",
      companyName: "Crest Machining Solutions",
      gstin: "GST - 33AIEPM7446C1ZH",
      headerImagePath: cmsQuotationHeaderImagePath,
      key: "CMS",
    }
    : {
      companyName: "A Tech Automation",
      headerImagePath: quotationHeaderImagePath,
      key: "ATECH",
    };
}

function drawPdfBrandHeader(doc, quotation, continuation = false) {
  const { left, right, width, colors } = PDF_LAYOUT;
  const brand = quotationBrand(quotation);
  const headerHeight = continuation ? 68 : 92;
  const imageHeight = continuation ? 54 : 80;
  const imageY = continuation ? 8 : 10;
  const companyNameY = continuation ? 10 : 18;
  const addressY = continuation ? 32 : 47;
  const gstinY = continuation ? 46 : 64;
  const logoWidth = continuation ? 120 : 145;
  const isCmsBrand = brand.key === "CMS";
  const cmsLogoHeight = logoWidth * 416 / 1600;
  const logoY = isCmsBrand
    ? imageY + (imageHeight - cmsLogoHeight) / 2
    : imageY;

  doc.rect(0, 0, doc.page.width, headerHeight).fill("#ffffff");
  if (isCmsBrand) {
    doc.image(brand.headerImagePath, left, logoY, { fit: [logoWidth, imageHeight] });
    doc.font(quotationFont("bold")).fontSize(15).fillColor("#0075cf")
      .text(brand.companyName.toUpperCase(), left, companyNameY, {
        width,
        align: "center",
        lineBreak: false,
      });
    doc.font(quotationFont()).fontSize(9.5).fillColor("#0075cf")
      .text(brand.address, left, addressY, {
        width,
        align: "center",
        lineBreak: false,
      });
    doc.font(quotationFont("bold")).fontSize(9.5).fillColor("#0075cf")
      .text(brand.gstin, left, gstinY, {
        width,
        align: "center",
        lineBreak: false,
      });
  } else {
    doc.save();
    doc.rect(left, imageY, logoWidth, imageHeight).clip();
    doc.image(brand.headerImagePath, left, imageY, { fit: [width, imageHeight] });
    doc.restore();
    doc.rect(left - 2, imageY - 2, 9, imageHeight + 4).fill("#ffffff");
    doc.font(quotationFont("bold")).fontSize(15).fillColor("#0075cf")
      .text("A TECH AUTOMATION", left, companyNameY, { width, align: "center", lineBreak: false });
    doc.font(quotationFont()).fontSize(9.5).fillColor("#0075cf")
      .text("1448 R.K Puram, Sathy Road, Ganapathy, Coimbatore - 641004", left, addressY, { width, align: "center", lineBreak: false });
    doc.font(quotationFont("bold")).fontSize(9.5).fillColor("#0075cf")
      .text("GSTIN No: 33AAZFA8601N1ZW", left, gstinY, { width, align: "center", lineBreak: false });
  }
  doc.strokeColor(colors.navy).lineWidth(1).moveTo(0, headerHeight).lineTo(doc.page.width, headerHeight).stroke();
  doc.x = left;
  doc.y = continuation ? 80 : 103;
}

function addPdfHeader(doc, quotation) {
  const { left, right, width, colors } = PDF_LAYOUT;
  drawPdfBrandHeader(doc, quotation);
  const customerX = left;
  const customerWidth = 430;
  const metaX = 526;
  const metaWidth = right - metaX;
  const panelTop = 103;

  doc.font(quotationFont("bold")).fontSize(8).fillColor(colors.red)
    .text("QUOTATION TO", customerX, panelTop, { width: customerWidth, lineBreak: false });
  doc.font(quotationFont("bold")).fontSize(12).fillColor(colors.ink)
    .text(asText(quotation.customer_name_snapshot), customerX, panelTop + 15, { width: customerWidth });
  let customerY = panelTop + 31 + doc.heightOfString(asText(quotation.customer_name_snapshot), { width: customerWidth });
  if (quotation.customer_address_snapshot) {
    doc.font(quotationFont()).fontSize(8.5).fillColor(colors.muted)
      .text(quotation.customer_address_snapshot, customerX, customerY, { width: customerWidth });
    customerY += doc.heightOfString(quotation.customer_address_snapshot, { width: customerWidth }) + 4;
  }
  if (quotation.customer_email_snapshot) {
    doc.font(quotationFont()).fontSize(8.5).fillColor(colors.muted)
      .text(quotation.customer_email_snapshot, customerX, customerY, { width: customerWidth });
  }

  const details = [
    ["Quotation No.", quotation.quotation_no],
    ["Quotation Date", asDate(quotation.quotation_date)],
    ["Reference", quotation.reference_no || quotation.quote_for],
    ...(quotation.customer_enquiry_reference
      ? [["Customer Enquiry No.", quotation.customer_enquiry_reference]]
      : []),
    ...(quotation.customer_enquiry_date
      ? [["Customer Enquiry Date", asDate(quotation.customer_enquiry_date)]]
      : []),
    ...(quotation.customer_representative_name
      ? [["Representative Name", quotation.customer_representative_name]]
      : []),
    ["Currency", quotation.currency_code],
  ];
  const detailHeight = 12 + details.length * 21;
  doc.roundedRect(metaX, panelTop, metaWidth, detailHeight, 6).fill(colors.paleBlue);
  details.forEach(([label, value], index) => {
    const y = panelTop + 10 + index * 21;
    doc.font(quotationFont("bold")).fontSize(7.5).fillColor(colors.muted)
      .text(label, metaX + 11, y, { width: 105, lineBreak: false, ellipsis: true });
    doc.font(quotationFont("bold")).fontSize(8.5).fillColor(colors.ink)
      .text(asText(value), metaX + 120, y, { width: metaWidth - 132, align: "right", lineBreak: false, ellipsis: true });
    if (index < details.length - 1) {
      doc.strokeColor("#d5deeb").lineWidth(0.5)
        .moveTo(metaX + 10, y + 16).lineTo(right - 10, y + 16).stroke();
    }
  });

  const introTop = Math.max(customerY + 20, panelTop + detailHeight + 16);
  doc.strokeColor(colors.border).lineWidth(0.75).moveTo(left, introTop - 9).lineTo(right, introTop - 9).stroke();
  doc.font(quotationFont("bold")).fontSize(9).fillColor(colors.ink)
    .text(asText(quotation.salutation || "Dear Sir / Madam,"), left, introTop, { width });
  const introduction = asText(quotation.introduction || "Please find our quotation for the following items.");
  const introductionY = introTop + 21;
  doc.font(quotationFont()).fontSize(9).fillColor(colors.muted)
    .text(introduction, left, introductionY, { width, lineGap: 2 });
  doc.x = left;
  doc.y = introductionY + doc.heightOfString(introduction, { width, lineGap: 2 }) + 19;
}

function addPdfContinuationHeader(doc, quotation) {
  drawPdfBrandHeader(doc, quotation, true);
}

function addPdfItems(doc, quotation) {
  const { left, right, width, bottom, colors } = PDF_LAYOUT;
  const currencyCode = String(quotation.currency_code || "INR").trim().toUpperCase();
  const columnWidths = [25, 58, 75, 24, 90, 48, 35, 36, 65, 40, 68, 72, 70, 72];
  const columns = columnWidths.reduce((result, columnWidth) => {
    const x = result.length ? result[result.length - 1].x + result[result.length - 1].width : left;
    result.push({ x, width: columnWidth, align: "left" });
    return result;
  }, []);
  [0, 3, 5, 6, 7].forEach((index) => { columns[index].align = "center"; });
  [9, 10, 11, 12, 13].forEach((index) => { columns[index].align = "right"; });
  const headers = [
    "S. NO.",
    "ITEM CODE",
    "DRAWING NO.",
    "REV.",
    "DESCRIPTION",
    "ANNUAL QTY",
    "UOM",
    "MOQ",
    "MATERIAL",
    "WT. (KGS)",
    `FOB PRICE (${currencyCode})`,
    `LINE TOTAL (${currencyCode})`,
    `SAMPLE COST (${currencyCode})`,
    `DEVELOPMENT COST (${currencyCode})`,
  ];
  const drawTableHeader = () => {
    const y = doc.y;
    const headerHeight = 30;
    doc.rect(left, y, width, headerHeight).fill(colors.tableHeader);
    doc.strokeColor(colors.tableGrid).lineWidth(0.85)
      .rect(left, y, width, headerHeight).stroke();
    columns.slice(1).forEach((column) => {
      doc.strokeColor(colors.tableGrid).lineWidth(0.85)
        .moveTo(column.x, y).lineTo(column.x, y + headerHeight).stroke();
    });
    doc.fillColor(colors.navy).font(quotationFont("bold")).fontSize(6.2);
    headers.forEach((header, index) => {
      doc.text(header, columns[index].x + 3, y + 10, {
        width: columns[index].width - 6,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.x = left;
    doc.y = y + headerHeight;
  };
  const startNextPage = () => {
    doc.addPage();
    addPdfContinuationHeader(doc, quotation);
    drawTableHeader();
  };

  drawTableHeader();
  quotation.items.forEach((item, index) => {
    const unitPrice = asNumber(item.part_price_fob_foreign);
    const quantity = quotedQuantity(item);
    const lineTotal = quotedLineTotal(item);
    const values = [
      String(index + 1),
      asText(item.item_code),
      asText(item.machining_drawing_number),
      asText(item.revision_number),
      asText(item.description),
      item.annual_quantity === null || item.annual_quantity === undefined || item.annual_quantity === ""
        ? item.required_quantity === null || item.required_quantity === undefined || item.required_quantity === ""
          ? "-"
          : quantity.toLocaleString("en-IN")
        : quantity.toLocaleString("en-IN"),
      asText(item.unit_of_measurement),
      asText(item.moq),
      asText(item.material),
      asAmount(item.weight_kg),
      asAmount(unitPrice),
      asAmount(lineTotal),
      asAmount(sampleCostInQuotationCurrency(item)),
      asAmount(item.total_development_cost_foreign),
    ];
    doc.font(quotationFont()).fontSize(8);
    const rowHeight = Math.max(37, ...values.map((value, column) =>
      doc.heightOfString(value, { width: columns[column].width - 8, lineGap: 1 }) + 13
    ));
    if (doc.y + rowHeight > bottom) startNextPage();
    const y = doc.y;
    if (index % 2 === 1) doc.rect(left, y, width, rowHeight).fill("#f8fafc");
    doc.strokeColor(colors.tableGrid).lineWidth(0.75).rect(left, y, width, rowHeight).stroke();
    columns.slice(1).forEach((column) => {
      doc.strokeColor(colors.tableGrid).lineWidth(0.75)
        .moveTo(column.x, y).lineTo(column.x, y + rowHeight).stroke();
    });
    doc.fillColor(colors.ink).font(quotationFont()).fontSize(8);
    values.forEach((value, column) => {
      doc.text(value, columns[column].x + 4, y + 7, {
        width: columns[column].width - 8,
        align: columns[column].align,
        lineGap: 1,
      });
    });
    doc.x = left;
    doc.y = y + rowHeight;
  });
}

function addPdfCostSummary(doc, quotation) {
  const { left, right, width, bottom, colors } = PDF_LAYOUT;
  const developmentTotals = new Map();
  (quotation.items || []).forEach((item) => {
    (item.optionalCosts || []).forEach((cost) => {
      const type = String(cost.costType || "").toUpperCase();
      if (!developmentCostLabels[type]) return;
      developmentTotals.set(type, (developmentTotals.get(type) || 0) + asNumber(cost.amountForeign));
    });
  });
  const developmentRows = Object.keys(developmentCostLabels)
    .filter((type) => developmentTotals.has(type))
    .map((type) => ({ label: developmentCostLabels[type], value: developmentTotals.get(type) }));
  const totalDevelopmentCost = developmentRows.reduce((sum, row) => sum + row.value, 0);
  const quotedItemsTotal = (quotation.items || []).reduce((sum, item) => sum + quotedLineTotal(item), 0);
  const quotationTotal = quotedItemsTotal + totalDevelopmentCost;
  const currencyCode = String(quotation.currency_code || "INR").trim().toUpperCase();
  const quotationTotalInWords = amountInWords(quotationTotal, currencyCode);
  const rows = [
    ...developmentRows,
    { label: `Quoted Items Total (${currencyCode})`, value: quotedItemsTotal },
    { label: `Total Development Cost (${currencyCode})`, value: totalDevelopmentCost },
    { label: `Quotation Total (${currencyCode})`, value: quotationTotal, total: true },
  ];
  doc.font(quotationFont()).fontSize(8.5);
  const amountWordsHeight = Math.max(24, doc.heightOfString(quotationTotalInWords, { width: width - 132, lineGap: 2 }) + 14);
  const sectionHeight = 51 + rows.length * 24 + amountWordsHeight;

  if (doc.y + sectionHeight > bottom) {
    doc.addPage();
    addPdfContinuationHeader(doc, quotation);
  }

  const titleY = doc.y + 14;
  doc.rect(left, titleY, width, 25).fill(colors.paleBlue);
  doc.font(quotationFont("bold")).fontSize(10).fillColor(colors.navy)
    .text("QUOTATION VALUE SUMMARY", left + 10, titleY + 8, { width: width - 20, lineBreak: false });
  let rowY = titleY + 37;
  rows.forEach((row) => {
    if (row.total) doc.rect(left, rowY, width, 22).fill("#f8fafc");
    doc.font(quotationFont(row.total ? "bold" : "regular")).fontSize(8.5).fillColor(colors.ink)
      .text(row.label, left + 11, rowY + 7, { width: width - 170, lineBreak: false });
    doc.font(quotationFont(row.total ? "bold" : "regular")).fontSize(8.5).fillColor(colors.ink)
      .text(asAmount(row.value), right - 145, rowY + 7, { width: 134, align: "right", lineBreak: false });
    doc.strokeColor(colors.border).lineWidth(0.5).moveTo(left, rowY + 22).lineTo(right, rowY + 22).stroke();
    rowY += 24;
  });
  doc.rect(left, rowY, width, amountWordsHeight).fill("#f8fafc");
  doc.font(quotationFont("bold")).fontSize(8.5).fillColor(colors.ink)
    .text("Amount in words:", left + 11, rowY + 7, { width: 102, lineBreak: false });
  doc.font(quotationFont()).fontSize(8.5).fillColor(colors.ink)
    .text(quotationTotalInWords, left + 120, rowY + 7, { width: width - 132, lineGap: 2 });
  doc.strokeColor(colors.border).lineWidth(0.5).rect(left, rowY, width, amountWordsHeight).stroke();
  rowY += amountWordsHeight;
  doc.x = left;
  doc.y = rowY;
}

function addPdfTerms(doc, quotation) {
  const { left, width, bottom, colors } = PDF_LAYOUT;
  const notes = quotation.notes?.map((note) => String(note.noteText || "").trim()).filter(Boolean) || [];
  const terms = notes.length ? notes : ["No additional commercial terms have been specified."];
  const drawTitle = () => {
    const y = doc.y + 14;
    doc.rect(left, y, width, 25).fill(colors.paleBlue);
    doc.font(quotationFont("bold")).fontSize(10).fillColor(colors.navy)
      .text("COMMERCIAL TERMS", left + 10, y + 8, { width: width - 20, lineBreak: false });
    doc.y = y + 37;
  };

  doc.addPage();
  addPdfContinuationHeader(doc, quotation);
  drawTitle();
  terms.forEach((term, index) => {
    doc.font(quotationFont()).fontSize(8.5);
    const text = `${index + 1}. ${term}`;
    const height = Math.max(16, doc.heightOfString(text, { width: width - 22, lineGap: 2 }) + 5);
    if (doc.y + height + 80 > bottom) {
      doc.addPage();
      addPdfContinuationHeader(doc, quotation);
      drawTitle();
    }
    const y = doc.y;
    doc.fillColor(colors.ink).text(text, left + 11, y, { width: width - 22, lineGap: 2 });
    doc.y = y + height;
  });
}

function addPdfSignature(doc, quotation) {
  const { left, right, width, bottom, colors } = PDF_LAYOUT;
  const brand = quotationBrand(quotation);
  const signatureHeight = 60;
  if (doc.y + signatureHeight > bottom) {
    doc.addPage();
    addPdfContinuationHeader(doc, quotation);
  }
  const signatureTop = doc.y + 25;
  doc.strokeColor(colors.border).lineWidth(0.75).moveTo(left, signatureTop - 14).lineTo(right, signatureTop - 14).stroke();
  doc.font(quotationFont("bold")).fontSize(9).fillColor(colors.ink)
    .text(`For ${brand.companyName}`, right - 192, signatureTop, { width: 192, align: "right" });
  doc.x = left;
  doc.y = signatureTop + 26;
}

function addPdfFooter(doc, quotation) {
  const { left, right, width, footerTop, colors } = PDF_LAYOUT;
  const brand = quotationBrand(quotation);
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.strokeColor(colors.border).lineWidth(0.75).moveTo(left, footerTop).lineTo(right, footerTop).stroke();
    doc.font(quotationFont()).fontSize(7.5).fillColor(colors.muted)
      .text(`Quotation ${asText(quotation.quotation_no)}  |  ${brand.companyName}`, left, footerTop + 9, {
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

export async function writeQuotationPdf(quotation, absolutePath) {
  const brand = quotationBrand(quotation);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: PDF_LAYOUT.left,
      bufferPages: true,
      info: {
        Title: `Quotation ${quotation.quotation_no}`,
        Author: brand.companyName,
        Subject: "Customer quotation",
      },
    });
    registerQuotationFont(doc);
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
    addPdfHeader(doc, quotation);
    addPdfItems(doc, quotation);
    addPdfCostSummary(doc, quotation);
    addPdfTerms(doc, quotation);
    addPdfSignature(doc, quotation);
    addPdfFooter(doc, quotation);
    doc.end();
  });
}

export async function generatePdf(enquiryId, user) {
  requirePermission(user, "GENERATE_QUOTATION_PDF", "You do not have permission to generate quotation PDFs.");
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  const quotation = await repository.getQuotation(enquiryId, marketingDatabase.pool);
  if (!quotation || quotation.quotation_status !== "FINALIZED") throw new AppError("Finalize the quotation before generating PDF.", 409);
  const directory = path.resolve(env.uploadRoot, "quotations");
  await fsPromises.mkdir(directory, { recursive: true });
  const fileName = `${quotation.quotation_no.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  const absolutePath = path.join(directory, fileName);
  // Pass the resolved database through to the renderer instead of inferring
  // the company only from a stored order-type field.
  await writeQuotationPdf({ ...quotation, marketingDatabaseKey: marketingDatabase.key }, absolutePath);
  const publicPath = `/uploads/quotations/${fileName}`;
  await marketingDatabase.withTransaction((connection) => repository.setPdfGenerated(connection, quotation.quotation_id, publicPath, user.userCode));
  return repository.getQuotation(enquiryId, marketingDatabase.pool);
}

const quotationAttachmentPath = (publicPath) => {
  const relativePath = String(publicPath || "")
    .replace(/^\/uploads\//i, "")
    .replace(/\\/g, "/");
  const uploadRoot = path.resolve(env.uploadRoot);
  const absolutePath = path.resolve(uploadRoot, relativePath);
  if (!relativePath || (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`))) {
    throw new AppError("The quotation PDF path is invalid.", 409);
  }
  return absolutePath;
};

export async function sendEmail(enquiryId, data, user) {
  requirePermission(user, "SEND_QUOTATION_EMAIL", "You do not have permission to send quotation emails.");
  if (!env.smtp.deliveryEnabled) throw new AppError("SMTP delivery is disabled.", 409);
  if (!env.smtp.host || !env.smtp.user || !env.smtp.password || !env.smtp.fromEmail) {
    throw new AppError("SMTP is not fully configured.", 409);
  }

  const to = String(data?.to || "").trim();
  const subject = String(data?.subject || "").trim();
  const body = String(data?.body || "").trim();
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw new AppError("Enter a valid recipient email address.");
  if (!subject) throw new AppError("Email subject is required.");
  if (!body) throw new AppError("Email body is required.");
  if (to.length > 500 || subject.length > 500) throw new AppError("Recipient or subject is too long.");

  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  const quotation = await repository.getQuotation(enquiryId, marketingDatabase.pool);
  if (!quotation || quotation.quotation_status !== "FINALIZED") {
    throw new AppError("Finalize the quotation before sending email.", 409);
  }
  if (quotation.pdf_status !== "GENERATED" || !quotation.pdf_file_path) {
    throw new AppError("Generate the quotation PDF before sending email.", 409);
  }

  const attachmentPath = quotationAttachmentPath(quotation.pdf_file_path);
  try {
    await fsPromises.access(attachmentPath, fs.constants.R_OK);
  } catch {
    throw new AppError("The generated quotation PDF file could not be found. Regenerate it and try again.", 409);
  }

  const mailer = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });

  try {
    const result = await mailer.sendMail({
      from: { name: env.smtp.fromName, address: env.smtp.fromEmail },
      to,
      subject,
      text: body,
      attachments: [{
        filename: path.basename(attachmentPath),
        path: attachmentPath,
        contentType: "application/pdf",
      }],
    });
    await marketingDatabase.withTransaction((connection) => repository.recordEmail(connection, quotation.quotation_id, {
      to,
      subject,
      body,
      attachmentPath: quotation.pdf_file_path,
      status: "SENT",
      messageId: result.messageId,
      userCode: user.userCode,
    }));
  } catch (error) {
    const failureReason = String(error?.message || "SMTP delivery failed.").slice(0, 2000);
    await marketingDatabase.withTransaction((connection) => repository.recordEmail(connection, quotation.quotation_id, {
      to,
      subject,
      body,
      attachmentPath: quotation.pdf_file_path,
      status: "FAILED",
      failureReason,
      userCode: user.userCode,
    }));
    throw new AppError(`Quotation email delivery failed: ${failureReason}`, 502);
  } finally {
    mailer.close();
  }

  return repository.getQuotation(enquiryId, marketingDatabase.pool);
}
