import assert from "node:assert/strict";
import { db } from "../src/config/db.js";
import * as repository from "../src/modules/grn/grn.repository.js";
import { validateGrn, validateGrnStockPosting } from "../src/modules/grn/grn.validation.js";

let connection;
try {
  const baseGrn = { purchaseOrderId: 1, gateEntryId: 1, grnDate: "2026-09-12", items: [{ purchaseOrderItemId: 1, receivedQuantity: 1 }] };
  assert.throws(() => validateGrn({ ...baseGrn, receiptType: "CUSTOMER_SUPPLIED" }), /customer name and plant code/i);
  const customerSupplied = validateGrn({ gateEntryId: 1, grnDate: "2026-09-12", items: [{ itemId: 1, receivedQuantity: 1 }], receiptType: "CUSTOMER_SUPPLIED", customerId: 7, customerName: "Customer One", customerPlantCode: "PLANT-01" });
  assert.equal(customerSupplied.receiptType, "CUSTOMER_SUPPLIED");
  assert.equal(customerSupplied.customerPlantCode, "PLANT-01");
  const openPurchase = validateGrn({ gateEntryId: 1, grnDate: "2026-09-12", receiptType: "OPEN_PURCHASE", supplierId: 7, items: [{ itemId: 1, receivedQuantity: 2, directRatePerQty: 100, taxPercent: 18 }] });
  assert.equal(openPurchase.purchaseOrderId, null);
  assert.equal(openPurchase.items[0].itemId, 1);
  assert.throws(() => validateGrnStockPosting({}), /stock posting date/i);
  assert.throws(() => validateGrnStockPosting({ stockPostingDate: "2026-09-11", receivedBy: "Stores", items: [{ grnItemId: 1, warehouseCode: "Main Stores" }] }), /bin location/i);
  const posting = validateGrnStockPosting({ stockPostingDate: "2026-09-11", receivedBy: "Stores", items: [{ grnItemId: 1, warehouseCode: "Main Stores", binLocation: "TEST-BIN", batchSerialNumber: "TEST-BATCH" }] });
  assert.equal(posting.items[0].warehouseCode, "Main Stores");

  connection = await db.getConnection();
  await connection.beginTransaction();
  const [items] = await connection.execute("SELECT item_id FROM item_master WHERE active_flag='Y' LIMIT 1");
  assert.ok(items[0], "An active item is needed to verify stock receipt balances.");
  const values = ["DEFAULT", null, "GRN-STOCK-TEST", items[0].item_id, "Test Warehouse", "TEST-BIN", "TEST-BATCH", 3, "GRN_STOCK_TEST", "GRN_STOCK_TEST"];
  let balance = await repository.upsertInventoryBalance(connection, values);
  assert.equal(balance.quantityOnHand, 3);
  values[7] = 2;
  balance = await repository.upsertInventoryBalance(connection, values);
  assert.equal(balance.quantityOnHand, 5);
  console.log("GRN stock receipt validation and inventory balance integration test passed.");
} finally {
  if (connection) { await connection.rollback(); connection.release(); }
  await db.end();
}
