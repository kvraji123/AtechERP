import assert from "node:assert/strict";
import app from "../src/app.js";
import { db } from "../src/config/db.js";
import * as grnRepository from "../src/modules/grn/grn.repository.js";

let server;
let itemId = 0;

try {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/items`;
  const headers = { "content-type": "application/json", "x-user-code": "ITEM_INSPECTION_TEST" };
  const lookups = await fetch(`${baseUrl}/lookups`).then((response) => response.json());
  const packagingGroup = lookups.data.groups.find((row) => row.groupCode === "PC");
  const packagingType = lookups.data.types.find((row) => row.itemGroupId === packagingGroup.itemGroupId);
  const uom = lookups.data.uoms.find((row) => row.uomCode === "NOS");
  const characteristic = lookups.data.characteristics[0];
  const instrument = lookups.data.instruments[0];
  const sampleSize = lookups.data.sampleSizes[0];
  const frequency = lookups.data.frequencies[0];
  const sizeField = lookups.data.specFields.find((row) => Number(row.itemTypeId) === Number(packagingType.itemTypeId) && row.fieldCode === "size");
  assert.ok(characteristic && instrument && sampleSize && frequency && sizeField, "Inspection masters and required Item Category fields must be available.");

  const created = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({
    itemGroupId: packagingGroup.itemGroupId, itemTypeId: packagingType.itemTypeId,
    itemDescription: "Incoming inspection integration test item", uomId: uom.uomId,
    specifications: [{ specFieldId: sizeField.specFieldId, fieldCode: sizeField.fieldCode, value: "Test size", uomId: null }],
    inspectionRequired: "Y", suppliers: [], inspectionPlanCharacteristics: [{
      balloonNumber: "B-1", characteristicMasterId: characteristic.characteristicMasterId,
      specifiedDimension: 10, toleranceGradeText: null, toleranceMinus: 0.1, tolerancePlus: 0.1,
      drawingGrid: "A-1", instrumentMasterId: instrument.instrumentMasterId,
      sampleSize: sampleSize.value, inspectionFrequency: frequency.value,
    }, {
      balloonNumber: "B-2", characteristicMasterId: null,
      characteristicText: "Packaging surface condition",
      specifiedDimension: null, toleranceGradeText: null, toleranceMinus: null, tolerancePlus: null,
      drawingGrid: null, instrumentMasterId: null,
      sampleSize: null, inspectionFrequency: null,
    }],
  }) });
  const payload = await created.json();
  assert.equal(created.status, 201, JSON.stringify(payload));
  itemId = Number(payload.data.item_id);
  assert.equal(payload.data.inspectionPlanCharacteristics.length, 2);
  assert.equal(Number(payload.data.inspectionPlanCharacteristics[0].lsl), 9.9);
  assert.equal(Number(payload.data.inspectionPlanCharacteristics[0].usl), 10.1);

  const loaded = await fetch(`${baseUrl}/${itemId}`).then((response) => response.json());
  assert.equal(loaded.data.inspectionPlanCharacteristics.length, 2);
  assert.equal(Number(loaded.data.inspectionPlanCharacteristics[0].characteristicMasterId), Number(characteristic.characteristicMasterId));
  assert.equal(loaded.data.inspectionPlanCharacteristics[0].sampleSize, sampleSize.value);
  assert.equal(loaded.data.inspectionPlanCharacteristics[0].inspectionFrequency, frequency.value);
  assert.equal(loaded.data.inspectionPlanCharacteristics[1].characteristicMasterId, null);
  assert.equal(loaded.data.inspectionPlanCharacteristics[1].characteristicText, "Packaging surface condition");
  const grnInspectionPlan = await grnRepository.getItemInspectionPlan(db, itemId);
  assert.equal(grnInspectionPlan[1].characteristic_name, "Packaging surface condition");
  assert.equal(grnInspectionPlan[1].characteristic_type, "FREE_TEXT");
  console.log("Item incoming inspection plan integration test passed.");
} finally {
  if (itemId) await db.execute("DELETE FROM item_master WHERE item_id=?", [itemId]);
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
}
