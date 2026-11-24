-- Material Test Certificate (MTC) applies only to Raw Material (RM) items.
-- Safe to run repeatedly in Adminer.
SET @atech_item_mtc_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'item_master'
      AND COLUMN_NAME = 'mtc_applicable'
  ),
  'SELECT 1',
  'ALTER TABLE item_master ADD COLUMN mtc_applicable ENUM(''Y'', ''N'') NOT NULL DEFAULT ''N'' AFTER material_grade_id'
);

PREPARE atech_item_mtc_statement FROM @atech_item_mtc_sql;
EXECUTE atech_item_mtc_statement;
DEALLOCATE PREPARE atech_item_mtc_statement;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id = I.item_group_id
SET I.mtc_applicable = 'N'
WHERE G.group_code <> 'RM'
  AND I.item_id > 0;
