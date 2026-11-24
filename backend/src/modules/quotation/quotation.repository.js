import { db } from "../../config/db.js";

const optionalDevelopmentCostDefinitions = [
  { field: "pattern_development_cost_foreign", costType: "PATTERN" },
  { field: "fixture_development_cost_foreign", costType: "FIXTURE" },
  { field: "tool_development_cost_foreign", costType: "TOOL" },
  { field: "gauge_development_cost_foreign", costType: "GAUGE" },
  { field: "trial_development_cost_foreign", costType: "TRIAL" },
];

export async function getEnquiry(enquiryId, connection = db, masterConnection = connection) {
  const [rows] = await connection.execute(
    `SELECT E.* FROM marketing_enquiries E WHERE E.enquiry_id=?`,
    [Number(enquiryId)]
  );
  if (!rows[0]) return null;
  const enquiry = rows[0];
  const [customers] = enquiry.customer_id
    ? await masterConnection.execute(
      `SELECT customer_code,billing_address,delivery_address,email_address,
              contact_person_name,phone_number,mobile_number
         FROM customer_master WHERE customer_id=?`,
      [Number(enquiry.customer_id)]
    )
    : [[]];
  return { ...enquiry, ...(customers[0] || {}) };
}

export async function getDefaultNotes(connection = db) {
  const [rows] = await connection.execute(
    `SELECT quotation_note_master_id AS quotationNoteMasterId,
            note_code AS noteCode, note_text AS noteText, sort_order AS sortOrder
       FROM quotation_notes_master
      WHERE active_flag='Y' AND default_flag='Y'
      ORDER BY sort_order, quotation_note_master_id`
  );
  return rows;
}

export async function getQuotation(enquiryId, connection = db) {
  const [rows] = await connection.execute(
    `SELECT Q.*, E.order_type AS enquiry_order_type,
            E.customer_enquiry_reference, E.customer_enquiry_date,
            E.customer_representative_name
       FROM marketing_quotations Q
       INNER JOIN marketing_enquiries E ON E.enquiry_id=Q.enquiry_id
      WHERE Q.enquiry_id=? AND Q.active_flag='Y'
      ORDER BY Q.quotation_id DESC LIMIT 1`,
    [Number(enquiryId)]
  );
  if (!rows.length) return null;
  const quotation = rows[0];
  const [items, notes, emails] = await Promise.all([
    connection.execute(
      `SELECT * FROM marketing_quotation_items
        WHERE quotation_id=? AND active_flag='Y' ORDER BY line_number`,
      [quotation.quotation_id]
    ).then(([result]) => result),
    connection.execute(
      `SELECT quotation_note_id AS quotationNoteId, note_text AS noteText,
              display_order AS displayOrder
         FROM marketing_quotation_notes
        WHERE quotation_id=? AND active_flag='Y' ORDER BY display_order`,
      [quotation.quotation_id]
    ).then(([result]) => result),
    connection.execute(
      `SELECT quotation_email_id AS quotationEmailId, recipient_email AS recipientEmail,
              email_subject AS emailSubject, email_status AS emailStatus,
              failure_reason AS failureReason, sent_by AS sentBy, sent_on AS sentOn,
              created_on AS createdOn
         FROM marketing_quotation_emails WHERE quotation_id=? ORDER BY created_on DESC`,
      [quotation.quotation_id]
    ).then(([result]) => result),
  ]);
  const optionalCosts = items.length
    ? await connection.execute(
      `SELECT quotation_item_id AS quotationItemId, cost_type AS costType,
              amount_foreign AS amountForeign, display_order AS displayOrder
         FROM marketing_quotation_item_optional_costs
        WHERE quotation_item_id IN (${items.map(() => "?").join(",")})
        ORDER BY quotation_item_id, display_order, quotation_item_optional_cost_id`,
      items.map((item) => item.quotation_item_id)
    ).then(([result]) => result)
    : [];
  const optionalCostsByItemId = new Map();
  for (const cost of optionalCosts) {
    const costs = optionalCostsByItemId.get(cost.quotationItemId) || [];
    costs.push(cost);
    optionalCostsByItemId.set(cost.quotationItemId, costs);
  }
  return {
    ...quotation,
    items: items.map((item) => ({
      ...item,
      optionalCosts: optionalCostsByItemId.get(item.quotation_item_id) || [],
    })),
    notes,
    emails,
  };
}

export async function getEligibleParts(enquiryId, enquiryPartIds = null, connection = db) {
  const ids = Array.isArray(enquiryPartIds) ? enquiryPartIds.map(Number).filter(Boolean) : [];
  const filter = ids.length ? `AND P.enquiry_part_id IN (${ids.map(() => "?").join(",")})` : "";
  const [rows] = await connection.execute(
    `SELECT P.enquiry_part_id, P.part_id, P.line_number, P.part_number,
            P.item_code, P.drawing_number, P.drawing_revision_number,
            P.product_description, P.required_quantity, P.annual_quantity,
            P.unit_of_measurement, P.material_and_grade,
             W.workout_id, W.process_plan_id, W.moq, W.weight_kg, W.currency_code,
             W.final_part_price_fob_inr, W.final_part_price_fob_foreign,
             W.total_development_cost_inr, W.total_development_cost_foreign,
             W.sample_cost_inr,
             ROUND((CASE WHEN P.is_assembled_part=1 THEN COALESCE(SD.pattern_cost_inr, 0) ELSE COALESCE(W.pattern_cost_inr, 0) END) / NULLIF(W.currency_rate, 0), 4) AS pattern_development_cost_foreign,
             ROUND((CASE WHEN P.is_assembled_part=1 THEN COALESCE(SD.fixture_cost_inr, 0) ELSE COALESCE(W.fixture_cost_inr, 0) END) / NULLIF(W.currency_rate, 0), 4) AS fixture_development_cost_foreign,
             ROUND((CASE WHEN P.is_assembled_part=1 THEN COALESCE(SD.special_tool_cost_inr, 0) ELSE COALESCE(W.special_tool_cost_inr, 0) END) / NULLIF(W.currency_rate, 0), 4) AS tool_development_cost_foreign,
             ROUND((CASE WHEN P.is_assembled_part=1 THEN COALESCE(SD.gauge_cost_inr, 0) ELSE COALESCE(W.gauge_cost_inr, 0) END) / NULLIF(W.currency_rate, 0), 4) AS gauge_development_cost_foreign,
             ROUND((CASE WHEN P.is_assembled_part=1 THEN COALESCE(SD.trial_cost_inr, 0) ELSE COALESCE(W.trial_cost_inr, 0) END) / NULLIF(W.currency_rate, 0), 4) AS trial_development_cost_foreign,
             W.payment_terms, W.development_time, W.pilot_batch_delivery
        FROM marketing_enquiry_parts P
        INNER JOIN marketing_feasibilities F ON F.enquiry_part_id=P.enquiry_part_id
         AND F.feasibility_decision='FEASIBLE' AND F.save_status IN ('CLOSED','SUBMITTED')
        INNER JOIN marketing_workouts W ON W.enquiry_part_id=P.enquiry_part_id
         AND W.save_status='COMPLETED'
        LEFT JOIN (
          SELECT workout_id,
                 SUM(pattern_cost_inr) AS pattern_cost_inr,
                 SUM(fixture_cost_inr) AS fixture_cost_inr,
                 SUM(special_tool_cost_inr) AS special_tool_cost_inr,
                 SUM(gauge_cost_inr) AS gauge_cost_inr,
                 SUM(trial_cost_inr) AS trial_cost_inr
            FROM marketing_workout_subparts
           WHERE active_flag='Y'
           GROUP BY workout_id
        ) SD ON SD.workout_id=W.workout_id
       WHERE P.enquiry_id=? AND P.active_flag='Y' ${filter}
      ORDER BY P.line_number`,
    [Number(enquiryId), ...ids]
  );
  return rows;
}

export async function upsertQuotation(connection, enquiry, quotationNo, data, userCode, status) {
  await connection.execute(
    `INSERT INTO marketing_quotations (
       quotation_no,enquiry_id,quotation_date,quote_for,reference_no,
       customer_id,customer_code_snapshot,customer_name_snapshot,
       customer_address_snapshot,customer_email_snapshot,salutation,introduction,
       currency_code,revision_number,revision_date,quotation_status,
       active_flag,created_by,updated_by
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Y',?,?)
     ON DUPLICATE KEY UPDATE quotation_date=VALUES(quotation_date),
       quote_for=VALUES(quote_for),reference_no=VALUES(reference_no),
       customer_code_snapshot=VALUES(customer_code_snapshot),
       customer_name_snapshot=VALUES(customer_name_snapshot),
       customer_address_snapshot=VALUES(customer_address_snapshot),
       customer_email_snapshot=VALUES(customer_email_snapshot),
       salutation=VALUES(salutation),introduction=VALUES(introduction),
       currency_code=VALUES(currency_code),revision_number=VALUES(revision_number),
       revision_date=VALUES(revision_date),quotation_status=VALUES(quotation_status),
       updated_by=VALUES(updated_by)`,
    [quotationNo,enquiry.enquiry_id,data.quotationDate,data.quoteFor || enquiry.doc_no,
      enquiry.po_reference || null,enquiry.customer_id,enquiry.customer_code,
      enquiry.customer_name_snapshot,enquiry.billing_address || enquiry.delivery_address || null,
      enquiry.email_address || null,data.salutation || "Dear Sir / Madam,",
      data.introduction || "Please find our quotation for the following machined parts.",
      data.currencyCode,enquiry.revision_number || null,enquiry.revision_date || null,
      status,userCode,userCode]
  );
}

async function quotationId(connection, enquiryId) {
  const [rows] = await connection.execute(
    `SELECT quotation_id FROM marketing_quotations
      WHERE enquiry_id=? AND active_flag='Y' ORDER BY quotation_id DESC LIMIT 1`,
    [Number(enquiryId)]
  );
  return rows[0].quotation_id;
}

export async function replaceQuotationItems(connection, enquiryId, parts, userCode, displayedCostFields = []) {
  const id = await quotationId(connection, enquiryId);
  await connection.execute(`DELETE FROM marketing_quotation_items WHERE quotation_id=?`, [id]);
  const selectedDefinitions = optionalDevelopmentCostDefinitions.filter((definition) => displayedCostFields.includes(definition.field));
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const [result] = await connection.execute(
      `INSERT INTO marketing_quotation_items (
        quotation_id,enquiry_part_id,workout_id,process_plan_id,line_number,item_code,
        machining_drawing_number,revision_number,description,annual_quantity,
        required_quantity,moq,material,weight_kg,currency_code,
        part_price_fob_inr,part_price_fob_foreign,
        total_development_cost_inr,total_development_cost_foreign,sample_cost_inr,
        active_flag,created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Y',?)`,
      [id,part.enquiry_part_id,part.workout_id,part.process_plan_id,index+1,part.item_code,
        part.drawing_number,part.drawing_revision_number,part.product_description,
        part.annual_quantity,part.required_quantity,part.moq,part.material_and_grade,
        part.weight_kg,part.currency_code,part.final_part_price_fob_inr,
        part.final_part_price_fob_foreign,part.total_development_cost_inr,
        part.total_development_cost_foreign,part.sample_cost_inr,userCode]
    );
    for (const [costIndex, definition] of selectedDefinitions.entries()) {
      const amount = Number(part[definition.field] || 0);
      if (amount <= 0) continue;
      await connection.execute(
        `INSERT INTO marketing_quotation_item_optional_costs
         (quotation_item_id,cost_type,amount_foreign,charge_basis,display_order,created_by)
         VALUES (?,?,?,'ONE_TIME',?,?)`,
        [result.insertId, definition.costType, amount, costIndex + 1, userCode]
      );
    }
  }
  return id;
}

export async function replaceQuotationNotes(connection, id, notes, userCode) {
  await connection.execute(`DELETE FROM marketing_quotation_notes WHERE quotation_id=?`, [id]);
  for (let index = 0; index < notes.length; index += 1) {
    const note = String(notes[index] || "").trim();
    if (!note) continue;
    await connection.execute(
      `INSERT INTO marketing_quotation_notes
       (quotation_id,note_text,display_order,active_flag,created_by)
       VALUES (?,?,?,'Y',?)`,
      [id,note,index+1,userCode]
    );
  }
}

export async function finalizeQuotation(connection, id, enquiryId, partIds, user) {
  await connection.execute(
    `UPDATE marketing_quotations SET quotation_status='FINALIZED',
       finalized_by=?,finalized_by_name=?,finalized_by_role=?,finalized_on=CURRENT_TIMESTAMP,
       submitted_by=?,submitted_on=CURRENT_TIMESTAMP,updated_by=? WHERE quotation_id=?`,
    [user.userCode,user.employeeName,user.role,user.userCode,user.userCode,id]
  );
  const placeholders = partIds.map(() => "?").join(",");
  await connection.execute(
    `UPDATE marketing_enquiry_parts SET part_status='QUOTED',updated_by=?
      WHERE enquiry_part_id IN (${placeholders})`,
    [user.userCode,...partIds]
  );
  await connection.execute(
    `UPDATE marketing_enquiries SET current_stage='COMPLETED',enquiry_status='QUOTED',
       enquiry_conversion='QUOTED',updated_by=? WHERE enquiry_id=?`,
    [user.userCode,Number(enquiryId)]
  );
}

export async function setPdfGenerated(connection, id, filePath, userCode) {
  await connection.execute(
    `UPDATE marketing_quotations SET pdf_status='GENERATED',pdf_file_path=?,
       pdf_generated_on=CURRENT_TIMESTAMP,updated_by=? WHERE quotation_id=?`,
    [filePath,userCode,id]
  );
}

export async function invalidatePdf(connection, id, userCode) {
  await connection.execute(
    `UPDATE marketing_quotations
        SET pdf_status='NOT_GENERATED',pdf_file_path=NULL,
            pdf_generated_on=NULL,updated_by=?
      WHERE quotation_id=?`,
    [userCode, id]
  );
}

export async function recordEmail(connection, id, details) {
  await connection.execute(
    `INSERT INTO marketing_quotation_emails
     (quotation_id,recipient_email,email_subject,email_body,attachment_path,
      email_status,provider_message_id,failure_reason,sent_by,sent_on)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id,details.to,details.subject,details.body,details.attachmentPath,
      details.status,details.messageId || null,details.failureReason || null,
      details.userCode,details.status === "SENT" ? new Date() : null]
  );
  await connection.execute(
    `UPDATE marketing_quotations SET email_status=?,email_to=?,email_subject=?,
       email_sent_on=?,email_sent_by=?,email_failure_reason=?,updated_by=?
      WHERE quotation_id=?`,
    [details.status,details.to,details.subject,
      details.status === "SENT" ? new Date() : null,details.userCode,
      details.failureReason || null,details.userCode,id]
  );
}
