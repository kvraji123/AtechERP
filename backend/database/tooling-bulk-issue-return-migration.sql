-- Supports fast issued-tool location tracking for bulk tool issue and return.
-- Safe to run on an existing database after tooling-lifecycle-migration.sql.

-- Add indexes only when they are absent, so Adminer and the npm migration may
-- safely be run again after an interrupted deployment.
SET @tooling_bulk_issue_index_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tooling_stock_movements'
      AND INDEX_NAME='ix_tooling_issue_tracking'),
  'SELECT 1',
  'ALTER TABLE tooling_stock_movements ADD KEY ix_tooling_issue_tracking (tenant_id,movement_type,item_id,to_warehouse_code,to_bin_location,machine_reference,movement_date)'
);
PREPARE tooling_bulk_issue_index_statement FROM @tooling_bulk_issue_index_sql;
EXECUTE tooling_bulk_issue_index_statement;
DEALLOCATE PREPARE tooling_bulk_issue_index_statement;

SET @tooling_bulk_return_index_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tooling_stock_movements'
      AND INDEX_NAME='ix_tooling_return_tracking'),
  'SELECT 1',
  'ALTER TABLE tooling_stock_movements ADD KEY ix_tooling_return_tracking (tenant_id,movement_type,item_id,from_warehouse_code,from_bin_location,machine_reference,movement_date)'
);
PREPARE tooling_bulk_return_index_statement FROM @tooling_bulk_return_index_sql;
EXECUTE tooling_bulk_return_index_statement;
DEALLOCATE PREPARE tooling_bulk_return_index_statement;
