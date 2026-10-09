-- Consumables-only Shelf Life Yes/No with days required when applicable.

SET @sql=IF(NOT EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_applicable'),
  'ALTER TABLE item_master ADD COLUMN shelf_life_applicable ENUM(''Y'',''N'') NOT NULL DEFAULT ''N'' AFTER storage_location','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql=IF(NOT EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_days'),
  'ALTER TABLE item_master ADD COLUMN shelf_life_days INT UNSIGNED NULL AFTER shelf_life_applicable','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id=I.item_group_id
SET I.shelf_life_applicable='N',I.shelf_life_days=NULL
WHERE G.group_code<>'CM'
  AND I.item_id>0;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id=I.item_group_id
SET I.shelf_life_days=NULL
WHERE G.group_code='CM'
  AND I.shelf_life_applicable='N'
  AND I.item_id>0;
