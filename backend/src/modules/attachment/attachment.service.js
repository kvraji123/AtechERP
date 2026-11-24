import fs from "node:fs/promises";
import path from "node:path";

import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import * as enquiryRepository from "../enquiry/enquiry.repository.js";
import { findMarketingDatabaseByEnquiryPartId } from "../marketing/marketing-database.js";
import * as repository from "./attachment.repository.js";

const entityDefinitions = {
  CUSTOMER: { table: "customer_master", idColumn: "customer_id" },
  SUPPLIER: { table: "supplier_master", idColumn: "supplier_id" },
  PART: { table: "part_master", idColumn: "part_id" },
  // A process definition belongs to one independent process-plan operation.
  PART_PROCESS_DEFINITION: {
    table: "part_process_definition",
    idColumn: "process_definition_id",
  },
  ENQUIRY_PART: {
    table: "marketing_enquiry_parts",
    idColumn: "enquiry_part_id",
  },
  PURCHASE_REQUEST_ITEM: {
    table: "purchase_request_items",
    idColumn: "purchase_request_item_id",
    tenantColumn: "tenant_id",
  },
  PURCHASE_ORDER: {
    table: "purchase_orders",
    idColumn: "purchase_order_id",
    tenantColumn: "tenant_id",
  },
  GRN_ITEM: {
    table: "goods_receipt_note_items",
    idColumn: "grn_item_id",
    tenantColumn: "tenant_id",
  },
};

function entityType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!entityDefinitions[normalized]) throw new AppError("Attachment entity is not supported.", 400);
  return normalized;
}

function tenantId(user) {
  return String(user?.tenantId || env.defaultTenantId || "DEFAULT");
}

async function assertEntityAccess(type, id, user, connection = db) {
  const definition = entityDefinitions[type];
  const entityId = Number(id);
  if (!Number.isInteger(entityId) || entityId < 1) throw new AppError("Attachment entity is not valid.", 400);
  const clause = definition.tenantColumn ? ` AND ${definition.tenantColumn}=?` : "";
  const values = definition.tenantColumn ? [entityId, tenantId(user)] : [entityId];
  const [rows] = await connection.execute(
    `SELECT ${definition.idColumn} AS entityId FROM ${definition.table}
      WHERE ${definition.idColumn}=?${clause} LIMIT 1`,
    values
  );
  if (!rows[0]) throw new AppError("Attachment parent record was not found.", 404);
  return entityId;
}

async function entityConnection(type, entityId) {
  if (type !== "ENQUIRY_PART") return db;
  const marketingDatabase = await findMarketingDatabaseByEnquiryPartId(entityId);
  return marketingDatabase.pool;
}

async function assertGrnItemIsNotStockPosted(type, entityId, user, connection = db) {
  if (type !== "GRN_ITEM") return;
  const [rows] = await connection.execute(
    `SELECT G.status
       FROM goods_receipt_note_items GI
       JOIN goods_receipt_notes G ON G.grn_id=GI.grn_id AND G.tenant_id=GI.tenant_id
      WHERE GI.grn_item_id=? AND GI.tenant_id=?
      LIMIT 1`,
    [Number(entityId), tenantId(user)]
  );
  if (rows[0]?.status === "POSTED") {
    throw new AppError("MTC certificates cannot be changed after the GRN is posted to stock.", 409);
  }
}

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function isPartModelAttachment(type, attachmentType) {
  return type === "PART" && String(attachmentType || "").trim().toUpperCase() === "PART_MODEL";
}

function assertPartModelFile(type, attachmentType, fileName) {
  if (!isPartModelAttachment(type, attachmentType)) return;
  if (!/\.(step|stp)$/i.test(String(fileName || ""))) {
    throw new AppError("Part Model accepts only STEP or STP files.", 400);
  }
}

function isMtcCertificateAttachment(type, attachmentType) {
  return type === "GRN_ITEM" && String(attachmentType || "").trim().toUpperCase() === "MTC_CERTIFICATE";
}

function assertGrnItemAttachment(type, attachmentType, fileName) {
  if (type !== "GRN_ITEM") return;
  if (!isMtcCertificateAttachment(type, attachmentType)) {
    throw new AppError("GRN item attachments must be uploaded as an MTC Certificate.", 400);
  }
  if (!/\.pdf$/i.test(String(fileName || ""))) {
    throw new AppError("MTC Certificate accepts only PDF files.", 400);
  }
}

function storedPath(file) {
  return path.relative(path.resolve(env.uploadRoot), file.path).split(path.sep).join("/");
}

async function removeStoredFile(filePath) {
  const uploadRoot = path.resolve(env.uploadRoot);
  const normalizedPath = String(filePath || "").replace(/\\/g, "/");
  const relativePath = normalizedPath.replace(/^\/uploads\//i, "");
  if (!relativePath || path.isAbsolute(relativePath)) return false;
  const absolutePath = path.resolve(uploadRoot, relativePath);
  const pathFromRoot = path.relative(uploadRoot, absolutePath);
  if (!pathFromRoot || pathFromRoot === ".." || pathFromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(pathFromRoot)) return false;
  await fs.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  return true;
}

export async function removeStoredFiles(filePaths = []) {
  let failedCount = 0;
  for (const filePath of new Set(filePaths.filter(Boolean))) {
    try {
      if (!(await removeStoredFile(filePath))) failedCount += 1;
    } catch {
      failedCount += 1;
    }
  }
  return failedCount;
}

function canEditSubmittedEnquiry(user) {
  return Array.isArray(user?.permissions) && user.permissions.includes("EDIT_ENQUIRY_ALL_STAGES");
}

async function enquiryPartRevisionContext(entityId, user, connection) {
  const [rows] = await connection.execute(
    `SELECT P.enquiry_id AS enquiryId, E.save_status AS saveStatus,
            P.part_number AS partNumber, P.drawing_number AS drawingNumber,
            P.drawing_revision_number AS drawingRevisionNumber
       FROM marketing_enquiry_parts P
       JOIN marketing_enquiries E ON E.enquiry_id=P.enquiry_id
      WHERE P.enquiry_part_id=?
      LIMIT 1`,
    [Number(entityId)]
  );
  const context = rows[0];
  if (context?.saveStatus === "SUBMITTED" && !canEditSubmittedEnquiry(user)) {
    throw new AppError("Only users with enquiry edit permission can change attachments on a submitted enquiry.", 403);
  }
  return context || null;
}

async function appendEnquiryAttachmentRevision(context, revisionAction, attachment, user, connection) {
  if (!context || context.saveStatus !== "SUBMITTED") return;
  try {
    await enquiryRepository.appendEnquiryRevision(connection, {
      enquiryId: Number(context.enquiryId),
      revisionAction,
      saveStatus: context.saveStatus,
      snapshot: {
        stage: "ENQUIRY_ATTACHMENT",
        action: revisionAction,
        part: {
          partNumber: context.partNumber,
          drawingNumber: context.drawingNumber,
          drawingRevisionNumber: context.drawingRevisionNumber,
        },
        attachment: attachment
          ? {
              attachmentId: Number(attachment.attachmentId || attachment.attachment_id),
              attachmentType: attachment.attachmentType || attachment.attachment_type,
              attachmentName: attachment.attachmentName || attachment.attachment_name,
              fileName: attachment.fileName || attachment.file_name,
            }
          : null,
      },
      userCode: user.userCode,
    });
  } catch (error) {
    // Attachment storage must remain available if the optional revision-history
    // migration has not reached an older database yet.
    console.error("Unable to append enquiry attachment revision history.", error);
  }
}

export async function listAttachments(entityTypeValue, entityId, user) {
  const type = entityType(entityTypeValue);
  const connection = await entityConnection(type, entityId);
  const verifiedId = await assertEntityAccess(type, entityId, user, connection);
  return repository.list(type, verifiedId, tenantId(user));
}

export async function addAttachment(entityTypeValue, entityId, file, data, user) {
  if (!file) throw new AppError("Select a file to upload.", 400);
  const type = entityType(entityTypeValue);
  const connection = await entityConnection(type, entityId);
  const verifiedId = await assertEntityAccess(type, entityId, user, connection);
  const revisionContext = type === "ENQUIRY_PART"
    ? await enquiryPartRevisionContext(verifiedId, user, connection)
    : null;
  await assertGrnItemIsNotStockPosted(type, verifiedId, user, connection);
  try {
    const attachmentType = cleanText(data.attachmentType, 50) || "OTHER";
    assertPartModelFile(type, attachmentType, file.originalname || file.filename);
    assertGrnItemAttachment(type, attachmentType, file.originalname || file.filename);
    const attachment = await repository.insert({
      tenantId: tenantId(user),
      entityType: type,
      entityId: verifiedId,
      attachmentType,
      attachmentName: cleanText(data.attachmentName, 255),
      fileName: String(file.originalname || file.filename).slice(0, 255),
      storedFileName: String(file.filename).slice(0, 255),
      filePath: storedPath(file),
      mimeType: cleanText(file.mimetype, 150),
      fileSizeBytes: Number(file.size || 0),
      createdBy: user.userCode,
    });
    await appendEnquiryAttachmentRevision(
      revisionContext,
      "ENQUIRY_ATTACHMENT_ADDED",
      attachment,
      user,
      connection
    );
    return attachment;
  } catch (error) {
    await removeStoredFile(storedPath(file));
    throw error;
  }
}

export async function updateAttachment(entityTypeValue, entityId, attachmentId, data, user) {
  const type = entityType(entityTypeValue);
  const connection = await entityConnection(type, entityId);
  const verifiedId = await assertEntityAccess(type, entityId, user, connection);
  const revisionContext = type === "ENQUIRY_PART"
    ? await enquiryPartRevisionContext(verifiedId, user, connection)
    : null;
  await assertGrnItemIsNotStockPosted(type, verifiedId, user, connection);
  const attachment = await repository.get(attachmentId, type, verifiedId, tenantId(user));
  if (!attachment) throw new AppError("Attachment not found.", 404);
  const attachmentType = cleanText(data.attachmentType, 50) || "OTHER";
  assertPartModelFile(type, attachmentType, attachment.file_name);
  assertGrnItemAttachment(type, attachmentType, attachment.file_name);
  await repository.update(attachmentId, {
    attachmentType,
    attachmentName: cleanText(data.attachmentName, 255),
  });
  const attachments = await repository.list(type, verifiedId, tenantId(user));
  const updated = attachments.find((entry) => Number(entry.attachmentId) === Number(attachmentId)) || null;
  await appendEnquiryAttachmentRevision(
    revisionContext,
    "ENQUIRY_ATTACHMENT_UPDATED",
    updated,
    user,
    connection
  );
  return updated;
}

export async function removeAttachment(entityTypeValue, entityId, attachmentId, user) {
  const type = entityType(entityTypeValue);
  const connection = await entityConnection(type, entityId);
  const verifiedId = await assertEntityAccess(type, entityId, user, connection);
  const revisionContext = type === "ENQUIRY_PART"
    ? await enquiryPartRevisionContext(verifiedId, user, connection)
    : null;
  await assertGrnItemIsNotStockPosted(type, verifiedId, user, connection);
  const attachment = await repository.get(attachmentId, type, verifiedId, tenantId(user));
  if (!attachment) throw new AppError("Attachment not found.", 404);
  await repository.remove(attachmentId);
  await appendEnquiryAttachmentRevision(
    revisionContext,
    "ENQUIRY_ATTACHMENT_REMOVED",
    attachment,
    user,
    connection
  );
  await removeStoredFile(attachment.file_path);
}
