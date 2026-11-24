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
    COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT(
        'attachmentId', A.attachment_id,
        'attachmentType', A.attachment_type,
        'fileName', A.file_name,
        'fileUrl', CONCAT('/uploads/', REPLACE(A.file_path, '\\\\', '/'))
      ))
      FROM application_attachments A
      WHERE A.tenant_id = ?
        AND A.entity_type = 'PART'
        AND A.entity_id = P.part_id
        AND A.attachment_type IN (
          'CUSTOMER_DRAWING',
          'BALLOONED_DRAWING',
          'PATTERN_DIE_DRAWING'
        )
        AND A.active_flag = 'Y'
    ), JSON_ARRAY()) AS drawingAttachments,
    P.material_specification AS materialSpecification,
    P.material_id AS materialId,
    P.material_grade_id AS materialGradeId,
    P.part_weight AS partWeight,
    P.unit_of_measurement AS unitOfMeasurement,
    P.uom_id AS uomId,
    P.part_status AS partStatus,
    P.save_status AS saveStatus,
    P.active_flag AS activeFlag,
    P.revision_source_part_id AS revisionSourcePartId,
    P.bom_release_status AS bomReleaseStatus,
    P.bom_required AS bomRequired,
    P.bom_released_by AS bomReleasedBy,
    P.bom_released_on AS bomReleasedOn,
    CASE
      WHEN COALESCE(P.bom_release_status, 'NOT_REQUIRED') = 'RELEASED' THEN 'COMPLETED'
      WHEN COALESCE(P.bom_release_status, 'NOT_REQUIRED') = 'DRAFT' THEN 'IN_PROGRESS'
      WHEN COALESCE(P.bom_required, 'N') = 'Y' THEN 'NOT_STARTED'
      WHEN COALESCE(P.bom_release_status, 'NOT_REQUIRED') = 'NOT_REQUIRED' THEN 'NOT_REQUIRED'
      ELSE 'NOT_STARTED'
    END AS bomCompletionStatus,
    COALESCE((
      SELECT CASE
        WHEN PP.plan_status = 'APPROVED' THEN 'COMPLETED'
        WHEN PP.plan_status = 'DRAFT' THEN 'IN_PROGRESS'
        ELSE PP.plan_status
      END
      FROM part_process_plan PP
      WHERE PP.part_id = P.part_id
        AND PP.active_flag = 'Y'
      ORDER BY PP.is_default DESC, PP.process_plan_id DESC
      LIMIT 1
    ), 'NOT_STARTED') AS processPlanCompletionStatus,
    COALESCE((
      SELECT CASE
        WHEN COUNT(PO.process_operation_id) = 0 THEN 'NOT_STARTED'
        WHEN SUM(CASE WHEN PO.inspection_required = 'Y' THEN 1 ELSE 0 END) = 0 THEN 'NOT_REQUIRED'
        WHEN SUM(CASE
          WHEN PO.inspection_required = 'Y'
            AND (IP.inspection_plan_id IS NULL OR IP.plan_status <> 'READY')
          THEN 1 ELSE 0
        END) > 0 THEN 'IN_PROGRESS'
        ELSE 'COMPLETED'
      END
      FROM part_process_plan PP
      LEFT JOIN part_process_operation PO
        ON PO.process_plan_id = PP.process_plan_id
      LEFT JOIN part_operation_inspection_plan IP
        ON IP.process_operation_id = PO.process_operation_id
      WHERE PP.part_id = P.part_id
        AND PP.active_flag = 'Y'
      GROUP BY PP.process_plan_id, PP.is_default
      ORDER BY PP.is_default DESC, PP.process_plan_id DESC
      LIMIT 1
    ), 'NOT_STARTED') AS inspectionPlanCompletionStatus,
    CASE
      WHEN P.part_status = 'DRAWING_UNDER_REVISION'
        THEN 'Drawing under revision - contact QA department.'
      ELSE NULL
    END AS revisionWarning,
    P.project_name AS projectName,
    COALESCE(P.updated_on, P.created_on) AS lastUpdated
  FROM part_master P
  LEFT JOIN customer_master C
    ON C.customer_id = P.customer_id
  WHERE
    (
      ? = ''
      OR P.part_number LIKE CONCAT('%', ?, '%')
      OR P.part_name LIKE CONCAT('%', ?, '%')
      OR P.drawing_number LIKE CONCAT('%', ?, '%')
      OR P.drawing_code LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = 0
      OR P.customer_id = ?
    )
    AND (
      ? = ''
      OR P.active_flag = ?
    )
    AND (
      ? = ''
      OR P.part_status = ?
    )
    AND (
      ? = ''
      OR COALESCE(P.save_status, 'SUBMITTED') = ?
    )
    AND (
      ? = 'Y'
      OR COALESCE(P.save_status, 'SUBMITTED') = 'SUBMITTED'
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
      OR P.drawing_code LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = 0
      OR P.customer_id = ?
    )
    AND (
      ? = ''
      OR P.active_flag = ?
    )
    AND (
      ? = ''
      OR P.part_status = ?
    )
    AND (
      ? = ''
      OR COALESCE(P.save_status, 'SUBMITTED') = ?
    )
    AND (
      ? = 'Y'
      OR COALESCE(P.save_status, 'SUBMITTED') = 'SUBMITTED'
    )
`;

export const GET_PART_BY_ID = `
  SELECT
    P.*,
    C.customer_code,
    C.customer_name
  FROM part_master P
  LEFT JOIN customer_master C
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
    save_status,
    active_flag,
    revision_source_part_id,
    bom_release_status,
    bom_required,
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
    save_status = ?,
    active_flag = ?,
    bom_required = ?,
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
