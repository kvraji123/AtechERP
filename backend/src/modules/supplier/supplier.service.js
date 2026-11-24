import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { getNextDocumentNumber } from "../../utils/sequence.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { assertActiveTransportModes, parseTransportModes, readTransportModes, transportModesJson } from "../../utils/transport-modes.js";
import * as repository from "./supplier.repository.js";

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

function assertCanSubmitSupplier(user, saveStatus) {
  if (saveStatus === "SUBMITTED" && !isAdministrator(user)) {
    throw new AppError(
      "Only administrators can submit Supplier Masters. You can save this record as a draft.",
      403
    );
  }
}
const isIndia = (countryName) => ["INDIA", "IN"].includes(
  String(countryName || "").trim().toUpperCase()
);
const SUPPLIER_TYPES = new Set(["MANUFACTURER", "TRADER", "SERVICE_PROVIDER"]);
const SUPPLIER_CATEGORIES = new Set([
  "CALIBRATION", "TOOLING", "RAW_MATERIAL", "CHILD_PARTS", "PACKING_MATERIAL", "POWDER_COATING",
]);

async function validateSupplier(data, { draft = false } = {}) {
  if (draft) return;

  if (!clean(data.supplierName)) {
    throw new AppError("Supplier Name is required.");
  }

  if (!SUPPLIER_TYPES.has(clean(data.supplierType)?.toUpperCase())) {
    throw new AppError("Supplier Type must be Manufacturer, Trader, or Service Provider.");
  }

  if (!SUPPLIER_CATEGORIES.has(clean(data.supplierCategory)?.toUpperCase())) {
    throw new AppError("Select a valid Supplier Category / Process.");
  }

  const indianSupplier = isIndia(data.countryName);
  const postalCodeLabel = indianSupplier ? "Pin code" : "Postal / ZIP code";
  const requiredFields = [
    [data.address, "Address"],
    [data.pinCode, postalCodeLabel],
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

  const postalCode = clean(data.pinCode);
  if (indianSupplier && !/^\d{6}$/.test(postalCode)) {
    throw new AppError("Enter a valid 6 digit pin code.");
  }
  if (!indianSupplier && !/^[A-Za-z0-9]{3,10}$/.test(postalCode)) {
    throw new AppError("Enter a valid Postal / ZIP code using 3 to 10 letters or numbers.");
  }

  if ((clean(data.paymentTerms)?.length || 0) > 500) {
    throw new AppError("Payment terms must be at most 500 characters.");
  }

  const transportModes = readTransportModes(data.transportModes);
  if (!transportModes.length) {
    throw new AppError("Select at least one transport mode.");
  }
  await assertActiveTransportModes(transportModes);

  if (
    data.emailAddress &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress)
  ) {
    throw new AppError("Enter a valid email address.");
  }
}
function buildValues(data, supplierCode, userCode, { saveStatus = "SUBMITTED" } = {}) {
  const transportModes = readTransportModes(data.transportModes);
  return [
    clean(data.supplierType)?.toUpperCase(),
    clean(data.supplierCategory)?.toUpperCase(),
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
    saveStatus: clean(query.saveStatus) || "",
    includeDraft: query.includeDraft,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { ...result, rows: result.rows.map(supplierResponse) };
}

export async function lookupActiveSuppliers(query) {
  return repository.lookupActiveSuppliers({
    search: clean(query.search) || "",
    limit: query.limit,
  });
}

export async function getSupplier(supplierId) {
  const record = await repository.getSupplierById(supplierId);

  if (!record) {
    throw new AppError("Supplier not found.", 404);
  }

  return supplierResponse(record);
}

export async function createSupplier(data, user) {
  const saveStatus = String(data.action || "SUBMIT").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  assertCanSubmitSupplier(user, saveStatus);
  await validateSupplier(data, { draft: saveStatus === "DRAFT" });

  return withTransaction(async (connection) => {
    const supplierCode =
      await getNextDocumentNumber(connection, "SUPPLIER");

    const supplierId = await repository.insertSupplier(
      connection,
      buildValues(data, supplierCode, actorUserCode(user), { saveStatus })
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

export async function updateSupplier(supplierId, data, user) {
  const existing = await getSupplier(supplierId);
  const saveStatus = existing.save_status === "DRAFT"
    && String(data.action || "SUBMIT").toUpperCase() === "DRAFT"
    ? "DRAFT"
    : "SUBMITTED";
  assertCanSubmitSupplier(user, saveStatus);
  await validateSupplier(data, { draft: saveStatus === "DRAFT" });
  const values = buildValues(
    { ...data, plantCode: existing.plant_code, billingAddress: existing.billing_address, invoiceType: existing.invoice_type },
    existing.supplier_code,
    actorUserCode(user),
    { saveStatus }
  );

  const updateValues = [
    values[0],
    values[1],
    ...values.slice(3, 32),
    values[35],
    values[36],
    values[37],
    values[38],
    values[39],
    actorUserCode(user),
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

export async function hardDeleteSupplier(supplierId, user) {
  try {
    return await withTransaction(async (connection) => {
      const supplier = await repository.getSupplierById(supplierId, connection);
      if (!supplier) throw new AppError("Supplier not found.", 404);
      if (supplier.active_flag !== "N") {
        throw new AppError("Only inactive suppliers can be permanently deleted.", 409);
      }

      const deleted = await repository.hardDeleteInactiveSupplier(connection, supplierId);
      if (!deleted) throw new AppError("Supplier is no longer inactive.", 409);
      await recordAudit({
        connection,
        tenantId: user.tenantId,
        module: "SUPPLIER",
        entityType: "SUPPLIER",
        entityId: supplierId,
        action: "SUPPLIER_HARD_DELETED",
        oldValue: {
          supplierCode: supplier.supplier_code,
          supplierName: supplier.supplier_name,
          activeFlag: supplier.active_flag,
        },
        performedBy: user.userCode,
      });
    });
  } catch (error) {
    if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(error.code)) {
      throw new AppError(
        "This supplier is linked to existing records and cannot be permanently deleted. Keep it inactive to preserve history.",
        409
      );
    }
    throw error;
  }
}
