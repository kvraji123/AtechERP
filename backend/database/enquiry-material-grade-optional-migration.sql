-- Make the Enquiry Material and Grade field optional.
-- Safe to import into an existing MySQL database through Adminer or phpMyAdmin.

SET @atech_material_grade_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'marketing_enquiry_parts'
      AND COLUMN_NAME = 'material_and_grade'
      AND IS_NULLABLE = 'NO'
  ),
  'ALTER TABLE marketing_enquiry_parts MODIFY COLUMN material_and_grade VARCHAR(300) NULL',
  'SELECT 1'
);

PREPARE atech_material_grade_statement FROM @atech_material_grade_sql;
EXECUTE atech_material_grade_statement;
DEALLOCATE PREPARE atech_material_grade_statement;
