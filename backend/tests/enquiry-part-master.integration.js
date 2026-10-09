import mysql from "mysql2/promise";
import app from "../src/app.js";
import { db as applicationDb } from "../src/config/db.js";
import { env } from "../src/config/env.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const marker = Date.now();
const customerName = `Drawing Lookup Test ${marker}`;
const existingDrawing = `DWG-EXIST-${marker}`;
const newDrawing = `DWG-NEW-${marker}`;
let customerId = 0;
let masterCustomerId = 0;

const db = await mysql.createConnection(env.db);

async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-user-code": "SYSTEM",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const enquiryBody = (part, action) => ({
  action,
  customerId,
  enquiryMode: "MAIL",
  orderType: "SALES",
  remarks: "Part Master drawing integration test",
  parts: [{
    partNumber: part.partNumber,
    itemCode: part.itemCode || "",
    drawingNumber: part.drawingNumber,
    drawingRevisionNumber: part.drawingRevisionNumber,
    productDescription: part.productDescription,
    materialAndGrade: part.materialAndGrade,
    alternativeMaterial: part.alternativeMaterial || null,
    requiredQuantity: 10,
    annualQuantity: 120,
    unitOfMeasurement: "Nos",
    partId: part.partId || null,
    createPartMaster: Boolean(part.createPartMaster),
  }],
});

try {
  const customer = await request("/api/v1/customers", "POST", {
    partyType: "CUSTOMER",
    customerType: "OEM",
    customerName,
    customerShortName: "DRAW TEST",
    plantCode: "TEST",
    emailAddress: "drawing.lookup@example.test",
  }, 201);
  customerId = Number(customer.data.customerId);
  masterCustomerId = customerId;

  const master = await request("/api/v1/parts", "POST", {
    customerId,
    partCategory: "MACHINING",
    partName: "Existing Master Product",
    partNumber: `PRT-EXIST-${marker}`,
    partNumberMode: "MANUAL",
    drawingNumber: existingDrawing,
    drawingRevisionNumber: "R2",
    drawingCodeMode: "MANUAL",
    drawingCode: `ITEM-${marker}`,
    materialSpecification: "EN24",
    unitOfMeasurement: "Nos",
  }, 201);
  const existingPartId = Number(master.data.part_id);

  const enquiryCustomer = await request("/api/v1/customers", "POST", {
    partyType: "CUSTOMER",
    customerType: "OEM",
    customerName: `${customerName} Enquiry Customer`,
    customerShortName: "DRAW ENQ",
    plantCode: "TEST2",
    emailAddress: "drawing.enquiry@example.test",
  }, 201);
  customerId = Number(enquiryCustomer.data.customerId);

  const existingEnquiry = await request(
    "/api/v1/marketing/enquiries",
    "POST",
    enquiryBody({
      partId: existingPartId,
      partNumber: `PRT-EXIST-${marker}`,
      drawingNumber: existingDrawing,
      drawingRevisionNumber: "BAD",
      productDescription: "Tampered browser value",
      materialAndGrade: "BAD",
      alternativeMaterial: "ALTERNATIVE-EN8",
    }, "SUBMIT"),
    201
  );
  const existingLine = existingEnquiry.data.parts[0];
  assert(existingEnquiry.data.current_stage === "FEASIBILITY", "Submitted enquiry must move to Feasibility.");
  assert(existingEnquiry.data.enquiry_status === "IN_PROGRESS", "Submitted enquiry must remain In Progress.");
  assert(Number(existingLine.part_id) === existingPartId, "Existing Part ID was not stored.");
  assert(existingLine.drawing_revision_number === "R2", "Existing revision was not controlled by Part Master.");
  assert(existingLine.product_description === "Existing Master Product", "Existing product was not controlled by Part Master.");
  assert(existingLine.material_and_grade === "EN24", "Existing material was not controlled by Part Master.");
  assert(existingLine.alternative_material === "ALTERNATIVE-EN8", "Alternative material was not stored.");

  const draft = await request(
    "/api/v1/marketing/enquiries",
    "POST",
    enquiryBody({
      partNumber: `PRT-NEW-${marker}`,
      drawingNumber: newDrawing,
      drawingRevisionNumber: "A1",
      productDescription: "New Drawing Product",
      materialAndGrade: "SS304",
      alternativeMaterial: "ALTERNATIVE-SS304",
    }, "DRAFT"),
    201
  );
  const draftId = Number(draft.data.enquiry_id);
  assert(draft.data.current_stage === "ENQUIRY", "Draft enquiry must remain in the Enquiry stage.");
  assert(draft.data.enquiry_status === "IN_PROGRESS", "Draft enquiry must start In Progress.");
  const [[beforeSubmit]] = await db.execute(
    "SELECT COUNT(*) AS total FROM part_master WHERE customer_id=? AND drawing_number=?",
    [customerId, newDrawing]
  );
  assert(Number(beforeSubmit.total) === 0, "Draft save must not create Part Master.");

  await request(
    `/api/v1/marketing/enquiries/${draftId}`,
    "PUT",
    enquiryBody({
      partNumber: `PRT-NEW-${marker}`,
      drawingNumber: newDrawing,
      drawingRevisionNumber: "A1",
      productDescription: "New Drawing Product",
      materialAndGrade: "SS304",
      alternativeMaterial: "ALTERNATIVE-SS304",
      createPartMaster: true,
    }, "SUBMIT"),
    409
  );

  const submitted = await request(
    `/api/v1/marketing/enquiries/${draftId}`,
    "PUT",
    enquiryBody({
      partNumber: `PRT-NEW-${marker}`,
      drawingNumber: newDrawing,
      drawingRevisionNumber: "A1",
      productDescription: "New Drawing Product",
      materialAndGrade: "SS304",
      alternativeMaterial: "ALTERNATIVE-SS304",
    }, "SUBMIT")
  );
  const newLine = submitted.data.parts[0];
  assert(submitted.data.current_stage === "FEASIBILITY", "Submitted draft must move to Feasibility.");
  assert(submitted.data.enquiry_status === "IN_PROGRESS", "Submitted draft must remain In Progress.");
  assert(newLine.part_id === null, "Enquiry submission must not create or link a new Part Master.");
  assert(newLine.alternative_material === "ALTERNATIVE-SS304", "New enquiry alternative material was not stored.");

  const [[partMasterCount]] = await db.execute(
    `SELECT COUNT(*) AS total
       FROM part_master WHERE customer_id=? AND drawing_number=?`,
    [customerId, newDrawing]
  );
  assert(Number(partMasterCount.total) === 0, "Enquiry submission must not add a Part Master record.");

  console.log(JSON.stringify({
    existingDrawing: {
      partId: existingPartId,
      revision: existingLine.drawing_revision_number,
      product: existingLine.product_description,
      material: existingLine.material_and_grade,
    },
    newDrawing: {
      draftCreatedPartMaster: false,
      submittedPartId: newLine.part_id,
      partMasterCreated: false,
    },
  }, null, 2));
} finally {
  if (customerId) {
    await db.execute("DELETE FROM marketing_enquiries WHERE customer_id=?", [customerId]);
    await db.execute("DELETE FROM part_master WHERE customer_id=?", [customerId]);
    await db.execute("DELETE FROM customer_master WHERE customer_id=?", [customerId]);
  }
  if (masterCustomerId) {
    await db.execute("DELETE FROM part_master WHERE customer_id=?", [masterCustomerId]);
    await db.execute("DELETE FROM customer_master WHERE customer_id=?", [masterCustomerId]);
  }
  await db.end();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await applicationDb.end();
}
