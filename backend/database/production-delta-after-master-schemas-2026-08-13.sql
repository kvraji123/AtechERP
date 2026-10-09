-- ATECH ERP - Production schema reconciliation after the following migrations:
--   item-master-schema.sql
--   item-master-material-grade-prefix-migration.sql
--   machine-master-schema.sql
--   part-bom-schema.sql
--   part-process-inspection-schema.sql
--
-- Date: 2026-08-13
-- Database: MySQL 8.x
--
-- Purpose
-- -------
-- The latest copies of the five migrations above already contain the database
-- structure required by the current application. Changes made after those files
-- were last updated are UI or application-rule changes and require no destructive
-- database migration. This idempotent reconciliation is provided for production
-- servers that may have executed an earlier copy of one or more files.
--
-- This script:
--   1. Keeps Machine Type hourly cost available for process costing.
--   2. Keeps Item Master linked to Machine Type.
--   3. Keeps Process Operations linked to Machine Type (not a physical machine).
--   4. Keeps the operation-level Inspection Plan CMM flag.
--   5. Keeps manually entered tolerance-grade text.
--   6. Backfills the new links/values without deleting production data.
--
-- Intentionally retained for backward compatibility/history:
--   * machine_unit_id and machine_unit.hourly_cost_inr
--   * patrol_qa_result
--   * sequence_authorization_* columns
-- The current application no longer uses the process sequence lock/authorisation
-- flow or Patrol QA input, but dropping these fields could destroy historical data.

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS atech_apply_post_master_schema_delta$$
CREATE PROCEDURE atech_apply_post_master_schema_delta()
BEGIN
  IF DATABASE() IS NULL OR DATABASE() = '' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Select the ATECH production database before running this migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'item_master'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'item_master is missing. Run item-master-schema.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'machine_type_master'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'machine_type_master is missing. Run machine-master-schema.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'part_process_operation'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'part_process_operation is missing. Run part-process-inspection-schema.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'part_operation_inspection_plan'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'part_operation_inspection_plan is missing. Run part-process-inspection-schema.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'part_inspection_characteristic'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'part_inspection_characteristic is missing. Run part-process-inspection-schema.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'machine_type_master'
      AND column_name = 'hourly_cost_inr'
  ) THEN
    ALTER TABLE machine_type_master
      ADD COLUMN hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0
      AFTER machine_type_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'item_master'
      AND column_name = 'machine_type_id'
  ) THEN
    ALTER TABLE item_master
      ADD COLUMN machine_type_id BIGINT UNSIGNED NULL
      AFTER model_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'item_master'
      AND column_name = 'machine_capacity'
  ) THEN
    ALTER TABLE item_master
      ADD COLUMN machine_capacity VARCHAR(500) NULL
      AFTER machine_type_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'item_master'
      AND column_name = 'machine_type_id'
  ) THEN
    ALTER TABLE item_master
      ADD INDEX ix_item_machine_type (machine_type_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE constraint_schema = DATABASE()
      AND table_name = 'item_master'
      AND column_name = 'machine_type_id'
      AND referenced_table_name = 'machine_type_master'
      AND referenced_column_name = 'machine_type_id'
  ) THEN
    ALTER TABLE item_master
      ADD CONSTRAINT fk_item_machine_type
      FOREIGN KEY (machine_type_id)
      REFERENCES machine_type_master(machine_type_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'part_process_operation'
      AND column_name = 'machine_type_id'
  ) THEN
    ALTER TABLE part_process_operation
      ADD COLUMN machine_type_id BIGINT UNSIGNED NULL
      AFTER source_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'part_process_operation'
      AND column_name = 'machine_type_id'
  ) THEN
    ALTER TABLE part_process_operation
      ADD INDEX ix_process_operation_machine_type (machine_type_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE constraint_schema = DATABASE()
      AND table_name = 'part_process_operation'
      AND column_name = 'machine_type_id'
      AND referenced_table_name = 'machine_type_master'
      AND referenced_column_name = 'machine_type_id'
  ) THEN
    ALTER TABLE part_process_operation
      ADD CONSTRAINT fk_process_operation_machine_type
      FOREIGN KEY (machine_type_id)
      REFERENCES machine_type_master(machine_type_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'part_operation_inspection_plan'
      AND column_name = 'cmm_required'
  ) THEN
    ALTER TABLE part_operation_inspection_plan
      ADD COLUMN cmm_required ENUM('Y','N') NOT NULL DEFAULT 'N'
      AFTER process_operation_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'part_inspection_characteristic'
      AND column_name = 'tolerance_grade_text'
  ) THEN
    ALTER TABLE part_inspection_characteristic
      ADD COLUMN tolerance_grade_text VARCHAR(50) NULL
      AFTER tolerance_grade_id;
  END IF;
END$$

DELIMITER ;

CALL atech_apply_post_master_schema_delta();
DROP PROCEDURE atech_apply_post_master_schema_delta;

-- Backfill Machine Type on existing process rows that still point to a physical
-- Machine Unit. The keyed WHERE condition is compatible with SQL safe-update mode.
UPDATE part_process_operation PO
JOIN machine_unit MU
  ON MU.machine_unit_id = PO.machine_unit_id
JOIN machine_master MM
  ON MM.machine_master_id = MU.machine_master_id
JOIN item_master I
  ON I.item_id = MM.item_id
SET PO.machine_type_id = I.machine_type_id
WHERE PO.process_operation_id > 0
  AND PO.machine_type_id IS NULL
  AND I.machine_type_id IS NOT NULL;

-- Preserve the previous unit rate as the Machine Type rate only when every
-- positive unit rate belonging to that type is identical. Conflicting rates are
-- deliberately left unchanged for manual business review.
SET @has_legacy_machine_unit_hourly_cost := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'machine_unit'
    AND column_name = 'hourly_cost_inr'
);

SET @migrate_machine_type_hourly_cost_sql := IF(
  @has_legacy_machine_unit_hourly_cost > 0,
  'UPDATE machine_type_master MT
     JOIN (
       SELECT I.machine_type_id, MAX(MU.hourly_cost_inr) AS hourly_cost_inr
       FROM machine_unit MU
       JOIN machine_master MM ON MM.machine_master_id = MU.machine_master_id
       JOIN item_master I ON I.item_id = MM.item_id
       WHERE MU.hourly_cost_inr > 0 AND I.machine_type_id IS NOT NULL
       GROUP BY I.machine_type_id
       HAVING COUNT(DISTINCT MU.hourly_cost_inr) = 1
     ) R ON R.machine_type_id = MT.machine_type_id
   SET MT.hourly_cost_inr = R.hourly_cost_inr
   WHERE MT.machine_type_id > 0 AND MT.hourly_cost_inr = 0',
  'SELECT 1'
);
PREPARE migrate_machine_type_hourly_cost_statement
  FROM @migrate_machine_type_hourly_cost_sql;
EXECUTE migrate_machine_type_hourly_cost_statement;
DEALLOCATE PREPARE migrate_machine_type_hourly_cost_statement;

-- Preserve the selected master grade as editable/displayable text. The keyed
-- WHERE condition is compatible with SQL safe-update mode.
UPDATE part_inspection_characteristic PIC
JOIN tolerance_grade_master TGM
  ON TGM.tolerance_grade_id = PIC.tolerance_grade_id
SET PIC.tolerance_grade_text = TGM.grade_code
WHERE PIC.inspection_characteristic_id > 0
  AND (PIC.tolerance_grade_text IS NULL OR PIC.tolerance_grade_text = '');

-- Production verification. Every result must be PRESENT.
SELECT
  requirement,
  CASE WHEN available_count > 0 THEN 'PRESENT' ELSE 'MISSING' END AS migration_status
FROM (
  SELECT 'machine_type_master.hourly_cost_inr' AS requirement, COUNT(*) AS available_count
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'machine_type_master'
    AND column_name = 'hourly_cost_inr'
  UNION ALL
  SELECT 'item_master.machine_type_id', COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'item_master'
    AND column_name = 'machine_type_id'
  UNION ALL
  SELECT 'item_master.machine_capacity', COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'item_master'
    AND column_name = 'machine_capacity'
  UNION ALL
  SELECT 'part_process_operation.machine_type_id', COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'part_process_operation'
    AND column_name = 'machine_type_id'
  UNION ALL
  SELECT 'part_operation_inspection_plan.cmm_required', COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'part_operation_inspection_plan'
    AND column_name = 'cmm_required'
  UNION ALL
  SELECT 'part_inspection_characteristic.tolerance_grade_text', COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'part_inspection_characteristic'
    AND column_name = 'tolerance_grade_text'
) verification;

-- Business-data checks. Zero is valid but must be reviewed before process costing.
SELECT
  COUNT(*) AS active_machine_types,
  SUM(CASE WHEN hourly_cost_inr = 0 THEN 1 ELSE 0 END) AS machine_types_with_zero_hourly_cost
FROM machine_type_master
WHERE active_flag = 'Y';

