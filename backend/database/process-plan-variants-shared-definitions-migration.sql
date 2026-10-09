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
