import assert from "node:assert/strict";
import { validateGateEntry } from "../src/modules/gate-entry/gate-entry.validation.js";

const base = { entryDateTime: "2026-09-14T10:04", vehicleNumber: "TN 38 AB 4521", driverName: "R Kumar", drivingLicenceNumber: "TN3820120006541" };

assert.equal(validateGateEntry({ ...base, entryType: "REGULAR_PURCHASE", purchaseOrderId: 42 }).purchaseOrderId, 42);
assert.throws(() => validateGateEntry({ ...base, entryType: "REGULAR_PURCHASE" }), /approved purchase order/i);
assert.throws(() => validateGateEntry({ ...base, entryType: "CUSTOMER_PURCHASE" }), /enquiry number/i);
assert.throws(() => validateGateEntry({ ...base, entryType: "CUSTOMER_PURCHASE", referenceNumber: "ENQ/2026-27/0121" }), /customer/i);
assert.equal(validateGateEntry({ ...base, entryType: "CUSTOMER_PURCHASE", customerId: 7, referenceNumber: "ENQ/2026-27/0121" }).customerId, 7);
assert.throws(() => validateGateEntry({ ...base, entryType: "OPEN_PURCHASE", referenceNumber: "ORD/2026-27/0086" }), /supplier/i);
assert.equal(validateGateEntry({ ...base, entryType: "OPEN_PURCHASE", supplierId: 8, referenceNumber: "ORD/2026-27/0086" }).purchaseOrderId, null);
assert.throws(() => validateGateEntry({ ...base, entryType: "OUTSOURCING_PARTS", supplierId: 8 }), /Part Master part/i);
assert.equal(validateGateEntry({ ...base, entryType: "OUTSOURCING_PARTS", supplierId: 8, partId: 42 }).entryType, "OUTSOURCING_PARTS");
assert.throws(() => validateGateEntry({ ...base, entryType: "OPEN_PURCHASE", supplierId: 8, referenceNumber: "ORD-1", action: "GATE_ENTERED", vehicleNumber: "" }), /vehicle number/i);

console.log("Gate entry type validation passed.");
