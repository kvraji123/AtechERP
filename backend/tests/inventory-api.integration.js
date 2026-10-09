import assert from "node:assert/strict";
import { once } from "node:events";
import app from "../src/app.js";
import { db } from "../src/config/db.js";

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/api/v1/inventory`;
const headers = { "x-user-code": "SYSTEM", "x-user-role": "Administrator" };

try {
  for (const path of ["/dashboard", "/stock", "/transactions", "/quality-hold", "/reorder-alerts"]) {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    assert.equal(response.status, 200, `${path} should be available to an administrator`);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.ok(payload.data !== undefined);
  }
  console.log("Inventory API routes return live data successfully.");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await db.end();
}
