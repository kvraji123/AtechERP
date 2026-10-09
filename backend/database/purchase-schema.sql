-- ============================================================================
-- PURCHASE MODULE
-- Purchase Request -> PR Approval -> Purchase Enquiry -> Supplier Quotations
-- Target: MySQL 8.0+
-- Notes:
--   * Suppliers are maintained independently in supplier_master.
--   * Item description/specification are copied from Item Master as snapshots.
--   * No budget tables or budget columns are included.
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_requests (
  purchase_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pr_number VARCHAR(50) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  plant_code VARCHAR(50) NOT NULL,
  floor_department VARCHAR(120) NOT NULL,
  requested_by VARCHAR(100) NOT NULL,
  request_date DATE NOT NULL,
  required_date DATE NOT NULL,
  requisition_type ENUM('NEW_ITEM','EXISTING_ITEM') NOT NULL,
  priority ENUM('NORMAL','HIGH','EMERGENCY') NOT NULL DEFAULT 'NORMAL',
  preferred_supplier_id BIGINT UNSIGNED NULL,
  quote_reference VARCHAR(150) NULL,
  remarks VARCHAR(1000) NULL,
  estimated_subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  estimated_tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  estimated_total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  pr_status ENUM(
    'DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED',
    'RETURNED','REJECTED','CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  submitted_on DATETIME NULL,
  approved_by VARCHAR(100) NULL,
  approved_on DATETIME NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_request_id),
  UNIQUE KEY uq_purchase_request_number (pr_number),
  KEY ix_purchase_request_queue (pr_status, priority, required_date, submitted_on),
  KEY ix_purchase_request_plant_department (plant_code, floor_department),
  KEY ix_purchase_request_requester (requested_by),
  KEY ix_purchase_request_preferred_supplier (preferred_supplier_id),
  CONSTRAINT fk_purchase_request_preferred_supplier FOREIGN KEY (preferred_supplier_id)
    REFERENCES supplier_master (supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_request_dates CHECK (required_date >= request_date),
  CONSTRAINT chk_purchase_request_amounts CHECK (
    estimated_subtotal >= 0 AND estimated_tax_amount >= 0 AND estimated_total_amount >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_items (
  purchase_request_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_request_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_group_name VARCHAR(120) NOT NULL,
  item_type_name VARCHAR(120) NOT NULL,
  item_description VARCHAR(250) NOT NULL,
  item_specification VARCHAR(1000) NULL,
  requested_quantity DECIMAL(18,3) NOT NULL,
  uom_code VARCHAR(30) NOT NULL,
  estimated_rate_per_qty DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  estimated_tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  estimated_total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  hsn_code VARCHAR(20) NULL,
  purpose VARCHAR(1000) NOT NULL,
  line_status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_request_item_id),
  UNIQUE KEY uq_purchase_request_line (purchase_request_id, line_number),
  KEY ix_purchase_request_item_master (item_id),
  CONSTRAINT fk_purchase_request_item_header FOREIGN KEY (purchase_request_id)
    REFERENCES purchase_requests (purchase_request_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_request_item_master FOREIGN KEY (item_id)
    REFERENCES item_master (item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_request_item_qty CHECK (requested_quantity > 0),
  CONSTRAINT chk_purchase_request_item_values CHECK (
    estimated_rate_per_qty >= 0 AND tax_percent >= 0 AND
    estimated_tax_amount >= 0 AND estimated_total_amount >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_item_attachments (
  purchase_request_item_attachment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_request_item_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  uploaded_by VARCHAR(50) NOT NULL,
  uploaded_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_request_item_attachment_id),
  KEY ix_pr_item_attachment_line (purchase_request_item_id),
  CONSTRAINT fk_pr_item_attachment_line FOREIGN KEY (purchase_request_item_id)
    REFERENCES purchase_request_items (purchase_request_item_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_approval_history (
  purchase_request_approval_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_request_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('SUBMITTED','APPROVED','RETURNED','REJECTED','RESUBMITTED') NOT NULL,
  decision_reason VARCHAR(1000) NULL,
  decided_by VARCHAR(100) NOT NULL,
  decided_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_request_approval_id),
  KEY ix_pr_approval_history_request (purchase_request_id, decided_on),
  CONSTRAINT fk_pr_approval_history_request FOREIGN KEY (purchase_request_id)
    REFERENCES purchase_requests (purchase_request_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_pr_approval_reason CHECK (
    decision NOT IN ('RETURNED','REJECTED') OR
    (decision_reason IS NOT NULL AND CHAR_LENGTH(TRIM(decision_reason)) > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_enquiries (
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enquiry_number VARCHAR(50) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  enquiry_date DATE NOT NULL,
  quote_due_date DATE NOT NULL,
  enquiry_status ENUM(
    'DRAFT','SENT','PARTIALLY_QUOTED','QUOTED','UNDER_NEGOTIATION','CLOSED','CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_enquiry_id),
  UNIQUE KEY uq_purchase_enquiry_number (enquiry_number),
  KEY ix_purchase_enquiry_status_due (enquiry_status, quote_due_date),
  CONSTRAINT chk_purchase_enquiry_dates CHECK (quote_due_date >= enquiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_enquiry_requests (
  purchase_enquiry_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  purchase_request_id BIGINT UNSIGNED NOT NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_enquiry_request_id),
  UNIQUE KEY uq_purchase_enquiry_request (purchase_enquiry_id, purchase_request_id),
  KEY ix_purchase_enquiry_request_pr (purchase_request_id),
  CONSTRAINT fk_purchase_enquiry_request_header FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_enquiry_request_pr FOREIGN KEY (purchase_request_id)
    REFERENCES purchase_requests (purchase_request_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_enquiry_items (
  purchase_enquiry_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  purchase_request_item_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  enquiry_quantity DECIMAL(18,3) NOT NULL,
  uom_code VARCHAR(30) NOT NULL,
  enquiry_required ENUM('Y','N') NOT NULL DEFAULT 'Y',
  bypass_reason VARCHAR(500) NULL,
  line_status ENUM('READY','SENT','PARTIALLY_QUOTED','QUOTED','SELECTED','CANCELLED') NOT NULL DEFAULT 'READY',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_enquiry_item_id),
  UNIQUE KEY uq_purchase_enquiry_item_source (purchase_enquiry_id, purchase_request_item_id),
  UNIQUE KEY uq_purchase_enquiry_item_line (purchase_enquiry_id, line_number),
  KEY ix_purchase_enquiry_item_pr_line (purchase_request_item_id),
  CONSTRAINT fk_purchase_enquiry_item_header FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_enquiry_item_pr_line FOREIGN KEY (purchase_request_item_id)
    REFERENCES purchase_request_items (purchase_request_item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_enquiry_item_qty CHECK (enquiry_quantity > 0),
  CONSTRAINT chk_purchase_enquiry_bypass CHECK (
    enquiry_required = 'Y' OR
    (bypass_reason IS NOT NULL AND CHAR_LENGTH(TRIM(bypass_reason)) > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_enquiry_item_suppliers (
  purchase_enquiry_item_supplier_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_enquiry_item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  assignment_status ENUM('ASSIGNED','SENT','REMINDER_SENT','QUOTED','DECLINED','NO_RESPONSE') NOT NULL DEFAULT 'ASSIGNED',
  assigned_by VARCHAR(50) NOT NULL,
  assigned_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_on DATETIME NULL,
  last_reminder_on DATETIME NULL,
  reminder_count INT UNSIGNED NOT NULL DEFAULT 0,
  supplier_email VARCHAR(200) NULL,
  remarks VARCHAR(500) NULL,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_enquiry_item_supplier_id),
  UNIQUE KEY uq_purchase_enquiry_item_supplier (purchase_enquiry_item_id, supplier_id),
  KEY ix_purchase_enquiry_supplier_party (supplier_id),
  KEY ix_purchase_enquiry_supplier_status (assignment_status, sent_on),
  CONSTRAINT fk_purchase_enquiry_supplier_item FOREIGN KEY (purchase_enquiry_item_id)
    REFERENCES purchase_enquiry_items (purchase_enquiry_item_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_enquiry_supplier_party FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_quotations (
  supplier_quotation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_quotation_number VARCHAR(100) NULL,
  supplier_quotation_date DATE NULL,
  received_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision_number INT UNSIGNED NOT NULL DEFAULT 1,
  quotation_status ENUM('RECEIVED','REVISED','NEGOTIATING','FINAL','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'RECEIVED',
  currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_terms VARCHAR(500) NULL,
  delivery_terms VARCHAR(500) NULL,
  quotation_valid_until DATE NULL,
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  grand_total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  attachment_file_name VARCHAR(255) NULL,
  attachment_file_url VARCHAR(1000) NULL,
  remarks VARCHAR(1000) NULL,
  entered_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_quotation_id),
  UNIQUE KEY uq_supplier_quotation_revision (purchase_enquiry_id, supplier_id, revision_number),
  KEY ix_supplier_quotation_supplier (supplier_id),
  KEY ix_supplier_quotation_status (quotation_status, received_on),
  CONSTRAINT fk_supplier_quotation_enquiry FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_supplier_quotation_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_supplier_quotation_amounts CHECK (
    subtotal_amount >= 0 AND tax_amount >= 0 AND grand_total_amount >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_quotation_items (
  supplier_quotation_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_quotation_id BIGINT UNSIGNED NOT NULL,
  purchase_enquiry_item_id BIGINT UNSIGNED NOT NULL,
  quote_response ENUM('QUOTED','NOT_QUOTED') NOT NULL DEFAULT 'QUOTED',
  quoted_quantity DECIMAL(18,3) NULL,
  unit_price DECIMAL(18,4) NULL,
  tax_percent DECIMAL(7,4) NULL,
  tax_amount DECIMAL(18,2) NULL,
  total_amount DECIMAL(18,2) NULL,
  delivery_date DATE NULL,
  delivery_lead_days INT UNSIGNED NULL,
  offered_make_brand VARCHAR(200) NULL,
  payment_terms VARCHAR(500) NULL,
  item_remarks VARCHAR(1000) NULL,
  quality_rating_snapshot DECIMAL(5,2) NULL,
  previous_rating_snapshot DECIMAL(5,2) NULL,
  comparison_score DECIMAL(8,4) NULL,
  recommended_flag ENUM('Y','N') NOT NULL DEFAULT 'N',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_quotation_item_id),
  UNIQUE KEY uq_supplier_quotation_item (supplier_quotation_id, purchase_enquiry_item_id),
  KEY ix_supplier_quote_item_enquiry_line (purchase_enquiry_item_id),
  KEY ix_supplier_quote_item_recommended (purchase_enquiry_item_id, recommended_flag, comparison_score),
  CONSTRAINT fk_supplier_quote_item_header FOREIGN KEY (supplier_quotation_id)
    REFERENCES supplier_quotations (supplier_quotation_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_supplier_quote_item_enquiry_line FOREIGN KEY (purchase_enquiry_item_id)
    REFERENCES purchase_enquiry_items (purchase_enquiry_item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_supplier_quote_item_values CHECK (
    (quote_response = 'NOT_QUOTED' AND unit_price IS NULL AND total_amount IS NULL) OR
    (quote_response = 'QUOTED' AND quoted_quantity > 0 AND unit_price >= 0 AND total_amount >= 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_quotation_negotiation_history (
  supplier_quotation_negotiation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_quotation_id BIGINT UNSIGNED NOT NULL,
  negotiation_round INT UNSIGNED NOT NULL,
  negotiation_note VARCHAR(2000) NOT NULL,
  previous_total_amount DECIMAL(18,2) NULL,
  revised_total_amount DECIMAL(18,2) NULL,
  recorded_by VARCHAR(50) NOT NULL,
  recorded_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_quotation_negotiation_id),
  UNIQUE KEY uq_supplier_quotation_negotiation_round (supplier_quotation_id, negotiation_round),
  CONSTRAINT fk_supplier_quotation_negotiation_header FOREIGN KEY (supplier_quotation_id)
    REFERENCES supplier_quotations (supplier_quotation_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_supplier_selections (
  purchase_supplier_selection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_enquiry_item_id BIGINT UNSIGNED NOT NULL,
  supplier_quotation_item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  selected_quantity DECIMAL(18,3) NOT NULL,
  selection_reason VARCHAR(1000) NULL,
  manager_decision ENUM('SELECTED','CANCELLED') NOT NULL DEFAULT 'SELECTED',
  selected_by VARCHAR(50) NOT NULL,
  selected_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (purchase_supplier_selection_id),
  UNIQUE KEY uq_purchase_supplier_selection (purchase_enquiry_item_id, supplier_quotation_item_id),
  KEY ix_purchase_supplier_selection_supplier (supplier_id),
  CONSTRAINT fk_purchase_supplier_selection_item FOREIGN KEY (purchase_enquiry_item_id)
    REFERENCES purchase_enquiry_items (purchase_enquiry_item_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_supplier_selection_quote_item FOREIGN KEY (supplier_quotation_item_id)
    REFERENCES supplier_quotation_items (supplier_quotation_item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_supplier_selection_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_supplier_selection_qty CHECK (selected_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW vw_purchase_request_approval_queue AS
SELECT
  PR.purchase_request_id,
  PR.pr_number,
  PR.plant_code,
  PR.floor_department,
  PR.requested_by,
  PR.requisition_type,
  PR.priority,
  PR.submitted_on,
  PR.required_date,
  PR.estimated_total_amount,
  PR.pr_status,
  COUNT(PRI.purchase_request_item_id) AS item_count
FROM purchase_requests PR
LEFT JOIN purchase_request_items PRI
  ON PRI.purchase_request_id = PR.purchase_request_id
 AND PRI.line_status = 'ACTIVE'
WHERE PR.pr_status IN ('SUBMITTED','PENDING_APPROVAL','RETURNED')
GROUP BY
  PR.purchase_request_id, PR.pr_number, PR.plant_code, PR.floor_department,
  PR.requested_by, PR.requisition_type, PR.priority, PR.submitted_on,
  PR.required_date, PR.estimated_total_amount, PR.pr_status;

CREATE OR REPLACE VIEW vw_purchase_enquiry_quote_comparison AS
SELECT
  PE.purchase_enquiry_id,
  PE.enquiry_number,
  PEI.purchase_enquiry_item_id,
  PRI.purchase_request_item_id,
  PR.pr_number,
  PRI.item_type_name,
  PRI.item_description,
  PEI.enquiry_quantity,
  PEI.uom_code,
  SQ.supplier_quotation_id,
  SQ.supplier_id,
  CM.supplier_code AS supplier_code,
  CM.supplier_name AS supplier_name,
  SQI.quote_response,
  SQI.unit_price,
  SQI.tax_percent,
  SQI.total_amount,
  SQI.delivery_date,
  SQI.delivery_lead_days,
  COALESCE(SQI.payment_terms, SQ.payment_terms) AS payment_terms,
  SQI.quality_rating_snapshot,
  SQI.previous_rating_snapshot,
  SQI.comparison_score,
  SQI.recommended_flag,
  SQ.attachment_file_name,
  SQ.attachment_file_url
FROM purchase_enquiries PE
JOIN purchase_enquiry_items PEI
  ON PEI.purchase_enquiry_id = PE.purchase_enquiry_id
JOIN purchase_request_items PRI
  ON PRI.purchase_request_item_id = PEI.purchase_request_item_id
JOIN purchase_requests PR
  ON PR.purchase_request_id = PRI.purchase_request_id
LEFT JOIN supplier_quotation_items SQI
  ON SQI.purchase_enquiry_item_id = PEI.purchase_enquiry_item_id
LEFT JOIN supplier_quotations SQ
  ON SQ.supplier_quotation_id = SQI.supplier_quotation_id
LEFT JOIN supplier_master CM
  ON CM.supplier_id = SQ.supplier_id;

INSERT INTO app_document_sequences
  (sequence_key, financial_year, prefix, current_number, number_padding)
VALUES
  ('PURCHASE_REQUEST', '2026-27', 'PR', 0, 4),
  ('PURCHASE_ENQUIRY', '2026-27', 'PE', 0, 4)
ON DUPLICATE KEY UPDATE
  prefix = VALUES(prefix),
  number_padding = VALUES(number_padding);
