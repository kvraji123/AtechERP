import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const testDatabase = `atech_revision_test_${Date.now()}`;
const adminConnection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

let applicationDb;

try {
  const source = await fs.readFile(
    new URL(
      "../database/atech-enquiry-quotation-complete-test.sql",
      import.meta.url
    ),
    "utf8"
  );

  await adminConnection.query(
    source.replaceAll("`atech_erp`", `\`${testDatabase}\``)
  );

  process.env.DB_NAME = testDatabase;

  const service = await import(
    `../src/modules/enquiry/enquiry.service.js?test=${Date.now()}`
  );
  const dbModule = await import("../src/config/db.js");
  applicationDb = dbModule.db;

  const draft = await service.createEnquiry(
    {
      customerId: 990001,
      enquiryMode: "MAIL",
      orderType: "SALES",
      requiredDate: "2026-07-31",
      remarks: "Revision integration test",
      action: "DRAFT",
      parts: [],
    },
    "REVISION_TEST"
  );

  await service.updateEnquiry(
    draft.enquiry_id,
    {
      customerId: 990001,
      enquiryMode: "VISIT",
      orderType: "SALES",
      requiredDate: "2026-08-01",
      remarks: "Revision integration test updated",
      action: "DRAFT",
      parts: [],
    },
    "REVISION_TEST"
  );

  const revisions = await service.getEnquiryRevisions(
    draft.enquiry_id
  );

  const revisionNumbers = revisions.map(
    (revision) => revision.revisionNumber
  );

  if (
    draft.enquiry_status !== "IN_PROGRESS" ||
    revisions.length !== 2 ||
    revisionNumbers[0] !== "REV01" ||
    revisionNumbers[1] !== "REV00"
  ) {
    throw new Error(
      `Unexpected revision history: ${JSON.stringify(revisions)}`
    );
  }

  const enquiryWithoutRemovedFields =
    await service.createEnquiry(
      {
        customerId: 990001,
        enquiryMode: "MAIL",
        orderType: "SALES",
        requiredDate: "2026-08-15",
        remarks: "Removed part fields integration test",
        action: "SUBMIT",
        parts: [
          {
            partId: null,
            partNumber: "OPTIONAL-QTY-PART-001",
            itemCode: "OPTIONAL-QTY-ITEM",
            drawingNumber: "OPTIONAL-QTY-DWG-001",
            drawingRevisionNumber: "A",
            productDescription: "Optional quantity test part",
            materialAndGrade: "MS",
            alternativeMaterial: "EN8",
            annualQuantity: 1200,
            moq: 10,
            unitOfMeasurement: "Nos",
          },
        ],
      },
      "REVISION_TEST"
    );

  if (
    Number(
      enquiryWithoutRemovedFields.parts[0]?.annual_quantity || 0
    ) !== 1200 ||
    enquiryWithoutRemovedFields.parts[0]?.alternative_material !==
      "EN8" ||
    enquiryWithoutRemovedFields.enquiry_status !== "IN_PROGRESS"
  ) {
    throw new Error(
      "Enquiry submission without Required Qty and Part Required Date failed."
    );
  }

  const quotedEnquiry = await service.changeEnquiryStatus(
    990001,
    "ORDER_RECEIVED",
    "REVISION_TEST"
  );

  if (quotedEnquiry.enquiry_status !== "ORDER_RECEIVED") {
    throw new Error(
      "Quoted enquiry was not changed to Order Received."
    );
  }

  console.log(
    JSON.stringify(
      {
        enquiryId: draft.enquiry_id,
        revisionNumbers,
        latestAction: revisions[0].revisionAction,
        removedFieldsOptional: true,
        submittedStatus:
          enquiryWithoutRemovedFields.enquiry_status,
        orderReceivedStatus:
          quotedEnquiry.enquiry_status,
      },
      null,
      2
    )
  );
} finally {
  if (applicationDb) {
    await applicationDb.end();
  }

  await adminConnection.query(
    `DROP DATABASE IF EXISTS \`${testDatabase}\``
  );
  await adminConnection.end();
}
