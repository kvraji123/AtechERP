export const LIST_ENQUIRIES = `
  SELECT
    E.enquiry_id AS enquiryId,
    E.doc_no AS docNo,
    E.customer_id AS customerId,
    E.customer_code_snapshot AS customerCode,
    E.customer_name_snapshot AS customerName,
    E.enquiry_mode AS enquiryMode,
    E.order_type AS orderType,
    E.required_date AS requiredDate,
    E.enquiry_status AS enquiryStatus,
    E.enquiry_conversion AS enquiryConversion,
    E.current_stage AS currentStage,
    E.save_status AS saveStatus,
    E.created_on AS createdOn,
    COALESCE(E.updated_on, E.submitted_on, E.created_on) AS lastUpdated,
    COUNT(P.enquiry_part_id) AS partCount,
    COALESCE(
      JSON_ARRAYAGG(
        IF(P.enquiry_part_id IS NULL, NULL, JSON_OBJECT(
          'enquiryPartId', P.enquiry_part_id,
          'lineNumber', P.line_number,
          'partNumber', P.part_number,
          'itemCode', P.item_code,
          'drawingNumber', P.drawing_number,
          'description', P.product_description,
          'requiredQuantity', P.required_quantity,
          'unitOfMeasurement', P.unit_of_measurement
        ))
      ),
      JSON_ARRAY()
    ) AS parts,
    COALESCE(
      MIN(CASE
        WHEN E.current_stage = 'FEASIBILITY'
          AND COALESCE(P.part_status, '') NOT IN ('FEASIBLE', 'NOT_FEASIBLE', 'WORKOUT_COMPLETED')
          THEN P.enquiry_part_id
        WHEN E.current_stage = 'WORKOUT'
          AND P.part_status = 'FEASIBLE'
          THEN P.enquiry_part_id
        ELSE NULL
      END),
      MIN(P.enquiry_part_id)
    ) AS currentPartId
  FROM marketing_enquiries E
  LEFT JOIN marketing_enquiry_parts P
    ON P.enquiry_id = E.enquiry_id
    AND P.active_flag = 'Y'
  WHERE
    (
      ? = ''
      OR E.doc_no LIKE CONCAT('%', ?, '%')
      OR E.customer_name_snapshot LIKE CONCAT('%', ?, '%')
      OR E.customer_code_snapshot LIKE CONCAT('%', ?, '%')
      OR EXISTS (
        SELECT 1
        FROM marketing_enquiry_parts PS
        WHERE PS.enquiry_id = E.enquiry_id
          AND PS.active_flag = 'Y'
          AND (
            PS.part_number LIKE CONCAT('%', ?, '%')
            OR PS.item_code LIKE CONCAT('%', ?, '%')
            OR PS.drawing_number LIKE CONCAT('%', ?, '%')
            OR PS.product_description LIKE CONCAT('%', ?, '%')
          )
      )
    )
    AND (? = '' OR E.current_stage = ?)
    AND (? = '' OR E.enquiry_status = ?)
    /* COLUMN_FILTERS */
  GROUP BY
    E.enquiry_id,
    E.doc_no,
    E.customer_id,
    E.customer_code_snapshot,
    E.customer_name_snapshot,
    E.enquiry_mode,
    E.order_type,
    E.required_date,
    E.enquiry_status,
    E.enquiry_conversion,
    E.current_stage,
    E.save_status,
    E.created_on,
    E.updated_on,
    E.submitted_on
  ORDER BY
    COALESCE(E.updated_on, E.submitted_on, E.created_on) DESC,
    E.enquiry_id DESC
`;
export const COUNT_ENQUIRIES = `
  SELECT COUNT(*) AS total
  FROM marketing_enquiries E
  WHERE
    (
      ? = ''
      OR E.doc_no LIKE CONCAT('%', ?, '%')
      OR E.customer_name_snapshot LIKE CONCAT('%', ?, '%')
      OR E.customer_code_snapshot LIKE CONCAT('%', ?, '%')
      OR EXISTS (
        SELECT 1
        FROM marketing_enquiry_parts PS
        WHERE PS.enquiry_id = E.enquiry_id
          AND PS.active_flag = 'Y'
          AND (
            PS.part_number LIKE CONCAT('%', ?, '%')
            OR PS.item_code LIKE CONCAT('%', ?, '%')
            OR PS.drawing_number LIKE CONCAT('%', ?, '%')
            OR PS.product_description LIKE CONCAT('%', ?, '%')
          )
      )
    )
    AND (? = '' OR E.current_stage = ?)
    AND (? = '' OR E.enquiry_status = ?)
    /* COLUMN_FILTERS */
`;

export const LIST_ENQUIRY_FILTER_OPTIONS = `
  SELECT DISTINCT
    filterKey,
    optionValue,
    optionLabel
  FROM (
    SELECT 'docNo' AS filterKey, E.doc_no AS optionValue, E.doc_no AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT 'customer' AS filterKey, E.customer_name_snapshot AS optionValue, E.customer_name_snapshot AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT 'mode' AS filterKey, E.enquiry_mode AS optionValue, E.enquiry_mode AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT 'orderType' AS filterKey, E.order_type AS optionValue, E.order_type AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT 'stage' AS filterKey, E.current_stage AS optionValue, E.current_stage AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT 'status' AS filterKey, E.enquiry_status AS optionValue, E.enquiry_status AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT
      'parts' AS filterKey,
      COALESCE(NULLIF(P.item_code, ''), NULLIF(P.drawing_number, ''), NULLIF(P.part_number, ''), NULLIF(P.product_description, '')) AS optionValue,
      CONCAT_WS(' · ', NULLIF(P.item_code, ''), NULLIF(P.part_number, ''), NULLIF(P.drawing_number, ''), NULLIF(P.product_description, '')) AS optionLabel
    FROM marketing_enquiry_parts P
    WHERE P.active_flag = 'Y'

    UNION ALL

    SELECT
      'createdOn' AS filterKey,
      DATE_FORMAT(E.created_on, '%Y-%m-%d') AS optionValue,
      DATE_FORMAT(E.created_on, '%d %b %Y') AS optionLabel
    FROM marketing_enquiries E

    UNION ALL

    SELECT
      'lastUpdated' AS filterKey,
      DATE_FORMAT(COALESCE(E.updated_on, E.submitted_on, E.created_on), '%Y-%m-%d') AS optionValue,
      DATE_FORMAT(COALESCE(E.updated_on, E.submitted_on, E.created_on), '%d %b %Y') AS optionLabel
    FROM marketing_enquiries E
  ) AS filterOptions
  WHERE optionValue IS NOT NULL
    AND optionValue <> ''
  ORDER BY filterKey, optionLabel
`;

export const GET_ENQUIRY = `
  SELECT *
  FROM marketing_enquiries
  WHERE enquiry_id = ?
`;

export const GET_ENQUIRY_PARTS = `
  SELECT *
  FROM marketing_enquiry_parts
  WHERE enquiry_id = ?
    AND active_flag = 'Y'
  ORDER BY line_number
`;

export const GET_ENQUIRY_REVISIONS = `
  SELECT
    enquiry_revision_id AS enquiryRevisionId,
    enquiry_id AS enquiryId,
    revision_sequence AS revisionSequence,
    revision_number AS revisionNumber,
    revision_date AS revisionDate,
    revision_action AS revisionAction,
    save_status AS saveStatus,
    created_by AS createdBy,
    created_on AS createdOn
  FROM marketing_enquiry_revisions
  WHERE enquiry_id = ?
  ORDER BY revision_sequence DESC
`;

export const GET_LATEST_ENQUIRY_REVISION = `
  SELECT
    enquiry_revision_id,
    revision_sequence,
    revision_number
  FROM marketing_enquiry_revisions
  WHERE enquiry_id = ?
  ORDER BY revision_sequence DESC
  LIMIT 1
`;

export const INSERT_ENQUIRY_REVISION = `
  INSERT INTO marketing_enquiry_revisions (
    enquiry_id,
    revision_sequence,
    revision_number,
    revision_date,
    revision_action,
    save_status,
    snapshot_json,
    created_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export const INSERT_ENQUIRY = `
  INSERT INTO marketing_enquiries (
    doc_no,
    customer_id,
    customer_code_snapshot,
    customer_name_snapshot,
    customer_short_name_snapshot,
    enquiry_mode,
    order_type,
    required_date,
    po_reference,
    enquiry_status,
    enquiry_conversion,
    current_stage,
    revision_number,
    revision_date,
    save_status,
    remarks,
    active_flag,
    created_by
  )
  VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', 'YET_TO_RECEIVE',
    'ENQUIRY', ?, ?, ?, ?, 'Y', ?
  )
`;

export const UPDATE_ENQUIRY = `
  UPDATE marketing_enquiries
  SET
    customer_id = ?,
    customer_code_snapshot = ?,
    customer_name_snapshot = ?,
    customer_short_name_snapshot = ?,
    enquiry_mode = ?,
    order_type = ?,
    required_date = ?,
    po_reference = ?,
    revision_number = ?,
    revision_date = ?,
    save_status = ?,
    remarks = ?,
    updated_by = ?
  WHERE enquiry_id = ?
`;

export const DELETE_ENQUIRY_PARTS = `
  DELETE FROM marketing_enquiry_parts
  WHERE enquiry_id = ?
`;

export const INSERT_ENQUIRY_PART = `
  INSERT INTO marketing_enquiry_parts (
    enquiry_id,
    part_id,
    line_number,
    part_number,
    item_code,
    drawing_number,
    drawing_revision_number,
    drawing_revision_date,
    product_description,
    material_and_grade,
    alternative_material,
    is_assembled_part,
    required_quantity,
    annual_quantity,
    moq,
    required_date,
    unit_of_measurement,
    part_status,
    save_status,
    active_flag,
    created_by
  )
  VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    'PENDING_FEASIBILITY', ?, 'Y', ?
  )
`;

export const SUBMIT_ENQUIRY = `
  UPDATE marketing_enquiries
  SET
    save_status = 'SUBMITTED',
    current_stage = 'FEASIBILITY',
    enquiry_status = 'IN_PROGRESS',
    submitted_by = ?,
    submitted_on = CURRENT_TIMESTAMP,
    updated_by = ?
  WHERE enquiry_id = ?
`;

export const UPDATE_ENQUIRY_STATUS = `
  UPDATE marketing_enquiries
  SET
    enquiry_status = ?,
    updated_by = ?
  WHERE enquiry_id = ?
`;

export const ELIGIBLE_QUOTATION_PARTS = `
  SELECT
    P.enquiry_part_id AS enquiryPartId,
    P.part_id AS partId,
    P.line_number AS lineNumber,
    P.part_number AS partNumber,
    P.item_code AS itemCode,
    P.drawing_number AS drawingNumber,
    P.drawing_revision_number AS revisionNumber,
    P.product_description AS description,
    P.annual_quantity AS annualQuantity,
    P.moq,
    P.material_and_grade AS material,
    W.workout_id AS workoutId,
    W.weight_kg AS weightKg,
    W.final_part_price_fob_foreign AS partPriceFobForeign,
    W.total_development_cost_foreign AS developmentCostForeign
  FROM marketing_enquiry_parts P
  INNER JOIN marketing_feasibilities F
    ON F.enquiry_part_id = P.enquiry_part_id
    AND F.feasibility_decision = 'FEASIBLE'
    AND F.save_status IN ('CLOSED', 'SUBMITTED')
  INNER JOIN marketing_workouts W
    ON W.enquiry_part_id = P.enquiry_part_id
    AND W.save_status = 'COMPLETED'
  WHERE P.enquiry_id = ?
    AND P.active_flag = 'Y'
  ORDER BY P.line_number
`;
