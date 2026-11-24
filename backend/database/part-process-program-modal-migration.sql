-- Inbuilt Program modal data for Part Master Process Plans.
-- MySQL 8.0+ / Adminer-safe. Run once after the Part Process Definition migration.

SET @has_process_definition_table := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
);

SET @has_program_data := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
    AND COLUMN_NAME='program_data'
);

SET @program_data_sql := IF(@has_process_definition_table=1 AND @has_program_data=0,
  'ALTER TABLE part_process_definition ADD COLUMN program_data JSON NULL',
  'SELECT 1');
PREPARE part_process_program_data_statement FROM @program_data_sql;
EXECUTE part_process_program_data_statement;
DEALLOCATE PREPARE part_process_program_data_statement;

SELECT 'Part Process Program modal migration completed.' AS result;
