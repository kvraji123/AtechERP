import fs from "fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { AppError } from "../../utils/AppError.js";

const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();
const amount = (value = "") => Number(String(value).replace(/,/g, "")) || 0;
const isoDate = (value = "") => {
  const match = String(value).match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};
const termValue = (text, expression) => clean(text.match(expression)?.[1] || "");

async function extractText(file) {
  const loadingTask = getDocument({ data: new Uint8Array(file), disableWorker: true });
  try {
    const document = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const content = await (await document.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n");
  } finally {
    await loadingTask.destroy();
  }
}

function extractLineItems(text) {
  const table = text.match(/LINE\s+TOTAL[\s\S]*?(?=TERMS\s*&\s*CONDITIONS|TERMS\s+AND\s+CONDITIONS|$)/i)?.[0] || "";
  const sections = table.split(/\n(?=\d+\s*\n)/).slice(1);
  return sections.map((section) => {
    const rows = section.split("\n").map(clean).filter(Boolean);
    const serial = Number(rows.shift() || 0);
    const description = clean(rows.shift());
    const values = rows.join(" ");
    const numericValues = values.match(/^(\d+?)(\d{8})(\d{1,3},\d{3}\.\d{2})/);
    return { serial, description, quantity: Number(numericValues?.[1] || 1), unitPrice: amount(numericValues?.[3]) };
  }).filter((item) => item.serial && item.description && item.unitPrice >= 0);
}

export async function extractQuotationPdf(filePath) {
  const file = await fs.readFile(filePath);
  if (file.subarray(0, 5).toString("ascii") !== "%PDF-") throw new AppError("The uploaded file is not a valid PDF document.", 400);
  let text;
  try { text = await extractText(file); }
  catch { throw new AppError("This PDF could not be read. Upload a text-based supplier quotation PDF.", 422); }
  if (!clean(text)) throw new AppError("No readable text was found in this PDF. Upload a text-based quotation PDF.", 422);
  const quotationNumber = termValue(text, /^\s*(QTN[-/][A-Z0-9./_-]+)/im) || termValue(text, /(?:QUOTATION\s*(?:NO\.?|NUMBER)?|QUOTE\s*(?:NO\.?|NUMBER)?|QTN)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]+)/i);
  const quotationDate = isoDate(termValue(text, /\bDATE\s*[:#-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i));
  const paymentTerms = termValue(text, /PAYMENT\s*:?\s*([^\n]+)/i);
  const deliveryText = termValue(text, /DELIVERY\s*:?\s*([^\n]+)/i);
  const validityText = termValue(text, /VALIDITY\s*:?\s*([^\n]+)/i);
  const gstPercent = Number(text.match(/GST\s*(?:@|:)?\s*(\d+(?:\.\d+)?)\s*%/i)?.[1] || 0);
  const packingPercent = Number(text.match(/PACKING\s*(?:&|AND)\s*FORWARDING\s*(?:@|:)?\s*(\d+(?:\.\d+)?)\s*%/i)?.[1] || 0);
  const validityDays = Number(validityText.match(/(\d+)\s*days?/i)?.[1] || 0);
  const weeks = deliveryText.match(/(\d+)\s*(?:to|-)?\s*(\d+)?\s*weeks?/i);
  const deliveryDays = weeks ? Number(weeks[2] || weeks[1]) * 7 : Number(deliveryText.match(/(\d+)\s*days?/i)?.[1] || 0);
  return { quotationNumber, quotationDate, paymentTerms, deliveryText, validityText, validityDays, deliveryDays, gstPercent, packingPercent, items: extractLineItems(text), extractedText: clean(text).slice(0, 12000) };
}
