import assert from "node:assert/strict";
import { db } from "../src/config/db.js";
import * as repository from "../src/modules/inventory/inventory.repository.js";

try {
  const tenantId = "DEFAULT";
  const dashboard = await repository.getDashboard(tenantId);
  assert.equal(typeof dashboard.quantityOnHand, "number");
  assert.equal(typeof dashboard.reorderAlertCount, "number");

  const filters = { search: "", warehouse: "", binLocation: "" };
  const [stock, transactions, qualityHold, reorderAlerts] = await Promise.all([
    repository.listStock({ tenantId, filters, limit: 10 }),
    repository.listTransactions({ tenantId, filters, limit: 10 }),
    repository.listQualityHold({ tenantId, limit: 10 }),
    repository.listReorderAlerts({ tenantId, limit: 10 }),
  ]);
  assert.ok(Array.isArray(stock));
  assert.ok(Array.isArray(transactions));
  assert.ok(Array.isArray(qualityHold));
  assert.ok(Array.isArray(reorderAlerts));
  console.log("Inventory read APIs query stock, transactions, quality hold and reorder alerts successfully.");
} finally {
  await db.end();
}
