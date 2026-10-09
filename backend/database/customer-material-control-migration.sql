-- Customer-supplied material controls.
-- Apply after GRN ownership, rejection inventory and rejection resolution migrations.

-- Customer material must be traceable separately from company stock.  The current
-- owner fields remain the source of truth; these changes add job/WIP and formal
-- Return-to-Customer controls around those records.
ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN transaction_type VARCHAR(50) NOT NULL,
  MODIFY COLUMN grn_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN grn_item_id BIGINT UNSIGNED NULL;

ALTER TABLE inventory_rejection_transaction
  MODIFY COLUMN transaction_type VARCHAR(50) NOT NULL;

CREATE TABLE IF NOT EXISTS customer_material_job_balance (
  customer_material_job_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  enquiry_id BIGINT UNSIGNED NULL,
  job_reference VARCHAR(120) NOT NULL,
  inventory_stock_balance_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity_in_process DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  status ENUM('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  issued_by VARCHAR(50) NOT NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_by VARCHAR(50) NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_material_job_balance_id),
  KEY ix_customer_material_job_open (tenant_id, customer_id, status, job_reference),
  KEY ix_customer_material_job_enquiry (tenant_id, enquiry_id, status),
  KEY ix_customer_material_job_stock (tenant_id, inventory_stock_balance_id, status),
  CONSTRAINT fk_customer_material_job_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master(customer_id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_material_job_enquiry FOREIGN KEY (enquiry_id)
    REFERENCES marketing_enquiries(enquiry_id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_material_job_stock FOREIGN KEY (inventory_stock_balance_id)
    REFERENCES inventory_stock_balance(inventory_stock_balance_id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_material_job_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_material_job_transaction (
  customer_material_job_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  customer_material_job_balance_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('ISSUE_TO_JOB','RETURN_FROM_JOB','CONSUMED_IN_JOB') NOT NULL,
  transaction_date DATE NOT NULL,
  quantity_in DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  quantity_out DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  balance_after_quantity DECIMAL(18,3) NOT NULL,
  reference_number VARCHAR(160) NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_material_job_transaction_id),
  KEY ix_customer_material_job_transaction (tenant_id, customer_material_job_balance_id, transaction_date),
  CONSTRAINT fk_customer_material_job_transaction_balance FOREIGN KEY (customer_material_job_balance_id)
    REFERENCES customer_material_job_balance(customer_material_job_balance_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_to_customer_documents (
  return_to_customer_document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  rtc_number VARCHAR(80) NOT NULL,
  rtc_date DATE NOT NULL,
  document_status ENUM('PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','DISPATCHED','CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_code_snapshot VARCHAR(80) NULL,
  customer_name_snapshot VARCHAR(250) NOT NULL,
  dispatch_reference VARCHAR(160) NULL,
  transport_reference VARCHAR(160) NULL,
  gate_exit_reference VARCHAR(160) NULL,
  remarks VARCHAR(1000) NOT NULL,
  approval_remarks VARCHAR(1000) NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  customer_contact VARCHAR(160) NULL,
  customer_acknowledgement_reference VARCHAR(250) NULL,
  customer_acknowledged_by VARCHAR(50) NULL,
  customer_acknowledged_at DATETIME NULL,
  dispatched_by VARCHAR(50) NULL,
  dispatched_at DATETIME NULL,
  pdf_file_name VARCHAR(255) NULL,
  pdf_file_path VARCHAR(500) NULL,
  pdf_file_size_bytes BIGINT UNSIGNED NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (return_to_customer_document_id),
  UNIQUE KEY uq_return_to_customer_number (tenant_id, rtc_number),
  KEY ix_return_to_customer_workflow (tenant_id, document_status, rtc_date),
  KEY ix_return_to_customer_customer (tenant_id, customer_id, document_status),
  CONSTRAINT fk_return_to_customer_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master(customer_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_to_customer_document_items (
  return_to_customer_document_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_to_customer_document_id BIGINT UNSIGNED NOT NULL,
  rejection_inventory_balance_id BIGINT UNSIGNED NOT NULL,
  grn_rejection_id BIGINT UNSIGNED NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  grn_number_snapshot VARCHAR(80) NOT NULL,
  item_code_snapshot VARCHAR(80) NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  returned_quantity DECIMAL(18,3) NOT NULL,
  rejection_reason_snapshot VARCHAR(500) NULL,
  PRIMARY KEY (return_to_customer_document_item_id),
  UNIQUE KEY uq_return_to_customer_document_balance (return_to_customer_document_id, rejection_inventory_balance_id),
  KEY ix_return_to_customer_item_balance (rejection_inventory_balance_id),
  CONSTRAINT fk_return_to_customer_item_document FOREIGN KEY (return_to_customer_document_id)
    REFERENCES return_to_customer_documents(return_to_customer_document_id) ON DELETE RESTRICT,
  CONSTRAINT fk_return_to_customer_item_balance FOREIGN KEY (rejection_inventory_balance_id)
    REFERENCES inventory_rejection_balance(rejection_inventory_balance_id) ON DELETE RESTRICT,
  CONSTRAINT fk_return_to_customer_item_rejection FOREIGN KEY (grn_rejection_id)
    REFERENCES grn_rejection_records(grn_rejection_id) ON DELETE RESTRICT,
  CONSTRAINT fk_return_to_customer_item_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE RESTRICT,
  CONSTRAINT fk_return_to_customer_item_grn_line FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_return_to_customer_item_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
