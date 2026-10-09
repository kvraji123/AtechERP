// src/modules/enquiry/enquiry.repository.js

import { db } from "../../config/db.js";
import * as query from "./enquiry.queries.js";

const FILTER_COLUMNS = {
  docNo: "E.doc_no",
  customer: "E.customer_name_snapshot",
  mode: "E.enquiry_mode",
  orderType: "E.order_type",
  stage: "E.current_stage",
  status: "E.enquiry_status",
  createdOn: "DATE_FORMAT(E.created_on, '%Y-%m-%d')",
  lastUpdated: "DATE_FORMAT(COALESCE(E.updated_on, E.submitted_on, E.created_on), '%Y-%m-%d')",
};

function columnFilterSql(filters, params) {
  let sql = "";

  for (const [key, values] of Object.entries(filters.columnFilters || {})) {
    if (!Array.isArray(values) || values.length === 0) continue;

    const placeholders = values.map(() => "?").join(", ");
    if (key === "parts") {
      sql += `
        AND EXISTS (
          SELECT 1
          FROM marketing_enquiry_parts FP
          WHERE FP.enquiry_id = E.enquiry_id
            AND FP.active_flag = 'Y'
            AND COALESCE(NULLIF(FP.item_code, ''), NULLIF(FP.drawing_number, ''), NULLIF(FP.part_number, ''), NULLIF(FP.product_description, '')) IN (${placeholders})
        )`;
    } else if (FILTER_COLUMNS[key]) {
      sql += ` AND ${FILTER_COLUMNS[key]} IN (${placeholders})`;
    } else {
      continue;
    }

    params.push(...values);
  }

  return sql;
}

export async function listEnquiries(filters) {
  const search = String(filters.search || "").trim();
  const stage = String(filters.stage || "").trim();
  const status = String(filters.status || "").trim();

  const limit = Math.min(
    Math.max(Number(filters.limit) || 20, 1),
    100
  );

  const offset = Math.max(
    Number(filters.offset) || 0,
    0
  );

  const columnFilterParams = [];
  const columnFilters = columnFilterSql(filters, columnFilterParams);
  const listSql = `
    ${query.LIST_ENQUIRIES.replace("/* COLUMN_FILTERS */", columnFilters)}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const listParams = [
    search,
    search,
    search,
    search,
    search,
    search,
    search,
    search,
    stage,
    stage,
    status,
    status,
    ...columnFilterParams,
  ];

  const [rows] = await db.execute(
    listSql,
    listParams
  );

  const [countRows] = await db.execute(
    query.COUNT_ENQUIRIES.replace("/* COLUMN_FILTERS */", columnFilters),
    listParams
  );

  return {
    rows,
    total: Number(countRows[0]?.total || 0),
  };
}

export async function listEnquiryFilterOptions() {
  const [rows] = await db.execute(query.LIST_ENQUIRY_FILTER_OPTIONS);
  return rows;
}

export async function dashboardSummary() {
  const [rows] = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM marketing_enquiries E WHERE E.active_flag='Y') AS totalEnquiries,
      (SELECT COUNT(*)
         FROM marketing_enquiry_parts P
         JOIN marketing_enquiries E ON E.enquiry_id=P.enquiry_id
        WHERE P.active_flag='Y' AND E.active_flag='Y'
          AND P.part_status='PENDING_FEASIBILITY') AS feasibilityPending,
      (SELECT COUNT(*)
         FROM marketing_quotations Q
        WHERE Q.active_flag='Y' AND Q.quotation_status='FINALIZED') AS quotationCount,
      (SELECT COALESCE(SUM(QI.part_price_fob_inr * COALESCE(QI.required_quantity, QI.annual_quantity, QI.moq, 0)), 0)
         FROM marketing_quotations Q
         JOIN marketing_quotation_items QI ON QI.quotation_id=Q.quotation_id AND QI.active_flag='Y'
        WHERE Q.active_flag='Y' AND Q.quotation_status='FINALIZED') AS quotationValue,
      (SELECT COUNT(*)
         FROM marketing_enquiries E
        WHERE E.active_flag='Y' AND E.enquiry_status='QUOTED') AS pendingOrders,
      (SELECT COALESCE(SUM(QI.part_price_fob_inr * COALESCE(QI.required_quantity, QI.annual_quantity, QI.moq, 0)), 0)
         FROM marketing_quotations Q
         JOIN marketing_enquiries E ON E.enquiry_id=Q.enquiry_id AND E.active_flag='Y'
         JOIN marketing_quotation_items QI ON QI.quotation_id=Q.quotation_id AND QI.active_flag='Y'
        WHERE Q.active_flag='Y' AND Q.quotation_status='FINALIZED'
          AND E.enquiry_status='ORDER_RECEIVED') AS orderValue
  `);
  return rows[0] || {};
}

export async function getEnquiry(
  enquiryId,
  connection = db
) {
  const [rows] = await connection.execute(
    query.GET_ENQUIRY,
    [Number(enquiryId)]
  );

  return rows[0] || null;
}

export async function getEnquiryParts(
  enquiryId,
  connection = db
) {
  const [rows] = await connection.execute(
    query.GET_ENQUIRY_PARTS,
    [Number(enquiryId)]
  );

  return rows;
}

export async function getEnquiryRevisions(
  enquiryId,
  connection = db
) {
  const [rows] = await connection.execute(
    query.GET_ENQUIRY_REVISIONS,
    [Number(enquiryId)]
  );

  return rows;
}

export async function getLatestEnquiryRevision(
  enquiryId,
  connection = db
) {
  const [rows] = await connection.execute(
    query.GET_LATEST_ENQUIRY_REVISION,
    [Number(enquiryId)]
  );

  return rows[0] || null;
}

export async function insertEnquiryRevision(
  connection,
  {
    enquiryId,
    revisionSequence,
    revisionNumber,
    revisionDate,
    revisionAction,
    saveStatus,
    snapshot,
    userCode,
  }
) {
  const [result] = await connection.execute(
    query.INSERT_ENQUIRY_REVISION,
    [
      Number(enquiryId),
      Number(revisionSequence),
      revisionNumber,
      revisionDate,
      revisionAction,
      saveStatus,
      JSON.stringify(snapshot),
      userCode,
    ]
  );

  return result.insertId;
}

export async function insertEnquiry(
  connection,
  values
) {
  const [result] = await connection.execute(
    query.INSERT_ENQUIRY,
    values
  );

  return result.insertId;
}

export async function updateEnquiry(
  connection,
  enquiryId,
  values
) {
  const [result] = await connection.execute(
    query.UPDATE_ENQUIRY,
    [
      ...values,
      Number(enquiryId),
    ]
  );

  return result.affectedRows;
}

export async function replaceParts(
  connection,
  enquiryId,
  parts,
  userCode,
  saveStatus
) {
  await connection.execute(
    query.DELETE_ENQUIRY_PARTS,
    [Number(enquiryId)]
  );

  for (
    let index = 0;
    index < parts.length;
    index += 1
  ) {
    const part = parts[index];

    await connection.execute(
      query.INSERT_ENQUIRY_PART,
      [
        Number(enquiryId),
        part.partId
          ? Number(part.partId)
          : null,
        index + 1,
        String(part.partNumber || "").trim(),
        String(part.itemCode || "").trim() || null,
        String(part.drawingNumber || "").trim(),
        String(
          part.drawingRevisionNumber || ""
        ).trim() || null,
        part.drawingRevisionDate || null,
        String(
          part.productDescription || ""
        ).trim(),
        String(
          part.materialAndGrade || ""
        ).trim(),
        String(
          part.alternativeMaterial || ""
        ).trim() || null,
        part.isAssembledPart ? 1 : 0,
        Number(part.requiredQuantity || 0),
        part.annualQuantity
          ? Number(part.annualQuantity)
          : null,
        part.moq
          ? Number(part.moq)
          : null,
        part.requiredDate || null,
        String(
          part.unitOfMeasurement || ""
        ).trim() || null,
        saveStatus,
        userCode,
      ]
    );
  }
}

export async function submitEnquiry(
  connection,
  enquiryId,
  userCode
) {
  await connection.execute(
    query.SUBMIT_ENQUIRY,
    [
      userCode,
      userCode,
      Number(enquiryId),
    ]
  );
}

export async function updateEnquiryStatus(
  enquiryId,
  enquiryStatus,
  userCode
) {
  const [result] = await db.execute(
    query.UPDATE_ENQUIRY_STATUS,
    [
      enquiryStatus,
      userCode,
      Number(enquiryId),
    ]
  );

  return result.affectedRows;
}

export async function getEligibleQuotationParts(
  enquiryId
) {
  const [rows] = await db.execute(
    query.ELIGIBLE_QUOTATION_PARTS,
    [Number(enquiryId)]
  );

  return rows;
}
