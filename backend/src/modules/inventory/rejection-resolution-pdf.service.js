import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { env } from "../../config/env.js";

const safeName = (value) => String(value || "resolution").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const display = (value) => String(value || "-").trim() || "-";
const dateText = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "-";
const actionTitle = (value) => ({ RETURN_TO_CUSTOMER:"RETURN TO CUSTOMER", REWORK:"REWORK AUTHORISATION", SCRAP:"SCRAP DISPOSAL AUTHORISATION", DEVIATION_RELEASE:"AUTHORISED DEVIATION RELEASE" }[value] || "REJECTION RESOLUTION");

function field(doc, label, value, x, y, width) {
  doc.fillColor("#53627a").font("Helvetica-Bold").fontSize(8).text(label, x, y, { width });
  doc.fillColor("#172b4d").font("Helvetica").fontSize(9).text(display(value), x, y + 12, { width });
}

export async function generateResolutionPdf(source) {
  const directory = path.resolve(env.uploadRoot, "inventory", "rejection-resolutions");
  await fsPromises.mkdir(directory, { recursive: true });
  const fileName = `${safeName(source.resolutionNumber)}.pdf`;
  const absolutePath = path.join(directory, fileName);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size:"A4", margin:48, info:{ Title:`Rejection resolution - ${source.resolutionNumber}`, Author:"Atech Automation" } });
    const stream = fs.createWriteStream(absolutePath);
    stream.on("finish", resolve); stream.on("error", reject); doc.on("error", reject); doc.pipe(stream);
    doc.fillColor("#102a5d").font("Helvetica-Bold").fontSize(19).text("Atech Automation", 48, 48, { width:499, align:"center" });
    doc.fillColor("#bf3a31").fontSize(13).text(actionTitle(source.action), 48, 76, { width:499, align:"center" });
    doc.strokeColor("#bf3a31").lineWidth(1.4).moveTo(48,100).lineTo(547,100).stroke();
    field(doc,"Resolution number",source.resolutionNumber,48,118,210);
    field(doc,"Resolution date",dateText(source.resolutionDate),335,118,212);
    field(doc,source.action === "RETURN_TO_CUSTOMER" ? "Customer" : "Stock owner",source.stockOwnerName,48,154,330);
    field(doc,"GRN number",source.grnNumber,48,190,210);
    field(doc,"Gate entry",source.gateEntryNumber,335,190,212);
    field(doc,"Action reference",source.actionReference,48,226,210);
    field(doc,"Warehouse / bin",[source.warehouseCode,source.binLocation].filter(Boolean).join(" / "),335,226,212);
    doc.rect(48,274,499,23).fill("#1f3a5f");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
    [[55,76,"Item code"],[136,226,"Item description"],[368,60,"Quantity"],[434,52,"UOM"],[492,50,"Reason"]].forEach(([x,width,label]) => doc.text(label,x,282,{width,lineBreak:false,ellipsis:true}));
    const description = display(source.itemDescription); const reason = display(source.rejectionReason); const rowY = 302;
    const rowHeight = Math.max(40,doc.heightOfString(description,{width:222}) + 13,doc.heightOfString(reason,{width:50}) + 13);
    doc.fillColor("#172b4d").font("Helvetica").fontSize(8);
    doc.text(display(source.itemCode),55,rowY + 7,{width:76}); doc.text(description,136,rowY + 7,{width:226});
    doc.text(display(source.quantity),368,rowY + 7,{width:60,align:"right"}); doc.text(display(source.uomCode),434,rowY + 7,{width:52}); doc.text(reason,492,rowY + 7,{width:50});
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48,rowY + rowHeight).lineTo(547,rowY + rowHeight).stroke();
    const remarksY = rowY + rowHeight + 26;
    doc.fillColor("#53627a").font("Helvetica-Bold").fontSize(8).text("Resolution remarks",48,remarksY);
    doc.fillColor("#172b4d").font("Helvetica").fontSize(9).text(display(source.remarks),48,remarksY + 14,{width:499,lineGap:2});
    const footerY = 625;
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48,footerY).lineTo(547,footerY).stroke();
    field(doc,"Prepared by",source.createdBy,48,footerY + 14,150); field(doc,"Approved by",source.approvedBy,220,footerY + 14,150); field(doc,"Approval date",dateText(source.approvedAt),392,footerY + 14,155);
    doc.strokeColor("#d5dde9").lineWidth(.6).moveTo(48,footerY + 58).lineTo(547,footerY + 58).stroke();
    doc.fillColor("#53627a").font("Helvetica").fontSize(8).text("Approval remarks",48,footerY + 69,{width:499});
    doc.fillColor("#172b4d").font("Helvetica").fontSize(8).text(display(source.approvalRemarks),48,footerY + 82,{width:499,lineGap:1});
    doc.end();
  });
  const details = await fsPromises.stat(absolutePath);
  return { fileName,filePath:`inventory/rejection-resolutions/${fileName}`,fileSizeBytes:details.size,fileUrl:`/uploads/inventory/rejection-resolutions/${fileName}` };
}
