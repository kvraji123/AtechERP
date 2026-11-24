import { db } from "../../config/db.js";

export async function getPart(enquiryPartId, connection = db, masterConnection = connection) {
  const [rows] = await connection.execute(
    `
      SELECT
        P.*,
        E.doc_no,
        E.order_type AS order_type,
        E.customer_name_snapshot,
        E.customer_id,
        E.current_stage,
        E.enquiry_status,
        E.save_status AS enquiry_save_status
      FROM marketing_enquiry_parts P
      INNER JOIN marketing_enquiries E ON E.enquiry_id = P.enquiry_id
      WHERE P.enquiry_part_id = ?
        AND P.active_flag = 'Y'
    `,
    [Number(enquiryPartId)]
  );

  if (!rows[0]) return null;
  const part = rows[0];
  const [customers] = part.customer_id
    ? await masterConnection.execute(
      `SELECT billing_address,delivery_address,contact_person_name,
              phone_number,mobile_number,email_address
         FROM customer_master
        WHERE customer_id=?`,
      [Number(part.customer_id)]
    )
    : [[]];
  return { ...part, ...(customers[0] || {}) };
}

export async function getEnquiryParts(enquiryId, connection = db) {
  const [rows] = await connection.execute(
    `
      SELECT
        enquiry_part_id AS enquiryPartId,
        line_number AS lineNumber,
        part_number AS partNumber,
        drawing_number AS drawingNumber,
        drawing_revision_number AS drawingRevisionNumber,
        product_description AS productDescription,
        material_and_grade AS materialAndGrade,
        required_quantity AS requiredQuantity,
        unit_of_measurement AS unitOfMeasurement,
        part_status AS partStatus
      FROM marketing_enquiry_parts
      WHERE enquiry_id = ?
        AND active_flag = 'Y'
      ORDER BY line_number
    `,
    [Number(enquiryId)]
  );

  return rows;
}

export async function getFeasibility(enquiryPartId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT * FROM marketing_feasibilities WHERE enquiry_part_id = ?`,
    [Number(enquiryPartId)]
  );

  return rows[0] || null;
}

export async function getRegretLetter(feasibilityId, connection = db) {
  if (!feasibilityId) return null;
  const [rows] = await connection.execute(
    `SELECT * FROM marketing_regret_letters WHERE feasibility_id = ?`,
    [Number(feasibilityId)]
  );
  const letter = rows[0] || null;
  if (!letter) return null;
  const [emailRows] = await connection.execute(
    `
      SELECT recipient_email, email_subject, email_status, provider_message_id,
             failure_reason, attempted_by, attempted_on
      FROM marketing_regret_letter_emails
      WHERE regret_letter_id = ?
      ORDER BY regret_email_id DESC
    `,
    [Number(letter.regret_letter_id)]
  );
  letter.email_attempts = emailRows;
  return letter;
}

export async function getReferenceValues(connection = db) {
  const [rows] = await connection.execute(
    `
      SELECT
        reference_type AS referenceType,
        value_code AS valueCode,
        display_label AS displayLabel
      FROM marketing_reference_values
      WHERE active_flag = 'Y'
        AND reference_type IN ('TRANSPORT_MODE', 'PAYMENT_TERM')
      ORDER BY reference_type, sort_order, display_label
    `
  );

  return rows;
}

export async function generateRegretLetter(
  connection,
  feasibilityId,
  letterContent,
  filePath,
  userCode
) {
  await connection.execute(
    `
      UPDATE marketing_regret_letters
      SET letter_status = 'DRAFTED',
          letter_content = ?,
          file_path = ?,
          generated_on = CURRENT_TIMESTAMP,
          approved_on = NULL,
          approved_by = NULL,
          sent_on = NULL,
          sent_by = NULL,
          updated_by = ?
      WHERE feasibility_id = ?
    `,
    [letterContent, filePath, userCode, Number(feasibilityId)]
  );
}

export async function approveRegretLetter(connection, feasibilityId, userCode) {
  await connection.execute(
    `
      UPDATE marketing_regret_letters
      SET letter_status = 'APPROVED',
          approved_on = CURRENT_TIMESTAMP,
          approved_by = ?,
          updated_by = ?
      WHERE feasibility_id = ?
        AND letter_status = 'DRAFTED'
    `,
    [userCode, userCode, Number(feasibilityId)]
  );
}

export async function markRegretLetterSent(connection, feasibilityId, userCode) {
  await connection.execute(
    `
      UPDATE marketing_regret_letters
      SET letter_status = 'SENT',
          sent_on = CURRENT_TIMESTAMP,
          sent_by = ?,
          updated_by = ?
      WHERE feasibility_id = ?
        AND letter_status = 'APPROVED'
    `,
    [userCode, userCode, Number(feasibilityId)]
  );
}

export async function recordRegretEmail(
  connection,
  regretLetter,
  recipient,
  subject,
  status,
  providerMessageId,
  failureReason,
  userCode
) {
  await connection.execute(
    `
      INSERT INTO marketing_regret_letter_emails (
        regret_letter_id, enquiry_part_id, recipient_email, email_subject,
        email_status, provider_message_id, failure_reason, attempted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      regretLetter.regret_letter_id,
      regretLetter.enquiry_part_id,
      recipient,
      subject,
      status,
      providerMessageId || null,
      failureReason || null,
      userCode,
    ]
  );
}

export async function upsertFeasibility(connection, part, data, userCode) {
  const values = {
    enquiryId: part.enquiry_id,
    enquiryPartId: part.enquiry_part_id,
    feasibilityDate: data.feasibilityDate,
    communicationAddress: data.communicationAddress,
    contactPerson: data.contactPerson,
    telephoneNumber: data.telephoneNumber,
    emailAddress: data.emailAddress,
    isNewCustomer: data.isNewCustomer,
    existingProductsDetails: data.existingProductsDetails,
    similarProductProcessing: data.similarProductProcessing,
    similarProductDetails: data.similarProductDetails,
    drawingReviewedCompletely: data.drawingReviewedCompletely,
    drawingRequirementsUnderstood: data.drawingRequirementsUnderstood,
    customerClarificationRequired: data.customerClarificationRequired,
    productTechnicallyFeasible: data.productTechnicallyFeasible,
    rawMaterialSource: data.rawMaterialSource,
    purchaseSourceAvailable: data.purchaseSourceAvailable,
    materialSourceDetails: data.materialSourceDetails,
    outsourceProcessRequired: data.outsourceProcessRequired,
    outsourceSourceDetails: data.outsourceSourceDetails,
    toleranceAchievable: data.toleranceAchievable,
    acceptanceCriteriaUnderstood: data.acceptanceCriteriaUnderstood,
    customerSpecialCharacteristics: data.customerSpecialCharacteristics,
    specialCharacteristicsDetails: data.specialCharacteristicsDetails,
    customerFinalInspectionFormat: data.customerFinalInspectionFormat,
    finalInspectionFormatDetails: data.finalInspectionFormatDetails,
    batchSupplyReports: data.batchSupplyReports,
    customerRequiredVolume: data.customerRequiredVolume,
    volumeUom: data.volumeUom,
    statutoryRequirements: data.statutoryRequirements,
    customerSpecifiedPacking: data.customerSpecifiedPacking,
    packingDetails: data.packingDetails,
    customerSpecifiedLabelling: data.customerSpecifiedLabelling,
    labellingDetails: data.labellingDetails,
    transportationMode: data.transportationMode,
    customerSpecifiedTransporter: data.customerSpecifiedTransporter,
    transporterDetails: data.transporterDetails,
    freightPaidBy: data.freightPaidBy,
    paymentTerms: data.paymentTerms,
    feasibilityDecision: data.feasibilityDecision,
    regretReason: data.regretReason,
    finalRemarks: data.finalRemarks,
    saveStatus: data.saveStatus,
    userCode,
  };

  await connection.execute(
    `
      INSERT INTO marketing_feasibilities (
        enquiry_id, enquiry_part_id, feasibility_date,
        communication_address, contact_person, telephone_number, email_address,
        is_new_customer, existing_products_details,
        similar_product_processing, similar_product_details,
        drawing_reviewed_completely, drawing_requirements_understood,
        customer_clarification_required, product_technically_feasible,
        raw_material_source, purchase_source_available, material_source_details,
        outsource_process_required, outsource_source_details,
        tolerance_achievable, acceptance_criteria_understood,
        customer_special_characteristics, special_characteristics_details,
        customer_final_inspection_format, final_inspection_format_details,
        batch_supply_reports, customer_required_volume, volume_uom,
        statutory_requirements, customer_specified_packing, packing_details,
        customer_specified_labelling, labelling_details, transportation_mode,
        customer_specified_transporter, transporter_details, freight_paid_by,
        payment_terms, feasibility_decision, regret_reason, final_remarks,
        save_status, active_flag, created_by, updated_by
      ) VALUES (
        :enquiryId, :enquiryPartId, :feasibilityDate,
        :communicationAddress, :contactPerson, :telephoneNumber, :emailAddress,
        :isNewCustomer, :existingProductsDetails,
        :similarProductProcessing, :similarProductDetails,
        :drawingReviewedCompletely, :drawingRequirementsUnderstood,
        :customerClarificationRequired, :productTechnicallyFeasible,
        :rawMaterialSource, :purchaseSourceAvailable, :materialSourceDetails,
        :outsourceProcessRequired, :outsourceSourceDetails,
        :toleranceAchievable, :acceptanceCriteriaUnderstood,
        :customerSpecialCharacteristics, :specialCharacteristicsDetails,
        :customerFinalInspectionFormat, :finalInspectionFormatDetails,
        :batchSupplyReports, :customerRequiredVolume, :volumeUom,
        :statutoryRequirements, :customerSpecifiedPacking, :packingDetails,
        :customerSpecifiedLabelling, :labellingDetails, :transportationMode,
        :customerSpecifiedTransporter, :transporterDetails, :freightPaidBy,
        :paymentTerms, :feasibilityDecision, :regretReason, :finalRemarks,
        :saveStatus, 'Y', :userCode, :userCode
      )
      ON DUPLICATE KEY UPDATE
        feasibility_date = VALUES(feasibility_date),
        communication_address = VALUES(communication_address),
        contact_person = VALUES(contact_person),
        telephone_number = VALUES(telephone_number),
        email_address = VALUES(email_address),
        is_new_customer = VALUES(is_new_customer),
        existing_products_details = VALUES(existing_products_details),
        similar_product_processing = VALUES(similar_product_processing),
        similar_product_details = VALUES(similar_product_details),
        drawing_reviewed_completely = VALUES(drawing_reviewed_completely),
        drawing_requirements_understood = VALUES(drawing_requirements_understood),
        customer_clarification_required = VALUES(customer_clarification_required),
        product_technically_feasible = VALUES(product_technically_feasible),
        raw_material_source = VALUES(raw_material_source),
        purchase_source_available = VALUES(purchase_source_available),
        material_source_details = VALUES(material_source_details),
        outsource_process_required = VALUES(outsource_process_required),
        outsource_source_details = VALUES(outsource_source_details),
        tolerance_achievable = VALUES(tolerance_achievable),
        acceptance_criteria_understood = VALUES(acceptance_criteria_understood),
        customer_special_characteristics = VALUES(customer_special_characteristics),
        special_characteristics_details = VALUES(special_characteristics_details),
        customer_final_inspection_format = VALUES(customer_final_inspection_format),
        final_inspection_format_details = VALUES(final_inspection_format_details),
        batch_supply_reports = VALUES(batch_supply_reports),
        customer_required_volume = VALUES(customer_required_volume),
        volume_uom = VALUES(volume_uom),
        statutory_requirements = VALUES(statutory_requirements),
        customer_specified_packing = VALUES(customer_specified_packing),
        packing_details = VALUES(packing_details),
        customer_specified_labelling = VALUES(customer_specified_labelling),
        labelling_details = VALUES(labelling_details),
        transportation_mode = VALUES(transportation_mode),
        customer_specified_transporter = VALUES(customer_specified_transporter),
        transporter_details = VALUES(transporter_details),
        freight_paid_by = VALUES(freight_paid_by),
        payment_terms = VALUES(payment_terms),
        feasibility_decision = VALUES(feasibility_decision),
        regret_reason = VALUES(regret_reason),
        final_remarks = VALUES(final_remarks),
        save_status = VALUES(save_status),
        updated_by = VALUES(updated_by)
    `,
    values
  );
}

export async function closeFeasibility(connection, part, decision, regretReason, user) {
  await connection.execute(
    `
      UPDATE marketing_feasibilities
      SET save_status = 'CLOSED',
          feasibility_decision = ?,
          regret_reason = ?,
          feasibility_check_completed_on = CURRENT_TIMESTAMP,
          closed_by_code = ?,
          closed_by_name = ?,
          closed_by_role = ?,
          submitted_by = ?,
          submitted_on = CURRENT_TIMESTAMP,
          updated_by = ?
      WHERE enquiry_part_id = ?
    `,
    [decision, regretReason, user.code, user.name, user.role, user.code, user.code, part.enquiry_part_id]
  );

  await connection.execute(
    `UPDATE marketing_enquiry_parts SET part_status = ?, save_status = 'SUBMITTED', updated_by = ? WHERE enquiry_part_id = ?`,
    [decision, user.code, part.enquiry_part_id]
  );

  if (decision === "NOT_FEASIBLE") {
    const feasibility = await getFeasibility(part.enquiry_part_id, connection);
    await connection.execute(
      `
        INSERT INTO marketing_regret_letters (
          enquiry_id, enquiry_part_id, feasibility_id, letter_status,
          regret_reason, created_by, updated_by
        ) VALUES (?, ?, ?, 'NOT_GENERATED', ?, ?, ?)
        ON DUPLICATE KEY UPDATE regret_reason = VALUES(regret_reason), updated_by = VALUES(updated_by)
      `,
      [part.enquiry_id, part.enquiry_part_id, feasibility.feasibility_id, regretReason, user.code, user.code]
    );
  }

  const [summaryRows] = await connection.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN F.save_status IN ('CLOSED','SUBMITTED') AND F.feasibility_decision IN ('FEASIBLE','NOT_FEASIBLE') THEN 1 ELSE 0 END) AS reviewed,
       SUM(CASE WHEN F.save_status IN ('CLOSED','SUBMITTED') AND F.feasibility_decision = 'FEASIBLE' THEN 1 ELSE 0 END) AS feasible
     FROM marketing_enquiry_parts P
     LEFT JOIN marketing_feasibilities F ON F.enquiry_part_id = P.enquiry_part_id
     WHERE P.enquiry_id = ? AND P.active_flag = 'Y'`,
    [part.enquiry_id]
  );
  const summary = summaryRows[0];
  const allReviewed = Number(summary.reviewed || 0) === Number(summary.total || 0);
  if (!allReviewed) {
    await connection.execute(
      `UPDATE marketing_enquiries SET current_stage='FEASIBILITY', enquiry_status='IN_PROGRESS', updated_by=? WHERE enquiry_id=?`,
      [user.code, part.enquiry_id]
    );
  } else if (Number(summary.feasible || 0) > 0) {
    await connection.execute(
      `UPDATE marketing_enquiries SET current_stage='WORKOUT', enquiry_status='IN_PROGRESS', enquiry_conversion='YET_TO_RECEIVE', updated_by=? WHERE enquiry_id=?`,
      [user.code, part.enquiry_id]
    );
  } else {
    await connection.execute(
      `UPDATE marketing_enquiries SET current_stage='COMPLETED', enquiry_status='IN_PROGRESS', enquiry_conversion='NOT_CONVERTED', updated_by=? WHERE enquiry_id=?`,
      [user.code, part.enquiry_id]
    );
  }
}
