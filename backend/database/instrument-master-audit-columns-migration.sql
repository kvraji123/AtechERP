-- Adds the audit timestamps required by the technical-master list queries.
-- Safe to run repeatedly on an existing MySQL 5.7+ production database.

SET @instrument_master_created_on_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inspection_instrument_master'
      AND COLUMN_NAME='created_on'),
  'SELECT ''inspection_instrument_master.created_on already exists'' AS result',
  'ALTER TABLE inspection_instrument_master ADD COLUMN created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER active_flag'
);
PREPARE instrument_master_created_on_statement FROM @instrument_master_created_on_sql;
EXECUTE instrument_master_created_on_statement;
DEALLOCATE PREPARE instrument_master_created_on_statement;

SET @instrument_master_updated_on_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inspection_instrument_master'
      AND COLUMN_NAME='updated_on'),
  'SELECT ''inspection_instrument_master.updated_on already exists'' AS result',
  'ALTER TABLE inspection_instrument_master ADD COLUMN updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_on'
);
PREPARE instrument_master_updated_on_statement FROM @instrument_master_updated_on_sql;
EXECUTE instrument_master_updated_on_statement;
DEALLOCATE PREPARE instrument_master_updated_on_statement;

SET @tolerance_grade_created_on_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tolerance_grade_master'
      AND COLUMN_NAME='created_on'),
  'SELECT ''tolerance_grade_master.created_on already exists'' AS result',
  'ALTER TABLE tolerance_grade_master ADD COLUMN created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER active_flag'
);
PREPARE tolerance_grade_created_on_statement FROM @tolerance_grade_created_on_sql;
EXECUTE tolerance_grade_created_on_statement;
DEALLOCATE PREPARE tolerance_grade_created_on_statement;

SET @tolerance_grade_updated_on_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tolerance_grade_master'
      AND COLUMN_NAME='updated_on'),
  'SELECT ''tolerance_grade_master.updated_on already exists'' AS result',
  'ALTER TABLE tolerance_grade_master ADD COLUMN updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_on'
);
PREPARE tolerance_grade_updated_on_statement FROM @tolerance_grade_updated_on_sql;
EXECUTE tolerance_grade_updated_on_statement;
DEALLOCATE PREPARE tolerance_grade_updated_on_statement;
