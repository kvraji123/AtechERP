-- Supplier category / process classification for new Supplier Master records.
-- Existing suppliers are intentionally left uncategorized.
-- Safe to re-run in MySQL 5.7+ / MySQL 8.0+.

SET @atech_supplier_category_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'supplier_master'
      AND COLUMN_NAME = 'supplier_category'
  ),
  'SELECT 1',
  'ALTER TABLE supplier_master ADD COLUMN supplier_category VARCHAR(50) NULL AFTER supplier_type'
);
PREPARE atech_supplier_category_statement FROM @atech_supplier_category_sql;
EXECUTE atech_supplier_category_statement;
DEALLOCATE PREPARE atech_supplier_category_statement;

SET @atech_supplier_category_index_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'supplier_master'
      AND INDEX_NAME = 'ix_supplier_category_active'
  ),
  'SELECT 1',
  'ALTER TABLE supplier_master ADD KEY ix_supplier_category_active (supplier_category, active_flag)'
);
PREPARE atech_supplier_category_index_statement FROM @atech_supplier_category_index_sql;
EXECUTE atech_supplier_category_index_statement;
DEALLOCATE PREPARE atech_supplier_category_index_statement;
