// src/modules/customer/customer.repository.js

import { db } from "../../config/db.js";
import * as queries from "./customer.queries.js";

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
export async function listCustomers({
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
    ${queries.LIST_CUSTOMERS}
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
    queries.COUNT_CUSTOMERS,
    parameters
  );

  return {
    rows,
    total: Number(
      countRows[0]?.total || 0
    ),
  };
}

export async function lookupActiveCustomers({ search = "", limit = 20 } = {}) {
  const safeSearch = String(search || "").trim();
  if (safeSearch.length < 2) return [];

  const safeLimit = getSafeInteger(limit, 20, 1, 25);
  const [rows] = await db.execute(
    `${queries.LOOKUP_ACTIVE_CUSTOMERS}\nLIMIT ${safeLimit}`,
    [safeSearch, safeSearch, safeSearch]
  );
  return rows;
}

export async function getCustomerById(
  customerId,
  connection = db
) {
  const [rows] = await connection.execute(
    queries.GET_CUSTOMER_BY_ID,
    [Number(customerId)]
  );

  return rows[0] || null;
}

export async function insertCustomer(
  connection,
  values
) {
  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await connection.execute(
    queries.INSERT_CUSTOMER,
    safeValues
  );

  return result.insertId;
}

export async function updateCustomer(
  customerId,
  values
) {
  const safeValues = values.map((value) =>
    value === undefined ? null : value
  );

  const [result] = await db.execute(
    queries.UPDATE_CUSTOMER,
    [
      ...safeValues,
      Number(customerId),
    ]
  );

  return result.affectedRows;
}

export async function updateCustomerStatus(
  customerId,
  {
    customerStatus,
    activeFlag,
    deactivationRemarks,
    updatedBy,
  }
) {
  const [result] = await db.execute(
    queries.UPDATE_CUSTOMER_STATUS,
    [
      customerStatus,
      activeFlag,
      deactivationRemarks || null,
      updatedBy,
      Number(customerId),
    ]
  );

  return result.affectedRows;
}

export async function hardDeleteInactiveCustomer(connection, customerId) {
  const [result] = await connection.execute(
    queries.HARD_DELETE_INACTIVE_CUSTOMER,
    [Number(customerId)]
  );

  return result.affectedRows;
}
