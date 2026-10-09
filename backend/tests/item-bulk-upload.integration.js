import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import app from "../src/app.js";
import { db } from "../src/config/db.js";

let server;
let createdItemId = 0;

function createWorkbook(rows, inspectionRows = []) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Upload Reference *", "Item Group *", "Item Category *", "Item Type / Variant", "Item Description / Name *", "UOM *", "Inspection Required?", "Size"],
    ...rows,
  ]);
  const inspectionSheet = XLSX.utils.aoa_to_sheet([
    ["Upload Reference *", "Balloon Number", "Characteristic *", "Specified Dimension", "Tolerance Grade", "Tolerance −", "Tolerance +", "Drawing Grid", "Instrument / Gauge", "Sample Size", "Inspection Frequency"],
    ...inspectionRows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Item Master");
  XLSX.utils.book_append_sheet(workbook, inspectionSheet, "Incoming Inspection Plan");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

async function uploadWorkbook(baseUrl, workbook) {
  const form = new FormData();
  form.append("file", new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), "Item_Master_Client_Data_Template.xlsx");
  const response = await fetch(`${baseUrl}/bulk-upload`, {
    method: "POST",
    headers: { "x-user-code": "ITEM_BULK_TEST" },
    body: form,
  });
  return { response, payload: await response.json() };
}

try {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/items`;
  const lookupPayload = await fetch(`${baseUrl}/lookups`).then((response) => response.json());
  const packingGroup = lookupPayload.data.groups.find((entry) => entry.groupCode === "PC");
  const packingType = lookupPayload.data.types.find((entry) => Number(entry.itemGroupId) === Number(packingGroup.itemGroupId));
  const nos = lookupPayload.data.uoms.find((entry) => entry.uomCode === "NOS");
  const characteristic = lookupPayload.data.characteristics[0];
  const instrument = lookupPayload.data.instruments[0];
  const sampleSize = lookupPayload.data.sampleSizes[0];
  const frequency = lookupPayload.data.frequencies[0];
  assert.ok(packingGroup && packingType && nos && characteristic && instrument && sampleSize && frequency,
    "Item and inspection lookups are required for the bulk-upload test.");
  assert.ok(lookupPayload.data.specFields.some((entry) => Number(entry.itemTypeId) === Number(packingType.itemTypeId) && entry.fieldCode === "size"));

  const size = `Bulk Upload Test ${Date.now()}`;
  const uploadReference = `ITEM-${Date.now()}`;
  const row = [uploadReference, `${packingGroup.groupCode} - ${packingGroup.groupName}`, packingType.typeName, "", "", nos.uomCode, "Yes", size];
  const inspectionRow = [uploadReference, "B-1", characteristic.characteristicName, 10, "", 0.1, 0.1, "A-1",
    instrument.instrumentName, sampleSize.value, frequency.value];
  const firstUpload = await uploadWorkbook(baseUrl, createWorkbook([row], [inspectionRow]));
  assert.equal(firstUpload.response.status, 201, JSON.stringify(firstUpload.payload));
  assert.equal(firstUpload.payload.data.importedCount, 1, JSON.stringify(firstUpload.payload));
  assert.match(firstUpload.payload.data.items[0].itemCode, /^PC-[A-Z0-9]+-\d{6}$/);
  createdItemId = Number(firstUpload.payload.data.items[0].itemId);
  const [inspectionPlans] = await db.execute(`SELECT characteristic_master_id AS characteristicMasterId,
    sample_size AS sampleSize,inspection_frequency AS inspectionFrequency
    FROM item_incoming_inspection_characteristic WHERE item_id=?`, [createdItemId]);
  assert.equal(inspectionPlans.length, 1);
  assert.equal(Number(inspectionPlans[0].characteristicMasterId), Number(characteristic.characteristicMasterId));
  assert.equal(inspectionPlans[0].sampleSize, sampleSize.value);
  assert.equal(inspectionPlans[0].inspectionFrequency, frequency.value);

  const [[counterBefore]] = await db.execute("SELECT current_number AS currentNumber FROM item_type_master WHERE item_type_id=?", [packingType.itemTypeId]);
  const duplicateRow = [...row];
  duplicateRow[0] = `${uploadReference}-COPY`;
  const duplicateInspectionRow = [...inspectionRow];
  duplicateInspectionRow[0] = duplicateRow[0];
  const duplicateUpload = await uploadWorkbook(baseUrl, createWorkbook([row, duplicateRow], [inspectionRow, duplicateInspectionRow]));
  assert.equal(duplicateUpload.response.status, 200, JSON.stringify(duplicateUpload.payload));
  assert.equal(duplicateUpload.payload.data.importedCount, 0);
  assert.equal(duplicateUpload.payload.data.errors.length, 2);
  assert.match(duplicateUpload.payload.data.errors[0].message, /Duplicate item data/);
  const [[counterAfter]] = await db.execute("SELECT current_number AS currentNumber FROM item_type_master WHERE item_type_id=?", [packingType.itemTypeId]);
  assert.equal(counterAfter.currentNumber, counterBefore.currentNumber, "Invalid rows must not consume Item Code numbers.");
  console.log("Item bulk-upload integration test passed.");
} finally {
  if (createdItemId) {
    await db.execute("DELETE FROM item_incoming_inspection_characteristic WHERE item_id=?", [createdItemId]);
    await db.execute("DELETE FROM item_master WHERE item_id=?", [createdItemId]);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
}
