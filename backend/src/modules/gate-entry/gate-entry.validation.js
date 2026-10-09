import { AppError } from "../../utils/AppError.js";

const entryTypes = new Set(["REGULAR_PURCHASE", "CUSTOMER_PURCHASE", "OPEN_PURCHASE", "OUTSOURCING_PARTS"]);
const referenceLabels = {
  CUSTOMER_PURCHASE: "Enquiry number",
  OPEN_PURCHASE: "Order number",
  OUTSOURCING_PARTS: "Part number",
};
const clean = (value) => String(value || "").trim();

export function validateGateEntry(raw = {}) {
  const entryType = clean(raw.entryType || "REGULAR_PURCHASE").toUpperCase();
  const purchaseOrderId = Number(raw.purchaseOrderId) || null;
  const customerId = Number(raw.customerId) || null;
  const supplierId = Number(raw.supplierId) || null;
  const partId = Number(raw.partId) || null;
  const referenceNumber = clean(raw.referenceNumber);
  const entryDateTime = clean(raw.entryDateTime);
  const transportMode = clean(raw.transportMode).toUpperCase();
  const action = clean(raw.action || "DRAFT").toUpperCase();

  if (!entryTypes.has(entryType)) throw new AppError("Choose a valid entry type.");
  if (!entryDateTime) throw new AppError("Gate entry date and time are required.");
  if (!['DRAFT', 'GATE_ENTERED'].includes(action)) throw new AppError("Invalid gate entry action.");
  if (entryType === "REGULAR_PURCHASE" && !purchaseOrderId) throw new AppError("Select an approved purchase order for a regular purchase entry.");
  if (!["REGULAR_PURCHASE", "OUTSOURCING_PARTS"].includes(entryType) && !referenceNumber) throw new AppError(`${referenceLabels[entryType]} is required for this entry type.`);
  if (entryType === "CUSTOMER_PURCHASE" && !customerId) throw new AppError("Select the customer for a customer purchase entry.");
  if (["OPEN_PURCHASE", "OUTSOURCING_PARTS"].includes(entryType) && !supplierId) throw new AppError("Select the supplier for this entry type.");
  if (entryType === "OUTSOURCING_PARTS" && !partId) throw new AppError("Select an active Part Master part for outsourcing.");
  if (referenceNumber.length > 100) throw new AppError("Reference number must not exceed 100 characters.");
  if (action === "GATE_ENTERED" && (!clean(raw.vehicleNumber) || !clean(raw.driverName) || !clean(raw.drivingLicenceNumber))) throw new AppError("Vehicle number, driver name and driving licence number are required.");

  return {
    entryType,
    purchaseOrderId: entryType === "REGULAR_PURCHASE" ? purchaseOrderId : null,
    customerId: entryType === "CUSTOMER_PURCHASE" ? customerId : null,
    supplierId: ["OPEN_PURCHASE", "OUTSOURCING_PARTS"].includes(entryType) ? supplierId : null,
    partId: entryType === "OUTSOURCING_PARTS" ? partId : null,
    referenceNumber: entryType === "REGULAR_PURCHASE" ? null : referenceNumber,
    entryDateTime,
    transportMode,
    vehicleNumber: clean(raw.vehicleNumber).toUpperCase(),
    driverName: clean(raw.driverName),
    drivingLicenceNumber: clean(raw.drivingLicenceNumber).toUpperCase(),
    action,
  };
}
