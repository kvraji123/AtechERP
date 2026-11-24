-- Quantity-based Tooling lifecycle.
-- Tool records are normal Item Master records in the Tools & Fixtures (TL) group.
-- No physical Tool ID or serial registration is created by this schema.

CREATE TABLE IF NOT EXISTS tooling_stock_balance (
  tooling_stock_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NOT NULL DEFAULT '',
  item_id BIGINT UNSIGNED NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL,
  bin_location VARCHAR(80) NOT NULL,
  stock_status ENUM('AVAILABLE','HOLD','REGRIND_REQUIRED') NOT NULL DEFAULT 'AVAILABLE',
  quantity_on_hand DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tooling_stock_balance_id),
  UNIQUE KEY uq_tooling_stock_location (tenant_id,plant_id,item_id,warehouse_code,bin_location,stock_status),
  KEY ix_tooling_stock_item (tenant_id,item_id),
  KEY ix_tooling_stock_location (tenant_id,warehouse_code,bin_location),
  CONSTRAINT fk_tooling_stock_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tooling_item_metrics (
  tooling_item_metric_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  regrind_event_count INT UNSIGNED NOT NULL DEFAULT 0,
  regrind_quantity_total DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  last_regrind_date DATE NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tooling_item_metric_id),
  UNIQUE KEY uq_tooling_item_metric (tenant_id,item_id),
  CONSTRAINT fk_tooling_item_metric_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tooling_regrind_batches (
  tooling_regrind_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NOT NULL DEFAULT '',
  dc_number VARCHAR(80) NOT NULL,
  dispatch_date DATE NOT NULL,
  supplier_name VARCHAR(160) NOT NULL,
  expected_return_date DATE NULL,
  courier_vehicle_reference VARCHAR(160) NULL,
  dispatch_warehouse_code VARCHAR(80) NOT NULL DEFAULT 'Tool Crib',
  dispatch_bin_location VARCHAR(80) NOT NULL DEFAULT 'Tooling',
  material_outward_document_id BIGINT UNSIGNED NULL,
  return_grn_number VARCHAR(80) NULL,
  return_gate_entry_id BIGINT UNSIGNED NULL,
  receipt_reference VARCHAR(160) NULL,
  receipt_date DATE NULL,
  status ENUM('DISPATCHED','RECEIVED_PENDING_INSPECTION','CLOSED','CANCELLED') NOT NULL DEFAULT 'DISPATCHED',
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tooling_regrind_batch_id),
  UNIQUE KEY uq_tooling_regrind_dc (tenant_id,dc_number),
  UNIQUE KEY uq_tooling_regrind_return_grn (tenant_id,return_grn_number),
  KEY ix_tooling_regrind_status (tenant_id,status,dispatch_date),
  KEY ix_tooling_regrind_outward_document (material_outward_document_id),
  KEY ix_tooling_regrind_return_gate (return_gate_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tooling_regrind_batch_items (
  tooling_regrind_batch_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  tooling_regrind_batch_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  uom_code_snapshot VARCHAR(30) NULL,
  dispatched_quantity DECIMAL(18,3) NOT NULL,
  received_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  accepted_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  rejected_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  measured_value DECIMAL(18,4) NULL,
  inspection_remarks VARCHAR(1000) NULL,
  rejection_action ENUM('SCRAP','REGRIND_AGAIN','RETURN_TO_TOOL_CRIB') NULL,
  line_status ENUM('DISPATCHED','RECEIVED_PENDING_INSPECTION','CLOSED') NOT NULL DEFAULT 'DISPATCHED',
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tooling_regrind_batch_item_id),
  UNIQUE KEY uq_tooling_regrind_batch_item (tooling_regrind_batch_id,item_id),
  KEY ix_tooling_regrind_item_status (tenant_id,item_id,line_status),
  CONSTRAINT fk_tooling_regrind_item_batch FOREIGN KEY (tooling_regrind_batch_id) REFERENCES tooling_regrind_batches(tooling_regrind_batch_id) ON DELETE RESTRICT,
  CONSTRAINT fk_tooling_regrind_item_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tooling_stock_movements (
  tooling_stock_movement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NOT NULL DEFAULT '',
  item_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('GRN_RECEIPT','ISSUE_TO_PRODUCTION','RETURN_FROM_PRODUCTION','RETURN_DAMAGED_REGRIND','RETURN_LOST','RETURN_SCRAP','REGRIND_DISPATCH','REGRIND_RECEIPT','REGRIND_ACCEPTED','REGRIND_REJECTED_SCRAP','REGRIND_REJECTED_REPEAT','REGRIND_REJECTED_RETURN') NOT NULL,
  movement_date DATE NOT NULL,
  quantity DECIMAL(18,3) NOT NULL,
  from_warehouse_code VARCHAR(80) NULL,
  from_bin_location VARCHAR(80) NULL,
  to_warehouse_code VARCHAR(80) NULL,
  to_bin_location VARCHAR(80) NULL,
  reference_number VARCHAR(160) NULL,
  grn_id BIGINT UNSIGNED NULL,
  grn_item_id BIGINT UNSIGNED NULL,
  tooling_regrind_batch_id BIGINT UNSIGNED NULL,
  tooling_regrind_batch_item_id BIGINT UNSIGNED NULL,
  machine_reference VARCHAR(160) NULL,
  employee_reference VARCHAR(160) NULL,
  operation_reference VARCHAR(160) NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tooling_stock_movement_id),
  UNIQUE KEY uq_tooling_grn_receipt_line (tenant_id,grn_item_id,movement_type),
  KEY ix_tooling_movement_item (tenant_id,item_id,movement_date),
  KEY ix_tooling_movement_batch (tenant_id,tooling_regrind_batch_id),
  CONSTRAINT fk_tooling_movement_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_tooling_movement_batch FOREIGN KEY (tooling_regrind_batch_id) REFERENCES tooling_regrind_batches(tooling_regrind_batch_id) ON DELETE SET NULL,
  CONSTRAINT fk_tooling_movement_batch_item FOREIGN KEY (tooling_regrind_batch_item_id) REFERENCES tooling_regrind_batch_items(tooling_regrind_batch_item_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tooling_regrind_inspection_measurements (
  tooling_regrind_inspection_measurement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  tooling_regrind_batch_item_id BIGINT UNSIGNED NOT NULL,
  item_inspection_characteristic_id BIGINT UNSIGNED NULL,
  sequence_number INT NOT NULL,
  characteristic_name_snapshot VARCHAR(180) NOT NULL,
  specified_dimension DECIMAL(18,4) NULL,
  lsl DECIMAL(18,4) NULL,
  usl DECIMAL(18,4) NULL,
  actual_value VARCHAR(160) NOT NULL,
  inspection_result ENUM('PASS','FAIL') NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tooling_regrind_inspection_measurement_id),
  UNIQUE KEY uq_tooling_regrind_measurement (tooling_regrind_batch_item_id,sequence_number),
  CONSTRAINT fk_tooling_regrind_measurement_item FOREIGN KEY (tooling_regrind_batch_item_id) REFERENCES tooling_regrind_batch_items(tooling_regrind_batch_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing Tool item stock becomes the opening balance of the Tooling lifecycle.
INSERT INTO tooling_stock_balance
  (tenant_id,company_id,plant_id,item_id,warehouse_code,bin_location,stock_status,quantity_on_hand,created_by,updated_by)
SELECT B.tenant_id,MAX(B.company_id),COALESCE(B.plant_id,''),B.item_id,B.warehouse_code,B.bin_location,'AVAILABLE',
       SUM(B.quantity_on_hand),'SYSTEM','SYSTEM'
  FROM inventory_stock_balance B
  JOIN item_master I ON I.item_id=B.item_id
  JOIN item_group_master G ON G.item_group_id=I.item_group_id AND G.group_code='TL'
 WHERE B.stock_owner_type='COMPANY'
   AND B.quantity_on_hand<>0
   AND B.warehouse_code IN ('Tool Crib','Production Stores')
 GROUP BY B.tenant_id,COALESCE(B.plant_id,''),B.item_id,B.warehouse_code,B.bin_location
ON DUPLICATE KEY UPDATE updated_by=VALUES(updated_by);

-- Tool transfers are also written to the standard inventory ledger.
ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN transaction_type VARCHAR(60) NOT NULL,
  MODIFY COLUMN grn_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN grn_item_id BIGINT UNSIGNED NULL;

INSERT INTO app_document_sequences (sequence_key,financial_year,prefix,current_number,number_padding)
VALUES ('TOOL_REGRIND_DC','2026-27','TDC',0,4)
ON DUPLICATE KEY UPDATE prefix=VALUES(prefix),number_padding=VALUES(number_padding);
