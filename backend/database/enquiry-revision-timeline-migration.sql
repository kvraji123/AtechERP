-- Extend Enquiry Revision History to include every marketing workflow stage.
-- Safe to import into an existing MySQL database through Adminer or phpMyAdmin.

SET @atech_enquiry_timeline_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'marketing_enquiry_revisions'
      AND COLUMN_NAME = 'revision_action'
      AND COLUMN_TYPE NOT LIKE '%FEASIBILITY_SAVED%'
  ),
  'ALTER TABLE marketing_enquiry_revisions MODIFY COLUMN revision_action ENUM(''CREATED'', ''UPDATED'', ''SUBMITTED'', ''MIGRATED'', ''FEASIBILITY_SAVED'', ''FEASIBILITY_CLOSED'', ''WORKOUT_SAVED'', ''WORKOUT_COMPLETED'', ''QUOTATION_SAVED'', ''QUOTATION_FINALIZED'', ''ENQUIRY_ATTACHMENT_ADDED'', ''ENQUIRY_ATTACHMENT_UPDATED'', ''ENQUIRY_ATTACHMENT_REMOVED'') NOT NULL DEFAULT ''UPDATED''',
  'SELECT 1'
);

PREPARE atech_enquiry_timeline_statement FROM @atech_enquiry_timeline_sql;
EXECUTE atech_enquiry_timeline_statement;
DEALLOCATE PREPARE atech_enquiry_timeline_statement;
