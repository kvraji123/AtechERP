-- Permit an inspection-plan characteristic to be selected from the master or stored as plan-specific free text.

SET @has_part_inspection_table := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
);
SET @has_part_characteristic_text := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND COLUMN_NAME='characteristic_text'
);
SET @part_characteristic_text_sql := IF(@has_part_inspection_table=1 AND @has_part_characteristic_text=0,
  'ALTER TABLE part_inspection_characteristic ADD COLUMN characteristic_text VARCHAR(150) NULL AFTER characteristic_master_id',
  'SELECT 1');
PREPARE part_characteristic_text_statement FROM @part_characteristic_text_sql;
EXECUTE part_characteristic_text_statement;
DEALLOCATE PREPARE part_characteristic_text_statement;

SET @has_item_inspection_table := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='item_incoming_inspection_characteristic'
);
SET @item_characteristic_nullable_sql := IF(@has_item_inspection_table=1,
  'ALTER TABLE item_incoming_inspection_characteristic MODIFY COLUMN characteristic_master_id BIGINT UNSIGNED NULL',
  'SELECT 1');
PREPARE item_characteristic_nullable_statement FROM @item_characteristic_nullable_sql;
EXECUTE item_characteristic_nullable_statement;
DEALLOCATE PREPARE item_characteristic_nullable_statement;

SET @has_item_characteristic_text := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='item_incoming_inspection_characteristic'
    AND COLUMN_NAME='characteristic_text'
);
SET @item_characteristic_text_sql := IF(@has_item_inspection_table=1 AND @has_item_characteristic_text=0,
  'ALTER TABLE item_incoming_inspection_characteristic ADD COLUMN characteristic_text VARCHAR(150) NULL AFTER characteristic_master_id',
  'SELECT 1');
PREPARE item_characteristic_text_statement FROM @item_characteristic_text_sql;
EXECUTE item_characteristic_text_statement;
DEALLOCATE PREPARE item_characteristic_text_statement;
