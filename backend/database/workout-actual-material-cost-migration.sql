-- Safe to run in Adminer more than once.
SET @atech_workout_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'marketing_workouts'
      AND COLUMN_NAME = 'actual_material_cost_inr'
  ),
  'SELECT 1',
  'ALTER TABLE marketing_workouts ADD COLUMN actual_material_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER material_cost_inr'
);

PREPARE atech_workout_statement FROM @atech_workout_sql;
EXECUTE atech_workout_statement;
DEALLOCATE PREPARE atech_workout_statement;
