-- Run after the existing GRN receipt type, open purchase and stock migrations.
ALTER TABLE goods_receipt_notes MODIFY COLUMN supplier_id BIGINT UNSIGNED NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS purchase_reason VARCHAR(500) NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS job_reference VARCHAR(120) NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS purchase_approved_by VARCHAR(50) NULL;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS purchase_approved_at DATETIME NULL;
ALTER TABLE inventory_stock_balance ADD COLUMN IF NOT EXISTS stock_owner_type VARCHAR(16) NOT NULL DEFAULT 'COMPANY';
ALTER TABLE inventory_stock_balance ADD COLUMN IF NOT EXISTS stock_owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE inventory_stock_transaction ADD COLUMN IF NOT EXISTS stock_owner_type VARCHAR(16) NOT NULL DEFAULT 'COMPANY';
ALTER TABLE inventory_stock_transaction ADD COLUMN IF NOT EXISTS stock_owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE inventory_stock_balance DROP INDEX IF EXISTS uq_inventory_stock_balance_location;
ALTER TABLE inventory_stock_balance ADD UNIQUE KEY IF NOT EXISTS uq_inventory_stock_balance_location
  (tenant_id,plant_id,item_id,warehouse_code,bin_location,batch_serial_number,stock_owner_type,stock_owner_id);
