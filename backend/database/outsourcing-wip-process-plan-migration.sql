-- Outsourced-part receipts are identified by Part Master and held outside
-- available inventory until the linked Process Plan operation is completed.
-- Apply after the Part Process Plan, Gate Entry and GRN migrations.

ALTER TABLE purchase_gate_entries ADD COLUMN part_id BIGINT UNSIGNED NULL AFTER customer_id;
ALTER TABLE purchase_gate_entries ADD COLUMN part_number_snapshot VARCHAR(100) NULL AFTER part_id;
ALTER TABLE purchase_gate_entries ADD COLUMN part_name_snapshot VARCHAR(200) NULL AFTER part_number_snapshot;
ALTER TABLE purchase_gate_entries ADD COLUMN part_uom_snapshot VARCHAR(30) NULL AFTER part_name_snapshot;
ALTER TABLE purchase_gate_entries MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE purchase_gate_entries ADD KEY ix_gate_entry_part (tenant_id, part_id);
ALTER TABLE purchase_gate_entries ADD CONSTRAINT fk_gate_entry_part FOREIGN KEY (part_id)
  REFERENCES part_master(part_id) ON DELETE RESTRICT;

-- A part-based outsourcing receipt does not use an Item Master line.  Existing
-- regular, open-purchase and customer-supplied receipt lines remain unchanged.
ALTER TABLE goods_receipt_note_items
  MODIFY COLUMN item_id BIGINT UNSIGNED NULL;

ALTER TABLE goods_receipt_notes MODIFY COLUMN inspection_status VARCHAR(40) NOT NULL DEFAULT 'PENDING';
ALTER TABLE goods_receipt_notes MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE goods_receipt_notes ADD COLUMN outsourcing_part_id BIGINT UNSIGNED NULL AFTER customer_id;
ALTER TABLE goods_receipt_notes ADD COLUMN outsourcing_part_number_snapshot VARCHAR(100) NULL AFTER outsourcing_part_id;
ALTER TABLE goods_receipt_notes ADD COLUMN outsourcing_part_name_snapshot VARCHAR(200) NULL AFTER outsourcing_part_number_snapshot;
ALTER TABLE goods_receipt_notes ADD COLUMN outsourcing_part_uom_snapshot VARCHAR(30) NULL AFTER outsourcing_part_name_snapshot;
ALTER TABLE goods_receipt_notes ADD COLUMN outsourcing_process_plan_id BIGINT UNSIGNED NULL AFTER outsourcing_part_uom_snapshot;
ALTER TABLE goods_receipt_notes ADD COLUMN outsourcing_process_operation_id BIGINT UNSIGNED NULL AFTER outsourcing_process_plan_id;
ALTER TABLE goods_receipt_notes ADD KEY ix_grn_outsourcing_part (tenant_id, outsourcing_part_id);
ALTER TABLE goods_receipt_notes ADD KEY ix_grn_outsourcing_operation (tenant_id, outsourcing_process_operation_id);
ALTER TABLE goods_receipt_notes ADD CONSTRAINT fk_grn_outsourcing_part FOREIGN KEY (outsourcing_part_id)
  REFERENCES part_master(part_id) ON DELETE RESTRICT;
ALTER TABLE goods_receipt_notes ADD CONSTRAINT fk_grn_outsourcing_process_plan FOREIGN KEY (outsourcing_process_plan_id)
  REFERENCES part_process_plan(process_plan_id) ON DELETE RESTRICT;
ALTER TABLE goods_receipt_notes ADD CONSTRAINT fk_grn_outsourcing_process_operation FOREIGN KEY (outsourcing_process_operation_id)
  REFERENCES part_process_operation(process_operation_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS outsourcing_wip_balance (
  outsourcing_wip_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  gate_entry_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  part_id BIGINT UNSIGNED NOT NULL,
  part_number_snapshot VARCHAR(100) NOT NULL,
  part_name_snapshot VARCHAR(200) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  batch_serial_number VARCHAR(120) NOT NULL,
  process_plan_id BIGINT UNSIGNED NOT NULL,
  process_operation_id BIGINT UNSIGNED NOT NULL,
  process_plan_code_snapshot VARCHAR(50) NULL,
  operation_number_snapshot INT NOT NULL,
  operation_name_snapshot VARCHAR(200) NOT NULL,
  inspection_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  received_quantity DECIMAL(18,3) NOT NULL,
  quantity_in_wip DECIMAL(18,3) NOT NULL,
  wip_status ENUM('AWAITING_PROCESS_OPERATION','IN_PROCESS','PROCESS_INSPECTION_PENDING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'AWAITING_PROCESS_OPERATION',
  inspection_status ENUM('NOT_STARTED','PENDING','PASSED','FAILED') NOT NULL DEFAULT 'NOT_STARTED',
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (outsourcing_wip_balance_id),
  UNIQUE KEY uq_outsourcing_wip_grn_item (tenant_id, grn_item_id),
  KEY ix_outsourcing_wip_queue (tenant_id, wip_status, process_operation_id),
  KEY ix_outsourcing_wip_part (tenant_id, part_id, wip_status),
  CONSTRAINT fk_outsourcing_wip_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE RESTRICT,
  CONSTRAINT fk_outsourcing_wip_grn_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_outsourcing_wip_gate_entry FOREIGN KEY (gate_entry_id)
    REFERENCES purchase_gate_entries(gate_entry_id) ON DELETE RESTRICT,
  CONSTRAINT fk_outsourcing_wip_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master(supplier_id) ON DELETE RESTRICT,
  CONSTRAINT fk_outsourcing_wip_part FOREIGN KEY (part_id)
    REFERENCES part_master(part_id) ON DELETE RESTRICT,
  CONSTRAINT fk_outsourcing_wip_plan FOREIGN KEY (process_plan_id)
    REFERENCES part_process_plan(process_plan_id) ON DELETE RESTRICT,
  CONSTRAINT fk_outsourcing_wip_operation FOREIGN KEY (process_operation_id)
    REFERENCES part_process_operation(process_operation_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outsourcing_wip_transaction (
  outsourcing_wip_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  outsourcing_wip_balance_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('GRN_WIP_RECEIPT','PROCESS_START','PROCESS_INSPECTION_PASS','PROCESS_INSPECTION_FAIL','WIP_ADJUSTMENT') NOT NULL,
  transaction_date DATE NOT NULL,
  quantity_in DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  quantity_out DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  balance_after_quantity DECIMAL(18,3) NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (outsourcing_wip_transaction_id),
  KEY ix_outsourcing_wip_transaction (tenant_id, outsourcing_wip_balance_id, transaction_date),
  CONSTRAINT fk_outsourcing_wip_transaction_balance FOREIGN KEY (outsourcing_wip_balance_id)
    REFERENCES outsourcing_wip_balance(outsourcing_wip_balance_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
