import assert from "node:assert/strict";

import app from "../src/app.js";
import { db } from "../src/config/db.js";

let server;

try {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    "x-user-code": "ATTACHMENT_TEST",
    "x-user-name": "Attachment Test",
    "x-user-role": "Administrator",
  };
  const request = async (path, options = {}, expectedStatus = 200) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    assert.equal(response.status, expectedStatus, `${options.method || "GET"} ${path}: ${JSON.stringify(payload)}`);
    return payload;
  };

  const customer = await request("/api/v1/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerType: "OEM",
      customerName: `Attachment Storage Test ${Date.now()}`,
      plantCode: "TEST",
      billingAddress: "Attachment test address",
      deliveryAddress: "Attachment test address",
      currencyCode: "INR",
    }),
  }, 201);
  const customerId = Number(customer.data.customerId);
  assert.ok(customerId > 0);

  const uploadBody = new FormData();
  uploadBody.append("file", new Blob(["attachment integration test"], { type: "application/pdf" }), "attachment.pdf");
  uploadBody.append("attachmentType", "NDA");
  uploadBody.append("attachmentName", "Initial file");
  const uploaded = await request(`/api/v1/attachments/CUSTOMER/${customerId}`, {
    method: "POST",
    body: uploadBody,
  }, 201);
  assert.equal(uploaded.data.fileName, "attachment.pdf");
  assert.ok(uploaded.data.fileUrl.startsWith("/uploads/"));

  const listed = await request(`/api/v1/attachments/CUSTOMER/${customerId}`);
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].attachmentName, "Initial file");

  const attachmentId = Number(listed.data[0].attachmentId);
  const updated = await request(`/api/v1/attachments/CUSTOMER/${customerId}/${attachmentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ attachmentType: "AGREEMENT", attachmentName: "Updated file" }),
  });
  assert.equal(updated.data.attachmentType, "AGREEMENT");
  assert.equal(updated.data.attachmentName, "Updated file");

  const storedFile = await fetch(`${baseUrl}${updated.data.fileUrl}`);
  assert.equal(storedFile.status, 200);
  assert.equal(await storedFile.text(), "attachment integration test");

  await request(`/api/v1/attachments/CUSTOMER/${customerId}/${attachmentId}`, { method: "DELETE" });
  const empty = await request(`/api/v1/attachments/CUSTOMER/${customerId}`);
  assert.equal(empty.data.length, 0);

  console.log(JSON.stringify({ customerId, attachmentId, retrieval: "verified" }, null, 2));
} finally {
  await new Promise((resolve) => server?.close(resolve));
  await db.end();
}
