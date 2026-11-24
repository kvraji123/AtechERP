-- Process document approval workflow
-- Run this once against the LOCAL MySQL database before starting the updated backend.
-- It is safe to run more than once.

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
PREPARE tool_list_data_statement FROM @tool_list_data_sql;
EXECUTE tool_list_data_statement;
DEALLOCATE PREPARE tool_list_data_statement;

SET @has_program_data := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
    AND COLUMN_NAME='program_data'
);
SET @program_data_sql := IF(@has_process_definition_table=1 AND @has_program_data=0,
  'ALTER TABLE part_process_definition ADD COLUMN program_data JSON NULL',
  'SELECT 1');
PREPARE program_data_statement FROM @program_data_sql;
EXECUTE program_data_statement;
DEALLOCATE PREPARE program_data_statement;

SET @has_document_approval_data := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_definition'
    AND COLUMN_NAME='document_approval_data'
);
SET @document_approval_data_sql := IF(@has_process_definition_table=1 AND @has_document_approval_data=0,
  'ALTER TABLE part_process_definition ADD COLUMN document_approval_data JSON NULL',
  'SELECT 1');
PREPARE document_approval_data_statement FROM @document_approval_data_sql;
EXECUTE document_approval_data_statement;
DEALLOCATE PREPARE document_approval_data_statement;

SET @has_inspection_plan_table := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_operation_inspection_plan'
);
SET @has_inspection_approval_status := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_operation_inspection_plan'
    AND COLUMN_NAME='approval_status'
);
SET @inspection_approval_status_sql := IF(@has_inspection_plan_table=1 AND @has_inspection_approval_status=0,
  "ALTER TABLE part_operation_inspection_plan ADD COLUMN approval_status ENUM('DRAFT','APPROVED') NOT NULL DEFAULT 'DRAFT' AFTER plan_status",
  'SELECT 1');
PREPARE inspection_approval_status_statement FROM @inspection_approval_status_sql;
EXECUTE inspection_approval_status_statement;
DEALLOCATE PREPARE inspection_approval_status_statement;

SELECT 'Process document approval migration applied.' AS result;
