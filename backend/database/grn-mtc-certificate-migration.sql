-- Snapshot the Item Master MTC requirement on every GRN line.
-- This must be applied after item-mtc-applicable-migration.sql.
-- It is safe to import repeatedly through Adminer.
SET @atech_grn_mtc_sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'goods_receipt_note_items'
      AND COLUMN_NAME = 'mtc_applicable'
  ),
  'SELECT 1',
  'ALTER TABLE goods_receipt_note_items ADD COLUMN mtc_applicable ENUM(''Y'', ''N'') NOT NULL DEFAULT ''N'' AFTER replacement_required'
);

PREPARE atech_grn_mtc_statement FROM @atech_grn_mtc_sql;
EXECUTE atech_grn_mtc_statement;
DEALLOCATE PREPARE atech_grn_mtc_statement;

-- Existing GRN rows receive the current Item Master setting. Future GRNs keep
-- their own snapshot even if the Item Master is changed later.
UPDATE goods_receipt_note_items GI
LEFT JOIN item_master I ON I.item_id = GI.item_id
SET GI.mtc_applicable = COALESCE(I.mtc_applicable, 'N');
