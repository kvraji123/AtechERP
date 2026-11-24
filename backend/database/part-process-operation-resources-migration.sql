-- Operation-level manufacturing resources for Part Master Process Plans.
-- MySQL 8.0+ / Adminer-safe. This is idempotent and preserves existing data.
--
-- Tool List and Program Number belong to part_process_definition because the
-- definition is shared by every capacity/route variant that uses the same
-- operation. Work-instruction files are stored as application_attachments
-- using entity_type = PART_PROCESS_DEFINITION.

SET @has_process_definition_table := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
);

SET @has_tool_list := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition' AND COLUMN_NAME='tool_list'
);
SET @tool_list_sql := IF(@has_process_definition_table=1 AND @has_tool_list=0,
  'ALTER TABLE part_process_definition ADD COLUMN tool_list VARCHAR(2000) NULL AFTER process_cost_inr',
  'SELECT 1');
PREPARE part_process_tool_list_statement FROM @tool_list_sql;
EXECUTE part_process_tool_list_statement;
DEALLOCATE PREPARE part_process_tool_list_statement;

SET @has_program_number := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition' AND COLUMN_NAME='program_number'
);
SET @program_number_sql := IF(@has_process_definition_table=1 AND @has_program_number=0,
  'ALTER TABLE part_process_definition ADD COLUMN program_number VARCHAR(255) NULL AFTER tool_list',
  'SELECT 1');
PREPARE part_process_program_number_statement FROM @program_number_sql;
EXECUTE part_process_program_number_statement;
DEALLOCATE PREPARE part_process_program_number_statement;

SELECT 'Part Process Tool List / Program Number migration completed.' AS result;
