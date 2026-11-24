import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./rfq.repository.js";

const safeName = (value) => String(value || "rfq").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const content = (value) => String(value || "-").trim() || "-";
const dateText = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "Not specified";

function addFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(`Page ${page + 1} of ${range.count}`, 48, 780, { width: 500, align: "center" });
  }
}

function addHeader(doc, source) {
  doc.fillColor("#102a43").font("Helvetica-Bold").fontSize(18).text("Atech Automation", 48, 48, { width: 500, align: "center" });
  doc.fillColor("#c73b32").fontSize(13).text("REQUEST FOR QUOTATION", 48, 74, { width: 500, align: "center" });
  doc.strokeColor("#c73b32").lineWidth(1.5).moveTo(48, 98).lineTo(547, 98).stroke();
  doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(8).text("RFQ / Purchase Enquiry No.", 48, 116).font("Helvetica").fontSize(9).text(source.enquiryNumber, 184, 116, { width: 158 });
  doc.font("Helvetica-Bold").text("RFQ Date", 350, 116).font("Helvetica").text(dateText(source.enquiryDate), 416, 116, { width: 131 });
  doc.font("Helvetica-Bold").text("Due Date", 48, 134).font("Helvetica").text(dateText(source.quoteDueDate), 128, 134, { width: 190 });
  doc.font("Helvetica-Bold").text("Delivery By", 350, 134).font("Helvetica").text(dateText(source.deliveryRequiredBy), 416, 134, { width: 131 });
  doc.font("Helvetica-Bold").text("To", 48, 160).font("Helvetica").text(source.supplierName, 128, 160, { width: 419 });
  const supplierHeight = doc.heightOfString(source.supplierName, { width: 419 });
  const emailY = 160 + supplierHeight + 5;
  doc.font("Helvetica-Bold").text("Email", 48, emailY).font("Helvetica").text(content(source.supplierEmail), 128, emailY, { width: 419 });
  doc.font("Helvetica").fontSize(10).fillColor("#334155").text(`Dear ${source.supplierName},`, 48, emailY + 29, { width: 499 });
  doc.text("Please submit your quotation for the following requirements.", 48, emailY + 45, { width: 499 });
  doc.y = emailY + 72;
}

function addItemsHeader(doc) {
  const y = doc.y;
  doc.rect(48, y, 499, 22).fill("#1f3a5f");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
  [[54, 24, "#"], [82, 253, "Item / specification"], [340, 68, "Quantity"], [413, 55, "UOM"], [472, 69, "Required date"]].forEach(([x, width, label]) => doc.text(label, x, y + 7, { width, lineBreak: false, ellipsis: true }));
  doc.y = y + 27;
}

function addItems(doc, source) {
  const columns = [[54, 24], [82, 253], [340, 68], [413, 55], [472, 69]];
  addItemsHeader(doc);
  source.items.forEach((item, index) => {
    const values = [String(index + 1), `${content(item.itemDescription)}${item.specification ? `\n${item.specification}` : ""}`, content(item.quantity), content(item.uom), dateText(item.requiredDate)];
    const rowHeight = Math.max(30, ...values.map((value, valueIndex) => doc.heightOfString(value, { width: columns[valueIndex][1] - 4, lineGap: 2 }) + 12));
    if (doc.y + rowHeight > 730) { doc.addPage(); doc.y = 54; addItemsHeader(doc); }
    const y = doc.y;
    doc.fillColor("#1e293b").font("Helvetica").fontSize(8);
    values.forEach((value, valueIndex) => doc.text(value, columns[valueIndex][0], y + 6, { width: columns[valueIndex][1] - 4, height: rowHeight - 9, ellipsis: true, lineGap: 2 }));
    doc.strokeColor("#d8dee9").lineWidth(0.5).moveTo(48, y + rowHeight).lineTo(547, y + rowHeight).stroke();
    doc.y = y + rowHeight + 3;
  });
}

function addTerms(doc, source) {
  const values = [["Delivery location", source.deliveryLocation], ["Commercial terms", source.commercialTerms], ["Notes", source.notes]].filter(([, value]) => String(value || "").trim());
  if (!values.length) return;
  const totalHeight = 42 + values.reduce((sum, [, value]) => sum + doc.heightOfString(content(value), { width: 410, lineGap: 2 }) + 13, 0);
  if (doc.y + totalHeight > 735) { doc.addPage(); doc.y = 54; }
  const headingY = doc.y;
  doc.fillColor("#1f3a5f").font("Helvetica-Bold").fontSize(11).text("Commercial terms and notes", 48, headingY + 12);
  doc.y = headingY + 30;
  values.forEach(([label, value]) => {
    const height = doc.heightOfString(content(value), { width: 410, lineGap: 2 }) + 13;
    if (doc.y + height > 735) { doc.addPage(); doc.y = 54; }
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text(label, 48, y, { width: 120 });
    doc.font("Helvetica").fillColor("#1e293b").text(content(value), 136, y, { width: 410, lineGap: 2 });
    doc.y = y + height;
  });
}

async function writeDocument(source, absolutePath) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: `Request for Quotation - ${source.enquiryNumber}`, Author: "Atech Automation" } });
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve); stream.on("error", reject); doc.on("error", reject); doc.pipe(stream);
    addHeader(doc, source); addItems(doc, source); addTerms(doc, source); addFooter(doc); doc.end();
  });
}

function groupSupplierDocuments(rfq) {
  const suppliers = new Map();
  for (const assignment of rfq.suppliers || []) {
    const supplierId = Number(assignment.supplier_id);
    if (!supplierId) continue;
    const source = suppliers.get(supplierId) || { supplierId, supplierName: assignment.supplierName || "Supplier", supplierCode: assignment.supplierCode || String(supplierId), supplierEmail: assignment.supplier_email || assignment.supplierEmail || "", items: [] };
    const item = (rfq.items || []).find((entry) => Number(entry.purchase_enquiry_item_id) === Number(assignment.purchase_enquiry_item_id));
    if (item && !source.items.some((entry) => Number(entry.purchase_enquiry_item_id) === Number(item.purchase_enquiry_item_id))) source.items.push({ ...item, itemDescription: item.item_description || item.item_type_name, specification: item.item_specification, quantity: item.enquiry_quantity, uom: item.uom_code, requiredDate: item.required_date });
    suppliers.set(supplierId, source);
  }
  return [...suppliers.values()].filter((source) => source.items.length);
}

export async function generateRfqDocuments(id, user) {
  const rfq = await repository.get(id, user.tenantId);
  if (!rfq) throw new AppError("RFQ not found.", 404);
  const sources = groupSupplierDocuments(rfq);
  if (!sources.length) throw new AppError("No supplier-assigned RFQ items are available to generate documents.", 409);
  const directory = path.resolve(env.uploadRoot, "purchase", "rfqs");
  await fsPromises.mkdir(directory, { recursive: true });
  for (const source of sources) {
    const fileName = `${safeName(rfq.enquiry_number)}-${safeName(source.supplierCode)}.pdf`;
    const absolutePath = path.join(directory, fileName);
    await writeDocument({ ...source, enquiryNumber: rfq.enquiry_number, enquiryDate: rfq.enquiry_date, quoteDueDate: rfq.quote_due_date, deliveryRequiredBy: rfq.delivery_required_by, deliveryLocation: rfq.delivery_location, commercialTerms: rfq.commercial_terms, notes: rfq.notes }, absolutePath);
    const info = await fsPromises.stat(absolutePath);
    await repository.upsertDocument(db, [user.tenantId, Number(id), source.supplierId, fileName, `/uploads/purchase/rfqs/${fileName}`, info.size, user.userCode]);
  }
  return repository.listDocuments(id, user.tenantId);
}

export async function listRfqDocuments(id, user) {
  const rfq = await repository.get(id, user.tenantId);
  if (!rfq) throw new AppError("RFQ not found.", 404);
  return repository.listDocuments(id, user.tenantId);
}
