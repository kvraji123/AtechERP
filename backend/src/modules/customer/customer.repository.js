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