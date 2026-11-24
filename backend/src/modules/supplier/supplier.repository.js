// src/modules/supplier/supplier.repository.js

import { db } from "../../config/db.js";
import * as queries from "./supplier.queries.js";

function getSafeInteger(
  value,
  defaultValue,
  minimum,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const parsedValue = Number.parseInt(
    String(value),
    10
  );

  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  return Math.min(
    Math.max(parsedValue, minimum),
    maximum
  );
}
export async function listSuppliers({
  search = "",
  activeFlag = "",
  saveStatus = "",
  includeDraft = false,
  limit = 20,
  offset = 0,
} = {}) {
  const safeSearch = String(
    search || ""
  ).trim();

  const safeActiveFlag = String(
    activeFlag || ""
  )
    .trim()
    .toUpperCase();
  const safeSaveStatus = ["DRAFT", "SUBMITTED"].includes(
    String(saveStatus || "").trim().toUpperCase()
  )
    ? String(saveStatus).trim().toUpperCase()
    : "";
  const safeIncludeDraft = includeDraft === true || ["Y", "TRUE", "1"].includes(String(includeDraft).trim().toUpperCase())
    ? "Y"
    : "N";

  const safeLimit = getSafeInteger(
    limit,
    20,
    1,
    100
  );

  const safeOffset = getSafeInteger(
    offset,
    0,
    0
  );

  const listSql = `
    ${queries.LIST_SUPPLIERS}
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;

  const parameters = [
    safeSearch,
    safeSearch,
    safeSearch,
    safeSearch,
    safeActiveFlag,
    safeActiveFlag,
    safeSaveStatus,
    safeSaveStatus,
    safeIncludeDraft,
  ];

  const [rows] = await db.execute(
    listSql,
    parameters
  );

  const [countRows] = await db.execute(
    queries.COUNT_SUPPLIERS,
    parameters
  );

  return {
    rows,
    total: Number(
      countRows[0]?.total || 0
    ),
  };
}

export async function lookupActiveSuppliers({ search = "", limit = 20 } = {}) {
  const safeSearch = String(search || "").trim();
  if (safeSearch.length < 2) return [];

  const safeLimit = getSafeInteger(limit, 20, 1, 25);
  const [rows] = await db.execute(
    `${queries.LOOKUP_ACTIVE_SUPPLIERS}\nLIMIT ${safeLimit}`,
    [safeSearch, safeSearch, safeSearch]
  );
  return rows;
}

export async function getSupplierById(
  supplierId,
  connection = db
) {
  const [rows] = await connection.execute(
    queries.GET_SUPPLIER_BY_ID,
    [Number(supplierId)]
  );

  return rows[0] || null;
}

export async function insertSupplier(
  connection,
  values
) {
  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await connection.execute(
    queries.INSERT_SUPPLIER,
    safeValues
  );

  return result.insertId;
}

export async function updateSupplier(
  supplierId,
  values
) {
  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await db.execute(
    queries.UPDATE_SUPPLIER,
    [
      ...safeValues,
      Number(supplierId),
    ]
  );

  return result.affectedRows;
}

export async function updateSupplierStatus(
  supplierId,
  {
    supplierStatus,
    activeFlag,
    deactivationRemarks,
    updatedBy,
  }
) {
  const [result] = await db.execute(
    queries.UPDATE_SUPPLIER_STATUS,
    [
      supplierStatus,
      activeFlag,
      deactivationRemarks || null,
      updatedBy,
      Number(supplierId),
    ]
  );

  return result.affectedRows;
}

export async function hardDeleteInactiveSupplier(connection, supplierId) {
  const [result] = await connection.execute(
    queries.HARD_DELETE_INACTIVE_SUPPLIER,
    [Number(supplierId)]
  );

  return result.affectedRows;
}
