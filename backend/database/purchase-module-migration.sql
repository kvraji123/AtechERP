-- Purchase module foundation migration
-- MySQL 8.0+. This migration is additive and preserves existing purchase data.
-- Run purchase-schema.sql first when installing a new database.

SET @purchase_default_tenant := 'DEFAULT';

-- Multi-tenant and item-level approval extensions for the existing PR tables.
ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_request_id,
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(64) NULL AFTER tenant_id,
  ADD COLUMN IF NOT EXISTS plant_id VARCHAR(64) NULL AFTER plant_code,
  ADD COLUMN IF NOT EXISTS department_id VARCHAR(64) NULL AFTER floor_department,
  ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(1000) NULL AFTER remarks;

UPDATE purchase_requests SET priority = 'HIGH' WHERE priority = 'EMERGENCY';
UPDATE purchase_requests SET priority = 'MEDIUM' WHERE priority = 'NORMAL';
ALTER TABLE purchase_requests
  MODIFY COLUMN priority ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE purchase_requests
  MODIFY COLUMN pr_status ENUM('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','PARTIALLY_APPROVED','RETURNED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE purchase_request_items
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_request_item_id,
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(64) NULL AFTER tenant_id,
  ADD COLUMN IF NOT EXISTS approved_quantity DECIMAL(18,3) NULL AFTER requested_quantity,
  ADD COLUMN IF NOT EXISTS approval_status ENUM('PENDING','APPROVED','NOT_APPROVED','CLARIFICATION') NOT NULL DEFAULT 'PENDING' AFTER approved_quantity,
  ADD COLUMN IF NOT EXISTS approval_reason VARCHAR(1000) NULL AFTER approval_status,
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(50) NULL AFTER approval_reason,
  ADD COLUMN IF NOT EXISTS approved_on DATETIME NULL AFTER approved_by;

ALTER TABLE purchase_enquiries
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_enquiry_id,
  ADD COLUMN IF NOT EXISTS company_id VARCHAR(64) NULL AFTER tenant_id,
  ADD COLUMN IF NOT EXISTS subject VARCHAR(500) NULL AFTER quote_due_date,
  ADD COLUMN IF NOT EXISTS delivery_required_by DATE NULL AFTER subject,
  ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(500) NULL AFTER delivery_required_by,
  ADD COLUMN IF NOT EXISTS commercial_terms VARCHAR(2000) NULL AFTER delivery_location,
  ADD COLUMN IF NOT EXISTS notes VARCHAR(2000) NULL AFTER commercial_terms;
ALTER TABLE purchase_enquiry_requests
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_enquiry_request_id;
ALTER TABLE purchase_enquiry_items
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_enquiry_item_id;
ALTER TABLE purchase_enquiry_item_suppliers
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_enquiry_item_supplier_id;
ALTER TABLE supplier_quotations
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER supplier_quotation_id,
  ADD COLUMN IF NOT EXISTS packing_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER tax_amount,
  ADD COLUMN IF NOT EXISTS freight_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER packing_amount,
  ADD COLUMN IF NOT EXISTS other_charges_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER freight_amount;
ALTER TABLE supplier_quotation_items
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER supplier_quotation_item_id,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER unit_price,
  ADD COLUMN IF NOT EXISTS freight_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER tax_amount,
  ADD COLUMN IF NOT EXISTS packing_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER freight_amount,
  ADD COLUMN IF NOT EXISTS other_charges_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER packing_amount,
  ADD COLUMN IF NOT EXISTS warranty_months INT UNSIGNED NULL AFTER previous_rating_snapshot;
ALTER TABLE supplier_quotation_negotiation_history
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER supplier_quotation_negotiation_id;
ALTER TABLE purchase_supplier_selections
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT' AFTER purchase_supplier_selection_id;

CREATE TABLE IF NOT EXISTS purchase_request_item_approval_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_request_id BIGINT UNSIGNED NOT NULL,
  purchase_request_item_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('APPROVED','NOT_APPROVED','CLARIFICATION') NOT NULL,
  approved_quantity DECIMAL(18,3) NULL,
  reason VARCHAR(1000) NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NOT NULL,
  performed_by VARCHAR(50) NOT NULL,
  performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_pr_line_approval_request (tenant_id, purchase_request_id, performed_at),
  CONSTRAINT fk_pr_line_approval_request FOREIGN KEY (purchase_request_id)
    REFERENCES purchase_requests (purchase_request_id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_line_approval_item FOREIGN KEY (purchase_request_item_id)
    REFERENCES purchase_request_items (purchase_request_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_supplier_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_request_item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  assigned_quantity DECIMAL(18,3) NOT NULL,
  assignment_status ENUM('ASSIGNED','CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
  assigned_by VARCHAR(50) NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pr_item_supplier_assignment (tenant_id, purchase_request_item_id, supplier_id),
  KEY ix_pr_supplier_assignment_supplier (tenant_id, supplier_id),
  CONSTRAINT fk_pr_supplier_assignment_item FOREIGN KEY (purchase_request_item_id)
    REFERENCES purchase_request_items (purchase_request_item_id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_supplier_assignment_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PO header/items preserve snapshots so later master changes do not rewrite history.
CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  po_number VARCHAR(50) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  po_date DATE NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_code_snapshot VARCHAR(50) NOT NULL,
  supplier_name_snapshot VARCHAR(200) NOT NULL,
  supplier_address_snapshot TEXT NULL,
  supplier_gst_snapshot VARCHAR(30) NULL,
  source_reference VARCHAR(500) NULL,
  billing_address_snapshot TEXT NOT NULL,
  delivery_address_snapshot TEXT NOT NULL,
  payment_terms VARCHAR(500) NULL,
  delivery_terms VARCHAR(500) NULL,
  expected_delivery_date DATE NULL,
  remarks VARCHAR(1000) NULL,
  special_instructions VARCHAR(2000) NULL,
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  freight_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  other_charges_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  grand_total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  status ENUM('DRAFT','SUBMITTED','RETURNED','APPROVED','REJECTED','PARTIALLY_RECEIVED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  submitted_by VARCHAR(50) NULL,
  submitted_at DATETIME NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  decision_reason VARCHAR(1000) NULL,
  cancellation_reason VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_order_id),
  UNIQUE KEY uq_purchase_order_number (tenant_id, po_number),
  KEY ix_purchase_order_queue (tenant_id, status, po_date),
  KEY ix_purchase_order_supplier (tenant_id, supplier_id),
  CONSTRAINT fk_purchase_order_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS packing_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER tax_amount;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  purchase_order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  purchase_request_item_id BIGINT UNSIGNED NULL,
  line_number INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(100) NOT NULL,
  item_type_snapshot VARCHAR(120) NOT NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  item_specification_snapshot VARCHAR(1000) NULL,
  other_specification VARCHAR(1000) NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  hsn_code_snapshot VARCHAR(20) NULL,
  ordered_quantity DECIMAL(18,3) NOT NULL,
  received_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  unit_price DECIMAL(18,4) NOT NULL,
  discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  freight_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  other_charges_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  line_total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  required_date DATE NULL,
  line_status ENUM('OPEN','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_order_item_id),
  UNIQUE KEY uq_purchase_order_line (purchase_order_id, line_number),
  KEY ix_purchase_order_item_source (tenant_id, purchase_request_item_id),
  CONSTRAINT fk_purchase_order_item_header FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (purchase_order_id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_order_item_request_line FOREIGN KEY (purchase_request_item_id)
    REFERENCES purchase_request_items (purchase_request_item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_order_item_master FOREIGN KEY (item_id)
    REFERENCES item_master (item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS packing_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER tax_amount;

CREATE TABLE IF NOT EXISTS purchase_order_sources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id BIGINT UNSIGNED NOT NULL,
  purchase_request_id BIGINT UNSIGNED NULL,
  purchase_request_item_id BIGINT UNSIGNED NULL,
  source_quantity DECIMAL(18,3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_purchase_order_source (tenant_id, purchase_order_id),
  CONSTRAINT fk_purchase_order_source_header FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (purchase_order_id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_order_source_item FOREIGN KEY (purchase_order_item_id)
    REFERENCES purchase_order_items (purchase_order_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  uploaded_by VARCHAR(50) NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_purchase_order_attachment (tenant_id, purchase_order_id),
  CONSTRAINT fk_purchase_order_attachment_header FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (purchase_order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_approval_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('SUBMITTED','APPROVED','RETURNED','REJECTED','CANCELLED') NOT NULL,
  reason VARCHAR(1000) NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NOT NULL,
  performed_by VARCHAR(50) NOT NULL,
  performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_purchase_order_approval_history (tenant_id, purchase_order_id, performed_at),
  CONSTRAINT fk_purchase_order_approval_header FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (purchase_order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GRN supports multiple partial receipts against a single PO.
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  grn_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  grn_number VARCHAR(50) NOT NULL,
  grn_date DATE NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  gate_entry_number VARCHAR(50) NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_name_snapshot VARCHAR(200) NOT NULL,
  inspection_status ENUM('NOT_REQUIRED','PENDING','PASSED','FAILED','PARTIAL') NOT NULL DEFAULT 'PENDING',
  status ENUM('DRAFT','INWARD','INSPECTION_PENDING','ACCEPTED','PARTIALLY_ACCEPTED','REJECTED','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grn_id),
  UNIQUE KEY uq_grn_number (tenant_id, grn_number),
  KEY ix_grn_queue (tenant_id, status, grn_date),
  CONSTRAINT fk_grn_purchase_order FOREIGN KEY (purchase_order_id)
    REFERENCES purchase_orders (purchase_order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_grn_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goods_receipt_note_items (
  grn_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  ordered_quantity DECIMAL(18,3) NOT NULL,
  previously_received_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  received_quantity DECIMAL(18,3) NOT NULL,
  accepted_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  rejected_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  rejection_reason VARCHAR(1000) NULL,
  replacement_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grn_item_id),
  UNIQUE KEY uq_grn_item_po_line (grn_id, purchase_order_item_id),
  CONSTRAINT fk_grn_item_header FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes (grn_id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_item_po_line FOREIGN KEY (purchase_order_item_id)
    REFERENCES purchase_order_items (purchase_order_item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_grn_item_master FOREIGN KEY (item_id)
    REFERENCES item_master (item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  audit_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  module VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  performed_by VARCHAR(50) NOT NULL,
  performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NULL,
  remarks VARCHAR(1000) NULL,
  PRIMARY KEY (audit_log_id),
  KEY ix_audit_log_entity (tenant_id, module, entity_type, entity_id, performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_workflow (
  approval_workflow_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  workflow_code VARCHAR(80) NOT NULL,
  module VARCHAR(80) NOT NULL,
  plant_id VARCHAR(64) NULL,
  department_id VARCHAR(64) NULL,
  material_category VARCHAR(120) NULL,
  min_value DECIMAL(18,2) NULL,
  max_value DECIMAL(18,2) NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (approval_workflow_id),
  UNIQUE KEY uq_approval_workflow (tenant_id, workflow_code),
  KEY ix_approval_workflow_match (tenant_id, module, plant_id, department_id, active_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_level (
  approval_level_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  approval_workflow_id BIGINT UNSIGNED NOT NULL,
  level_number INT UNSIGNED NOT NULL,
  approver_role VARCHAR(80) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (approval_level_id),
  UNIQUE KEY uq_approval_level (approval_workflow_id, level_number),
  CONSTRAINT fk_approval_level_workflow FOREIGN KEY (approval_workflow_id)
    REFERENCES approval_workflow (approval_workflow_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_transaction (
  approval_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  workflow_code VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  current_level INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('PENDING','APPROVED','RETURNED','REJECTED') NOT NULL DEFAULT 'PENDING',
  assigned_to VARCHAR(50) NULL,
  decision_reason VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (approval_transaction_id),
  UNIQUE KEY uq_approval_transaction (tenant_id, entity_type, entity_id),
  KEY ix_approval_transaction_queue (tenant_id, status, assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactional outbox for RFQ emails, reminders and document generation.
-- Workers can claim PENDING jobs without coupling external delivery to a DB transaction.
CREATE TABLE IF NOT EXISTS purchase_outbox_job (
  job_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  job_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  payload JSON NOT NULL,
  status ENUM('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  completed_at DATETIME NULL,
  last_error VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  KEY ix_purchase_outbox_claim (status, available_at),
  KEY ix_purchase_outbox_entity (tenant_id, entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Supplier-specific RFQ email outbox. Each row is one email delivery attempt
-- that can be viewed and retried independently of other suppliers.
CREATE TABLE IF NOT EXISTS purchase_rfq_email_outbox (
  email_outbox_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  recipient_name VARCHAR(200) NULL,
  subject VARCHAR(500) NOT NULL,
  text_body TEXT NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  status ENUM('PENDING','PROCESSING','SENT','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  sent_at DATETIME NULL,
  message_id VARCHAR(500) NULL,
  last_error VARCHAR(2000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email_outbox_id),
  UNIQUE KEY uq_rfq_email_outbox_supplier (tenant_id, purchase_enquiry_id, supplier_id),
  KEY ix_rfq_email_outbox_claim (status, available_at),
  KEY ix_rfq_email_outbox_enquiry (tenant_id, purchase_enquiry_id),
  CONSTRAINT fk_rfq_email_outbox_enquiry FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id) ON DELETE CASCADE,
  CONSTRAINT fk_rfq_email_outbox_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A supplier-specific stored RFQ PDF is produced before any email is delivered.
CREATE TABLE IF NOT EXISTS purchase_rfq_documents (
  rfq_document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(1000) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rfq_document_id),
  UNIQUE KEY uq_rfq_document_supplier (tenant_id, purchase_enquiry_id, supplier_id),
  KEY ix_rfq_document_enquiry (tenant_id, purchase_enquiry_id),
  CONSTRAINT fk_rfq_document_enquiry FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id) ON DELETE CASCADE,
  CONSTRAINT fk_rfq_document_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Normalize previously queued, unsent RFQ email subjects. Item names remain in
-- the email body and in the stored RFQ PDF, not in the email subject.
UPDATE purchase_rfq_email_outbox O
JOIN purchase_enquiries PE ON PE.purchase_enquiry_id=O.purchase_enquiry_id
SET O.subject=CONCAT('Request for Quotation - ', PE.enquiry_number)
WHERE O.status='PENDING';

-- Document sequences used by purchase services.
INSERT INTO app_document_sequences (sequence_key, financial_year, prefix, current_number, number_padding)
VALUES
  ('PURCHASE_REQUEST', '2026-27', 'PR', 0, 4),
  ('PURCHASE_ENQUIRY', '2026-27', 'PE', 0, 4),
  ('PURCHASE_ORDER', '2026-27', 'PO', 0, 4),
  ('GATE_ENTRY', '2026-27', 'GE', 0, 4),
  ('GRN', '2026-27', 'GRN', 0, 4)
ON DUPLICATE KEY UPDATE prefix = VALUES(prefix), number_padding = VALUES(number_padding);
