import { db, withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { env } from "../../config/env.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import { isValidDateOnly, todayInAppTimeZone } from "../../utils/dateTime.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { removeStoredFiles } from "../attachment/attachment.service.js";
import * as customerRepository from "../customer/customer.repository.js";
import * as partRepository from "../part/part.repository.js";
import {
  findMarketingDatabaseByEnquiryId,
  marketingDatabaseForOrderType,
} from "../marketing/marketing-database.js";
import * as repository from "./enquiry.repository.js";

export async function dashboardSummary() {
  const [sales, labour] = await Promise.all([
    repository.dashboardSummary(db),
    repository.dashboardSummary(marketingDatabaseForOrderType("LABOUR").pool),
  ]);
  return Object.fromEntries(
    Array.from(new Set([...Object.keys(sales), ...Object.keys(labour)]))
      .map((key) => [key, Number(sales[key] || 0) + Number(labour[key] || 0)])
  );
}

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

const tenantId = (user) => String(user?.tenantId || env.defaultTenantId || "DEFAULT");

function canEditSubmittedEnquiry(user) {
  return Array.isArray(user?.permissions) && user.permissions.includes("EDIT_ENQUIRY_ALL_STAGES");
}

const COLUMN_FILTER_KEYS = new Set([
  "docNo",
  "customer",
  "mode",
  "orderType",
  "stage",
  "status",
  "parts",
  "createdOn",
  "lastUpdated",
]);

function columnFilters(value) {
  if (!value) return {};

  let parsed = value;
  try {
    if (typeof value === "string") parsed = JSON.parse(value);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key]) => COLUMN_FILTER_KEYS.has(key))
      .map(([key, values]) => [
        key,
        [...new Set((Array.isArray(values) ? values : [])
          .map(clean)
          .filter(Boolean))].slice(0, 100),
      ])
      .filter(([, values]) => values.length > 0)
  );
}

function currentDate() { return todayInAppTimeZone(); }

function ensureNotFutureDate(value, label) {
  const date = clean(value);
  if (!date) return;
  if (!isValidDateOnly(date)) throw new AppError(`${label} must be a valid date.`);
  if (date > currentDate()) throw new AppError(`${label} cannot be a future date.`);
}

function ensureNotPastDate(value, label) {
  const date = clean(value);
  if (!date) return;
  if (!isValidDateOnly(date)) throw new AppError(`${label} must be a valid date.`);
  if (date < currentDate()) throw new AppError(`${label} cannot be earlier than today.`);
}

function revisionLabel(sequence) {
  return `REV${String(sequence).padStart(2, "0")}`;
}

function validate(data, action = "DRAFT") {
  if (action === "SUBMITTED" && !Number(data.customerId)) {
    throw new AppError("Customer is required.");
  }

  ensureNotPastDate(data.requiredDate, "Required Date");
  ensureNotFutureDate(data.customerEnquiryDate, "Customer Enquiry Date");
  (Array.isArray(data.parts) ? data.parts : []).forEach((part, index) => {
    ensureNotFutureDate(part?.drawingRevisionDate, `Drawing Revision Date for row ${index + 1}`);
  });

  if (action === "SUBMITTED") {
    if (!["MAIL", "ORAL", "VISIT"].includes(data.enquiryMode)) {
      throw new AppError("Enquiry Mode is required.");
    }

    if (!["LABOUR", "SALES"].includes(data.orderType)) {
      throw new AppError("Order Type is required.");
    }

    if (!Array.isArray(data.parts) || data.parts.length === 0) {
      throw new AppError("Add at least one enquiry part.");
    }

    data.parts.forEach((part, index) => {
      const number = index + 1;

      if (!clean(part.partNumber)) {
        throw new AppError(`Part Number is required for row ${number}.`);
      }

      if (!clean(part.drawingNumber)) {
        throw new AppError(`Drawing Number is required for row ${number}.`);
      }

      if (
        clean(part.drawingRevisionNumber) &&
        !/^[A-Za-z0-9]+$/.test(clean(part.drawingRevisionNumber))
      ) {
        throw new AppError(`Revision Number must be alphanumeric for row ${number}.`);
      }

      if (!clean(part.productDescription)) {
        throw new AppError(`Description is required for row ${number}.`);
      }

    });
  }
}

function partMasterSnapshot(master) {
  return {
    partId: Number(master.part_id),
    partNumber: master.part_number,
    itemCode: master.drawing_code || null,
    drawingNumber: master.drawing_number,
    drawingRevisionNumber: master.drawing_revision_number,
    drawingRevisionDate: master.drawing_revision_date,
    productDescription: master.part_name,
    materialAndGrade: master.material_specification,
    unitOfMeasurement: master.unit_of_measurement,
  };
}

async function resolveParts(
  masterConnection,
  data,
  { allowInactivePersistedParts = false } = {}
) {
  const parts = Array.isArray(data.parts) ? data.parts : [];
  const resolved = [];

  for (let index = 0; index < parts.length; index += 1) {
    const input = parts[index];
    const row = index + 1;
    if (input.createPartMaster === true) {
      throw new AppError(
        `Part Master creation is disabled at the Enquiry stage for row ${row}. Create the Part Master separately from Masters.`,
        409
      );
    }
    let master = null;

    if (Number(input.partId)) {
      master = await partRepository.getPartById(Number(input.partId), masterConnection);
      if (!master || master.active_flag !== "Y") {
        const isPersistedPart = Number(input.enquiryPartId || input.enquiry_part_id) > 0;
        if (master && allowInactivePersistedParts && isPersistedPart) {
          const resolvedPart = {
            ...input,
            ...partMasterSnapshot(master),
          };
          ensureNotFutureDate(
            resolvedPart.drawingRevisionDate,
            `Drawing Revision Date for row ${row}`
          );
          resolved.push(resolvedPart);
          continue;
        }
        const [revisionWarning] = master
          ? await partRepository.findRevisionWarnings([Number(input.partId)], masterConnection)
          : [];
        if (revisionWarning) {
          throw new AppError(
            `Drawing revision is under progress for Part ${revisionWarning.partNumber}. Contact QA team.`,
            409,
            {
              code: "PART_DRAWING_REVISION_IN_PROGRESS",
              partId: Number(input.partId),
              revisionPartId: Number(revisionWarning.revisionPartId),
            }
          );
        }
        throw new AppError(`Selected Part Master is invalid for row ${row}.`, 409);
      }
      if (
        String(master.drawing_number || "").trim().toUpperCase() !==
        String(input.drawingNumber || "").trim().toUpperCase()
      ) {
        throw new AppError(`Drawing Number does not match the selected Part Master for row ${row}.`, 409);
      }
    } else if (clean(input.drawingNumber)) {
      master = await partRepository.getActivePartByDrawing(
        input.drawingNumber,
        masterConnection
      );
    }

    const resolvedPart = {
      ...input,
      ...(master ? partMasterSnapshot(master) : {}),
    };
    ensureNotFutureDate(resolvedPart.drawingRevisionDate, `Drawing Revision Date for row ${row}`);
    resolved.push(resolvedPart);
  }
  return resolved;
}

function enquiryValues(
  data,
  customer,
  saveStatus,
  userCode,
  revisionNumber,
  revisionDate
) {
  return [
    Number(data.customerId) || null,
    customer?.customer_code || null,
    customer?.customer_name || null,
    customer?.customer_short_name || null,
    clean(data.customerRepresentativeName)?.slice(0, 150) || null,
    data.enquiryMode || "MAIL",
    data.orderType || "SALES",
    clean(data.requiredDate),
    clean(data.customerEnquiryReference),
    clean(data.customerEnquiryDate),
    null,
    revisionNumber,
    revisionDate,
    saveStatus,
    clean(data.remarks),
    userCode,
  ];
}

export async function listEnquiries(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const role = String(user?.role || "").trim().toUpperCase().replace(/\s+/g, "_");
  const activeFlag = role === "ADMINISTRATOR" && clean(query.activeFlag) === "N" ? "N" : "Y";

  const filters = {
    search: clean(query.search) || "",
    stage: clean(query.stage) || "",
    status: clean(query.status) || "",
    activeFlag,
    tenantId: tenantId(user),
    columnFilters: columnFilters(query.filters),
    limit: 1000,
    offset: 0,
  };
  const [sales, labour] = await Promise.all([
    repository.listEnquiries(filters, db),
    repository.listEnquiries(filters, marketingDatabaseForOrderType("LABOUR").pool),
  ]);
  const rows = [
    ...sales.rows.map((row) => ({ ...row, marketingDatabase: "ATECH" })),
    ...labour.rows.map((row) => ({ ...row, marketingDatabase: "CMS" })),
  ].sort((left, right) => String(right.created_on || "").localeCompare(String(left.created_on || ""))
    || String(right.doc_no || "").localeCompare(String(left.doc_no || "")));
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: sales.total + labour.total,
  };
}

export async function listEnquiryFilterOptions() {
  const [sales, labour] = await Promise.all([
    repository.listEnquiryFilterOptions(db),
    repository.listEnquiryFilterOptions(marketingDatabaseForOrderType("LABOUR").pool),
  ]);
  return [...sales, ...labour].filter((row, index, rows) =>
    rows.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(row)) === index
  );
}

export async function getEnquiry(enquiryId, user) {
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  const enquiry = await repository.getEnquiry(enquiryId, marketingDatabase.pool);

  if (!enquiry) {
    throw new AppError("Enquiry not found.", 404);
  }

  const [parts, drawingAttachments] = await Promise.all([
    repository.getEnquiryParts(enquiryId, marketingDatabase.pool),
    repository.getDrawingAttachments(enquiryId, tenantId(user), marketingDatabase.pool),
  ]);
  const attachmentsByPart = new Map();
  drawingAttachments.forEach((attachment) => {
    const partId = Number(attachment.entityId);
    attachmentsByPart.set(partId, [...(attachmentsByPart.get(partId) || []), attachment]);
  });

  return {
    ...enquiry,
    marketingDatabase: marketingDatabase.key,
    parts: parts.map((part) => ({
      ...part,
      drawingAttachments: attachmentsByPart.get(Number(part.enquiry_part_id)) || [],
    })),
  };
}

export async function getEnquiryRevisions(enquiryId) {
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  return repository.getEnquiryRevisions(enquiryId, marketingDatabase.pool);
}

async function save(enquiryId, data, user, action) {
  const userCode = typeof user === "string" ? user : user?.userCode;
  const currentEnquiryId = Number(enquiryId || 0);
  const marketingDatabase = currentEnquiryId
    ? await findMarketingDatabaseByEnquiryId(currentEnquiryId)
    : marketingDatabaseForOrderType(data.orderType);
  return marketingDatabase.withTransaction(async (connection) => {
    let saveStatus = action === "SUBMIT" ? "SUBMITTED" : "DRAFT";
    let preserveExistingParts = false;
    let existing = null;
    let currentEnquiryId = Number(enquiryId || 0);

    if (currentEnquiryId) {
      existing = await repository.getEnquiry(currentEnquiryId, connection);

      if (!existing) {
        throw new AppError("Enquiry not found.", 404);
      }
      if (data.orderType && String(data.orderType).toUpperCase() !== String(existing.order_type).toUpperCase()) {
        throw new AppError("Order Type cannot be changed after an enquiry is created because it determines the database.", 409);
      }
      data.orderType = existing.order_type;

      if (existing.save_status === "SUBMITTED") {
        if (!canEditSubmittedEnquiry(user)) {
          throw new AppError("Only users with enquiry edit permission can change a submitted enquiry.", 403);
        }
        if (action === "SUBMIT") {
          throw new AppError("This enquiry is already submitted. Use Save Changes to record an update.", 409);
        }
        saveStatus = "SUBMITTED";
        preserveExistingParts = true;
      }
    }

    validate(data, saveStatus);
    const customerId = Number(data.customerId || 0);
    const customer = customerId
      ? await customerRepository.getCustomerById(customerId, db)
      : null;

    if (customerId && (!customer || customer.active_flag !== "Y")) {
      throw new AppError("Select an active customer.");
    }

    let revisionSequence = 0;
    let revisionNumber = revisionLabel(revisionSequence);
    const revisionDate = currentDate();
    let revisionAction = "CREATED";

    if (currentEnquiryId) {
      const latestRevision =
        await repository.getLatestEnquiryRevision(
          currentEnquiryId,
          connection
        );

      if (!latestRevision) {
        const existingParts = await repository.getEnquiryParts(
          currentEnquiryId,
          connection
        );

        await repository.insertEnquiryRevision(connection, {
          enquiryId: currentEnquiryId,
          revisionSequence: 0,
          revisionNumber:
            clean(existing.revision_number) || revisionLabel(0),
          revisionDate:
            clean(existing.revision_date) ||
            String(existing.created_on || revisionDate).slice(0, 10),
          revisionAction: "MIGRATED",
          saveStatus: existing.save_status || "DRAFT",
          snapshot: {
            enquiry: existing,
            parts: existingParts,
          },
          userCode:
            clean(existing.updated_by) ||
            clean(existing.created_by) ||
            userCode,
        });
      }

      revisionSequence = latestRevision
        ? Number(latestRevision.revision_sequence) + 1
        : 1;
      revisionNumber = revisionLabel(revisionSequence);
      revisionAction =
        action === "SUBMIT" ? "SUBMITTED" : "UPDATED";

      await repository.updateEnquiry(
        connection,
        currentEnquiryId,
        enquiryValues(
          data,
          customer,
          saveStatus,
          userCode,
          revisionNumber,
          revisionDate
        )
      );
    } else {
      const docNo = marketingDatabase.key === "ATECH"
        ? await getNextDocumentNumber(connection, "ENQUIRY")
        : await withTransaction((masterConnection) => getNextDocumentNumber(masterConnection, "ENQUIRY"));

      currentEnquiryId = await repository.insertEnquiry(
        connection,
        [
          docNo,
          customerId || null,
          customer?.customer_code || null,
          customer?.customer_name || null,
          customer?.customer_short_name || null,
          clean(data.customerRepresentativeName)?.slice(0, 150) || null,
          data.enquiryMode || "MAIL",
          data.orderType || "SALES",
          clean(data.requiredDate),
          clean(data.customerEnquiryReference),
          clean(data.customerEnquiryDate),
          null,
          revisionNumber,
          revisionDate,
          saveStatus,
          clean(data.remarks),
          userCode,
        ]
      );
    }

    const resolvedParts = await resolveParts(db, data, {
      allowInactivePersistedParts: preserveExistingParts,
    });

    await repository.replaceParts(
      connection,
      currentEnquiryId,
      resolvedParts,
      userCode,
      saveStatus,
      { preserveExistingParts }
    );

    if (action === "SUBMIT") {
      await repository.submitEnquiry(
        connection,
        currentEnquiryId,
        userCode
      );
    }

    const enquiry = await repository.getEnquiry(
      currentEnquiryId,
      connection
    );

    const parts = await repository.getEnquiryParts(
      currentEnquiryId,
      connection
    );

    await repository.insertEnquiryRevision(connection, {
      enquiryId: currentEnquiryId,
      revisionSequence,
      revisionNumber,
      revisionDate,
      revisionAction,
      saveStatus,
      snapshot: {
        enquiry,
        parts,
      },
      userCode,
    });

    return {
      ...enquiry,
      marketingDatabase: marketingDatabase.key,
      parts,
    };
  });
}

export function createEnquiry(data, user) {
  return save(null, data, user, data.action || "DRAFT");
}

export function updateEnquiry(enquiryId, data, user) {
  return save(enquiryId, data, user, data.action || "DRAFT");
}

export async function changeEnquiryStatus(
  enquiryId,
  enquiryStatus,
  user
) {
  if (enquiryStatus !== "ORDER_RECEIVED") {
    throw new AppError(
      "Only Order Received can be selected manually.",
      400
    );
  }

  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  return marketingDatabase.withTransaction(async (connection) => {
    const enquiry = await repository.getEnquiry(enquiryId, connection);

    if (!enquiry) throw new AppError("Enquiry not found.", 404);
    if (enquiry.enquiry_status !== "QUOTED") {
      throw new AppError(
        "Only a Quoted enquiry can be changed to Order Received.",
        409
      );
    }

    await repository.updateEnquiryStatus(
      enquiryId,
      enquiryStatus,
      typeof user === "string" ? user : user?.userCode,
      connection
    );
    const updatedEnquiry = await repository.getEnquiry(enquiryId, connection);
    await repository.appendEnquiryRevision(connection, {
      enquiryId: Number(enquiryId),
      revisionAction: "UPDATED",
      saveStatus: updatedEnquiry.save_status,
      snapshot: {
        stage: "ENQUIRY_STATUS",
        previousStatus: enquiry.enquiry_status,
        currentStatus: updatedEnquiry.enquiry_status,
      },
      userCode: typeof user === "string" ? user : user?.userCode,
    });
    return { ...updatedEnquiry, marketingDatabase: marketingDatabase.key };
  });
}

export async function deleteEnquiry(enquiryId, userCode) {
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  return marketingDatabase.withTransaction(async (connection) => {
    const enquiry = await repository.getEnquiry(enquiryId, connection);

    if (!enquiry) {
      throw new AppError("Enquiry not found.", 404);
    }

    const deleted = await repository.deactivateEnquiry(
      connection,
      enquiryId,
      userCode
    );

    if (!deleted) {
      throw new AppError("Enquiry not found.", 404);
    }
  });
}

export async function hardDeleteEnquiry(enquiryId, user) {
  let filePaths = [];
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  try {
    filePaths = await marketingDatabase.withTransaction(async (connection) => {
      const enquiry = await repository.getEnquiryIncludingInactive(enquiryId, connection);
      if (!enquiry) throw new AppError("Enquiry not found.", 404);
      if (enquiry.active_flag !== "N") {
        throw new AppError("Only inactive enquiries can be permanently deleted.", 409);
      }
      if (await repository.hasCustomerMaterialJobBalance(enquiryId)) {
        throw new AppError(
          "This enquiry has customer material job records and cannot be permanently deleted. Keep it inactive to preserve inventory history.",
          409
        );
      }

      const paths = await repository.getEnquiryHardDeleteFilePaths(enquiryId, connection);
      const deleted = await repository.hardDeleteEnquiry(connection, enquiryId);
      if (!deleted) throw new AppError("Enquiry is no longer inactive.", 409);
      await recordAudit({
        connection: db,
        tenantId: user.tenantId,
        module: "MARKETING",
        entityType: "ENQUIRY",
        entityId: enquiryId,
        action: "ENQUIRY_HARD_DELETED",
        oldValue: {
          docNo: enquiry.doc_no,
          customerId: enquiry.customer_id,
          customerName: enquiry.customer_name_snapshot,
          activeFlag: enquiry.active_flag,
        },
        performedBy: user.userCode,
      });
      return paths;
    });
  } catch (error) {
    if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(error.code)) {
      throw new AppError(
        "This enquiry is linked to operational records and cannot be permanently deleted. Keep it inactive to preserve history.",
        409
      );
    }
    throw error;
  }

  return { fileCleanupPending: await removeStoredFiles(filePaths) > 0 };
}


export async function submitEnquiry(enquiryId, user) {
  const userCode = typeof user === "string" ? user : user?.userCode;
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  return marketingDatabase.withTransaction(async (connection) => {
    const enquiry = await repository.getEnquiry(enquiryId, connection);

    if (!enquiry) {
      throw new AppError("Enquiry not found.", 404);
    }

    const parts = await repository.getEnquiryParts(
      enquiryId,
      connection
    );

    validate(
      {
        customerId: enquiry.customer_id,
        enquiryMode: enquiry.enquiry_mode,
        orderType: enquiry.order_type,
        parts: parts.map((part) => ({
          partNumber: part.part_number,
          drawingNumber: part.drawing_number,
          productDescription: part.product_description,
          materialAndGrade: part.material_and_grade,
          requiredQuantity: part.required_quantity,
        })),
      },
      "SUBMITTED"
    );

    await repository.submitEnquiry(connection, enquiryId, userCode);
    const submittedEnquiry = await repository.getEnquiry(enquiryId, connection);
    const submittedParts = await repository.getEnquiryParts(enquiryId, connection);
    await repository.appendEnquiryRevision(connection, {
      enquiryId: Number(enquiryId),
      revisionAction: "SUBMITTED",
      saveStatus: "SUBMITTED",
      snapshot: {
        enquiry: submittedEnquiry,
        parts: submittedParts,
      },
      userCode,
    });

    return { ...submittedEnquiry, marketingDatabase: marketingDatabase.key };
  });
}

export async function getEligibleQuotationParts(enquiryId) {
  const marketingDatabase = await findMarketingDatabaseByEnquiryId(enquiryId);
  return repository.getEligibleQuotationParts(enquiryId, marketingDatabase.pool);
}
