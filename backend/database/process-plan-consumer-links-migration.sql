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
