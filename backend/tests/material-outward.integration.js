import assert from "node:assert/strict";

import { db } from "../src/config/db.js";
import * as grnRepository from "../src/modules/grn/grn.repository.js";
import * as materialOutwardService from "../src/modules/material-outward/material-outward.service.js";

const originalGetConnection = db.getConnection.bind(db);
let connection;

try {
  connection = await originalGetConnection();
  await connection.beginTransaction();

  // Run each service transaction inside this outer transaction, then roll all
  // records back. This checks the real workflow without leaving test stock,
  // outward documents, or gate exits in the database.
  db.getConnection = async () => new Proxy(connection, {
    get(target, key) {
      if (["beginTransaction", "commit", "rollback", "release"].includes(key)) return async () => {};
      const value = target[key];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  const [[item]] = await connection.query("SELECT item_id FROM item_master WHERE active_flag='Y' LIMIT 1");
  const [[customer]] = await connection.query(`SELECT customer_id FROM customer_master
    WHERE active_flag='Y' AND COALESCE(save_status,'SUBMITTED')='SUBMITTED'
      AND party_type IN ('CUSTOMER','BOTH') LIMIT 1`);
  assert.ok(item && customer, "An active item and submitted customer are required for material outward testing.");

  const user = { tenantId: "DEFAULT", companyId: null, userCode: "MATERIAL_OUTWARD_TEST", permissions: ["GRN_POST", "PO_APPROVE"] };
  const plantId = `MOUTWARD-${Date.now()}`;
  const balance = await grnRepository.upsertInventoryBalance(connection, [
    user.tenantId, null, plantId, item.item_id,
    "Main Stores", "FG", "FG", "AVAILABLE", "MOUTWARD-BATCH", "",
    5, user.userCode, user.userCode,
  ]);
  const [[stock]] = await connection.execute(`SELECT inventory_stock_balance_id,quantity_on_hand
    FROM inventory_stock_balance
    WHERE tenant_id=? AND plant_id=? AND item_id=? AND warehouse_code='Main Stores'
      AND sub_inventory_code='FG' AND bin_location='FG' AND batch_serial_number='MOUTWARD-BATCH'
      AND stock_owner_type='COMPANY' FOR UPDATE`, [user.tenantId, plantId, item.item_id]);
  assert.ok(stock, "The test company stock balance must be created.");
  assert.equal(Number(balance.quantityOnHand), 5);

  const baseDocument = {
    outwardType: "FINISHED_GOODS",
    outwardDate: "2026-11-23",
    partyId: customer.customer_id,
    transportMode: "ROAD",
    transportReference: "MOUTWARD-TEST-REF",
    remarks: "Automated material outward test",
  };

  await assert.rejects(
    materialOutwardService.create({ ...baseDocument, items: [{ stockBalanceId: stock.inventory_stock_balance_id, quantity: 0 }] }, user),
    /positive quantity/i,
  );
  await assert.rejects(
    materialOutwardService.create({ ...baseDocument, items: [{ stockBalanceId: stock.inventory_stock_balance_id, quantity: 6 }] }, user),
    /exceeds available company stock/i,
  );

  const outward = await materialOutwardService.create({
    ...baseDocument,
    items: [{ stockBalanceId: stock.inventory_stock_balance_id, quantity: 2 }],
  }, user);
  assert.equal(outward.documentStatus, "PENDING_APPROVAL");
  assert.equal(outward.items.length, 1);

  const validGateExit = {
    materialOutwardDocumentId: outward.materialOutwardDocumentId,
    exitDateTime: "2026-11-23T10:30",
    vehicleNumber: "TN01TEST",
    driverName: "Test Driver",
    drivingLicenceNumber: "TEST-LICENSE",
    remarks: "Automated gate-exit test",
  };
  await assert.rejects(materialOutwardService.createGateExit(validGateExit, user), /only an approved/i);

  const approved = await materialOutwardService.approve(outward.materialOutwardDocumentId, { approvalRemarks: "Approved by automated test" }, user);
  assert.equal(approved.documentStatus, "APPROVED");
  await assert.rejects(
    materialOutwardService.createGateExit({ ...validGateExit, driverName: "" }, user),
    /vehicle number and driver name/i,
  );

  const gateExit = await materialOutwardService.createGateExit(validGateExit, user);
  assert.ok(gateExit.gateExitNumber);
  const [[dispatchedDocument]] = await connection.execute("SELECT document_status,gate_exit_reference FROM material_outward_documents WHERE material_outward_document_id=?", [outward.materialOutwardDocumentId]);
  const [[remainingStock]] = await connection.execute("SELECT quantity_on_hand FROM inventory_stock_balance WHERE inventory_stock_balance_id=?", [stock.inventory_stock_balance_id]);
  assert.equal(dispatchedDocument.document_status, "DISPATCHED");
  assert.equal(dispatchedDocument.gate_exit_reference, gateExit.gateExitNumber);
  assert.equal(Number(remainingStock.quantity_on_hand), 3);
  await assert.rejects(materialOutwardService.createGateExit(validGateExit, user), /already been recorded/i);

  console.log("Material outward and gate exit: positive and negative workflow checks passed (rolled back).");
} finally {
  db.getConnection = originalGetConnection;
  if (connection) {
    await connection.rollback();
    connection.release();
  }
  await db.end();
}
