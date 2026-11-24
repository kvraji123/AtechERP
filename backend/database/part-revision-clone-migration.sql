-- Drawing-revision Part clone workflow.
-- Safe to re-run in MySQL 5.7+ / MySQL 8.0+.

SET @atech_part_revision_status_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='part_status'
      AND COLUMN_TYPE LIKE '%DRAWING_UNDER_REVISION%'),
  'SELECT 1',
  "ALTER TABLE part_master MODIFY COLUMN part_status ENUM('ACTIVE','INACTIVE','DRAWING_UNDER_REVISION') NOT NULL DEFAULT 'ACTIVE'"
);
PREPARE atech_part_revision_status_statement FROM @atech_part_revision_status_sql;
EXECUTE atech_part_revision_status_statement;
DEALLOCATE PREPARE atech_part_revision_status_statement;

SET @atech_part_revision_source_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='revision_source_part_id'),
  'SELECT 1',
  'ALTER TABLE part_master ADD COLUMN revision_source_part_id BIGINT UNSIGNED NULL AFTER active_flag'
);
PREPARE atech_part_revision_source_statement FROM @atech_part_revision_source_sql;
EXECUTE atech_part_revision_source_statement;
DEALLOCATE PREPARE atech_part_revision_source_statement;

SET @atech_part_bom_release_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='bom_release_status'),
  'SELECT 1',
  "ALTER TABLE part_master ADD COLUMN bom_release_status ENUM('DRAFT','RELEASED','NOT_REQUIRED') NOT NULL DEFAULT 'NOT_REQUIRED' AFTER revision_source_part_id"
);
PREPARE atech_part_bom_release_statement FROM @atech_part_bom_release_sql;
EXECUTE atech_part_bom_release_statement;
DEALLOCATE PREPARE atech_part_bom_release_statement;

SET @atech_part_bom_released_by_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='bom_released_by'),
  'SELECT 1',
  'ALTER TABLE part_master ADD COLUMN bom_released_by VARCHAR(50) NULL AFTER bom_release_status'
);
PREPARE atech_part_bom_released_by_statement FROM @atech_part_bom_released_by_sql;
EXECUTE atech_part_bom_released_by_statement;
DEALLOCATE PREPARE atech_part_bom_released_by_statement;

SET @atech_part_bom_released_on_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME='bom_released_on'),
  'SELECT 1',
  'ALTER TABLE part_master ADD COLUMN bom_released_on DATETIME NULL AFTER bom_released_by'
);
PREPARE atech_part_bom_released_on_statement FROM @atech_part_bom_released_on_sql;
EXECUTE atech_part_bom_released_on_statement;
DEALLOCATE PREPARE atech_part_bom_released_on_statement;

SET @atech_part_revision_source_index_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND INDEX_NAME='ix_part_revision_source'),
  'SELECT 1',
  'ALTER TABLE part_master ADD KEY ix_part_revision_source (revision_source_part_id)'
);
PREPARE atech_part_revision_source_index_statement FROM @atech_part_revision_source_index_sql;
EXECUTE atech_part_revision_source_index_statement;
DEALLOCATE PREPARE atech_part_revision_source_index_statement;

SET @atech_part_revision_source_fk_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND CONSTRAINT_NAME='fk_part_revision_source'),
  'SELECT 1',
  'ALTER TABLE part_master ADD CONSTRAINT fk_part_revision_source FOREIGN KEY (revision_source_part_id) REFERENCES part_master(part_id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE atech_part_revision_source_fk_statement FROM @atech_part_revision_source_fk_sql;
EXECUTE atech_part_revision_source_fk_statement;
DEALLOCATE PREPARE atech_part_revision_source_fk_statement;
