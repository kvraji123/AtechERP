CREATE TABLE IF NOT EXISTS quotation_notes_master (
  quotation_note_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_code VARCHAR(50) NOT NULL,
  note_text TEXT NOT NULL,
  default_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  sort_order INT UNSIGNED NOT NULL DEFAULT 1,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_note_master_id),
  UNIQUE KEY uq_quotation_note_code (note_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_quotations (
  quotation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_no VARCHAR(50) NOT NULL,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  quotation_date DATE NOT NULL,
  quote_for VARCHAR(200) NULL,
  reference_no VARCHAR(100) NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_code_snapshot VARCHAR(50) NULL,
  customer_name_snapshot VARCHAR(200) NOT NULL,
  customer_address_snapshot TEXT NULL,
  customer_email_snapshot VARCHAR(200) NULL,
  salutation VARCHAR(100) NULL,
  introduction TEXT NULL,
  currency_code VARCHAR(10) NOT NULL,
  revision_number VARCHAR(50) NULL,
  revision_date DATE NULL,
  quotation_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  pdf_status VARCHAR(20) NOT NULL DEFAULT 'NOT_GENERATED',
  pdf_file_path VARCHAR(500) NULL,
  pdf_generated_on TIMESTAMP NULL,
  email_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SENT',
  email_to VARCHAR(500) NULL,
  email_subject VARCHAR(500) NULL,
  email_sent_on TIMESTAMP NULL,
  email_sent_by VARCHAR(50) NULL,
  email_failure_reason TEXT NULL,
  finalized_by VARCHAR(50) NULL,
  finalized_by_name VARCHAR(200) NULL,
  finalized_by_role VARCHAR(100) NULL,
  finalized_on TIMESTAMP NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  submitted_by VARCHAR(50) NULL,
  submitted_on TIMESTAMP NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_id),
  UNIQUE KEY uq_marketing_quotation_no (quotation_no),
  UNIQUE KEY uq_marketing_quotation_enquiry_active (enquiry_id, active_flag),
  CONSTRAINT fk_marketing_quotation_enquiry FOREIGN KEY (enquiry_id)
    REFERENCES marketing_enquiries (enquiry_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_marketing_quotation_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master (customer_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_quotation_items (
  quotation_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_id BIGINT UNSIGNED NOT NULL,
  enquiry_part_id BIGINT UNSIGNED NOT NULL,
  workout_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  item_code VARCHAR(100) NULL,
  machining_drawing_number VARCHAR(100) NOT NULL,
  revision_number VARCHAR(50) NULL,
  description VARCHAR(500) NOT NULL,
  annual_quantity DECIMAL(14,3) NULL,
  required_quantity DECIMAL(14,3) NULL,
  moq DECIMAL(14,3) NOT NULL,
  material VARCHAR(300) NULL,
  weight_kg DECIMAL(14,4) NOT NULL,
  currency_code VARCHAR(10) NOT NULL,
  part_price_fob_inr DECIMAL(18,4) NOT NULL,
  part_price_fob_foreign DECIMAL(18,4) NOT NULL,
  total_development_cost_inr DECIMAL(18,4) NOT NULL,
  total_development_cost_foreign DECIMAL(18,4) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_item_id),
  UNIQUE KEY uq_quotation_item_part (quotation_id, enquiry_part_id),
  CONSTRAINT fk_quotation_item_header FOREIGN KEY (quotation_id)
    REFERENCES marketing_quotations (quotation_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_quotation_item_part FOREIGN KEY (enquiry_part_id)
    REFERENCES marketing_enquiry_parts (enquiry_part_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_quotation_item_workout FOREIGN KEY (workout_id)
    REFERENCES marketing_workouts (workout_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_quotation_item_optional_costs (
  quotation_item_optional_cost_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_item_id BIGINT UNSIGNED NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  amount_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  charge_basis VARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
  display_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_item_optional_cost_id),
  UNIQUE KEY uq_quotation_item_optional_cost_type (quotation_item_id, cost_type),
  KEY ix_quotation_item_optional_costs_item (quotation_item_id, display_order),
  CONSTRAINT fk_quotation_item_optional_cost_item FOREIGN KEY (quotation_item_id)
    REFERENCES marketing_quotation_items (quotation_item_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_quotation_notes (
  quotation_note_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_id BIGINT UNSIGNED NOT NULL,
  note_text TEXT NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 1,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_note_id),
  CONSTRAINT fk_quotation_note_header FOREIGN KEY (quotation_id)
    REFERENCES marketing_quotations (quotation_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_quotation_emails (
  quotation_email_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(500) NOT NULL,
  email_subject VARCHAR(500) NOT NULL,
  email_body LONGTEXT NULL,
  attachment_path VARCHAR(500) NULL,
  email_status VARCHAR(20) NOT NULL,
  provider_message_id VARCHAR(300) NULL,
  failure_reason TEXT NULL,
  sent_by VARCHAR(50) NOT NULL,
  sent_on TIMESTAMP NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_email_id),
  KEY ix_quotation_email_header (quotation_id, created_on),
  CONSTRAINT fk_quotation_email_header FOREIGN KEY (quotation_id)
    REFERENCES marketing_quotations (quotation_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_regret_letter_emails (
  regret_email_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  regret_letter_id BIGINT UNSIGNED NOT NULL,
  enquiry_part_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  email_subject VARCHAR(500) NOT NULL,
  email_status ENUM('SENT', 'FAILED') NOT NULL,
  provider_message_id VARCHAR(500) NULL,
  failure_reason TEXT NULL,
  attempted_by VARCHAR(50) NOT NULL,
  attempted_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (regret_email_id),
  KEY ix_regret_email_letter (regret_letter_id, attempted_on),
  CONSTRAINT fk_regret_email_letter
    FOREIGN KEY (regret_letter_id) REFERENCES marketing_regret_letters (regret_letter_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_regret_email_part
    FOREIGN KEY (enquiry_part_id) REFERENCES marketing_enquiry_parts (enquiry_part_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO quotation_notes_master (note_code, note_text, default_flag, sort_order)
VALUES
 ('FOB_CHENNAI', 'Part prices are quoted FOB Chennai.', 'Y', 10),
 ('PAYMENT_TERMS', 'Payment terms are 30 days from the date of Bill of Lading.', 'Y', 20),
 ('MOQ', 'Supply quantity is subject to the MOQ stated against each item.', 'Y', 30),
 ('CURRENCY', 'Prices are based on the quotation currency and exchange rate used in the completed Workout.', 'Y', 40),
 ('PRICE_VALIDITY', 'This quotation is valid for 30 days from the quotation date.', 'Y', 50),
 ('DEVELOPMENT', 'Development time and pilot batch delivery are as stated in the completed Workout.', 'Y', 60)
ON DUPLICATE KEY UPDATE note_text=VALUES(note_text), sort_order=VALUES(sort_order), active_flag='Y';

INSERT INTO app_document_sequences (sequence_key, financial_year, prefix, current_number, number_padding)
VALUES ('QUOTATION', '2026-27', 'QUO', 0, 4)
ON DUPLICATE KEY UPDATE prefix=VALUES(prefix), number_padding=VALUES(number_padding);
