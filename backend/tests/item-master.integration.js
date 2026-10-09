import assert from "node:assert/strict";
import app from "../src/app.js";
import { db } from "../src/config/db.js";

let server;
let createdItemId = 0;
let createdNonRawItemId = 0;
let createdConsumableItemId = 0;
let createdInstrumentItemId = 0;
let createdCategoryId = 0;
const createdPurchasedItemIds = [];

try {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1/items`;
  const headers = { "content-type": "application/json", "x-user-code": "ITEM_TEST" };

  const lookupPayload = await fetch(`${baseUrl}/lookups`).then((response) => response.json());
  assert.equal(lookupPayload.success, true);
  assert.ok(lookupPayload.data.groups.some((row) => row.groupCode === "PU" && row.groupName === "Purchased Item"));
  assert.ok(lookupPayload.data.types.length >= 41);
  assert.ok(lookupPayload.data.uoms.length >= 22);
  assert.ok(lookupPayload.data.materialGrades.length > 0);
  assert.ok(Array.isArray(lookupPayload.data.drawingCodes));
  assert.equal("customers" in lookupPayload.data, false);
  assert.equal(lookupPayload.data.references.some((row) =>
    ["MAKE_BUY","STOCK_CLASSIFICATION","VALUATION_METHOD"].includes(row.referenceGroup)), false);

  const purchasedItemGroup = lookupPayload.data.groups.find((row) => row.groupCode === "PU");
  const fasteners = lookupPayload.data.types.find((row) => row.itemGroupId === purchasedItemGroup.itemGroupId && row.typeName === "Fasteners");
  const plugs = lookupPayload.data.types.find((row) => row.itemGroupId === purchasedItemGroup.itemGroupId && row.typeName === "Plugs");
  const holders = lookupPayload.data.types.find((row) => row.typeName === "Holders");
  const fastenerFields = lookupPayload.data.specFields.filter((row) => row.itemTypeId === fasteners.itemTypeId);
  const plugFields = lookupPayload.data.specFields.filter((row) => row.itemTypeId === plugs.itemTypeId);
  const holderFields = lookupPayload.data.specFields.filter((row) => row.itemTypeId === holders.itemTypeId);
  assert.ok(fastenerFields.some((field) => field.fieldCode === "item_subtype"));
  assert.ok(fastenerFields.some((field) => field.fieldCode === "fastener_details"));
  assert.ok(plugFields.some((field) => field.fieldCode === "plug_gauge_details"));
  assert.equal(holderFields.filter((field) => field.fieldCode === "holder_length").length, 1);

  const rawMaterial = lookupPayload.data.groups.find((row) => row.groupCode === "RM");
  const categoryName = `Integration Category ${Date.now()}`;
  const categoryCode = `IT${String(Date.now()).slice(-8)}`;
  const categoryResponse = await fetch(`${baseUrl}/categories`, { method: "POST", headers,
    body: JSON.stringify({ itemGroupId: rawMaterial.itemGroupId, typeName: categoryName, itemCodePrefix: categoryCode }) });
  const categoryPayload = await categoryResponse.json();
  assert.equal(categoryResponse.status, 201, JSON.stringify(categoryPayload));
  createdCategoryId = Number(categoryPayload.data.itemTypeId);
  assert.equal(categoryPayload.data.itemGroupId, rawMaterial.itemGroupId);
  assert.equal(categoryPayload.data.typeName, categoryName);
  assert.equal(categoryPayload.data.itemCodePrefix, categoryCode);
  const duplicateCategoryResponse = await fetch(`${baseUrl}/categories`, { method: "POST", headers,
    body: JSON.stringify({ itemGroupId: rawMaterial.itemGroupId, typeName: categoryName, itemCodePrefix: categoryCode }) });
  assert.equal(duplicateCategoryResponse.status, 409);
  const refreshedLookups = await fetch(`${baseUrl}/lookups`).then((response) => response.json());
  assert.ok(refreshedLookups.data.types.some((row) => Number(row.itemTypeId) === createdCategoryId));
  const rod = lookupPayload.data.types.find((row) => row.itemGroupId === rawMaterial.itemGroupId && row.typeName === "Rod");
  const nos = lookupPayload.data.uoms.find((row) => row.uomCode === "NOS");
  const mm = lookupPayload.data.uoms.find((row) => row.uomCode === "MM");
  const aluminium = lookupPayload.data.materialGrades.find((row) =>
    row.gradeCode === "GENERAL" && row.materialName === "Aluminium"
  );
  const rodFields = lookupPayload.data.specFields.filter((row) => row.itemTypeId === rod.itemTypeId);
  const specifications = rodFields.map((field) => ({ specFieldId: field.specFieldId, fieldCode: field.fieldCode,
    value: field.fieldCode === "rod_type" ? "BLACK_ROD" : field.fieldCode === "shape" ? "ROUND" : field.fieldCode === "diameter" ? "25" :
      field.fieldCode === "length" ? "3000" : "", uomId: field.inputType === "NUMBER" ? mm.uomId : null }));

  const createResponse = await fetch(baseUrl, {
    method: "POST", headers,
    body: JSON.stringify({ itemGroupId: rawMaterial.itemGroupId, itemTypeId: rod.itemTypeId,
      itemDescription: "ROD - Integration Test Aluminium Rod", itemSpecification: "Temporary test item",
      uomId: nos.uomId, materialGradeId: aluminium.materialGradeId, inspectionRequired: "N",
      hsnCode: "7604", purchaseRate: 100.25, minimumStock: 5, specifications, suppliers: [] }),
  });
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createPayload));
  createdItemId = Number(createPayload.data.item_id);
  assert.ok(createdItemId > 0);
  assert.match(createPayload.data.item_code, /^RM-[A-Z0-9]+-\d{6}$/);
  assert.equal(createPayload.data.item_description, "RM-AL Round Rod Ø25 mm × 3000 mm");

  const instrumentGroup = lookupPayload.data.groups.find((row) => row.groupCode === "IG");
  const threadPlugGauge = lookupPayload.data.types.find((row) =>
    row.itemGroupId === instrumentGroup.itemGroupId && row.typeName === "Thread Plug Gauge"
  );
  const calibrationAgency = lookupPayload.data.suppliers[0];
  const instrumentResponse = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({
    itemGroupId: instrumentGroup.itemGroupId, itemTypeId: threadPlugGauge.itemTypeId,
    itemDescription: "TPG Calibration Source Test", uomId: nos.uomId, inspectionRequired: "N",
    makeName: "Gauge Maker", modelName: "TPG-14", calibrationRequired: "Y",
    calibrationFrequency: "YEARLY", calibrationAgencyId: calibrationAgency?.supplierId || null,
    measurementRange: '1/2" X 14 NPT', leastCount: "0.001 mm", accuracy: "±0.002 mm",
    suppliers: [], specifications: [],
  }) });
  const instrumentPayload = await instrumentResponse.json();
  assert.equal(instrumentResponse.status, 201, JSON.stringify(instrumentPayload));
  createdInstrumentItemId = Number(instrumentPayload.data.item_id);
  assert.equal(instrumentPayload.data.make_name, "Gauge Maker");
  assert.equal(instrumentPayload.data.model_name, "TPG-14");
  assert.equal(instrumentPayload.data.calibration_frequency, "YEARLY");
  assert.equal(Number(instrumentPayload.data.calibration_agency_id) || null, calibrationAgency?.supplierId || null);

  const fastenerSpecifications = fastenerFields.map((field) => ({
    specFieldId: field.specFieldId,
    fieldCode: field.fieldCode,
    value: field.fieldCode === "item_subtype" ? "BOLTS_AND_SCREWS"
      : field.fieldCode === "bolt_screw_type" ? "HEX_BOLTS"
        : field.fieldCode === "fastener_details" ? "M8 × 25 Hex Bolt" : "",
    uomId: null,
  }));
  const fastenerResponse = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({
    itemGroupId: purchasedItemGroup.itemGroupId, itemTypeId: fasteners.itemTypeId,
    itemDescription: "This value must be replaced", itemSpecification: null, uomId: nos.uomId,
    inspectionRequired: "N", specifications: fastenerSpecifications, suppliers: [],
  }) });
  const fastenerPayload = await fastenerResponse.json();
  assert.equal(fastenerResponse.status, 201, JSON.stringify(fastenerPayload));
  createdPurchasedItemIds.push(Number(fastenerPayload.data.item_id));
  assert.equal(fastenerPayload.data.item_description, "PU-M8 × 25 Hex Bolt");

  const plugSpecifications = plugFields.map((field) => ({
    specFieldId: field.specFieldId, fieldCode: field.fieldCode,
    value: field.fieldCode === "plug_gauge_details" ? 'TPG 1/2" X 14 NPT L1 S.L.' : "", uomId: null,
  }));
  const plugResponse = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify({
    itemGroupId: purchasedItemGroup.itemGroupId, itemTypeId: plugs.itemTypeId,
    itemDescription: "This value must be replaced", itemSpecification: null, uomId: nos.uomId,
    inspectionRequired: "N", specifications: plugSpecifications, suppliers: [],
  }) });
  const plugPayload = await plugResponse.json();
  assert.equal(plugResponse.status, 201, JSON.stringify(plugPayload));
  createdPurchasedItemIds.push(Number(plugPayload.data.item_id));
  assert.equal(plugPayload.data.item_description, 'PU-TPG 1/2" X 14 NPT L1 S.L.');

  const attachmentBody = new FormData();
  attachmentBody.append("file", new Blob(["item-master-test"], { type: "image/png" }), "item-master-test.png");
  attachmentBody.append("documentType", "IMAGE");
  attachmentBody.append("documentDescription", "Integration test image");
  const attachmentResponse = await fetch(`${baseUrl}/${createdItemId}/attachments`, {
    method: "POST", headers: { "x-user-code": "ITEM_TEST" }, body: attachmentBody,
  });
  const attachmentPayload = await attachmentResponse.json();
  assert.equal(attachmentResponse.status, 201, JSON.stringify(attachmentPayload));
  const attachmentId = Number(attachmentPayload.data.itemAttachmentId);
  assert.ok(attachmentId > 0);

  const listPayload = await fetch(`${baseUrl}?search=${encodeURIComponent(createPayload.data.item_code)}&pageSize=100`).then((response) => response.json());
  assert.equal(listPayload.data.some((row) => Number(row.itemId) === createdItemId), true);

  const statusResponse = await fetch(`${baseUrl}/${createdItemId}/status`, {
    method: "PATCH", headers, body: JSON.stringify({ itemStatus: "INACTIVE" }),
  });
  assert.equal(statusResponse.status, 200);
  const detailPayload = await fetch(`${baseUrl}/${createdItemId}`).then((response) => response.json());
  assert.equal(detailPayload.data.item_status, "INACTIVE");
  assert.equal("make_buy_classification" in detailPayload.data, false);
  assert.equal("stock_classification" in detailPayload.data, false);
  assert.equal("valuation_method" in detailPayload.data, false);
  assert.equal("customers" in detailPayload.data, false);
  assert.equal(detailPayload.data.attachments.length, 1);
  const deleteAttachmentResponse = await fetch(`${baseUrl}/${createdItemId}/attachments/${attachmentId}`, {
    method: "DELETE", headers: { "x-user-code": "ITEM_TEST" },
  });
  assert.equal(deleteAttachmentResponse.status, 200);

  const packagingGroup = lookupPayload.data.groups.find((row) => row.groupCode === "PC");
  const packagingType = lookupPayload.data.types.find((row) => row.itemGroupId === packagingGroup.itemGroupId);
  const packagingSpecifications = lookupPayload.data.specFields
    .filter((field) => field.itemTypeId === packagingType.itemTypeId)
    .map((field) => ({ specFieldId: field.specFieldId, fieldCode: field.fieldCode, value: field.fieldCode === "size" ? "300 x 200 x 150" : "", uomId: null }));
  const nonRawResponse = await fetch(baseUrl, { method:"POST",headers,body:JSON.stringify({
    itemGroupId:packagingGroup.itemGroupId,itemTypeId:packagingType.itemTypeId,
    itemDescription:"Non-raw material enforcement test",uomId:nos.uomId,
    materialGradeId:aluminium.materialGradeId,shelfLifeApplicable:"Y",shelfLifeDays:90,inspectionRequired:"N",specifications:packagingSpecifications,suppliers:[],
  }) });
  const nonRawPayload = await nonRawResponse.json();
  assert.equal(nonRawResponse.status,201,JSON.stringify(nonRawPayload));
  createdNonRawItemId = Number(nonRawPayload.data.item_id);
  assert.equal(nonRawPayload.data.material_id,null);
  assert.equal(nonRawPayload.data.material_grade_id,null);
  assert.equal(nonRawPayload.data.shelf_life_applicable,"N");
  assert.equal(nonRawPayload.data.shelf_life_days,null);

  const consumableGroup = lookupPayload.data.groups.find((row) => row.groupCode === "CM");
  const consumableType = lookupPayload.data.types.find((row) => row.itemGroupId === consumableGroup.itemGroupId);
  const consumableResponse = await fetch(baseUrl, { method:"POST",headers,body:JSON.stringify({
    itemGroupId:consumableGroup.itemGroupId,itemTypeId:consumableType.itemTypeId,
    itemDescription:"Consumable shelf-life radio test",uomId:nos.uomId,
    shelfLifeApplicable:"Y",shelfLifeDays:180,inspectionRequired:"N",suppliers:[],
  }) });
  const consumablePayload = await consumableResponse.json();
  assert.equal(consumableResponse.status,201,JSON.stringify(consumablePayload));
  createdConsumableItemId = Number(consumablePayload.data.item_id);
  assert.equal(consumablePayload.data.shelf_life_applicable,"Y");
  assert.equal(Number(consumablePayload.data.shelf_life_days),180);
  console.log("Item Master integration test passed.");
} finally {
  for (const itemId of createdPurchasedItemIds) await db.execute("DELETE FROM item_master WHERE item_id = ?", [itemId]);
  if (createdInstrumentItemId) await db.execute("DELETE FROM item_master WHERE item_id = ?", [createdInstrumentItemId]);
  if (createdConsumableItemId) await db.execute("DELETE FROM item_master WHERE item_id = ?", [createdConsumableItemId]);
  if (createdNonRawItemId) await db.execute("DELETE FROM item_master WHERE item_id = ?", [createdNonRawItemId]);
  if (createdItemId) await db.execute("DELETE FROM item_master WHERE item_id = ?", [createdItemId]);
  if (createdCategoryId) await db.execute("DELETE FROM item_type_master WHERE item_type_id = ?", [createdCategoryId]);
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
}
