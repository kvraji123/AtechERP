import app from "../src/app.js";
import { db as applicationDb } from "../src/config/db.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-user-code": "SYSTEM",
      "x-user-name": "System Administrator",
      "x-user-role": "Administrator",
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `${options.method || "GET"} ${path}: expected ${expectedStatus}, received ${response.status}\n${JSON.stringify(payload)}`
    );
  }
  return payload;
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const today = new Date().toISOString().slice(0, 10);
let summary;

try {
  const customerResponse = await request("/api/v1/customers", {
    method: "POST",
    body: JSON.stringify({
      customerType: "OEM",
      customerName: `Quotation Workflow Test Customer ${Date.now()}`,
      customerShortName: "QWF TEST",
      plantCode: "TEST",
      billingAddress: "API Integration Test Address, Chennai",
      deliveryAddress: "API Integration Test Address, Chennai",
      contactPersonName: "Workflow Test Contact",
      mobileNumber: "9000000000",
      emailAddress: "quotation.workflow@example.test",
      currencyCode: "INR",
    }),
  }, 201);
  const customerId = Number(customerResponse.data.customerId);

  const enquiryResponse = await request("/api/v1/marketing/enquiries", {
    method: "POST",
    body: JSON.stringify({
      action: "SUBMIT",
      customerId,
      enquiryMode: "MAIL",
      orderType: "SALES",
      requiredDate: today,
      poReference: `QWF-TEST-${Date.now()}`,
      remarks: "Five-item quotation workflow API integration test",
      parts: Array.from({ length: 5 }, (_, index) => ({
        partNumber: `QWF-PART-${index + 1}`,
        itemCode: `QWF-ITEM-${index + 1}`,
        drawingNumber: `QWF-DWG-${String(index + 1).padStart(2, "0")}`,
        drawingRevisionNumber: "A",
        productDescription: `Quotation workflow test part ${index + 1}`,
        materialAndGrade: "EN8",
        requiredQuantity: 100 * (index + 1),
        annualQuantity: 1200 * (index + 1),
        moq: 25,
        unitOfMeasurement: "NOS",
        requiredDate: today,
      })),
    }),
  }, 201);

  const enquiryId = Number(enquiryResponse.data.enquiry_id);
  const docNo = enquiryResponse.data.doc_no;
  const parts = enquiryResponse.data.parts;
  assert(parts.length === 5, "The test enquiry must contain five parts.");

  const feasibleLines = new Set([1, 3, 5]);
  const feasibilityPayload = (lineNumber) => {
    const feasible = feasibleLines.has(lineNumber);
    return {
      feasibilityDate: today,
      communicationAddress: "API Integration Test Address, Chennai",
      contactPerson: "Workflow Test Contact",
      telephoneNumber: "9000000000",
      emailAddress: "quotation.workflow@example.test",
      isNewCustomer: "YES",
      similarProductProcessing: "NO",
      drawingReviewedCompletely: "YES",
      drawingRequirementsUnderstood: "YES",
      productTechnicallyFeasible: feasible ? "YES" : "NO",
      rawMaterialSource: "PURCHASE",
      purchaseSourceAvailable: "YES",
      materialSourceDetails: "Approved existing material supplier",
      outsourceProcessRequired: "NO",
      outsourceSourceDetails: null,
      toleranceAchievable: feasible ? "YES" : "NO",
      acceptanceCriteriaUnderstood: feasible ? "YES" : "NO",
      customerSpecialCharacteristics: "NO",
      customerFinalInspectionFormat: "NO",
      batchSupplyReports: "Material certificate with every batch",
      statutoryRequirements: "Standard statutory requirements",
      customerSpecifiedPacking: "NO",
      customerSpecifiedLabelling: "NO",
      transportationMode: "ROAD",
      customerSpecifiedTransporter: "NO",
      freightPaidBy: "BY_COMPANY",
      paymentTerms: "Net 30 Days",
      feasibilityDecision: feasible ? "FEASIBLE" : "NOT_FEASIBLE",
      regretReason: feasible ? null : "Required tolerance is outside the available process capability.",
      finalRemarks: feasible ? "Approved for commercial workout." : "Regret communication required.",
    };
  };

  for (const part of parts) {
    await request(
      `/api/v1/marketing/enquiry-parts/${part.enquiry_part_id}/feasibility/submit`,
      { method: "POST", body: JSON.stringify(feasibilityPayload(Number(part.line_number))) }
    );
    if ([2, 4].includes(Number(part.line_number))) {
      await request(
        `/api/v1/marketing/enquiry-parts/${part.enquiry_part_id}/feasibility/regret-letter/generate`,
        { method: "POST", body: "{}" }
      );
      await request(
        `/api/v1/marketing/enquiry-parts/${part.enquiry_part_id}/feasibility/regret-letter/approve`,
        { method: "POST", body: "{}" }
      );
    }
  }

  const afterFeasibility = await request(`/api/v1/marketing/enquiries/${enquiryId}`);
  assert(afterFeasibility.data.current_stage === "WORKOUT", "Mixed feasibility must progress to WORKOUT.");
  assert(
    afterFeasibility.data.parts.filter((part) => part.part_status === "FEASIBLE").length === 3,
    "Exactly three parts must be feasible."
  );

  for (const part of parts.filter((item) => feasibleLines.has(Number(item.line_number)))) {
    const line = Number(part.line_number);
    await request(
      `/api/v1/marketing/enquiry-parts/${part.enquiry_part_id}/workout/submit`,
      {
        method: "POST",
        body: JSON.stringify({
          workoutDate: today,
          currencyCode: "EUR",
          currencyRate: 100,
          exchangeRateEffectiveDate: today,
          weightKg: 2 + line,
          materialRatePerKg: 90,
          additionalMaterialCostInr: 25,
          overheadPercent: 12,
          profitCalculationType: "PERCENTAGE",
          profitValue: 15,
          packingForwardingCostInr: 50,
          commissionPercent: 2,
          patternCostInr: 1000 * line,
          fixtureCostInr: 500 * line,
          specialToolCostInr: 250 * line,
          gaugeCostInr: 150 * line,
          trialCostInr: 100 * line,
          moq: 25,
          paymentTerms: "Net 30 Days",
          developmentTime: "4 weeks",
          pilotBatchDelivery: "6 weeks",
          processCosts: [
            { processType: "TURNING", description: "CNC turning", costInr: 600 + 50 * line },
            { processType: "VMC", description: "VMC machining", costInr: 800 + 50 * line },
          ],
          notes: [`API test cost sheet for item ${line}`],
        }),
      }
    );
  }

  const afterWorkout = await request(`/api/v1/marketing/enquiries/${enquiryId}`);
  assert(afterWorkout.data.current_stage === "QUOTATION", "Completed feasible workouts must progress to QUOTATION.");

  const quotationView = await request(`/api/v1/marketing/enquiries/${enquiryId}/quotation`);
  const eligibleLines = quotationView.data.eligibleParts.map((part) => Number(part.line_number));
  assert(JSON.stringify(eligibleLines) === JSON.stringify([1, 3, 5]), "Quotation must load only lines 1, 3 and 5.");
  const selectedIds = quotationView.data.eligibleParts.map((part) => Number(part.enquiry_part_id));
  const quotationPayload = {
    quotationDate: today,
    quoteFor: docNo,
    currencyCode: "EUR",
    enquiryPartIds: selectedIds,
    salutation: "Dear Sir / Madam,",
    introduction: "Please find our quotation for the feasible items from your enquiry.",
    notes: quotationView.data.defaultNotes.map((note) => note.noteText),
    developmentCostDisplayFields: [
      "pattern_development_cost_foreign",
      "tool_development_cost_foreign",
    ],
  };

  await request(`/api/v1/marketing/enquiries/${enquiryId}/quotation`, {
    method: "PUT",
    body: JSON.stringify(quotationPayload),
  });
  await request(
    `/api/v1/marketing/enquiries/${enquiryId}/quotation/submit`,
    {
      method: "POST",
      headers: {
        "x-user-code": "TEST-NO-PERMISSION",
        "x-user-role": "User",
      },
      body: JSON.stringify(quotationPayload),
    },
    403
  );
  const finalized = await request(`/api/v1/marketing/enquiries/${enquiryId}/quotation/submit`, {
    method: "POST",
    body: JSON.stringify(quotationPayload),
  });
  assert(finalized.data.items.length === 3, "Final quotation must snapshot three items.");
  assert(finalized.data.items[0].optionalCosts.length === 2, "Selected development costs must be saved with each quotation item.");
  assert(
    JSON.stringify(finalized.data.items[0].optionalCosts.map((cost) => cost.costType)) === JSON.stringify(["PATTERN", "TOOL"]),
    "Only selected development cost types must be returned."
  );

  const pdf = await request(`/api/v1/marketing/enquiries/${enquiryId}/quotation/pdf`, {
    method: "POST",
    body: "{}",
  });
  const pdfResponse = await fetch(`${baseUrl}${pdf.data.pdf_file_path}`);
  const pdfHeader = Buffer.from(await pdfResponse.arrayBuffer()).subarray(0, 4).toString();
  assert(pdfResponse.ok && pdfHeader === "%PDF", "Generated quotation attachment must be a valid PDF.");

  const finalView = await request(`/api/v1/marketing/enquiries/${enquiryId}/quotation`);

  summary = {
    customerId,
    enquiryId,
    docNo,
    quotationNo: finalView.data.quotation.quotation_no,
    eligiblePartLines: eligibleLines,
    excludedPartLines: [2, 4],
    finalStage: finalView.data.enquiry.current_stage,
    quotationStatus: finalView.data.quotation.quotation_status,
    pdfStatus: finalView.data.quotation.pdf_status,
    mailSending: "UI option only; no email API integration",
    uiPath: `/marketing/enquiries/${enquiryId}/quotation`,
  };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await applicationDb.end();
}
