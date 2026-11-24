import assert from "node:assert/strict";
import {
  automaticSampleSequences,
  dueCharacteristicEvents,
  parsePieceFrequency,
  validateCharacteristicSampling,
} from "../src/modules/in-process-inspection/inspection-frequency.js";

const diameter = { inspectionFrequency: "100_PERCENT", sampleSize: "100_PERCENT" };
const surface = { inspectionFrequency: "5", sampleSize: "1" };

assert.equal(parsePieceFrequency("100_PERCENT").kind, "EVERY_PIECE");
assert.equal(validateCharacteristicSampling(diameter).requiredSampleSize, 1);
assert.equal(validateCharacteristicSampling(surface).requiredSampleSize, 1);

assert.equal(dueCharacteristicEvents([diameter, surface], 1).length, 1,
  "The first piece must have only the 100% characteristic due.");
const fifth = dueCharacteristicEvents([diameter, surface], 5);
assert.equal(fifth.length, 2, "The fifth piece must include 100% and 1-of-5 checks.");
assert.deepEqual(fifth[1].window, { start: 1, end: 5 });
assert.deepEqual(automaticSampleSequences({ start: 1, end: 5 }, 1), [5],
  "A one-piece sample must remain due at the frequency trigger.");
assert.deepEqual(automaticSampleSequences({ start: 1, end: 10 }, 2), [1, 5],
  "A 2-of-10 sample must select the first and fifth pieces in its window.");
assert.deepEqual(automaticSampleSequences({ start: 11, end: 20 }, 2), [11, 15],
  "The next 2-of-10 window must repeat the same sampling positions.");
assert.equal(dueCharacteristicEvents([diameter, surface], 6).length, 1,
  "The sixth piece must continue 100% without repeating 1-of-5.");
assert.throws(
  () => validateCharacteristicSampling({ inspectionFrequency: "100_PERCENT", sampleSize: "5" }),
  /100% inspection frequency/
);
assert.throws(
  () => validateCharacteristicSampling({ inspectionFrequency: "5", sampleSize: "100_PERCENT" }),
  /Sample size 100%/
);
assert.throws(
  () => validateCharacteristicSampling({ inspectionFrequency: "SHIFT", sampleSize: "1" }),
  /cannot be used for piece-count/
);

console.log("In-process inspection frequency unit test passed.");
