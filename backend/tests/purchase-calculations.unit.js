import assert from "node:assert/strict";
import { calculateLineAmounts } from "../src/shared/constants/purchase.js";

const result = calculateLineAmounts({
  quantity: 10,
  unitPrice: 1200,
  discount: 500,
  taxPercent: 18,
  packing: 100,
  freight: 250,
  otherCharges: 50,
});

assert.equal(result.basicAmount, 12000);
assert.equal(result.discountAmount, 500);
assert.equal(result.taxAmount, 2070);
assert.equal(result.lineTotalAmount, 13970);
console.log("Purchase calculation unit test passed.");
