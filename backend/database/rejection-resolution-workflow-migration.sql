-- Controlled resolution workflows for customer returns, rework, scrap and authorised deviation release.

ALTER TABLE inventory_rejection_balance
  MODIFY COLUMN status ENUM('OPEN','IN_REWORK','RESOLVED','CANCELLED') NOT NULL DEFAULT 'OPEN';

ALTER TABLE inventory_rejection_transaction
  MODIFY COLUMN transaction_type ENUM(
    'GRN_REJECTION','RETURN_TO_VENDOR','RETURN_TO_CUSTOMER','REWORK','REWORK_RETURN','SCRAP',
    'DEVIATION_RELEASE','ADJUSTMENT','RTV_SUBMITTED','RESOLUTION_SUBMITTED'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS rejection_resolution_requests (
  rejection_resolution_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  resolution_number VARCHAR(80) NOT NULL,
  resolution_action ENUM('RETURN_TO_CUSTOMER','REWORK','SCRAP','DEVIATION_RELEASE') NOT NULL,
  resolution_date DATE NOT NULL,
  resolution_status ENUM('PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','IN_PROGRESS','AWAITING_REINSPECTION','EXECUTED','CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  rejection_inventory_balance_id BIGINT UNSIGNED NOT NULL,
  grn_rejection_id BIGINT UNSIGNED NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  quantity DECIMAL(18,3) NOT NULL,
  item_code_snapshot VARCHAR(80) NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  rejection_reason_snapshot VARCHAR(255) NULL,
  warehouse_code VARCHAR(80) NULL,
  bin_location VARCHAR(80) NULL,
  dispatch_reference VARCHAR(160) NULL,
  transport_reference VARCHAR(160) NULL,
  action_reference VARCHAR(250) NULL,
  remarks VARCHAR(1000) NOT NULL,
  approval_remarks VARCHAR(1000) NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  party_contact VARCHAR(160) NULL,
  acknowledgement_reference VARCHAR(250) NULL,
  acknowledged_by VARCHAR(50) NULL,
  acknowledged_at DATETIME NULL,
  execution_reference VARCHAR(250) NULL,
  executed_by VARCHAR(50) NULL,
  executed_at DATETIME NULL,
  pdf_file_name VARCHAR(255) NULL,
  pdf_file_path VARCHAR(500) NULL,
  pdf_file_size_bytes BIGINT UNSIGNED NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rejection_resolution_request_id),
  UNIQUE KEY uq_rejection_resolution_number (tenant_id, resolution_number),
  KEY ix_rejection_resolution_workflow (tenant_id, resolution_status, resolution_action, created_at),
  KEY ix_rejection_resolution_balance (tenant_id, rejection_inventory_balance_id, created_at),
  CONSTRAINT fk_rejection_resolution_balance FOREIGN KEY (rejection_inventory_balance_id)
    REFERENCES inventory_rejection_balance(rejection_inventory_balance_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rejection_resolution_record FOREIGN KEY (grn_rejection_id)
    REFERENCES grn_rejection_records(grn_rejection_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rejection_resolution_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rejection_resolution_grn_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rejection_resolution_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rejection_resolution_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master(customer_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_rework_balance (
  inventory_rework_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  rejection_resolution_request_id BIGINT UNSIGNED NOT NULL,
  rejection_inventory_balance_id BIGINT UNSIGNED NOT NULL,
  grn_rejection_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity_in_process DECIMAL(18,3) NOT NULL,
  work_reference VARCHAR(250) NOT NULL,
  status ENUM('IN_PROGRESS','AWAITING_REINSPECTION','CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  started_by VARCHAR(50) NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_by VARCHAR(50) NULL,
  completed_at DATETIME NULL,
  completion_remarks VARCHAR(1000) NULL,
  PRIMARY KEY (inventory_rework_balance_id),
  UNIQUE KEY uq_rework_resolution (rejection_resolution_request_id),
  KEY ix_rework_balance_status (tenant_id, status, started_at),
  CONSTRAINT fk_rework_resolution FOREIGN KEY (rejection_resolution_request_id)
    REFERENCES rejection_resolution_requests(rejection_resolution_request_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rework_rejection_balance FOREIGN KEY (rejection_inventory_balance_id)
    REFERENCES inventory_rejection_balance(rejection_inventory_balance_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rework_rejection_record FOREIGN KEY (grn_rejection_id)
    REFERENCES grn_rejection_records(grn_rejection_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rework_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
