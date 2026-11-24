-- Adds a purchaser-entered specification note to each PO line.
-- Safe to run repeatedly on an existing production database from Adminer.
SET @purchase_order_other_specification_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items'
      AND COLUMN_NAME='other_specification'),
  'SELECT ''purchase_order_items.other_specification already exists'' AS result',
  'ALTER TABLE purchase_order_items ADD COLUMN other_specification VARCHAR(1000) NULL AFTER item_specification_snapshot'
);
PREPARE purchase_order_other_specification_statement FROM @purchase_order_other_specification_sql;
EXECUTE purchase_order_other_specification_statement;
DEALLOCATE PREPARE purchase_order_other_specification_statement;
