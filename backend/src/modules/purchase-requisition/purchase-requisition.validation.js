import { AppError } from "../../utils/AppError.js";

const priorities = new Set(["LOW", "MEDIUM", "HIGH"]);
const requisitionTypes = new Set(["EXISTING_ITEM", "NEW_ITEM"]);

export function normalizeRequest(data = {}) {
  const action = String(data.action || "DRAFT").toUpperCase();
  const requisitionType = String(data.requisitionType || "EXISTING_ITEM").toUpperCase();
  const priority = String(data.priority || "MEDIUM").toUpperCase();
  const department = String(data.department || "").trim();
  if (!["DRAFT", "SUBMIT"].includes(action)) throw new AppError("Action must be DRAFT or SUBMIT.");
  if (!requisitionTypes.has(requisitionType)) throw new AppError("Invalid requisition type.");
  if (!priorities.has(priority)) throw new AppError("Priority must be LOW, MEDIUM, or HIGH.");
  if (!department) throw new AppError("Department is required.");
  if (!Array.isArray(data.items) || data.items.length === 0) throw new AppError("Add at least one purchase request item.");
  const requestDate = String(data.requestDate || "").trim();
  const requiredDate = String(data.requiredDate || "").trim();
  const preferredSupplierId = data.preferredSupplierId === null || data.preferredSupplierId === undefined || data.preferredSupplierId === ""
    ? null
    : Number(data.preferredSupplierId);
  if (preferredSupplierId !== null && (!Number.isSafeInteger(preferredSupplierId) || preferredSupplierId <= 0)) {
    throw new AppError("Select a valid Preferred Supplier.");
  }
  if (action === "SUBMIT" && requisitionType === "EXISTING_ITEM" && !preferredSupplierId) {
    throw new AppError("Preferred Supplier is required for an Existing Item purchase request.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestDate)) throw new AppError("Request date must be in YYYY-MM-DD format.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requiredDate)) throw new AppError("Required date must be in YYYY-MM-DD format.");
  if (requiredDate < requestDate) throw new AppError("Required date cannot be before request date.");
  data.items.forEach((item, index) => {
    if (!Number.isInteger(Number(item.itemId)) || Number(item.itemId) <= 0) throw new AppError(`Select a valid Item Master item for row ${index + 1}.`);
    const quantity = Number(item.requestedQuantity ?? item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError(`Quantity must be greater than zero for row ${index + 1}.`);
    if (!String(item.purpose || "").trim()) throw new AppError(`Purpose is required for row ${index + 1}.`);
  });
  return { ...data, action, requisitionType, priority, department, requestDate, requiredDate, preferredSupplierId };
}
