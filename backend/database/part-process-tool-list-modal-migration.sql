-- Inbuilt Tool List modal data for Part Master Process Plans.
-- MySQL 8.0+ / Adminer-safe. Run once after the Part Process Definition migration.

SET @has_process_definition_table := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
);

SET @has_tool_list_data := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
    AND COLUMN_NAME='tool_list_data'
);

SET @tool_list_data_sql := IF(@has_process_definition_table=1 AND @has_tool_list_data=0,
  'ALTER TABLE part_process_definition ADD COLUMN tool_list_data JSON NULL',
  'SELECT 1');
PREPARE part_process_tool_list_data_statement FROM @tool_list_data_sql;
EXECUTE part_process_tool_list_data_statement;
DEALLOCATE PREPARE part_process_tool_list_data_statement;

SELECT 'Part Process Tool List modal migration completed.' AS result;
