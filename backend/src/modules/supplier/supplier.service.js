import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import { assertActiveTransportModes, parseTransportModes, readTransportModes, transportModesJson } from "../../utils/transport-modes.js";
import * as repository from "./supplier.repository.js";

const clean = (value) =>
  value === null || value === undefined
    ? null
    : String(value).trim() || null;

async function validateSupplier(data) {
  if (!clean(data.supplierName)) {
    throw new AppError("Supplier Name is required.");
  }

  if (!["MANUFACTURER","DEALER"].includes(clean(data.supplierType)?.toUpperCase())) {
    throw new AppError("Supplier Type must be Manufacturer or Dealer.");
  }

  const requiredFields = [
    [data.address, "Address"],
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

function buildValues(data, supplierCode, userCode) {
  const transportModes = readTransportModes(data.transportModes);
  return [
    clean(data.supplierType)?.toUpperCase(),
    supplierCode,
    clean(data.supplierName),
    clean(data.supplierShortName),
    clean(data.plantCode),
    clean(data.billingAddress),
    clean(data.address ?? data.deliveryAddress),
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

function supplierResponse(record) {
  if (!record) return record;
  return { ...record, transportModes: parseTransportModes(record.allowed_transport_modes, record.transport_mode) };
}

export async function listSuppliers(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);

  const result = await repository.listSuppliers({
    search: clean(query.search) || "",
    activeFlag: clean(query.activeFlag) || "",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, rows: result.rows.map(supplierResponse) };
}

export async function getSupplier(supplierId) {
  const record = await repository.getSupplierById(supplierId);

  if (!record) {
    throw new AppError("Supplier not found.", 404);
  }

  return supplierResponse(record);
}

export async function createSupplier(data, userCode) {
  await validateSupplier(data);

  return withTransaction(async (connection) => {
    const supplierCode =
      await getNextDocumentNumber(connection, "SUPPLIER");

    const supplierId = await repository.insertSupplier(
      connection,
      buildValues(data, supplierCode, userCode)
    );

    const supplier = await repository.getSupplierById(
      supplierId,
      connection
    );

    return {
      supplierId,
      supplierCode,
      supplier: supplierResponse(supplier),
    };
  });
}

export async function updateSupplier(supplierId, data, userCode) {
  await validateSupplier(data);

  const existing = await getSupplier(supplierId);
  const values = buildValues(
    { ...data, plantCode: existing.plant_code, billingAddress: existing.billing_address, invoiceType: existing.invoice_type },
    existing.supplier_code,
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

  await repository.updateSupplier(supplierId, updateValues);
  return getSupplier(supplierId);
}

export async function changeSupplierStatus(supplierId, data, userCode) {
  const supplierStatus = data.supplierStatus;

  if (!["ACTIVE", "INACTIVE"].includes(supplierStatus)) {
    throw new AppError("Invalid supplier status.");
  }

  await getSupplier(supplierId);

  await repository.updateSupplierStatus(supplierId, {
    supplierStatus,
    activeFlag: supplierStatus === "ACTIVE" ? "Y" : "N",
    deactivationRemarks: clean(data.deactivationRemarks),
    updatedBy: userCode,
  });

  return getSupplier(supplierId);
}
