import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import { todayInAppTimeZone } from "../../utils/dateTime.js";
import * as customerRepository from "../customer/customer.repository.js";
import * as partRepository from "../part/part.repository.js";
import * as repository from "./enquiry.repository.js";

export async function dashboardSummary() {
  return repository.dashboardSummary();
}

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

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

function revisionLabel(sequence) {
  return `REV${String(sequence).padStart(2, "0")}`;
}

function validate(data, action = "DRAFT") {
  if (!Number(data.customerId)) {
    throw new AppError("Customer is required.");
  }

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

      if (!clean(part.materialAndGrade)) {
        throw new AppError(`Material and Grade is required for row ${number}.`);
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

async function resolveParts(connection, data) {
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
      master = await partRepository.getPartById(Number(input.partId), connection);
      if (
        !master ||
        master.active_flag !== "Y"
      ) {
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
        connection
      );
    }

    resolved.push({
      ...input,
      ...(master ? partMasterSnapshot(master) : {}),
    });
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
    Number(data.customerId),
    customer.customer_code,
    customer.customer_name,
    customer.customer_short_name,
    data.enquiryMode || "MAIL",
    data.orderType || "SALES",
    clean(data.requiredDate),
    null,
    revisionNumber,
    revisionDate,
    saveStatus,
    clean(data.remarks),
    userCode,
  ];
}

export async function listEnquiries(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);

  return repository.listEnquiries({
    search: clean(query.search) || "",
    stage: clean(query.stage) || "",
    status: clean(query.status) || "",
    columnFilters: columnFilters(query.filters),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
}

export async function listEnquiryFilterOptions() {
  return repository.listEnquiryFilterOptions();
}

export async function getEnquiry(enquiryId) {
  const enquiry = await repository.getEnquiry(enquiryId);

  if (!enquiry) {
    throw new AppError("Enquiry not found.", 404);
  }

  return {
    ...enquiry,
    parts: await repository.getEnquiryParts(enquiryId),
  };
}

export async function getEnquiryRevisions(enquiryId) {
  await getEnquiry(enquiryId);
  return repository.getEnquiryRevisions(enquiryId);
}

async function save(enquiryId, data, userCode, action) {
  const saveStatus = action === "SUBMIT" ? "SUBMITTED" : "DRAFT";
  validate(data, saveStatus);

  return withTransaction(async (connection) => {
    const customer = await customerRepository.getCustomerById(
      Number(data.customerId),
      connection
    );

    if (!customer || customer.active_flag !== "Y") {
      throw new AppError("Select an active customer.");
    }

    let currentEnquiryId = Number(enquiryId || 0);
    let revisionSequence = 0;
    let revisionNumber = revisionLabel(revisionSequence);
    const revisionDate = currentDate();
    let revisionAction = "CREATED";

    if (currentEnquiryId) {
      const existing = await repository.getEnquiry(
        currentEnquiryId,
        connection
      );

      if (!existing) {
        throw new AppError("Enquiry not found.", 404);
      }

      if (existing.save_status === "SUBMITTED") {
        throw new AppError(
          "Submitted enquiry cannot be edited using the draft endpoint."
        );
      }

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
      const docNo = await getNextDocumentNumber(
        connection,
        "ENQUIRY"
      );

      currentEnquiryId = await repository.insertEnquiry(
        connection,
        [
          docNo,
          Number(data.customerId),
          customer.customer_code,
          customer.customer_name,
          customer.customer_short_name,
          data.enquiryMode || "MAIL",
          data.orderType || "SALES",
          clean(data.requiredDate),
          null,
          revisionNumber,
          revisionDate,
          saveStatus,
          clean(data.remarks),
          userCode,
        ]
      );
    }

    const resolvedParts = await resolveParts(connection, data);

    await repository.replaceParts(
      connection,
      currentEnquiryId,
      resolvedParts,
      userCode,
      saveStatus
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
      parts,
    };
  });
}

export function createEnquiry(data, userCode) {
  return save(null, data, userCode, data.action || "DRAFT");
}

export function updateEnquiry(enquiryId, data, userCode) {
  return save(enquiryId, data, userCode, data.action || "DRAFT");
}

export async function changeEnquiryStatus(
  enquiryId,
  enquiryStatus,
  userCode
) {
  if (enquiryStatus !== "ORDER_RECEIVED") {
    throw new AppError(
      "Only Order Received can be selected manually.",
      400
    );
  }

  const enquiry = await getEnquiry(enquiryId);

  if (enquiry.enquiry_status !== "QUOTED") {
    throw new AppError(
      "Only a Quoted enquiry can be changed to Order Received.",
      409
    );
  }

  await repository.updateEnquiryStatus(
    enquiryId,
    enquiryStatus,
    userCode
  );

  return getEnquiry(enquiryId);
}

export async function submitEnquiry(enquiryId, userCode) {
  return withTransaction(async (connection) => {
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

    return repository.getEnquiry(enquiryId, connection);
  });
}

export async function getEligibleQuotationParts(enquiryId) {
  await getEnquiry(enquiryId);
  return repository.getEligibleQuotationParts(enquiryId);
}
