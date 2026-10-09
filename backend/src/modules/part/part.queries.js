// src/modules/part/part.queries.js

export const LIST_PARTS = `
  SELECT
    P.part_id AS partId,
    P.customer_id AS customerId,
    C.customer_code AS customerCode,
    C.customer_name AS customerName,
    P.part_category AS partCategory,
    P.part_name AS partName,
    P.part_number AS partNumber,
    P.drawing_number AS drawingNumber,
    P.drawing_revision_number AS drawingRevisionNumber,
    P.drawing_revision_date AS drawingRevisionDate,
    P.drawing_code_mode AS drawingCodeMode,
    P.drawing_code AS drawingCode,
    P.material_specification AS materialSpecification,
    P.material_id AS materialId,
    P.material_grade_id AS materialGradeId,
    P.part_weight AS partWeight,
    P.unit_of_measurement AS unitOfMeasurement,
    P.uom_id AS uomId,
    P.part_status AS partStatus,
    P.active_flag AS activeFlag,
    P.project_name AS projectName,
    COALESCE(P.updated_on, P.created_on) AS lastUpdated
  FROM part_master P
  INNER JOIN customer_master C
    ON C.customer_id = P.customer_id
  WHERE
    (
      ? = ''
      OR P.part_number LIKE CONCAT('%', ?, '%')
      OR P.part_name LIKE CONCAT('%', ?, '%')
      OR P.drawing_number LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = 0
      OR P.customer_id = ?
    )
    AND (
      ? = ''
      OR P.active_flag = ?
    )
  ORDER BY
    COALESCE(P.updated_on, P.created_on) DESC,
    P.part_id DESC
`;

export const COUNT_PARTS = `
  SELECT
    COUNT(*) AS total
  FROM part_master P
  WHERE
    (
      ? = ''
      OR P.part_number LIKE CONCAT('%', ?, '%')
      OR P.part_name LIKE CONCAT('%', ?, '%')
      OR P.drawing_number LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = 0
      OR P.customer_id = ?
    )
    AND (
      ? = ''
      OR P.active_flag = ?
    )
`;

export const GET_PART_BY_ID = `
  SELECT
    P.*,
    C.customer_code,
    C.customer_name
  FROM part_master P
  INNER JOIN customer_master C
    ON C.customer_id = P.customer_id
  WHERE P.part_id = ?
`;

export const INSERT_PART = `
  INSERT INTO part_master
  (
    customer_id,
    part_category,
    part_name,
    part_number,
    drawing_number,
    drawing_revision_number,
    drawing_revision_date,
    drawing_code_mode,
    drawing_code,
    material_specification,
    material_id,
    material_grade_id,
    part_weight,
    unit_of_measurement,
    uom_id,
    part_status,
    active_flag,
    project_name,
    created_by
  )
  VALUES
  (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
`;

export const UPDATE_PART = `
  UPDATE part_master
  SET
    customer_id = ?,
    part_category = ?,
    part_name = ?,
    part_number = ?,
    drawing_number = ?,
    drawing_revision_number = ?,
    drawing_revision_date = ?,
    drawing_code_mode = ?,
    drawing_code = ?,
    material_specification = ?,
    material_id = ?,
    material_grade_id = ?,
    part_weight = ?,
    unit_of_measurement = ?,
    uom_id = ?,
    project_name = ?,
    updated_by = ?
  WHERE part_id = ?
`;

export const UPDATE_PART_STATUS = `
  UPDATE part_master
  SET
    part_status = ?,
    active_flag = ?,
    deactivation_remarks = ?,
    updated_by = ?
  WHERE part_id = ?
`;
