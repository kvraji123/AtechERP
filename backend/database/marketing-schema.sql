CREATE TABLE IF NOT EXISTS marketing_enquiries (
  enquiry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  doc_no VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  customer_code_snapshot VARCHAR(50) NULL,
  customer_name_snapshot VARCHAR(200) NULL,
  customer_short_name_snapshot VARCHAR(100) NULL,
  customer_representative_name VARCHAR(150) NULL,
  enquiry_mode VARCHAR(20) NOT NULL DEFAULT 'MAIL',
  order_type VARCHAR(20) NOT NULL DEFAULT 'SALES',
  required_date DATE NULL,
  customer_enquiry_reference VARCHAR(100) NULL,
  customer_enquiry_date DATE NULL,
  po_reference VARCHAR(100) NULL,
  enquiry_status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
  enquiry_conversion VARCHAR(30) NOT NULL DEFAULT 'YET_TO_RECEIVE',
  current_stage VARCHAR(30) NOT NULL DEFAULT 'ENQUIRY',
  revision_number VARCHAR(50) NULL,
  revision_date DATE NULL,
  save_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  remarks TEXT NULL,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  submitted_by VARCHAR(50) NULL,
  submitted_on TIMESTAMP NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (enquiry_id),
  UNIQUE KEY uq_marketing_enquiry_doc_no (doc_no),
  KEY ix_marketing_enquiry_customer (customer_id),
  KEY ix_marketing_enquiry_stage_status (current_stage, enquiry_status),
  KEY ix_marketing_enquiry_created_on (created_on),
  CONSTRAINT fk_marketing_enquiry_customer
    FOREIGN KEY (customer_id) REFERENCES customer_master (customer_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_enquiry_parts (
  enquiry_part_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  part_id BIGINT UNSIGNED NULL,
  line_number INT UNSIGNED NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  item_code VARCHAR(100) NULL,
  drawing_number VARCHAR(100) NOT NULL,
  drawing_revision_number VARCHAR(50) NULL,
  drawing_revision_date DATE NULL,
  product_description VARCHAR(500) NOT NULL,
  material_and_grade VARCHAR(300) NULL,
  alternative_material VARCHAR(300) NULL,
  is_assembled_part TINYINT(1) NOT NULL DEFAULT 0,
  required_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  annual_quantity DECIMAL(14,3) NULL,
  moq DECIMAL(14,3) NULL,
  required_date DATE NULL,
  unit_of_measurement VARCHAR(30) NULL,
  part_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_FEASIBILITY',
  save_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (enquiry_part_id),
  UNIQUE KEY uq_marketing_enquiry_line (enquiry_id, line_number),
  KEY ix_marketing_enquiry_part_master (part_id),
  KEY ix_marketing_enquiry_part_status (part_status, active_flag),
  CONSTRAINT fk_marketing_enquiry_part_header
    FOREIGN KEY (enquiry_id) REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_marketing_enquiry_part_master
    FOREIGN KEY (part_id) REFERENCES part_master (part_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_enquiry_revisions (
  enquiry_revision_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  revision_sequence INT UNSIGNED NOT NULL,
  revision_number VARCHAR(50) NOT NULL,
  revision_date DATE NOT NULL,
  revision_action ENUM(
    'CREATED', 'UPDATED', 'SUBMITTED', 'MIGRATED',
    'FEASIBILITY_SAVED', 'FEASIBILITY_CLOSED',
    'WORKOUT_SAVED', 'WORKOUT_COMPLETED',
    'QUOTATION_SAVED', 'QUOTATION_FINALIZED',
    'ENQUIRY_ATTACHMENT_ADDED', 'ENQUIRY_ATTACHMENT_UPDATED',
    'ENQUIRY_ATTACHMENT_REMOVED'
  )
    NOT NULL DEFAULT 'UPDATED',
  save_status ENUM('DRAFT', 'SUBMITTED') NOT NULL,
  snapshot_json JSON NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enquiry_revision_id),
  UNIQUE KEY uq_enquiry_revision (enquiry_id, revision_sequence),
  KEY ix_enquiry_revision_date (enquiry_id, revision_date),
  CONSTRAINT fk_enquiry_revision_enquiry
    FOREIGN KEY (enquiry_id) REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_document_sequences
  (sequence_key, financial_year, prefix, current_number, number_padding)
VALUES
  ('ENQUIRY', '2026-27', 'ENQ', 0, 4)
ON DUPLICATE KEY UPDATE
  prefix = VALUES(prefix),
  number_padding = VALUES(number_padding);
