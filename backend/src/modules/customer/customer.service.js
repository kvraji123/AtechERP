import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { assertActiveTransportModes, parseTransportModes, readTransportModes, transportModesJson } from "../../utils/transport-modes.js";
import * as repository from "./customer.repository.js";

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

const actorUserCode = (user) => user?.userCode;

const isAdministrator = (user) =>
  String(user?.role || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_") === "ADMINISTRATOR";

function assertCanSubmitCustomer(user, saveStatus) {
  if (saveStatus === "SUBMITTED" && !isAdministrator(user)) {
    throw new AppError(
      "Only administrators can submit Customer Masters. You can save this record as a draft.",
      403
    );
  }
}

const isIndia = (countryName) => ["INDIA", "IN"].includes(
  String(countryName || "").trim().toUpperCase()
);

async function validateCustomer(data, { draft = false } = {}) {
  if (draft) return;

  if (!clean(data.customerName)) {
    throw new AppError("Customer Name is required.");
  }

  const indianCustomer = isIndia(data.countryName);
  const postalCodeLabel = indianCustomer ? "Pin code" : "Postal / ZIP code";
  const requiredFields = [
    [data.billingAddress, "Billing address"],
    [data.deliveryAddress, "Delivery address"],
    [data.pinCode, postalCodeLabel],
    [data.city, "City"],
    [data.stateName, "State"],
    [data.countryName, "Country"],
  ];
  if (indianCustomer) requiredFields.splice(6, 0, [data.gstNumber, "GST number"]);
  const missingField = requiredFields.find(([value]) => !clean(value));
  if (missingField) {
    throw new AppError(`${missingField[1]} is required.`);
  }

  const postalCode = clean(data.pinCode);
  if (indianCustomer && !/^\d{6}$/.test(postalCode)) {
    throw new AppError("Enter a valid 6 digit pin code.");
  }
  if (!indianCustomer && !/^[A-Za-z0-9]{3,10}$/.test(postalCode)) {
    throw new AppError("Enter a valid Postal / ZIP code using 3 to 10 letters or numbers.");
  }

  if ((clean(data.paymentTerms)?.length || 0) > 500) {
    throw new AppError("Payment terms must be at most 500 characters.");
  }

  const transportModes = readTransportModes(data.transportModes);
  await assertActiveTransportModes(transportModes);

  if (
    data.emailAddress &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress)
  ) {
    throw new AppError("Enter a valid email address.");
  }
}
function buildValues(data, customerCode, userCode, { saveStatus = "SUBMITTED" } = {}) {
  const transportModes = readTransportModes(data.transportModes);
  return [
    customerCode,
    clean(data.customerName),
    clean(data.customerShortName),
    clean(data.plantCode),
    clean(data.billingAddress),
    clean(data.deliveryAddress),
    clean(data.deliveryTerms),
    clean(data.pinCode),
    clean(data.city),
    clean(data.stateName),
    clean(data.countryName),
    clean(data.gstNumber),
    clean(data.panNumber),
    clean(data.mobileNumber),
    clean(data.phoneNumber),
    clean(data.faxNumber),
    clean(data.emailAddress),
    clean(data.websiteUrl),
    clean(data.invoiceType),
    clean(data.contactPersonName),
    clean(data.contactPersonMobile),
    clean(data.contactPersonDesignation),
    clean(data.contactPersonDepartment),
    clean(data.currencyCode) || "INR",
    clean(data.accountNumber),
    clean(data.accountName),
    clean(data.bankName),
    clean(data.branchName),
    clean(data.ifscCode),
    clean(data.panTanNumber),
    "ACTIVE",
    // A draft is still an active master record. Whether it can be selected in
    // operational transactions is controlled by save_status, not active_flag.
    "Y",
    null,
    clean(data.otherLegalRequirements),
    clean(data.paymentTerms),
    transportModes[0] || null,
    transportModesJson(transportModes),
    saveStatus,
    userCode,
  ];
}

function customerResponse(record) {
  if (!record) return record;
  const { customer_type: _customerType, customerType: _customerTypeAlias, ...customer } = record;
  return { ...customer, transportModes: parseTransportModes(record.allowed_transport_modes, record.transport_mode) };
}

export async function listCustomers(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);

  const result = await repository.listCustomers({
    search: clean(query.search) || "",
    activeFlag: clean(query.activeFlag) || "",
    saveStatus: clean(query.saveStatus) || "",
    includeDraft: query.includeDraft,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, rows: result.rows.map(customerResponse) };
}

export async function lookupActiveCustomers(query) {
  return repository.lookupActiveCustomers({
    search: clean(query.search) || "",
    limit: query.limit,
  });
}

export async function getCustomer(customerId) {
  const record = await repository.getCustomerById(customerId);

  if (!record) {
    throw new AppError("Customer not found.", 404);
  }

  return customerResponse(record);
}

export async function createCustomer(data, user) {
  const saveStatus = String(data.action || "SUBMIT").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  assertCanSubmitCustomer(user, saveStatus);
  await validateCustomer(data, { draft: saveStatus === "DRAFT" });

  return withTransaction(async (connection) => {
    const customerCode =
      await getNextDocumentNumber(connection, "CUSTOMER");

    const customerId = await repository.insertCustomer(
      connection,
      buildValues(data, customerCode, actorUserCode(user), { saveStatus })
    );

    const customer = await repository.getCustomerById(
      customerId,
      connection
    );

    return {
      customerId,
      customerCode,
      customer: customerResponse(customer),
    };
  });
}

export async function updateCustomer(customerId, data, user) {
  const existing = await getCustomer(customerId);
  const saveStatus = existing.save_status === "DRAFT"
    && String(data.action || "SUBMIT").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  assertCanSubmitCustomer(user, saveStatus);
  await validateCustomer(data, { draft: saveStatus === "DRAFT" });
  const values = buildValues(
    data,
    existing.customer_code,
    actorUserCode(user),
    { saveStatus }
  );

  const updateValues = [
    ...values.slice(1, 30),
    values[33],
    values[34],
    values[35],
    values[36],
    values[37],
    actorUserCode(user),
  ];

  await repository.updateCustomer(customerId, updateValues);
  return getCustomer(customerId);
}

export async function changeCustomerStatus(customerId, data, userCode) {
  const customerStatus = data.customerStatus;

  if (!["ACTIVE", "INACTIVE"].includes(customerStatus)) {
    throw new AppError("Invalid customer status.");
  }

  await getCustomer(customerId);

  await repository.updateCustomerStatus(customerId, {
    customerStatus,
    activeFlag: customerStatus === "ACTIVE" ? "Y" : "N",
    deactivationRemarks: clean(data.deactivationRemarks),
    updatedBy: userCode,
  });

  return getCustomer(customerId);
}

export async function hardDeleteCustomer(customerId, user) {
  try {
    return await withTransaction(async (connection) => {
      const customer = await repository.getCustomerById(customerId, connection);
      if (!customer) throw new AppError("Customer not found.", 404);
      if (customer.active_flag !== "N") {
        throw new AppError("Only inactive customers can be permanently deleted.", 409);
      }

      const deleted = await repository.hardDeleteInactiveCustomer(connection, customerId);
      if (!deleted) throw new AppError("Customer is no longer inactive.", 409);
      await recordAudit({
        connection,
        tenantId: user.tenantId,
        module: "CUSTOMER",
        entityType: "CUSTOMER",
        entityId: customerId,
        action: "CUSTOMER_HARD_DELETED",
        oldValue: {
          customerCode: customer.customer_code,
          customerName: customer.customer_name,
          activeFlag: customer.active_flag,
        },
        performedBy: user.userCode,
      });
    });
  } catch (error) {
    if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(error.code)) {
      throw new AppError(
        "This customer is linked to existing records and cannot be permanently deleted. Keep it inactive to preserve history.",
        409
      );
    }
    throw error;
  }
}
