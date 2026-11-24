import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the service calculations without opening a database connection.
const source = readFileSync(new URL('../src/modules/workout/workout.service.js', import.meta.url), 'utf8');
const calculationSource = source.slice(source.indexOf('const number ='), source.indexOf('function validate('));
const { calculate } = vm.runInNewContext(`${calculationSource}\n({ calculate });`, { AppError: Error });
const materialTypes = new Set(['MANUFACTURING', 'PURCHASE']);
const base = { isAssembledPart: true, currencyRate: 2 };
for (const materialType of materialTypes) {
  const line = { materialType, materialPricePerKg: 10, rmWeightKg: 3, materialCostInr: '125.50' };
  const result = calculate({ ...base, subparts: [line] }, new Set(), materialTypes);
  assert.equal(result.subparts[0].materialCostInr, 125.5);
  assert.equal(result.materialCost, 125.5);
  assert.equal(result.finalPartPrice, 125.5);
  assert.equal(result.materialCostForeign, 62.75);
  for (const value of [0, '0', '']) {
    assert.equal(calculate({ ...base, subparts: [{ ...line, materialCostInr: value }] }).materialCost, 0);
  }
  for (const value of [-1, 'invalid', Infinity]) {
    assert.throws(() => calculate({ ...base, subparts: [{ ...line, materialCostInr: value }] }), /material cost must be zero or positive/);
  }
  const { materialCostInr, ...legacyLine } = line;
  assert.equal(calculate({ ...base, subparts: [legacyLine] }).materialCost, 30);
}

const regularPart = {
  isAssembledPart: false,
  currencyRate: 2,
  weightKg: 10,
  materialRatePerKg: 10,
  additionalMaterialCostInr: 25,
};
assert.equal(calculate(regularPart).materialCost, 125);
assert.equal(calculate({ ...regularPart, actualMaterialCostInr: '80' }).materialCost, 80);
assert.equal(calculate({ ...regularPart, actualMaterialCostInr: '80' }).finalPartPrice, 80);
console.log('Workout material cost checks passed.');
