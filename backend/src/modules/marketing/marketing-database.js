import { cmsDb, db, withCmsTransaction, withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";

export const SALES_MARKETING_DATABASE = Object.freeze({
  key: "ATECH",
  pool: db,
  withTransaction,
});

export const LABOUR_MARKETING_DATABASE = Object.freeze({
  key: "CMS",
  pool: cmsDb,
  withTransaction: withCmsTransaction,
});

export function marketingDatabaseForOrderType(orderType) {
  return String(orderType || "SALES").trim().toUpperCase() === "LABOUR"
    ? LABOUR_MARKETING_DATABASE
    : SALES_MARKETING_DATABASE;
}

async function locate(tableName, idColumn, id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError("A valid marketing record identifier is required.", 400);
  }

  const [salesRows, labourRows] = await Promise.all([
    db.execute(`SELECT 1 FROM ${tableName} WHERE ${idColumn}=? LIMIT 1`, [numericId]),
    cmsDb.execute(`SELECT 1 FROM ${tableName} WHERE ${idColumn}=? LIMIT 1`, [numericId]),
  ]);
  const matches = [
    salesRows[0]?.length ? SALES_MARKETING_DATABASE : null,
    labourRows[0]?.length ? LABOUR_MARKETING_DATABASE : null,
  ].filter(Boolean);

  if (!matches.length) throw new AppError("Marketing record not found.", 404);
  if (matches.length > 1) {
    throw new AppError(
      "The same marketing record identifier exists in both databases. Contact support to resolve the identifier collision.",
      409
    );
  }
  return matches[0];
}

export function findMarketingDatabaseByEnquiryId(enquiryId) {
  return locate("marketing_enquiries", "enquiry_id", enquiryId);
}

export function findMarketingDatabaseByEnquiryPartId(enquiryPartId) {
  return locate("marketing_enquiry_parts", "enquiry_part_id", enquiryPartId);
}
