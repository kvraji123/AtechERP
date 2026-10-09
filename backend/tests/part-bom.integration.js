import assert from "node:assert/strict";
import app from "../src/app.js";
import { db } from "../src/config/db.js";

let server;
let createdPartId = 0;

try {
  const [[customer]] = await db.query(
    "SELECT customer_id AS customerId FROM customer_master WHERE active_flag='Y' ORDER BY customer_id LIMIT 1"
  );
  const [[componentPart]] = await db.query(
    "SELECT part_id AS componentId FROM part_master WHERE active_flag='Y' ORDER BY part_id LIMIT 1"
  );
  const [[componentItem]] = await db.query(
    "SELECT item_id AS componentId, item_code AS componentCode FROM item_master WHERE active_flag='Y' ORDER BY item_id LIMIT 1"
  );
  assert.ok(customer && componentPart && componentItem, "Customer, Part and Item test masters are required.");

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1/parts`;
  const headers = { "content-type": "application/json", "x-user-code": "BOM_TEST" };
  const partNumber = `BOM-TEST-${Date.now()}`;
  const basePayload = {
    customerId: Number(customer.customerId),
    partCategory: "ASSEMBLY",
    partName: "BOM Integration Test Assembly",
    partNumber,
    drawingCodeMode: "AUTO_GENERATED",
    bomComponents: [
      { componentType: "PART", componentId: Number(componentPart.componentId), quantity: 2 },
      { componentType: "ITEM", componentId: Number(componentItem.componentId), quantity: 3.5 },
    ],
  };

  const createResponse = await fetch(baseUrl, {
    method: "POST", headers, body: JSON.stringify(basePayload),
  });
  const createPayload = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createPayload));
  createdPartId = Number(createPayload.data.part_id);
  assert.ok(createdPartId > 0);
  assert.equal(createPayload.data.bomComponents.length, 2);

  const hierarchyResponse = await fetch(`${baseUrl}/${createdPartId}/bom-hierarchy`);
  const hierarchyPayload = await hierarchyResponse.json();
  assert.equal(hierarchyResponse.status, 200, JSON.stringify(hierarchyPayload));
  assert.equal(hierarchyPayload.data.componentCode, partNumber);
  assert.equal(hierarchyPayload.data.children.length, 2);

  const searchResponse = await fetch(
    `${baseUrl}/bom-options/search?search=${encodeURIComponent(componentItem.componentCode)}&excludePartId=${createdPartId}`
  );
  const searchPayload = await searchResponse.json();
  assert.equal(searchResponse.status, 200, JSON.stringify(searchPayload));
  assert.equal(searchPayload.data.some((row) =>
    row.componentType === "ITEM" && Number(row.componentId) === Number(componentItem.componentId)
  ), true);

  const updateResponse = await fetch(`${baseUrl}/${createdPartId}`, {
    method: "PUT", headers,
    body: JSON.stringify({
      ...basePayload,
      bomComponents: [{ componentType: "ITEM", componentId: Number(componentItem.componentId), quantity: 7 }],
    }),
  });
  const updatePayload = await updateResponse.json();
  assert.equal(updateResponse.status, 200, JSON.stringify(updatePayload));
  assert.equal(updatePayload.data.bomComponents.length, 1);
  assert.equal(Number(updatePayload.data.bomComponents[0].quantity), 7);

  console.log("Part Bill of Material integration test passed.");
} finally {
  if (createdPartId) await db.execute("DELETE FROM part_master WHERE part_id = ?", [createdPartId]);
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
}
