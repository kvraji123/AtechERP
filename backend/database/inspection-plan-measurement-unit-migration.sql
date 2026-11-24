-- Adds MM / inch selection for operation-level Part Inspection Plans.
-- MySQL 8.0 compatible; safe to run more than once.

SET @has_inspection_measurement_unit := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'part_operation_inspection_plan'
    AND COLUMN_NAME = 'measurement_unit'
);

SET @inspection_measurement_unit_sql := IF(
  @has_inspection_measurement_unit = 0,
  "ALTER TABLE part_operation_inspection_plan ADD COLUMN measurement_unit ENUM('MM','INCH') NOT NULL DEFAULT 'MM' AFTER cmm_required",
  'SELECT 1'
);

PREPARE inspection_measurement_unit_statement FROM @inspection_measurement_unit_sql;
EXECUTE inspection_measurement_unit_statement;
DEALLOCATE PREPARE inspection_measurement_unit_statement;

