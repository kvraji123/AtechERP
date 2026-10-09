-- ============================================================================
-- A TECH AUTOMATION ERP - PRODUCTION DELTA
-- Baseline: production-delta-after-master-schemas-2026-08-13.sql already applied
-- Generated: 2026-08-17
-- Target: MySQL 8.x
-- ============================================================================
-- IMPORTANT:
--   1. Take and verify a production database backup before execution.
--   2. Select the production database before running this file.
--   3. Deploy the matching backend/frontend application immediately afterward.
--   4. DDL statements auto-commit in MySQL; this migration cannot be rolled back
--      as one transaction.
--
-- Intentional data cleanup:
--   * Drops item_customer and its customer-specific Item mappings.
--   * Drops make_buy_classification, stock_classification and valuation_method.
--   * Clears Material/Grade on every non-Raw-Material Item.
--   * Keeps Shelf Life and Shelf Life Days only for Consumable Items.
-- ============================================================================

SET NAMES utf8mb4;

-- No DELIMITER/client commands are used, so this file works in Workbench,
-- phpMyAdmin, MySQL CLI and programmatic multiple-statement runners.
SELECT DATABASE() AS selected_database,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()
    AND table_name IN ('item_master','item_group_master','part_process_plan','part_process_operation',
                       'marketing_workouts','marketing_quotation_items')) AS required_baseline_tables,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='part_process_operation' AND column_name='machine_type_id')
    THEN 'BASELINE PRESENT' ELSE 'BASELINE MISSING - STOP' END AS baseline_status;

-- ============================================================================
-- Process Plan variants and shared Process Definitions
-- Source: process-plan-variants-shared-definitions-migration.sql
-- ============================================================================

-- Multiple capacity-specific Process Plan variants with reusable shared process definitions.

SET @has_plan_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND COLUMN_NAME='plan_code'
);
SET @plan_code_sql := IF(@has_plan_code=0,
  "ALTER TABLE part_process_plan ADD COLUMN plan_code VARCHAR(30) NULL AFTER drawing_revision_number",
  'SELECT 1');
PREPARE plan_code_statement FROM @plan_code_sql;
EXECUTE plan_code_statement;
DEALLOCATE PREPARE plan_code_statement;

SET @has_route_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND COLUMN_NAME='route_name'
);
SET @route_name_sql := IF(@has_route_name=0,
  "ALTER TABLE part_process_plan ADD COLUMN route_name VARCHAR(150) NULL AFTER plan_code",
  'SELECT 1');
PREPARE route_name_statement FROM @route_name_sql;
EXECUTE route_name_statement;
DEALLOCATE PREPARE route_name_statement;

SET @has_default_flag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND COLUMN_NAME='is_default'
);
SET @default_flag_sql := IF(@has_default_flag=0,
  "ALTER TABLE part_process_plan ADD COLUMN is_default ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER plan_status",
  'SELECT 1');
PREPARE default_flag_statement FROM @default_flag_sql;
EXECUTE default_flag_statement;
DEALLOCATE PREPARE default_flag_statement;

SET @has_plan_active_flag := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND COLUMN_NAME='active_flag'
);
SET @plan_active_flag_sql := IF(@has_plan_active_flag=0,
  "ALTER TABLE part_process_plan ADD COLUMN active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y' AFTER is_default",
  'SELECT 1');
PREPARE plan_active_flag_statement FROM @plan_active_flag_sql;
EXECUTE plan_active_flag_statement;
DEALLOCATE PREPARE plan_active_flag_statement;

UPDATE part_process_plan
SET plan_code=COALESCE(NULLIF(plan_code,''),CONCAT('PP-',LPAD(process_plan_id,4,'0'))),
    route_name=COALESCE(NULLIF(route_name,''),'Default Route')
WHERE process_plan_id>0;

DROP TEMPORARY TABLE IF EXISTS process_plan_default_candidates;
CREATE TEMPORARY TABLE process_plan_default_candidates AS
SELECT P.part_id,MIN(P.process_plan_id) AS default_plan_id
FROM part_process_plan P
LEFT JOIN part_process_plan D ON D.part_id=P.part_id AND D.is_default='Y'
WHERE D.process_plan_id IS NULL
GROUP BY P.part_id;
UPDATE part_process_plan P
JOIN process_plan_default_candidates D ON D.default_plan_id=P.process_plan_id
SET P.is_default='Y'
WHERE P.process_plan_id>0;
DROP TEMPORARY TABLE process_plan_default_candidates;

SET @has_old_plan_unique := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND INDEX_NAME='uq_part_process_revision'
);
SET @has_plan_part_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND INDEX_NAME='ix_process_plan_part'
);
SET @plan_part_index_sql := IF(@has_plan_part_index=0,
  'ALTER TABLE part_process_plan ADD KEY ix_process_plan_part (part_id)',
  'SELECT 1');
PREPARE plan_part_index_statement FROM @plan_part_index_sql;
EXECUTE plan_part_index_statement;
DEALLOCATE PREPARE plan_part_index_statement;

SET @drop_old_plan_unique_sql := IF(@has_old_plan_unique>0,
  'ALTER TABLE part_process_plan DROP INDEX uq_part_process_revision',
  'SELECT 1');
PREPARE drop_old_plan_unique_statement FROM @drop_old_plan_unique_sql;
EXECUTE drop_old_plan_unique_statement;
DEALLOCATE PREPARE drop_old_plan_unique_statement;

SET @has_variant_unique := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_plan' AND INDEX_NAME='uq_part_process_variant_code'
);
SET @variant_unique_sql := IF(@has_variant_unique=0,
  'ALTER TABLE part_process_plan ADD UNIQUE KEY uq_part_process_variant_code (part_id,plan_code)',
  'SELECT 1');
PREPARE variant_unique_statement FROM @variant_unique_sql;
EXECUTE variant_unique_statement;
DEALLOCATE PREPARE variant_unique_statement;

CREATE TABLE IF NOT EXISTS part_process_definition (
  process_definition_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  part_id BIGINT UNSIGNED NOT NULL,
  definition_code VARCHAR(30) NOT NULL,
  operation_master_id BIGINT UNSIGNED NULL,
  operation_description VARCHAR(500) NULL,
  source_type ENUM('INHOUSE','OUTSOURCE') NOT NULL,
  machine_type_id BIGINT UNSIGNED NULL,
  cycle_time_seconds DECIMAL(18,3) NULL,
  clamping_time_seconds DECIMAL(18,3) NULL,
  setting_time_hours DECIMAL(18,3) NULL,
  outsource_cost_inr DECIMAL(18,2) NULL,
  process_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (process_definition_id),
  UNIQUE KEY uq_part_process_definition_code (part_id,definition_code),
  KEY ix_process_definition_operation (operation_master_id),
  KEY ix_process_definition_machine_type (machine_type_id),
  CONSTRAINT fk_process_definition_part FOREIGN KEY (part_id)
    REFERENCES part_master(part_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_process_definition_operation FOREIGN KEY (operation_master_id)
    REFERENCES operation_master(operation_master_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_process_definition_machine_type FOREIGN KEY (machine_type_id)
    REFERENCES machine_type_master(machine_type_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_process_definition_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation' AND COLUMN_NAME='process_definition_id'
);
SET @process_definition_id_sql := IF(@has_process_definition_id=0,
  'ALTER TABLE part_process_operation ADD COLUMN process_definition_id BIGINT UNSIGNED NULL AFTER process_plan_id',
  'SELECT 1');
PREPARE process_definition_id_statement FROM @process_definition_id_sql;
EXECUTE process_definition_id_statement;
DEALLOCATE PREPARE process_definition_id_statement;

INSERT INTO part_process_definition
 (process_definition_id,part_id,definition_code,operation_master_id,operation_description,source_type,
  machine_type_id,cycle_time_seconds,clamping_time_seconds,setting_time_hours,outsource_cost_inr,
  process_cost_inr,created_by)
SELECT PO.process_operation_id,P.part_id,CONCAT('PD-',LPAD(PO.process_operation_id,4,'0')),
  PO.operation_master_id,PO.operation_description,PO.source_type,PO.machine_type_id,
  PO.cycle_time_seconds,PO.clamping_time_seconds,PO.setting_time_hours,PO.outsource_cost_inr,
  PO.process_cost_inr,PO.created_by
FROM part_process_operation PO
JOIN part_process_plan P ON P.process_plan_id=PO.process_plan_id
LEFT JOIN part_process_definition D ON D.process_definition_id=PO.process_operation_id
WHERE D.process_definition_id IS NULL;

UPDATE part_process_operation
SET process_definition_id=process_operation_id
WHERE process_definition_id IS NULL
  AND process_operation_id>0;

SET @has_process_definition_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation' AND INDEX_NAME='ix_process_operation_definition'
);
SET @process_definition_index_sql := IF(@has_process_definition_index=0,
  'ALTER TABLE part_process_operation ADD KEY ix_process_operation_definition (process_definition_id)',
  'SELECT 1');
PREPARE process_definition_index_statement FROM @process_definition_index_sql;
EXECUTE process_definition_index_statement;
DEALLOCATE PREPARE process_definition_index_statement;

SET @has_process_definition_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND CONSTRAINT_NAME='fk_process_operation_definition'
);
SET @process_definition_fk_sql := IF(@has_process_definition_fk=0,
  'ALTER TABLE part_process_operation ADD CONSTRAINT fk_process_operation_definition FOREIGN KEY (process_definition_id) REFERENCES part_process_definition(process_definition_id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE process_definition_fk_statement FROM @process_definition_fk_sql;
EXECUTE process_definition_fk_statement;
DEALLOCATE PREPARE process_definition_fk_statement;

-- ============================================================================
-- Selected Process Plan links for Workouts and Quotations
-- Source: process-plan-consumer-links-migration.sql
-- ============================================================================

-- Preserve the selected Process Plan Variant in costing and quotation transactions.

SET @has_workout_process_plan := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workouts' AND COLUMN_NAME='process_plan_id'
);
SET @workout_process_plan_sql := IF(@has_workout_process_plan=0,
  'ALTER TABLE marketing_workouts ADD COLUMN process_plan_id BIGINT UNSIGNED NULL AFTER enquiry_part_id',
  'SELECT 1');
PREPARE workout_process_plan_statement FROM @workout_process_plan_sql;
EXECUTE workout_process_plan_statement;
DEALLOCATE PREPARE workout_process_plan_statement;

SET @has_workout_process_plan_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workouts' AND INDEX_NAME='ix_workout_process_plan'
);
SET @workout_process_plan_index_sql := IF(@has_workout_process_plan_index=0,
  'ALTER TABLE marketing_workouts ADD KEY ix_workout_process_plan (process_plan_id)',
  'SELECT 1');
PREPARE workout_process_plan_index_statement FROM @workout_process_plan_index_sql;
EXECUTE workout_process_plan_index_statement;
DEALLOCATE PREPARE workout_process_plan_index_statement;

SET @has_workout_process_plan_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='marketing_workouts'
    AND CONSTRAINT_NAME='fk_workout_process_plan'
);
SET @workout_process_plan_fk_sql := IF(@has_workout_process_plan_fk=0,
  'ALTER TABLE marketing_workouts ADD CONSTRAINT fk_workout_process_plan FOREIGN KEY (process_plan_id) REFERENCES part_process_plan(process_plan_id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE workout_process_plan_fk_statement FROM @workout_process_plan_fk_sql;
EXECUTE workout_process_plan_fk_statement;
DEALLOCATE PREPARE workout_process_plan_fk_statement;

UPDATE marketing_workouts W
JOIN marketing_enquiry_parts EP ON EP.enquiry_part_id=W.enquiry_part_id
JOIN part_process_plan PP ON PP.part_id=EP.part_id AND PP.is_default='Y' AND PP.active_flag='Y'
SET W.process_plan_id=PP.process_plan_id
WHERE W.process_plan_id IS NULL
  AND W.workout_id>0;

SET @has_quotation_process_plan := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_quotation_items' AND COLUMN_NAME='process_plan_id'
);
SET @quotation_process_plan_sql := IF(@has_quotation_process_plan=0,
  'ALTER TABLE marketing_quotation_items ADD COLUMN process_plan_id BIGINT UNSIGNED NULL AFTER workout_id',
  'SELECT 1');
PREPARE quotation_process_plan_statement FROM @quotation_process_plan_sql;
EXECUTE quotation_process_plan_statement;
DEALLOCATE PREPARE quotation_process_plan_statement;

SET @has_quotation_process_plan_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_quotation_items' AND INDEX_NAME='ix_quotation_item_process_plan'
);
SET @quotation_process_plan_index_sql := IF(@has_quotation_process_plan_index=0,
  'ALTER TABLE marketing_quotation_items ADD KEY ix_quotation_item_process_plan (process_plan_id)',
  'SELECT 1');
PREPARE quotation_process_plan_index_statement FROM @quotation_process_plan_index_sql;
EXECUTE quotation_process_plan_index_statement;
DEALLOCATE PREPARE quotation_process_plan_index_statement;

SET @has_quotation_process_plan_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='marketing_quotation_items'
    AND CONSTRAINT_NAME='fk_quotation_item_process_plan'
);
SET @quotation_process_plan_fk_sql := IF(@has_quotation_process_plan_fk=0,
  'ALTER TABLE marketing_quotation_items ADD CONSTRAINT fk_quotation_item_process_plan FOREIGN KEY (process_plan_id) REFERENCES part_process_plan(process_plan_id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE quotation_process_plan_fk_statement FROM @quotation_process_plan_fk_sql;
EXECUTE quotation_process_plan_fk_statement;
DEALLOCATE PREPARE quotation_process_plan_fk_statement;

UPDATE marketing_quotation_items QI
JOIN marketing_workouts W ON W.workout_id=QI.workout_id
SET QI.process_plan_id=W.process_plan_id
WHERE QI.process_plan_id IS NULL
  AND QI.quotation_item_id>0;

-- ============================================================================
-- Retired Item Master fields and Raw Material-only Material/Grade
-- Source: item-master-field-removal-migration.sql
-- ============================================================================

-- Remove retired Item Master attributes and restrict Material/Grade to Raw Material.

DROP TABLE IF EXISTS item_customer;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id=I.item_group_id
SET I.material_id=NULL,I.material_grade_id=NULL
WHERE G.group_code<>'RM'
  AND I.item_id>0;

DELETE FROM item_reference_value
WHERE reference_group IN ('MAKE_BUY','STOCK_CLASSIFICATION','VALUATION_METHOD')
  AND item_reference_value_id>0;

SET @sql=IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='make_buy_classification'),
  'ALTER TABLE item_master DROP COLUMN make_buy_classification','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql=IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='stock_classification'),
  'ALTER TABLE item_master DROP COLUMN stock_classification','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql=IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='valuation_method'),
  'ALTER TABLE item_master DROP COLUMN valuation_method','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Consumables-only Shelf Life Yes/No flag
-- Source: consumable-shelf-life-radio-migration.sql
-- ============================================================================

-- Consumables-only Shelf Life Yes/No with days required when applicable.

SET @sql=IF(NOT EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_applicable'),
  'ALTER TABLE item_master ADD COLUMN shelf_life_applicable ENUM(''Y'',''N'') NOT NULL DEFAULT ''N'' AFTER storage_location','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql=IF(NOT EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_days'),
  'ALTER TABLE item_master ADD COLUMN shelf_life_days INT UNSIGNED NULL AFTER shelf_life_applicable','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id=I.item_group_id
SET I.shelf_life_applicable='N',I.shelf_life_days=NULL
WHERE G.group_code<>'CM'
  AND I.item_id>0;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id=I.item_group_id
SET I.shelf_life_days=NULL
WHERE G.group_code='CM'
  AND I.shelf_life_applicable='N'
  AND I.item_id>0;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- Every migration_status value must be PRESENT and both invalid-link counts 0.
-- ============================================================================
SELECT requirement,CASE WHEN available_count>0 THEN 'PRESENT' ELSE 'MISSING' END AS migration_status
FROM (
  SELECT 'part_process_definition table' requirement,COUNT(*) available_count
  FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='part_process_definition'
  UNION ALL SELECT 'part_process_plan.plan_code',COUNT(*) FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='part_process_plan' AND column_name='plan_code'
  UNION ALL SELECT 'part_process_operation.process_definition_id',COUNT(*) FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='part_process_operation' AND column_name='process_definition_id'
  UNION ALL SELECT 'marketing_workouts.process_plan_id',COUNT(*) FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='marketing_workouts' AND column_name='process_plan_id'
  UNION ALL SELECT 'marketing_quotation_items.process_plan_id',COUNT(*) FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='marketing_quotation_items' AND column_name='process_plan_id'
  UNION ALL SELECT 'item_master.shelf_life_applicable',COUNT(*) FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_applicable'
  UNION ALL SELECT 'item_master.shelf_life_days',COUNT(*) FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_days'
) V;

SELECT
  (SELECT COUNT(*) FROM item_master I JOIN item_group_master G ON G.item_group_id=I.item_group_id
    WHERE G.group_code<>'RM' AND (I.material_id IS NOT NULL OR I.material_grade_id IS NOT NULL))
    AS non_raw_items_with_material_grade,
  (SELECT COUNT(*) FROM item_master I JOIN item_group_master G ON G.item_group_id=I.item_group_id
    WHERE (G.group_code<>'CM' AND (I.shelf_life_applicable='Y' OR I.shelf_life_days IS NOT NULL))
       OR (G.group_code='CM' AND ((I.shelf_life_applicable='Y' AND COALESCE(I.shelf_life_days,0)=0)
                              OR (I.shelf_life_applicable='N' AND I.shelf_life_days IS NOT NULL))))
    AS items_with_invalid_shelf_life;

SELECT 'Production delta after 2026-08-13 applied successfully.' AS result;
