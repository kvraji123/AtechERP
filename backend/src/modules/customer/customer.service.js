import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import { assertActiveTransportModes, parseTransportModes, readTransportModes, transportModesJson } from "../../utils/transport-modes.js";
import * as repository from "./customer.repository.js";

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

async function validateCustomer(data) {
  if (!clean(data.customerName)) {
    throw new AppError("Customer Name is required.");
  }

  if (!["OEM","OTHERS"].includes(clean(data.customerType)?.toUpperCase())) {
    throw new AppError("Customer Type must be OEM or Others.");
  }

  const requiredFields = [
    [data.billingAddress, "Billing address"],
    [data.deliveryAddress, "Delivery address"],
    [data.pinCode, "Pin code"],
    [data.city, "City"],
    [data.stateName, "State"],
    [data.countryName, "Country"],
    [data.gstNumber, "GST number"],
    [data.accountNumber, "Account number"],
    [data.accountName, "Account name"],
    [data.bankName, "Bank name"],
    [data.branchName, "Branch name"],
    [data.ifscCode, "IFSC code"],
  ];
  const missingField = requiredFields.find(([value]) => !clean(value));
  if (missingField) {
    throw new AppError(`${missingField[1]} is required.`);
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

function buildValues(data, customerCode, userCode) {
  const transportModes = readTransportModes(data.transportModes);
  return [
    clean(data.customerType)?.toUpperCase(),
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
    "Y",
    null,
    clean(data.otherLegalRequirements),
    clean(data.paymentTerms),
    transportModes[0] || null,
    transportModesJson(transportModes),
    userCode,
  ];
}

function customerResponse(record) {
  if (!record) return record;
  return { ...record, transportModes: parseTransportModes(record.allowed_transport_modes, record.transport_mode) };
}

export async function listCustomers(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);

  const result = await repository.listCustomers({
    search: clean(query.search) || "",
    activeFlag: clean(query.activeFlag) || "",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, rows: result.rows.map(customerResponse) };
}

export async function getCustomer(customerId) {
  const record = await repository.getCustomerById(customerId);

  if (!record) {
    throw new AppError("Customer not found.", 404);
  }

  return customerResponse(record);
}

export async function createCustomer(data, userCode) {
  await validateCustomer(data);

  return withTransaction(async (connection) => {
    const customerCode =
      await getNextDocumentNumber(connection, "CUSTOMER");

    const customerId = await repository.insertCustomer(
      connection,
      buildValues(data, customerCode, userCode)
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

export async function updateCustomer(customerId, data, userCode) {
  await validateCustomer(data);

  const existing = await getCustomer(customerId);
  const values = buildValues(
    data,
    existing.customer_code,
    userCode
  );

  const updateValues = [
    values[0],
    ...values.slice(2, 31),
    values[34],
    values[35],
    values[36],
    values[37],
    userCode,
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
