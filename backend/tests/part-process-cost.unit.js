import assert from "node:assert/strict";
import { calculateProcessCostInr } from "../src/modules/part/part-process-cost.js";

assert.equal(calculateProcessCostInr({
  sourceType:"INHOUSE",hourlyCostInr:1000,cycleTimeSeconds:100,
  clampingTimeSeconds:200,settingTimeHours:99,
}), 83.33, "In-house cost must use only cycle and clamping time converted to hours.");

assert.equal(calculateProcessCostInr({
  sourceType:"INHOUSE",hourlyCostInr:1000,cycleTimeSeconds:100,
  clampingTimeSeconds:300,
}), 111.11);

assert.equal(calculateProcessCostInr({
  sourceType:"OUTSOURCE",hourlyCostInr:1000,cycleTimeSeconds:100,
  clampingTimeSeconds:300,outsourceCostInr:725.5,
}), 725.5, "Outsource cost must come directly from the entered value.");

console.log("Part process cost calculation unit test passed.");
