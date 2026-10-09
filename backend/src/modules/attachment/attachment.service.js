import fs from "node:fs/promises";
import path from "node:path";

import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./attachment.repository.js";

const entityDefinitions = {
  CUSTOMER: { table: "customer_master", idColumn: "customer_id" },
  SUPPLIER: { table: "supplier_master", idColumn: "supplier_id" },
  PART: { table: "part_master", idColumn: "part_id" },
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

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function storedPath(file) {
  return path.relative(path.resolve(env.uploadRoot), file.path).split(path.sep).join("/");
}

async function removeStoredFile(filePath) {
  const uploadRoot = path.resolve(env.uploadRoot);
  const absolutePath = path.resolve(uploadRoot, filePath);
  if (absolutePath === uploadRoot || !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return;
  await fs.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function listAttachments(entityTypeValue, entityId, user) {
  const type = entityType(entityTypeValue);
  const verifiedId = await assertEntityAccess(type, entityId, user);
  return repository.list(type, verifiedId, tenantId(user));
}

export async function addAttachment(entityTypeValue, entityId, file, data, user) {
  if (!file) throw new AppError("Select a file to upload.", 400);
  const type = entityType(entityTypeValue);
  const verifiedId = await assertEntityAccess(type, entityId, user);
  try {
    return await repository.insert({
      tenantId: tenantId(user),
      entityType: type,
      entityId: verifiedId,
      attachmentType: cleanText(data.attachmentType, 50) || "OTHER",
      attachmentName: cleanText(data.attachmentName, 255),
      fileName: String(file.originalname || file.filename).slice(0, 255),
      storedFileName: String(file.filename).slice(0, 255),
      filePath: storedPath(file),
      mimeType: cleanText(file.mimetype, 150),
      fileSizeBytes: Number(file.size || 0),
      createdBy: user.userCode,
    });
  } catch (error) {
    await removeStoredFile(storedPath(file));
    throw error;
  }
}

export async function updateAttachment(entityTypeValue, entityId, attachmentId, data, user) {
  const type = entityType(entityTypeValue);
  const verifiedId = await assertEntityAccess(type, entityId, user);
  const attachment = await repository.get(attachmentId, type, verifiedId, tenantId(user));
  if (!attachment) throw new AppError("Attachment not found.", 404);
  await repository.update(attachmentId, {
    attachmentType: cleanText(data.attachmentType, 50) || "OTHER",
    attachmentName: cleanText(data.attachmentName, 255),
  });
  const attachments = await repository.list(type, verifiedId, tenantId(user));
  return attachments.find((entry) => Number(entry.attachmentId) === Number(attachmentId)) || null;
}

export async function removeAttachment(entityTypeValue, entityId, attachmentId, user) {
  const type = entityType(entityTypeValue);
  const verifiedId = await assertEntityAccess(type, entityId, user);
  const attachment = await repository.get(attachmentId, type, verifiedId, tenantId(user));
  if (!attachment) throw new AppError("Attachment not found.", 404);
  await repository.remove(attachmentId);
  await removeStoredFile(attachment.file_path);
}
