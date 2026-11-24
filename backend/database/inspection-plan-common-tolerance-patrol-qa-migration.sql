-- Inspection Plan common tolerance standard and Patrol Inspection QA column.
-- MySQL 8.0+; safe to run more than once.

SET @has_plan_tolerance_standard := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_operation_inspection_plan'
    AND COLUMN_NAME='tolerance_standard_id'
);
SET @plan_tolerance_standard_column_sql := IF(@has_plan_tolerance_standard=0,
  'ALTER TABLE part_operation_inspection_plan ADD COLUMN tolerance_standard_id BIGINT UNSIGNED NULL AFTER measurement_unit',
  'SELECT 1');
PREPARE plan_tolerance_standard_column_statement FROM @plan_tolerance_standard_column_sql;
EXECUTE plan_tolerance_standard_column_statement;
DEALLOCATE PREPARE plan_tolerance_standard_column_statement;

SET @has_plan_tolerance_standard_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_operation_inspection_plan'
    AND INDEX_NAME='ix_inspection_plan_tolerance_standard'
);
SET @plan_tolerance_standard_index_sql := IF(@has_plan_tolerance_standard_index=0,
  'ALTER TABLE part_operation_inspection_plan ADD KEY ix_inspection_plan_tolerance_standard (tolerance_standard_id)',
  'SELECT 1');
PREPARE plan_tolerance_standard_index_statement FROM @plan_tolerance_standard_index_sql;
EXECUTE plan_tolerance_standard_index_statement;
DEALLOCATE PREPARE plan_tolerance_standard_index_statement;

SET @has_plan_tolerance_standard_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_operation_inspection_plan'
    AND CONSTRAINT_NAME='fk_inspection_plan_tolerance_standard'
);
SET @plan_tolerance_standard_fk_sql := IF(@has_plan_tolerance_standard_fk=0,
  'ALTER TABLE part_operation_inspection_plan ADD CONSTRAINT fk_inspection_plan_tolerance_standard FOREIGN KEY (tolerance_standard_id) REFERENCES inspection_tolerance_standard_master(tolerance_standard_id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE plan_tolerance_standard_fk_statement FROM @plan_tolerance_standard_fk_sql;
EXECUTE plan_tolerance_standard_fk_statement;
DEALLOCATE PREPARE plan_tolerance_standard_fk_statement;

SET @has_patrol_inspection_qa := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND COLUMN_NAME='patrol_inspection_qa_required'
);
SET @patrol_inspection_qa_column_sql := IF(@has_patrol_inspection_qa=0,
  'ALTER TABLE part_inspection_characteristic ADD COLUMN patrol_inspection_qa_required ENUM(''Y'',''N'') NOT NULL DEFAULT ''N'' AFTER sc_cc_identification',
  'SELECT 1');
PREPARE patrol_inspection_qa_column_statement FROM @patrol_inspection_qa_column_sql;
EXECUTE patrol_inspection_qa_column_statement;
DEALLOCATE PREPARE patrol_inspection_qa_column_statement;

-- Existing plans use the common standard only when every row already selected
-- the same standard. Mixed historical standards are intentionally left blank
-- for the user to choose explicitly at plan level.
UPDATE part_operation_inspection_plan IP
INNER JOIN (
  SELECT inspection_plan_id, MIN(tolerance_standard_id) AS tolerance_standard_id
  FROM part_inspection_characteristic
  WHERE tolerance_standard_id IS NOT NULL
  GROUP BY inspection_plan_id
  HAVING COUNT(DISTINCT tolerance_standard_id)=1
) PIC ON PIC.inspection_plan_id=IP.inspection_plan_id
SET IP.tolerance_standard_id=PIC.tolerance_standard_id
WHERE IP.tolerance_standard_id IS NULL;
