import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { env } from "../../config/env.js";

const safeName = (value) => String(value || "rtc").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const text = (value) => String(value || "—").trim() || "—";
const dateText = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "—";

function field(doc, label, value, x, y, width) {
  doc.fillColor("#53627a").font("Helvetica-Bold").fontSize(8).text(label, x, y, { width });
  doc.fillColor("#172b4d").font("Helvetica").fontSize(9).text(text(value), x, y + 12, { width });
}

function addHeader(doc, source) {
  doc.fillColor("#102a5d").font("Helvetica-Bold").fontSize(19).text("Atech Automation", 48, 48, { width: 499, align: "center" });
  doc.fillColor("#bf3a31").fontSize(13).text("RETURN TO CUSTOMER", 48, 76, { width: 499, align: "center" });
  doc.strokeColor("#bf3a31").lineWidth(1.4).moveTo(48, 100).lineTo(547, 100).stroke();
  field(doc, "RTC number", source.rtcNumber, 48, 118, 210);
  field(doc, "RTC date", dateText(source.rtcDate), 335, 118, 212);
  field(doc, "Customer", source.customerName, 48, 154, 330);
  field(doc, "Customer code", source.customerCode, 402, 154, 145);
  field(doc, "Dispatch reference", source.dispatchReference, 48, 190, 210);
  field(doc, "Transport mode / vehicle", [source.transportMode, source.transportReference].filter(Boolean).join(" · "), 335, 190, 212);
}

function addItemsHeader(doc, y) {
  doc.rect(48, y, 499, 23).fill("#1f3a5f");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  [[55, 72, "GRN"], [131, 72, "Item code"], [207, 174, "Item description"], [385, 42, "Qty"], [431, 42, "UOM"], [477, 65, "Reason"]]
    .forEach(([x, width, label]) => doc.text(label, x, y + 8, { width, lineBreak: false, ellipsis: true }));
}

export async function generateReturnToCustomerPdf(source) {
  const directory = path.resolve(env.uploadRoot, "inventory", "return-to-customer");
  await fsPromises.mkdir(directory, { recursive: true });
  const fileName = `${safeName(source.rtcNumber)}.pdf`;
  const absolutePath = path.join(directory, fileName);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Return to Customer - ${source.rtcNumber}`, Author: "Atech Automation" } });
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve); stream.on("error", reject); doc.on("error", reject); doc.pipe(stream);
    addHeader(doc, source);
    let y = 238;
    addItemsHeader(doc, y);
    y += 28;
    for (const item of source.items || []) {
      const description = text(item.itemDescription); const reason = text(item.rejectionReason);
      const height = Math.max(33, doc.heightOfString(description, { width: 170 }) + 12, doc.heightOfString(reason, { width: 65 }) + 12);
      if (y + height > 570) {
        doc.addPage(); addHeader(doc, source); y = 238; addItemsHeader(doc, y); y += 28;
      }
      doc.fillColor("#172b4d").font("Helvetica").fontSize(8);
      doc.text(text(item.grnNumber), 55, y + 6, { width: 72 });
      doc.text(text(item.itemCode), 131, y + 6, { width: 72 });
      doc.text(description, 207, y + 6, { width: 174 });
      doc.text(text(item.quantity), 385, y + 6, { width: 42, align: "right" });
      doc.text(text(item.uomCode), 431, y + 6, { width: 42 });
      doc.text(reason, 477, y + 6, { width: 65 });
      doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48, y + height).lineTo(547, y + height).stroke();
      y += height;
    }
    const remarksY = Math.min(y + 22, 590);
    doc.fillColor("#53627a").font("Helvetica-Bold").fontSize(8).text("Return remarks", 48, remarksY);
    doc.fillColor("#172b4d").font("Helvetica").fontSize(9).text(text(source.remarks), 48, remarksY + 14, { width: 499, lineGap: 2 });
    const footerY = 680;
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48, footerY).lineTo(547, footerY).stroke();
    field(doc, "Prepared by", source.createdBy, 48, footerY + 14, 150);
    field(doc, "Approved by", source.approvedBy, 220, footerY + 14, 150);
    field(doc, "Approval date", dateText(source.approvedAt), 392, footerY + 14, 155);
    doc.fillColor("#53627a").font("Helvetica").fontSize(8).text("Customer acknowledgement / signature", 360, footerY + 58, { width: 187, align: "center" });
    doc.end();
  });
  const details = await fsPromises.stat(absolutePath);
  return { fileName, filePath: `inventory/return-to-customer/${fileName}`, fileSizeBytes: details.size, fileUrl: `/uploads/inventory/return-to-customer/${fileName}` };
}
