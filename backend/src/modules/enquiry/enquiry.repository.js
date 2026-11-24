// src/modules/enquiry/enquiry.repository.js

import { db } from "../../config/db.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
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

function columnFilterSql(filters, params, activeFlag = "Y") {
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
            AND FP.active_flag = '${activeFlag}'
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

export async function listEnquiries(filters, connection = db) {
  const search = String(filters.search || "").trim();
  const stage = String(filters.stage || "").trim();
  const status = String(filters.status || "").trim();
  const activeFlag = filters.activeFlag === "N" ? "N" : "Y";

  const limit = Math.min(
    Math.max(Number(filters.limit) || 20, 1),
    1000
  );

  const offset = Math.max(
    Number(filters.offset) || 0,
    0
  );

  const columnFilterParams = [];
  const columnFilters = columnFilterSql(filters, columnFilterParams, activeFlag);
  const activeListQuery = (sql) => sql
    .replaceAll("E.active_flag = 'Y'", `E.active_flag = '${activeFlag}'`)
    .replaceAll("P.active_flag = 'Y'", `P.active_flag = '${activeFlag}'`)
    .replaceAll("PS.active_flag = 'Y'", `PS.active_flag = '${activeFlag}'`);
  const listSql = `
    ${activeListQuery(query.LIST_ENQUIRIES).replace("/* COLUMN_FILTERS */", columnFilters)}
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
  const [rows] = await connection.execute(
    listSql,
    listParams
  );

  const [countRows] = await connection.execute(
    activeListQuery(query.COUNT_ENQUIRIES).replace("/* COLUMN_FILTERS */", columnFilters),
    listParams
  );

  return {
    rows,
    total: Number(countRows[0]?.total || 0),
  };
}

export async function listEnquiryFilterOptions(connection = db) {
  const [rows] = await connection.execute(query.LIST_ENQUIRY_FILTER_OPTIONS);
  return rows;
}

export async function dashboardSummary(connection = db) {
  const [rows] = await connection.execute(`
    SELECT
      (SELECT COUNT(*) FROM marketing_enquiries E WHERE E.active_flag='Y' AND E.save_status='SUBMITTED') AS totalEnquiries,
      (SELECT COUNT(*)
         FROM marketing_enquiry_parts P
         JOIN marketing_enquiries E ON E.enquiry_id=P.enquiry_id
        WHERE P.active_flag='Y' AND E.active_flag='Y' AND E.save_status='SUBMITTED'
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
        WHERE E.active_flag='Y' AND E.save_status='SUBMITTED' AND E.enquiry_status='QUOTED') AS pendingOrders,
      (SELECT COALESCE(SUM(QI.part_price_fob_inr * COALESCE(QI.required_quantity, QI.annual_quantity, QI.moq, 0)), 0)
         FROM marketing_quotations Q
         JOIN marketing_enquiries E ON E.enquiry_id=Q.enquiry_id AND E.active_flag='Y' AND E.save_status='SUBMITTED'
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

export async function getEnquiryIncludingInactive(enquiryId, connection = db) {
  const [rows] = await connection.execute(
    "SELECT * FROM marketing_enquiries WHERE enquiry_id = ?",
    [Number(enquiryId)]
  );

  return rows[0] || null;
}

export async function getEnquiryHardDeleteFilePaths(enquiryId, connection) {
  const parts = await getEnquiryParts(enquiryId, connection);
  const partIds = parts.map((part) => Number(part.enquiry_part_id)).filter(Boolean);
  const [attachmentRows, workflowRows] = await Promise.all([
    partIds.length
      ? db.execute(
        `SELECT file_path AS filePath FROM application_attachments
          WHERE entity_type='ENQUIRY_PART' AND entity_id IN (${partIds.map(() => "?").join(",")})`,
        partIds
      )
      : Promise.resolve([[]]),
    connection.execute(
      `SELECT Q.pdf_file_path AS filePath
       FROM marketing_quotations Q
      WHERE Q.enquiry_id = ? AND Q.pdf_file_path IS NOT NULL AND Q.pdf_file_path <> ''
     UNION
     SELECT R.file_path AS filePath
       FROM marketing_regret_letters R
      WHERE R.enquiry_id = ? AND R.file_path IS NOT NULL AND R.file_path <> ''`,
      [Number(enquiryId), Number(enquiryId)]
    ),
  ]);

  return [...attachmentRows[0], ...workflowRows[0]].map((row) => row.filePath);
}

export async function hasCustomerMaterialJobBalance(enquiryId) {
  const [rows] = await db.execute(
    `SELECT 1
       FROM customer_material_job_balance
      WHERE enquiry_id = ?
      LIMIT 1`,
    [Number(enquiryId)]
  );

  return rows.length > 0;
}

export async function hardDeleteEnquiry(connection, enquiryId) {
  const id = Number(enquiryId);
  const parts = await getEnquiryParts(id, connection);
  const partIds = parts.map((part) => Number(part.enquiry_part_id)).filter(Boolean);
  if (partIds.length) {
    await db.execute(
      `DELETE FROM application_attachments
        WHERE entity_type='ENQUIRY_PART' AND entity_id IN (${partIds.map(() => "?").join(",")})`,
      partIds
    );
  }
  await connection.execute("DELETE FROM marketing_quotations WHERE enquiry_id = ?", [id]);
  await connection.execute("DELETE FROM marketing_regret_letters WHERE enquiry_id = ?", [id]);
  await connection.execute("DELETE FROM marketing_workouts WHERE enquiry_id = ?", [id]);
  await connection.execute("DELETE FROM marketing_feasibilities WHERE enquiry_id = ?", [id]);
  await connection.execute("DELETE FROM marketing_enquiry_revisions WHERE enquiry_id = ?", [id]);
  await connection.execute("DELETE FROM marketing_enquiry_parts WHERE enquiry_id = ?", [id]);
  const [result] = await connection.execute(
    "DELETE FROM marketing_enquiries WHERE enquiry_id = ? AND active_flag = 'N'",
    [id]
  );

  return result.affectedRows;
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

export async function getDrawingAttachments(
  enquiryId,
  tenantId,
  connection = db
) {
  const parts = await getEnquiryParts(enquiryId, connection);
  const partIds = parts.map((part) => Number(part.enquiry_part_id)).filter(Boolean);
  if (!partIds.length) return [];
  const lineNumbers = new Map(parts.map((part) => [Number(part.enquiry_part_id), Number(part.line_number)]));
  const [rows] = await db.execute(
    `SELECT
        A.attachment_id AS attachmentId,
        A.entity_type AS entityType,
        A.entity_id AS entityId,
        A.attachment_type AS attachmentType,
        A.attachment_name AS attachmentName,
        A.file_name AS fileName,
        CONCAT('/uploads/', REPLACE(A.file_path, '\\\\', '/')) AS fileUrl,
        A.mime_type AS mimeType,
        A.file_size_bytes AS fileSizeBytes,
        A.created_by AS createdBy,
        A.created_on AS createdOn
      FROM application_attachments A
      WHERE A.entity_id IN (${partIds.map(() => "?").join(",")})
        AND A.tenant_id = ?
        AND A.entity_type = 'ENQUIRY_PART'
        AND A.attachment_type = 'DRAWING'
        AND A.active_flag = 'Y'
      ORDER BY A.attachment_id`,
    [...partIds, tenantId]
  );

  return rows.sort((left, right) => (lineNumbers.get(Number(left.entityId)) || 0) - (lineNumbers.get(Number(right.entityId)) || 0)
    || Number(left.attachmentId) - Number(right.attachmentId));
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

export async function appendEnquiryRevision(
  connection,
  {
    enquiryId,
    revisionAction,
    saveStatus,
    snapshot,
    userCode,
  }
) {
  const latestRevision = await getLatestEnquiryRevision(enquiryId, connection);
  const revisionSequence = latestRevision
    ? Number(latestRevision.revision_sequence) + 1
    : 0;
  const revisionNumber = `REV${String(revisionSequence).padStart(2, "0")}`;
  const revisionDate = todayInAppTimeZone();

  await insertEnquiryRevision(connection, {
    enquiryId,
    revisionSequence,
    revisionNumber,
    revisionDate,
    revisionAction,
    saveStatus: saveStatus === "SUBMITTED" ? "SUBMITTED" : "DRAFT",
    snapshot,
    userCode,
  });

  return { revisionSequence, revisionNumber, revisionDate };
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
  saveStatus,
  { preserveExistingParts = false } = {}
) {
  const existingParts = await getEnquiryParts(enquiryId, connection);
  const existingPartIds = new Set(existingParts.map((part) => Number(part.enquiry_part_id)));
  const retainedPartIds = parts
    .map((part) => Number(part.enquiryPartId || part.enquiry_part_id || 0))
    .filter((partId) => existingPartIds.has(partId));

  if (new Set(retainedPartIds).size !== retainedPartIds.length) {
    throw new Error("An enquiry part cannot be submitted more than once.");
  }

  if (preserveExistingParts) {
    if (
      parts.length !== existingParts.length ||
      retainedPartIds.length !== existingParts.length
    ) {
      throw new Error(
        "Submitted enquiry parts cannot be added or removed. Edit the existing part details only."
      );
    }

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const enquiryPartId = Number(part.enquiryPartId || part.enquiry_part_id || 0);
      const [result] = await connection.execute(
        `UPDATE marketing_enquiry_parts
            SET part_id=?, line_number=?, part_number=?, item_code=?, drawing_number=?,
                drawing_revision_number=?, drawing_revision_date=?, product_description=?,
                material_and_grade=?, is_assembled_part=?,
                required_quantity=?, annual_quantity=?, moq=?, required_date=?,
                unit_of_measurement=?, save_status=?, updated_by=?
          WHERE enquiry_part_id=? AND enquiry_id=?`,
        [
          part.partId ? Number(part.partId) : null,
          index + 1,
          String(part.partNumber || "").trim(),
          String(part.itemCode || "").trim() || null,
          String(part.drawingNumber || "").trim(),
          String(part.drawingRevisionNumber || "").trim() || null,
          part.drawingRevisionDate || null,
          String(part.productDescription || "").trim(),
          String(part.materialAndGrade || "").trim(),
          part.isAssembledPart ? 1 : 0,
          Number(part.requiredQuantity || 0),
          part.annualQuantity ? Number(part.annualQuantity) : null,
          part.moq ? Number(part.moq) : null,
          part.requiredDate || null,
          String(part.unitOfMeasurement || "").trim() || null,
          saveStatus,
          userCode,
          enquiryPartId,
          Number(enquiryId),
        ]
      );

      if (result.affectedRows !== 1) {
        throw new Error("An enquiry part is no longer available for update.");
      }
    }

    return;
  }

  const removedPartIds = [...existingPartIds].filter((partId) => !retainedPartIds.includes(partId));
  if (removedPartIds.length) {
    await db.execute(
      `UPDATE application_attachments
          SET active_flag='N'
        WHERE entity_type='ENQUIRY_PART'
          AND active_flag='Y'
          AND entity_id IN (${removedPartIds.map(() => "?").join(",")})`,
      removedPartIds
    );
  }

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

    const [result] = await connection.execute(
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
        // Material and Grade is no longer captured on an enquiry. Keep an empty
        // legacy value so saving still works before an older database has run
        // the optional-column migration.
        String(part.materialAndGrade || "").trim(),
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

    const previousPartId = Number(part.enquiryPartId || part.enquiry_part_id || 0);
    if (existingPartIds.has(previousPartId)) {
      await db.execute(
        `UPDATE application_attachments
            SET entity_id=?
          WHERE entity_type='ENQUIRY_PART'
            AND active_flag='Y'
            AND entity_id=?`,
        [Number(result.insertId), previousPartId]
      );
    }
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
  userCode,
  connection = db
) {
  const [result] = await connection.execute(
    query.UPDATE_ENQUIRY_STATUS,
    [
      enquiryStatus,
      userCode,
      Number(enquiryId),
    ]
  );

  return result.affectedRows;
}

export async function deactivateEnquiry(connection, enquiryId, userCode) {
  const [result] = await connection.execute(
    query.DEACTIVATE_ENQUIRY,
    [userCode, Number(enquiryId)]
  );

  if (result.affectedRows === 0) return false;

  await connection.execute(
    query.DEACTIVATE_ENQUIRY_PARTS,
    [userCode, Number(enquiryId)]
  );

  return true;
}

export async function getEligibleQuotationParts(
  enquiryId,
  connection = db
) {
  const [rows] = await connection.execute(
    query.ELIGIBLE_QUOTATION_PARTS,
    [Number(enquiryId)]
  );

  return rows;
}
