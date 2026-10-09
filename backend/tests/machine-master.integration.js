import assert from "node:assert/strict";
import app from "../src/app.js";
import { db } from "../src/config/db.js";

let server;
let createdItemId = 0;
let createdMachineMasterId = 0;
let testedMachineTypeId = 0;
let originalHourlyCostInr = 0;

try {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  const apiBase = `http://127.0.0.1:${port}/api/v1`;
  const headers = { "content-type": "application/json", "x-user-code": "MACHINE_TEST" };

  const itemLookups = await fetch(`${apiBase}/items/lookups`).then((response) => response.json());
  const capitalGroup = itemLookups.data.groups.find((row) => row.groupCode === "CA");
  const machineItemType = itemLookups.data.types.find((row) =>
    row.itemGroupId === capitalGroup.itemGroupId && row.typeName === "Machines & Equipment");
  const nos = itemLookups.data.uoms.find((row) => row.uomCode === "NOS");
  const vmc = itemLookups.data.machineTypes.find((row) => row.machineTypeCode === "VMC");
  assert.ok(capitalGroup && machineItemType && nos && vmc);
  testedMachineTypeId = Number(vmc.machineTypeId);
  const [[originalRate]] = await db.execute("SELECT hourly_cost_inr AS hourlyCostInr FROM machine_type_master WHERE machine_type_id=?", [testedMachineTypeId]);
  originalHourlyCostInr = Number(originalRate?.hourlyCostInr || 0);

  const suffix = Date.now();
  const itemResponse = await fetch(`${apiBase}/items`, { method: "POST", headers,
    body: JSON.stringify({ itemGroupId:capitalGroup.itemGroupId,itemTypeId:machineItemType.itemTypeId,
      itemDescription:`MAC - Machine Test ${suffix}`,itemSpecification:"Integration test machine",
      uomId:nos.uomId,inspectionRequired:"N",makeName:"ATECH TEST",modelName:`MODEL-${suffix}`,
      machineTypeId:vmc.machineTypeId,machineCapacity:"X-800 mm / Y-500 mm / Z-500 mm",
      assetCategory:"MACHINE",suppliers:[],customers:[],specifications:[] }) });
  const itemPayload = await itemResponse.json();
  assert.equal(itemResponse.status, 201, JSON.stringify(itemPayload));
  createdItemId = Number(itemPayload.data.item_id);

  const machineLookups = await fetch(`${apiBase}/machines/lookups`).then((response) => response.json());
  assert.equal(machineLookups.data.items.some((row) => Number(row.itemId) === createdItemId), true);

  const machineResponse = await fetch(`${apiBase}/machines`, { method:"POST",headers,
    body:JSON.stringify({ itemId:createdItemId,numberOfMachines:2,machineStatus:"ACTIVE",hourlyCostInr:750,
      otherSpecification:"Coolant tank provided",units:[
        { machineCode:`TEST-V-${suffix}-1`,serialNumber:"SERIAL-1",unitStatus:"ACTIVE" },
        { machineCode:`TEST-V-${suffix}-2`,serialNumber:"SERIAL-2",unitStatus:"UNDER_MAINTENANCE" },
      ] }) });
  const machinePayload = await machineResponse.json();
  assert.equal(machineResponse.status, 201, JSON.stringify(machinePayload));
  createdMachineMasterId = Number(machinePayload.data.machineMasterId);
  assert.equal(machinePayload.data.numberOfMachines, 2);
  assert.equal(machinePayload.data.machineTypeCode, "VMC");
  assert.equal(Number(machinePayload.data.hourlyCostInr), 750);

  const updateResponse = await fetch(`${apiBase}/machines/${createdMachineMasterId}`, { method:"PUT",headers,
    body:JSON.stringify({ itemId:createdItemId,numberOfMachines:3,machineStatus:"ACTIVE",hourlyCostInr:1000,units:[
      { machineUnitId:machinePayload.data.units[0].machineUnitId,machineId:`TEST-V-${suffix}-1`,unitStatus:"ACTIVE" },
      { machineUnitId:machinePayload.data.units[1].machineUnitId,machineCode:`TEST-V-${suffix}-2`,unitStatus:"ACTIVE" },
      { machineCode:`TEST-V-${suffix}-3`,unitStatus:"IDLE" },
    ] }) });
  const updatePayload = await updateResponse.json();
  assert.equal(updateResponse.status, 200, JSON.stringify(updatePayload));
  assert.equal(updatePayload.data.numberOfMachines, 3);
  assert.equal(Number(updatePayload.data.hourlyCostInr), 1000);

  const listPayload = await fetch(`${apiBase}/machines?search=${suffix}&pageSize=100`).then((response) => response.json());
  assert.equal(listPayload.data.some((row) => Number(row.machineMasterId) === createdMachineMasterId && Number(row.numberOfMachines) === 3), true);

  const deleteResponse = await fetch(`${apiBase}/machines/${createdMachineMasterId}`, { method:"DELETE",headers });
  assert.equal(deleteResponse.status, 200);
  createdMachineMasterId = 0;
  console.log("Machine Master integration test passed.");
} finally {
  if (createdMachineMasterId) await db.execute("DELETE FROM machine_master WHERE machine_master_id=?", [createdMachineMasterId]);
  if (createdItemId) await db.execute("DELETE FROM item_master WHERE item_id=?", [createdItemId]);
  if (testedMachineTypeId) await db.execute("UPDATE machine_type_master SET hourly_cost_inr=? WHERE machine_type_id=?", [originalHourlyCostInr,testedMachineTypeId]);
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
}
