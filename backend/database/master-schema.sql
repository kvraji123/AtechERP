CREATE TABLE IF NOT EXISTS app_document_sequences (
  sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sequence_key VARCHAR(50) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  current_number INT UNSIGNED NOT NULL DEFAULT 0,
  number_padding TINYINT UNSIGNED NOT NULL DEFAULT 4,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sequence_id),
  UNIQUE KEY uq_document_sequence (sequence_key, financial_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_master (
  customer_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_type ENUM('CUSTOMER', 'SUPPLIER', 'BOTH') NOT NULL DEFAULT 'CUSTOMER',
  customer_code VARCHAR(50) NOT NULL,
  customer_type VARCHAR(100) NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_short_name VARCHAR(100) NULL,
  plant_code VARCHAR(50) NULL,
  billing_address TEXT NULL,
  delivery_address TEXT NULL,
  delivery_terms VARCHAR(500) NULL,
  pin_code VARCHAR(20) NULL,
  city VARCHAR(100) NULL,
  state_name VARCHAR(100) NULL,
  country_name VARCHAR(100) NULL,
  gst_number VARCHAR(30) NULL,
  pan_number VARCHAR(30) NULL,
  mobile_number VARCHAR(30) NULL,
  phone_number VARCHAR(30) NULL,
  fax_number VARCHAR(30) NULL,
  email_address VARCHAR(200) NULL,
  website_url VARCHAR(300) NULL,
  invoice_type VARCHAR(50) NULL,
  contact_person_name VARCHAR(150) NULL,
  contact_person_mobile VARCHAR(30) NULL,
  contact_person_designation VARCHAR(100) NULL,
  contact_person_department VARCHAR(100) NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
  account_number VARCHAR(100) NULL,
  account_name VARCHAR(150) NULL,
  bank_name VARCHAR(150) NULL,
  branch_name VARCHAR(150) NULL,
  ifsc_code VARCHAR(30) NULL,
  pan_tan_number VARCHAR(30) NULL,
  customer_status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  deactivation_remarks VARCHAR(500) NULL,
  other_legal_requirements TEXT NULL,
  payment_terms VARCHAR(500) NULL,
  transport_mode VARCHAR(100) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customer_code (customer_code),
  KEY ix_customer_name (customer_name),
  KEY ix_customer_active (active_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS part_master (
  part_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  part_category ENUM('MACHINING', 'ASSEMBLY') NOT NULL,
  part_name VARCHAR(200) NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  drawing_number VARCHAR(100) NULL,
  drawing_revision_number VARCHAR(50) NULL,
  drawing_revision_date DATE NULL,
  drawing_code_mode VARCHAR(30) NOT NULL DEFAULT 'AUTO_GENERATED',
  drawing_code VARCHAR(100) NULL,
  material_specification VARCHAR(300) NULL,
  part_weight DECIMAL(14,3) NULL,
  unit_of_measurement VARCHAR(30) NULL,
  part_status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  project_name VARCHAR(200) NULL,
  deactivation_remarks VARCHAR(500) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (part_id),
  UNIQUE KEY uq_part_number (part_number),
  KEY ix_part_customer (customer_id),
  KEY ix_part_name (part_name),
  KEY ix_part_active (active_flag),
  CONSTRAINT fk_part_customer
    FOREIGN KEY (customer_id) REFERENCES customer_master (customer_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_document_sequences
  (sequence_key, financial_year, prefix, current_number, number_padding)
VALUES
  ('CUSTOMER', '2026-27', 'CUS', 0, 4),
  ('PART', '2026-27', 'PRT', 0, 4)
ON DUPLICATE KEY UPDATE
  prefix = VALUES(prefix),
  number_padding = VALUES(number_padding);
