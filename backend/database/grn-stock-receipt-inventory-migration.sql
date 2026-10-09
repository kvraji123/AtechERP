-- Persistent stock receipt and inventory ledger for accepted GRN lines.
-- Run after purchase-module-migration.sql and grn-inspection-disposition-migration.sql.

ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS stock_posting_date DATE NULL AFTER received_by,
  ADD COLUMN IF NOT EXISTS stock_posted_by VARCHAR(50) NULL AFTER stock_posting_date;

ALTER TABLE goods_receipt_note_items
  ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(80) NULL AFTER quality_remarks,
  ADD COLUMN IF NOT EXISTS bin_location VARCHAR(80) NULL AFTER warehouse_code,
  ADD COLUMN IF NOT EXISTS batch_serial_number VARCHAR(120) NULL AFTER bin_location;

CREATE TABLE IF NOT EXISTS inventory_stock_balance (
  inventory_stock_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL,
  bin_location VARCHAR(80) NOT NULL,
  batch_serial_number VARCHAR(120) NOT NULL DEFAULT '',
  quantity_on_hand DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (inventory_stock_balance_id),
  UNIQUE KEY uq_inventory_stock_balance_location (tenant_id,plant_id,item_id,warehouse_code,bin_location,batch_serial_number),
  KEY ix_inventory_stock_balance_item (tenant_id,item_id),
  CONSTRAINT fk_inventory_stock_balance_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_stock_transaction (
  inventory_stock_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  transaction_type ENUM('GRN_RECEIPT') NOT NULL,
  transaction_date DATE NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL,
  bin_location VARCHAR(80) NOT NULL,
  batch_serial_number VARCHAR(120) NOT NULL DEFAULT '',
  quantity_in DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  quantity_out DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  balance_after_quantity DECIMAL(18,3) NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inventory_stock_transaction_id),
  UNIQUE KEY uq_inventory_stock_transaction_grn_line (tenant_id,grn_item_id),
  KEY ix_inventory_stock_transaction_item (tenant_id,item_id,transaction_date),
  KEY ix_inventory_stock_transaction_grn (tenant_id,grn_id),
  CONSTRAINT fk_inventory_stock_transaction_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stock_transaction_grn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(grn_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stock_transaction_grn_item FOREIGN KEY (grn_item_id) REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
