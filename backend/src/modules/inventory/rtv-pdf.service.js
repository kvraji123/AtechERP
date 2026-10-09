import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { env } from "../../config/env.js";

const safeName = (value) => String(value || "rtv").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const text = (value) => String(value || "—").trim() || "—";
const dateText = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "—";

function field(doc, label, value, x, y, width) {
  doc.fillColor("#53627a").font("Helvetica-Bold").fontSize(8).text(label, x, y, { width });
  doc.fillColor("#172b4d").font("Helvetica").fontSize(9).text(text(value), x, y + 12, { width });
}

async function writePdf(source, absolutePath) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Return to Vendor - ${source.rtvNumber}`, Author: "Atech Automation" } });
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve); stream.on("error", reject); doc.on("error", reject); doc.pipe(stream);
    doc.fillColor("#102a5d").font("Helvetica-Bold").fontSize(19).text("Atech Automation", 48, 48, { width: 499, align: "center" });
    doc.fillColor("#bf3a31").fontSize(13).text("RETURN TO VENDOR", 48, 76, { width: 499, align: "center" });
    doc.strokeColor("#bf3a31").lineWidth(1.4).moveTo(48, 100).lineTo(547, 100).stroke();

    field(doc, "RTV number", source.rtvNumber, 48, 118, 210);
    field(doc, "RTV date", dateText(source.rtvDate), 335, 118, 212);
    field(doc, "Supplier", source.supplierName, 48, 154, 330);
    field(doc, "Supplier code", source.supplierCode, 402, 154, 145);
    field(doc, "GRN number", source.grnNumber, 48, 190, 210);
    field(doc, "Gate entry", source.gateEntryNumber, 335, 190, 212);
    field(doc, "Dispatch reference", source.dispatchReference, 48, 226, 210);
    field(doc, "Transport mode / vehicle", [source.transportMode, source.transportReference].filter(Boolean).join(" · "), 335, 226, 212);

    const headerY = 274;
    doc.rect(48, headerY, 499, 23).fill("#1f3a5f");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
    [[55, 75, "Item code"], [135, 222, "Item description"], [362, 62, "Quantity"], [429, 52, "UOM"], [486, 56, "Reason"]].forEach(([x, width, label]) => doc.text(label, x, headerY + 8, { width, lineBreak: false, ellipsis: true }));
    const rowY = headerY + 28;
    const reason = text(source.rejectionReason);
    const description = text(source.itemDescription);
    const rowHeight = Math.max(40, doc.heightOfString(description, { width: 220 }) + 13, doc.heightOfString(reason, { width: 55 }) + 13);
    doc.fillColor("#172b4d").font("Helvetica").fontSize(8);
    doc.text(text(source.itemCode), 55, rowY + 7, { width: 75 });
    doc.text(description, 135, rowY + 7, { width: 222 });
    doc.text(text(source.quantity), 362, rowY + 7, { width: 62, align: "right" });
    doc.text(text(source.uomCode), 429, rowY + 7, { width: 52 });
    doc.text(reason, 486, rowY + 7, { width: 56 });
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48, rowY + rowHeight).lineTo(547, rowY + rowHeight).stroke();

    const remarksY = rowY + rowHeight + 26;
    doc.fillColor("#53627a").font("Helvetica-Bold").fontSize(8).text("Return remarks", 48, remarksY);
    doc.fillColor("#172b4d").font("Helvetica").fontSize(9).text(text(source.remarks), 48, remarksY + 14, { width: 499, lineGap: 2 });
    const footerY = 625;
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48, footerY).lineTo(547, footerY).stroke();
    field(doc, "Prepared by", source.createdBy, 48, footerY + 14, 150);
    field(doc, "Approved by", source.approvedBy, 220, footerY + 14, 150);
    field(doc, "Approval date", dateText(source.approvedAt), 392, footerY + 14, 155);
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48, footerY + 58).lineTo(547, footerY + 58).stroke();
    doc.fillColor("#53627a").font("Helvetica").fontSize(8).text("Approval remarks", 48, footerY + 69, { width: 499 });
    doc.fillColor("#172b4d").font("Helvetica").fontSize(8).text(text(source.approvalRemarks), 48, footerY + 82, { width: 499, lineGap: 1 });
    doc.strokeColor("#aeb9ca").lineWidth(.5).moveTo(360, footerY + 104).lineTo(547, footerY + 104).stroke();
    doc.fillColor("#53627a").font("Helvetica").fontSize(8).text("Supplier acknowledgement / signature", 360, footerY + 108, { width: 187, align: "center" });
    doc.end();
  });
}

export async function generateRtvPdf(source) {
  const directory = path.resolve(env.uploadRoot, "inventory", "rtv");
  await fsPromises.mkdir(directory, { recursive: true });
  const fileName = `${safeName(source.rtvNumber)}.pdf`;
  const absolutePath = path.join(directory, fileName);
  await writePdf(source, absolutePath);
  const details = await fsPromises.stat(absolutePath);
  return { fileName, filePath: `inventory/rtv/${fileName}`, fileSizeBytes: details.size, fileUrl: `/uploads/inventory/rtv/${fileName}` };
}
