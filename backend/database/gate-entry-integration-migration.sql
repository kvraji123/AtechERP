-- Persistent Gate Entry records linked to approved purchase orders.
CREATE TABLE IF NOT EXISTS purchase_gate_entries (
  gate_entry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  gate_entry_number VARCHAR(50) NOT NULL,
  entry_datetime DATETIME NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_code_snapshot VARCHAR(80) NULL,
  supplier_name_snapshot VARCHAR(200) NOT NULL,
  vehicle_number VARCHAR(50) NULL,
  driver_name VARCHAR(150) NULL,
  driving_licence_number VARCHAR(80) NULL,
  status ENUM('DRAFT','GATE_ENTERED','GRN_CREATED','STOCK_POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (gate_entry_id),
  UNIQUE KEY uq_gate_entry_number (tenant_id, gate_entry_number),
  KEY ix_gate_entry_queue (tenant_id, status, entry_datetime),
  CONSTRAINT fk_gate_entry_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (purchase_order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_gate_entry_supplier FOREIGN KEY (supplier_id) REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS gate_entry_id BIGINT UNSIGNED NULL AFTER gate_entry_number;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS supplier_invoice_number VARCHAR(100) NULL AFTER supplier_name_snapshot;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE NULL AFTER supplier_invoice_number;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS delivery_challan_number VARCHAR(100) NULL AFTER supplier_invoice_date;
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS received_by VARCHAR(100) NULL AFTER delivery_challan_number;
ALTER TABLE goods_receipt_notes ADD KEY IF NOT EXISTS ix_grn_gate_entry (tenant_id, gate_entry_id);
ALTER TABLE goods_receipt_notes ADD CONSTRAINT fk_grn_gate_entry FOREIGN KEY (gate_entry_id) REFERENCES purchase_gate_entries (gate_entry_id) ON DELETE SET NULL;
