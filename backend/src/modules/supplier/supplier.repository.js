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