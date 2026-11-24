import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import app from "../src/app.js";
import { db } from "../src/config/db.js";
import * as authRepository from "../src/modules/auth/auth.repository.js";

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/api/v1/inventory`;
let sessionId = null;

try {
  const unauthenticated = await fetch(`${baseUrl}/dashboard`);
  assert.equal(unauthenticated.status, 401, "inventory APIs must reject unauthenticated requests");

  const [users] = await db.execute(
    "SELECT user_id FROM app_users WHERE active_flag='Y' AND role_name='ADMINISTRATOR' LIMIT 1",
  );
  assert.ok(users[0], "An active administrator is needed to test protected inventory APIs.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  sessionId = await authRepository.createSession(
    db,
    users[0].user_id,
    tokenHash,
    new Date(Date.now() + 5 * 60 * 1000),
  );
  const headers = { cookie: `atech_session=${token}` };

  for (const path of ["/dashboard", "/stock", "/transactions", "/quality-hold", "/outsourcing-wip", "/rejection-inventory", "/customer-stock", "/return-to-customer", "/reorder-alerts"]) {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    assert.equal(response.status, 200, `${path} should be available to an administrator`);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.ok(payload.data !== undefined);
  }
  console.log("Inventory API routes return live data successfully.");
} finally {
  if (sessionId) await db.execute("DELETE FROM app_user_sessions WHERE app_user_session_id=?", [sessionId]);
  await new Promise((resolve) => server.close(resolve));
  await db.end();
}
