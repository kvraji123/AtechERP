import { AppError } from "../../utils/AppError.js";

const entryTypes = new Set(["REGULAR_PURCHASE", "CUSTOMER_PURCHASE", "OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"]);
const serviceTypes = new Set(["CALIBRATION_RETURN", "TOOL_RETURN"]);
const referenceLabels = {
  CUSTOMER_PURCHASE: "DC number",
  OPEN_PURCHASE: "Order / invoice number",
  OUTSOURCING_PARTS: "DC number",
  OTHER_SERVICES: "Service DC / invoice number",
};
const supplierEntryTypes = new Set(["OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"]);
const clean = (value) => String(value || "").trim();
const isCourierTransport = (transportMode) => transportMode === "COURIER";

export function validateGateEntry(raw = {}) {
  const entryType = clean(raw.entryType || "REGULAR_PURCHASE").toUpperCase();
  const serviceType = clean(raw.serviceType).toUpperCase();
  const purchaseOrderId = Number(raw.purchaseOrderId) || null;
  const customerId = Number(raw.customerId) || null;
  const supplierId = Number(raw.supplierId) || null;
  const partId = Number(raw.partId) || null;
  const referenceNumber = clean(raw.referenceNumber);
  const entryDateTime = clean(raw.entryDateTime);
  const transportMode = clean(raw.transportMode).toUpperCase();
  const courierName = clean(raw.courierName);
  const courierReceiptNumber = clean(raw.courierReceiptNumber);
  const action = clean(raw.action || "DRAFT").toUpperCase();

  if (!entryTypes.has(entryType)) throw new AppError("Choose a valid entry type.");
  if (entryType === "OTHER_SERVICES" && serviceType && !serviceTypes.has(serviceType)) throw new AppError("Choose a valid service type.");
  if (!entryDateTime) throw new AppError("Gate entry date and time are required.");
  if (!['DRAFT', 'GATE_ENTERED'].includes(action)) throw new AppError("Invalid gate entry action.");
  if (entryType === "REGULAR_PURCHASE" && !purchaseOrderId) throw new AppError("Select an approved purchase order for a regular purchase entry.");
  if (entryType !== "REGULAR_PURCHASE" && !referenceNumber) throw new AppError(`${referenceLabels[entryType]} is required for this entry type.`);
  if (entryType === "CUSTOMER_PURCHASE" && !customerId) throw new AppError("Select the customer for a customer purchase entry.");
  if (supplierEntryTypes.has(entryType) && !supplierId) throw new AppError("Select the supplier for this entry type.");
  if (entryType === "OUTSOURCING_PARTS" && !partId) throw new AppError("Select an active Part Master part for outsourcing.");
  if (referenceNumber.length > 100) throw new AppError("Reference number must not exceed 100 characters.");
  if (courierName.length > 150) throw new AppError("Courier name must not exceed 150 characters.");
  if (courierReceiptNumber.length > 120) throw new AppError("Courier Receipt number must not exceed 120 characters.");
  if (action === "GATE_ENTERED" && isCourierTransport(transportMode) && (!courierName || !courierReceiptNumber)) throw new AppError("Courier name and Courier Receipt number are required when transport mode is Courier.");
  if (action === "GATE_ENTERED" && !isCourierTransport(transportMode) && (!clean(raw.vehicleNumber) || !clean(raw.driverName))) throw new AppError("Vehicle number and driver name are required.");

  return {
    entryType,
    serviceType: entryType === "OTHER_SERVICES" ? serviceType || null : null,
    purchaseOrderId: entryType === "REGULAR_PURCHASE" ? purchaseOrderId : null,
    customerId: entryType === "CUSTOMER_PURCHASE" ? customerId : null,
    supplierId: supplierEntryTypes.has(entryType) ? supplierId : null,
    partId: entryType === "OUTSOURCING_PARTS" ? partId : null,
    referenceNumber: entryType === "REGULAR_PURCHASE" ? null : referenceNumber,
    entryDateTime,
    transportMode,
    vehicleNumber: isCourierTransport(transportMode) ? null : clean(raw.vehicleNumber).toUpperCase(),
    driverName: isCourierTransport(transportMode) ? null : clean(raw.driverName),
    drivingLicenceNumber: isCourierTransport(transportMode) ? null : clean(raw.drivingLicenceNumber).toUpperCase(),
    courierName: isCourierTransport(transportMode) ? courierName : null,
    courierReceiptNumber: isCourierTransport(transportMode) ? courierReceiptNumber.toUpperCase() : null,
    action,
  };
}
