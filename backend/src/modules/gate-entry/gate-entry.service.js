import { withTransaction } from "../../config/db.js";
import { ensureDocumentSequence, getFinancialYear, getNextDocumentNumber } from "../../utils/sequence.js";
import { AppError } from "../../utils/AppError.js";
import { appLocalDateTimeToUtc } from "../../utils/dateTime.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { assertPartyTransportMode } from "../../utils/transport-modes.js";
import * as repository from "./gate-entry.repository.js";
import { validateGateEntry } from "./gate-entry.validation.js";

const clean = (value) => String(value || "").trim();
const withItemCategories = async (rows, tenantId, connection) => {
  const categories = await repository.listItemCategories(tenantId, rows.map((row) => row.purchaseOrderId || row.purchase_order_id || row.id), connection);
  const byPurchaseOrderId = new Map(categories.map((row) => [Number(row.purchaseOrderId), row.itemCategory]));
  return rows.map((row) => ({ ...row, itemCategory: byPurchaseOrderId.get(Number(row.purchaseOrderId || row.purchase_order_id || row.id)) || "Item type unavailable" }));
};

export async function list(query, user) { const page = Math.max(Number(query.page || 1), 1); const pageSize = Math.min(Math.max(Number(query.pageSize || 100), 1), 100); const result = await repository.list({ tenantId: user.tenantId, search: clean(query.search), status: clean(query.status).toUpperCase(), supplier: clean(query.supplier), dateRange: clean(query.dateRange).toUpperCase(), limit: pageSize, offset: (page - 1) * pageSize }); return { ...result, rows: await withItemCategories(result.rows, user.tenantId), page, pageSize }; }
export async function summary(user) { return repository.summary(user.tenantId); }
export async function listSupplierOptions(user) { return repository.listSupplierOptions(user.tenantId); }
export async function get(id, user) { const row = await repository.get(id, user.tenantId); if (!row) throw new AppError("Gate entry not found.", 404); return (await withItemCategories([row], user.tenantId))[0]; }
export async function eligibleOrders(user) { const strictRows = await repository.eligibleOrders(user.tenantId); return withItemCategories(strictRows.length ? strictRows : await repository.receivableOrders(user.tenantId), user.tenantId); }

export async function create(raw, user) {
  const data = validateGateEntry(raw);
  return withTransaction(async (connection) => {
    const order = data.entryType === "REGULAR_PURCHASE" ? await repository.getEligibleOrder(data.purchaseOrderId, user.tenantId, connection, true) || await repository.getReceivableOrder(data.purchaseOrderId, user.tenantId, connection, true) : null;
    const customer = data.entryType === "CUSTOMER_PURCHASE" ? await repository.getActiveCustomer(connection, data.customerId) : null;
    const supplier = ["OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"].includes(data.entryType) ? await repository.getActiveSupplier(connection, data.supplierId) : null;
    const part = data.entryType === "OUTSOURCING_PARTS" ? await repository.getActivePart(connection, data.partId) : null;
    if (data.entryType === "REGULAR_PURCHASE" && !order?.items.length) throw new AppError("This purchase order has no open items for gate entry.", 409);
    if (data.entryType === "CUSTOMER_PURCHASE" && !customer) throw new AppError("The selected customer is not active.", 409);
    if (["OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"].includes(data.entryType) && !supplier) throw new AppError("The selected supplier is not active.", 409);
    if (data.entryType === "OUTSOURCING_PARTS" && !part) throw new AppError("The selected Part Master part is not active.", 409);
    const transportParty = customer || supplier || (order ? await repository.getActiveSupplier(connection, order.supplier_id) : null);
    if (!transportParty) throw new AppError("The shipment party is not active.", 409);
    const transportMode = data.transportMode ? await assertPartyTransportMode({ selectedMode: data.transportMode, allowedModes: transportParty.allowed_transport_modes || transportParty.allowedTransportModes || transportParty.transport_mode || transportParty.transportMode, partyLabel: customer ? "Customer" : "Supplier", connection }) : null;
    if (data.action === "GATE_ENTERED" && !transportMode) throw new AppError("Select the actual transport mode before creating the gate entry.");
    const financialYear = getFinancialYear();
    const [sequenceRows] = await connection.execute(`SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(gate_entry_number, '/', -1) AS UNSIGNED)), 0) AS currentNumber FROM purchase_gate_entries WHERE tenant_id=? AND gate_entry_number LIKE ?`, [user.tenantId, `GE/${financialYear}/%`]);
    await ensureDocumentSequence(connection, "GATE_ENTRY", financialYear, "GE", Number(sequenceRows[0]?.currentNumber || 0));
    const number = await getNextDocumentNumber(connection, "GATE_ENTRY", financialYear);
    const referenceNumber = data.referenceNumber || order?.po_number || part?.part_number || null;
    const id = await repository.insert(connection, [user.tenantId, user.companyId, order?.plant_id || null, number, appLocalDateTimeToUtc(data.entryDateTime), data.entryType, data.serviceType, referenceNumber, order?.purchase_order_id || null, order?.supplier_id || supplier?.supplier_id || null, customer?.customer_id || null, part?.part_id || null, part?.part_number || null, part?.part_name || null, part?.unit_of_measurement || null, order?.supplier_code_snapshot || supplier?.supplier_code || null, order?.supplier_name_snapshot || supplier?.supplier_name || null, customer?.customer_name || null, transportMode, data.courierName || null, data.courierReceiptNumber || null, data.vehicleNumber || null, data.driverName || null, data.drivingLicenceNumber || null, data.action, user.userCode]);
    await recordAudit({ connection, tenantId: user.tenantId, module: "PURCHASE", entityType: "GATE_ENTRY", entityId: id, action: `GATE_ENTRY_${data.action}`, newValue: { gateEntryNumber: number, entryType: data.entryType, serviceType: data.serviceType, referenceNumber, purchaseOrderId: order?.purchase_order_id || null, supplierId: order?.supplier_id || supplier?.supplier_id || null, customerId: customer?.customer_id || null, partId: part?.part_id || null, transportMode, courierName: data.courierName || null, courierReceiptNumber: data.courierReceiptNumber || null }, performedBy: user.userCode });
    return (await withItemCategories([await repository.get(id, user.tenantId, connection)], user.tenantId, connection))[0];
  });
}

export async function update(id, raw, user) {
  const data = validateGateEntry(raw);
  return withTransaction(async (connection) => {
    const existing = await repository.get(id, user.tenantId, connection, true);
    if (!existing) throw new AppError("Gate entry not found.", 404);
    if (existing.status !== "DRAFT") throw new AppError("Only draft gate entries can be updated.", 409);
    const order = data.entryType === "REGULAR_PURCHASE" ? await repository.getEligibleOrder(data.purchaseOrderId, user.tenantId, connection, true) || await repository.getReceivableOrder(data.purchaseOrderId, user.tenantId, connection, true) : null;
    const customer = data.entryType === "CUSTOMER_PURCHASE" ? await repository.getActiveCustomer(connection, data.customerId) : null;
    const supplier = ["OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"].includes(data.entryType) ? await repository.getActiveSupplier(connection, data.supplierId) : null;
    const part = data.entryType === "OUTSOURCING_PARTS" ? await repository.getActivePart(connection, data.partId) : null;
    if (data.entryType === "REGULAR_PURCHASE" && !order?.items.length) throw new AppError("This purchase order has no open items for gate entry.", 409);
    if (data.entryType === "CUSTOMER_PURCHASE" && !customer) throw new AppError("The selected customer is not active.", 409);
    if (["OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"].includes(data.entryType) && !supplier) throw new AppError("The selected supplier is not active.", 409);
    if (data.entryType === "OUTSOURCING_PARTS" && !part) throw new AppError("The selected Part Master part is not active.", 409);
    const transportParty = customer || supplier || (order ? await repository.getActiveSupplier(connection, order.supplier_id) : null);
    if (!transportParty) throw new AppError("The shipment party is not active.", 409);
    const transportMode = data.transportMode ? await assertPartyTransportMode({ selectedMode: data.transportMode, allowedModes: transportParty.allowed_transport_modes || transportParty.allowedTransportModes || transportParty.transport_mode || transportParty.transportMode, partyLabel: customer ? "Customer" : "Supplier", connection }) : null;
    if (data.action === "GATE_ENTERED" && !transportMode) throw new AppError("Select the actual transport mode before creating the gate entry.");
    await repository.update(connection, id, user.tenantId, [appLocalDateTimeToUtc(data.entryDateTime), data.entryType, data.serviceType, data.referenceNumber || order?.po_number || part?.part_number || null, order?.purchase_order_id || null, order?.plant_id || null, order?.supplier_id || supplier?.supplier_id || null, customer?.customer_id || null, part?.part_id || null, part?.part_number || null, part?.part_name || null, part?.unit_of_measurement || null, order?.supplier_code_snapshot || supplier?.supplier_code || null, order?.supplier_name_snapshot || supplier?.supplier_name || null, customer?.customer_name || null, transportMode, data.courierName || null, data.courierReceiptNumber || null, data.vehicleNumber || null, data.driverName || null, data.drivingLicenceNumber || null, data.action, user.userCode]);
    return (await withItemCategories([await repository.get(id, user.tenantId, connection)], user.tenantId, connection))[0];
  });
}

export async function markGrnCreated(connection, gateEntryId, user) { if (gateEntryId) await repository.setStatus(connection, gateEntryId, user.tenantId, "GRN_CREATED", user.userCode); }
export async function markOutsourcingWip(connection, gateEntryId, user) { if (gateEntryId) await repository.setStatus(connection, gateEntryId, user.tenantId, "OUTSOURCING_WIP", user.userCode); }
export async function markStockPosted(connection, gateEntryId, user) { if (gateEntryId) await repository.setStatus(connection, gateEntryId, user.tenantId, "STOCK_POSTED", user.userCode); }

export async function completeCalibrationReturnGateEntry(connection, gateEntryId, user) {
  const gate = await repository.get(gateEntryId, user.tenantId, connection, true);
  if (!gate || gate.status !== "GATE_ENTERED") throw new AppError("The Calibration Return Gate Entry is not ready for GRN inward.", 409);
  if (gate.entryType !== "OTHER_SERVICES" || gate.serviceType !== "CALIBRATION_RETURN") {
    throw new AppError("Select a Gate Entry recorded as Other Services / Calibration Return.", 409);
  }
  await repository.setStatus(connection, gateEntryId, user.tenantId, "GRN_CREATED", user.userCode);
  return gate;
}

export async function completeToolReturnGateEntry(connection, gateEntryId, user) {
  const gate = await repository.get(gateEntryId, user.tenantId, connection, true);
  if (!gate || gate.status !== "GATE_ENTERED") throw new AppError("The Tool Return Gate Entry is not ready for GRN inward.", 409);
  if (gate.entryType !== "OTHER_SERVICES" || gate.serviceType !== "TOOL_RETURN") {
    throw new AppError("Select a Gate Entry recorded as Other Services / Tool Return.", 409);
  }
  await repository.setStatus(connection, gateEntryId, user.tenantId, "GRN_CREATED", user.userCode);
  return gate;
}
