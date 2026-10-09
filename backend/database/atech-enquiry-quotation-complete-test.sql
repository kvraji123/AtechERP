-- ============================================================================
-- A TECH AUTOMATION - ENQUIRY TO QUOTATION MODULE
-- Complete MySQL database, tables, document sequences and testing data
-- Generated from the project schema and repeatable workflow seed files.
--
-- Import this single file on a tester PC using MySQL Workbench or:
-- mysql -u <user> -p < this-file.sql
--
-- Safe to run repeatedly: tables use IF NOT EXISTS and the reserved test
-- records (IDs 990001-990006) are replaced on every import.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `atech_erp`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `atech_erp`;
SET NAMES utf8mb4;

-- ============================================================================
-- Master tables and document sequences
-- Source: master-schema.sql
-- ============================================================================

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

-- ============================================================================
-- Enquiry tables and enquiry sequence
-- Source: marketing-schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_enquiries (
  enquiry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  doc_no VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_code_snapshot VARCHAR(50) NOT NULL,
  customer_name_snapshot VARCHAR(200) NOT NULL,
  customer_short_name_snapshot VARCHAR(100) NULL,
  enquiry_mode VARCHAR(20) NOT NULL DEFAULT 'MAIL',
  order_type VARCHAR(20) NOT NULL DEFAULT 'SALES',
  required_date DATE NULL,
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
  material_and_grade VARCHAR(300) NOT NULL,
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
  revision_action ENUM('CREATED', 'UPDATED', 'SUBMITTED', 'MIGRATED')
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

-- ============================================================================
-- Feasibility and regret-letter tables
-- Source: feasibility-schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_feasibilities (
  feasibility_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  enquiry_part_id BIGINT UNSIGNED NOT NULL,
  feasibility_date DATE NOT NULL,
  communication_address TEXT NULL,
  contact_person VARCHAR(200) NULL,
  telephone_number VARCHAR(50) NULL,
  fax_number VARCHAR(50) NULL,
  email_address VARCHAR(200) NULL,
  is_new_customer VARCHAR(3) NULL,
  existing_products_details TEXT NULL,
  similar_product_processing VARCHAR(3) NULL,
  similar_product_details TEXT NULL,
  drawing_reviewed_completely VARCHAR(3) NULL,
  drawing_requirements_understood VARCHAR(3) NULL,
  customer_clarification_required TEXT NULL,
  product_technically_feasible VARCHAR(3) NULL,
  raw_material_source VARCHAR(20) NULL,
  purchase_source_available VARCHAR(3) NULL,
  material_source_details TEXT NULL,
  outsource_process_required VARCHAR(3) NULL,
  outsource_source_details TEXT NULL,
  tolerance_achievable VARCHAR(3) NULL,
  acceptance_criteria_understood VARCHAR(3) NULL,
  customer_special_characteristics VARCHAR(3) NULL,
  special_characteristics_details TEXT NULL,
  customer_final_inspection_format VARCHAR(3) NULL,
  final_inspection_format_details TEXT NULL,
  batch_supply_reports TEXT NULL,
  customer_required_volume DECIMAL(14,3) NULL,
  volume_uom VARCHAR(30) NULL,
  statutory_requirements TEXT NULL,
  customer_specified_packing VARCHAR(3) NULL,
  packing_details TEXT NULL,
  customer_specified_labelling VARCHAR(3) NULL,
  labelling_details TEXT NULL,
  transportation_mode VARCHAR(100) NULL,
  customer_specified_transporter VARCHAR(3) NULL,
  transporter_details TEXT NULL,
  freight_paid_by VARCHAR(30) NULL,
  payment_terms TEXT NULL,
  feasibility_decision VARCHAR(30) NULL,
  regret_reason TEXT NULL,
  final_remarks TEXT NULL,
  save_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  feasibility_check_completed_on DATETIME NULL,
  closed_by_code VARCHAR(50) NULL,
  closed_by_name VARCHAR(150) NULL,
  closed_by_role VARCHAR(100) NULL,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  submitted_by VARCHAR(50) NULL,
  submitted_on DATETIME NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (feasibility_id),
  UNIQUE KEY uq_feasibility_enquiry_part (enquiry_part_id),
  KEY ix_feasibility_enquiry (enquiry_id),
  KEY ix_feasibility_status (save_status, feasibility_decision),
  CONSTRAINT fk_feasibility_enquiry
    FOREIGN KEY (enquiry_id) REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_feasibility_enquiry_part
    FOREIGN KEY (enquiry_part_id) REFERENCES marketing_enquiry_parts (enquiry_part_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_regret_letters (
  regret_letter_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  enquiry_part_id BIGINT UNSIGNED NOT NULL,
  feasibility_id BIGINT UNSIGNED NOT NULL,
  letter_status VARCHAR(30) NOT NULL DEFAULT 'NOT_GENERATED',
  regret_reason TEXT NOT NULL,
  generated_on DATETIME NULL,
  approved_on DATETIME NULL,
  approved_by VARCHAR(50) NULL,
  sent_on DATETIME NULL,
  sent_by VARCHAR(50) NULL,
  file_path VARCHAR(500) NULL,
  letter_content LONGTEXT NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (regret_letter_id),
  UNIQUE KEY uq_regret_letter_feasibility (feasibility_id),
  KEY ix_regret_letter_enquiry (enquiry_id),
  CONSTRAINT fk_regret_letter_enquiry
    FOREIGN KEY (enquiry_id) REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_regret_letter_enquiry_part
    FOREIGN KEY (enquiry_part_id) REFERENCES marketing_enquiry_parts (enquiry_part_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_regret_letter_feasibility
    FOREIGN KEY (feasibility_id) REFERENCES marketing_feasibilities (feasibility_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_reference_values (
  reference_value_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_type VARCHAR(50) NOT NULL,
  value_code VARCHAR(100) NOT NULL,
  display_label VARCHAR(150) NOT NULL,
  numeric_value DECIMAL(18,6) NULL,
  effective_date DATE NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (reference_value_id),
  UNIQUE KEY uq_marketing_reference_value (reference_type, value_code),
  KEY ix_marketing_reference_active (reference_type, active_flag, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, sort_order)
VALUES
  ('TRANSPORT_MODE', 'ROAD', 'Road', 10),
  ('TRANSPORT_MODE', 'AIR', 'Air', 20),
  ('TRANSPORT_MODE', 'SEA', 'Sea', 30),
  ('TRANSPORT_MODE', 'COURIER', 'Courier', 40),
  ('TRANSPORT_MODE', 'OTHER', 'Other', 50),
  ('PAYMENT_TERM', 'ADVANCE', 'Advance Payment', 10),
  ('PAYMENT_TERM', 'NET_30', 'Net 30 Days', 20),
  ('PAYMENT_TERM', 'NET_45', 'Net 45 Days', 30),
  ('PAYMENT_TERM', 'NET_60', 'Net 60 Days', 40),
  ('PAYMENT_TERM', 'LC', 'Letter of Credit', 50),
  ('PAYMENT_TERM', 'OTHER', 'Other', 60)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

-- ============================================================================
-- Workout tables and reference values
-- Source: workout-schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketing_workouts (
  workout_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_no VARCHAR(50) NOT NULL,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  enquiry_part_id BIGINT UNSIGNED NOT NULL,
  workout_date DATE NOT NULL,
  reference_no VARCHAR(100) NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EUR',
  currency_rate DECIMAL(16,6) NOT NULL DEFAULT 1,
  exchange_rate_effective_date DATE NULL,
  overhead_profit_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
  profit_calculation_type VARCHAR(20) NOT NULL DEFAULT 'FIXED_AMOUNT',
  profit_value DECIMAL(18,4) NOT NULL DEFAULT 0,
  commission_percent DECIMAL(9,4) NOT NULL DEFAULT 0,
  payment_terms VARCHAR(500) NULL,
  development_time VARCHAR(200) NULL,
  pilot_batch_delivery VARCHAR(200) NULL,
  item_code VARCHAR(100) NULL,
  machining_drawing_number VARCHAR(100) NOT NULL,
  revision_number VARCHAR(50) NULL,
  description VARCHAR(500) NOT NULL,
  annual_quantity DECIMAL(14,3) NULL,
  required_quantity_snapshot DECIMAL(14,3) NULL,
  moq DECIMAL(14,3) NULL,
  material VARCHAR(300) NULL,
  weight_kg DECIMAL(14,4) NOT NULL DEFAULT 0,
  material_rate_per_kg DECIMAL(18,4) NOT NULL DEFAULT 0,
  additional_material_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  assembly_labour_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  material_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  material_cost_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  turning_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  vmc_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  keyway_spline_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  heat_treatment_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  shaping_gear_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  packing_forwarding_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_machining_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  overhead_profit_amount_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  profit_amount_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  adjusted_machining_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  adjusted_machining_cost_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  part_cost_with_overhead_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  part_cost_with_overhead_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  machining_cost_with_va_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  packing_cost_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  part_price_fob_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  part_price_fob_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  commission_amount_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  commission_amount_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  final_part_price_fob_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  final_part_price_fob_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  pattern_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  fixture_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  special_tool_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  gauge_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  trial_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_development_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_development_cost_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  save_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  submitted_by VARCHAR(50) NULL,
  submitted_on TIMESTAMP NULL,
  completed_by_name VARCHAR(200) NULL,
  completed_by_role VARCHAR(100) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workout_id),
  UNIQUE KEY uq_marketing_workout_no (workout_no),
  UNIQUE KEY uq_marketing_workout_part (enquiry_part_id),
  KEY ix_marketing_workout_enquiry (enquiry_id),
  CONSTRAINT fk_marketing_workout_enquiry
    FOREIGN KEY (enquiry_id) REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_marketing_workout_part
    FOREIGN KEY (enquiry_part_id) REFERENCES marketing_enquiry_parts (enquiry_part_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_workout_process_costs (
  workout_process_cost_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_id BIGINT UNSIGNED NOT NULL,
  process_type VARCHAR(50) NOT NULL,
  process_description VARCHAR(300) NULL,
  cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  display_order INT UNSIGNED NOT NULL DEFAULT 1,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workout_process_cost_id),
  KEY ix_marketing_workout_process (workout_id, display_order),
  CONSTRAINT fk_marketing_workout_process
    FOREIGN KEY (workout_id) REFERENCES marketing_workouts (workout_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_workout_notes (
  workout_note_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_id BIGINT UNSIGNED NOT NULL,
  note_text TEXT NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 1,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workout_note_id),
  KEY ix_marketing_workout_note (workout_id, display_order),
  CONSTRAINT fk_marketing_workout_note
    FOREIGN KEY (workout_id) REFERENCES marketing_workouts (workout_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_workout_subparts (
  workout_subpart_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  part_name VARCHAR(200) NULL,
  part_drawing_number VARCHAR(100) NULL,
  material_type VARCHAR(50) NULL,
  material_and_grade VARCHAR(300) NULL,
  material_price_per_kg DECIMAL(18,4) NOT NULL DEFAULT 0,
  rm_weight_kg DECIMAL(14,4) NOT NULL DEFAULT 0,
  material_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_machining_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  pattern_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  fixture_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  special_tool_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  gauge_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  trial_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_development_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workout_subpart_id),
  UNIQUE KEY uq_workout_subpart_line (workout_id, line_number),
  CONSTRAINT fk_workout_subpart_workout
    FOREIGN KEY (workout_id) REFERENCES marketing_workouts (workout_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_workout_subpart_process_costs (
  workout_subpart_process_cost_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_subpart_id BIGINT UNSIGNED NOT NULL,
  process_type VARCHAR(50) NOT NULL,
  process_description VARCHAR(300) NULL,
  cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
  display_order INT UNSIGNED NOT NULL DEFAULT 1,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workout_subpart_process_cost_id),
  UNIQUE KEY uq_workout_subpart_process (workout_subpart_id, process_type),
  KEY ix_workout_subpart_process_order (workout_subpart_id, display_order),
  CONSTRAINT fk_workout_subpart_process_subpart
    FOREIGN KEY (workout_subpart_id) REFERENCES marketing_workout_subparts (workout_subpart_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, sort_order)
VALUES
  ('MACHINING_PROCESS', 'TURNING', 'Turning', 10),
  ('MACHINING_PROCESS', 'VMC', 'VMC', 20),
  ('MACHINING_PROCESS', 'KEYWAY_SPLINE', 'Keyway / Spline', 30),
  ('MACHINING_PROCESS', 'HEAT_TREATMENT', 'Heat Treatment', 40),
  ('MACHINING_PROCESS', 'SHAPING_GEAR', 'Shaping / Gear', 50),
  ('MACHINING_PROCESS', 'OTHER', 'Other Process', 60),
  ('SUBPART_MATERIAL_TYPE', 'PURCHASE', 'Purchase', 10),
  ('SUBPART_MATERIAL_TYPE', 'MANUFACTURING', 'Manufacturing', 20),
  ('CURRENCY', 'INR', 'Indian Rupee', 10),
  ('CURRENCY', 'EUR', 'Euro', 20),
  ('CURRENCY', 'USD', 'US Dollar', 30),
  ('CURRENCY', 'GBP', 'British Pound', 40)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

UPDATE marketing_reference_values
SET numeric_value = CASE value_code
  WHEN 'INR' THEN 1
  WHEN 'EUR' THEN 85
  WHEN 'USD' THEN 83
  WHEN 'GBP' THEN 108
END,
effective_date = '2026-04-01'
WHERE reference_type = 'CURRENCY'
  AND numeric_value IS NULL;

-- ============================================================================
-- Quotation tables, notes master and quotation sequence
-- Source: quotation-schema.sql
-- ============================================================================

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

-- ============================================================================
-- Repeatable five-part workflow testing data
-- Source: quotation-workflow-test-data.sql
-- ============================================================================

-- ATECH five-item quotation workflow test seed
-- Prerequisite: apply the project database schemas/upgrades before importing this file.
-- Reserved IDs 990001-990006 are used only for this repeatable test dataset.
-- Lines 1, 3 and 5 are feasible/quoted; lines 2 and 4 are not feasible.
-- PDF status is reset because generated files are not embedded in SQL.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

DELETE FROM `marketing_quotation_notes` WHERE `quotation_note_id` IN (990001, 990002, 990003, 990004, 990005, 990006);
DELETE FROM `marketing_quotation_items` WHERE `quotation_item_id` IN (990001, 990002, 990003);
DELETE FROM `marketing_quotations` WHERE `quotation_id` IN (990001);
DELETE FROM `marketing_workout_notes` WHERE `workout_note_id` IN (990001, 990002, 990003);
DELETE FROM `marketing_workout_process_costs` WHERE `workout_process_cost_id` IN (990001, 990002, 990003, 990004, 990005, 990006);
DELETE FROM `marketing_workouts` WHERE `workout_id` IN (990001, 990002, 990003);
DELETE FROM `marketing_regret_letters` WHERE `regret_letter_id` IN (990001, 990002);
DELETE FROM `marketing_feasibilities` WHERE `feasibility_id` IN (990001, 990002, 990003, 990004, 990005);
DELETE FROM `marketing_enquiry_parts` WHERE `enquiry_part_id` IN (990001, 990002, 990003, 990004, 990005);
DELETE FROM `marketing_enquiries` WHERE `enquiry_id` IN (990001);
DELETE FROM `customer_master` WHERE `customer_id` IN (990001);
DELETE FROM `marketing_enquiries` WHERE `doc_no` = 'ENQ/QWF/TEST/0001';
DELETE FROM `customer_master` WHERE `customer_code` = 'CUS/QWF/TEST/0001';

-- customer_master
INSERT INTO `customer_master` (`customer_id`, `party_type`, `customer_code`, `customer_name`, `customer_short_name`, `plant_code`, `billing_address`, `delivery_address`, `delivery_terms`, `pin_code`, `city`, `state_name`, `country_name`, `gst_number`, `pan_number`, `mobile_number`, `phone_number`, `fax_number`, `email_address`, `website_url`, `invoice_type`, `contact_person_name`, `contact_person_mobile`, `contact_person_designation`, `contact_person_department`, `currency_code`, `account_number`, `account_name`, `bank_name`, `branch_name`, `ifsc_code`, `pan_tan_number`, `customer_status`, `active_flag`, `deactivation_remarks`, `other_legal_requirements`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 'CUSTOMER', 'CUS/QWF/TEST/0001', 'Quotation Workflow Test Customer', 'QWF TEST', 'TEST', 'API Integration Test Address, Chennai', 'API Integration Test Address, Chennai', NULL, NULL, NULL, NULL, 'India', NULL, NULL, '9000000000', NULL, NULL, 'quotation.workflow@example.test', NULL, NULL, 'Workflow Test Contact', NULL, NULL, NULL, 'INR', NULL, NULL, NULL, NULL, NULL, NULL, 'ACTIVE', 'Y', NULL, NULL, 'SYSTEM', '2026-07-23 03:31:40', NULL, '2026-07-23 03:31:40');

-- marketing_enquiries
INSERT INTO `marketing_enquiries` (`enquiry_id`, `doc_no`, `customer_id`, `customer_code_snapshot`, `customer_name_snapshot`, `customer_short_name_snapshot`, `enquiry_mode`, `order_type`, `required_date`, `po_reference`, `enquiry_status`, `enquiry_conversion`, `current_stage`, `revision_number`, `revision_date`, `save_status`, `remarks`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 'ENQ/QWF/TEST/0001', 990001, 'CUS/QWF/TEST/0001', 'Quotation Workflow Test Customer', 'QWF TEST', 'MAIL', 'SALES', '2026-07-22 18:30:00', 'QWF-TEST-0001', 'QUOTED', 'QUOTED', 'COMPLETED', NULL, NULL, 'SUBMITTED', 'Five-item quotation workflow API integration test', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_enquiry_parts
INSERT INTO `marketing_enquiry_parts` (`enquiry_part_id`, `enquiry_id`, `part_id`, `line_number`, `part_number`, `item_code`, `drawing_number`, `drawing_revision_number`, `drawing_revision_date`, `product_description`, `material_and_grade`, `required_quantity`, `annual_quantity`, `moq`, `required_date`, `unit_of_measurement`, `part_status`, `save_status`, `active_flag`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 990001, NULL, 1, 'QWF-PART-1', 'QWF-ITEM-1', 'QWF-DWG-01', 'A', NULL, 'Quotation workflow test part 1', 'EN8', '100.000', '1200.000', '25.000', '2026-07-22 18:30:00', 'NOS', 'QUOTED', 'SUBMITTED', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_enquiry_parts` (`enquiry_part_id`, `enquiry_id`, `part_id`, `line_number`, `part_number`, `item_code`, `drawing_number`, `drawing_revision_number`, `drawing_revision_date`, `product_description`, `material_and_grade`, `required_quantity`, `annual_quantity`, `moq`, `required_date`, `unit_of_measurement`, `part_status`, `save_status`, `active_flag`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990002, 990001, NULL, 2, 'QWF-PART-2', 'QWF-ITEM-2', 'QWF-DWG-02', 'A', NULL, 'Quotation workflow test part 2', 'EN8', '200.000', '2400.000', '25.000', '2026-07-22 18:30:00', 'NOS', 'NOT_FEASIBLE', 'SUBMITTED', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:40');
INSERT INTO `marketing_enquiry_parts` (`enquiry_part_id`, `enquiry_id`, `part_id`, `line_number`, `part_number`, `item_code`, `drawing_number`, `drawing_revision_number`, `drawing_revision_date`, `product_description`, `material_and_grade`, `required_quantity`, `annual_quantity`, `moq`, `required_date`, `unit_of_measurement`, `part_status`, `save_status`, `active_flag`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990003, 990001, NULL, 3, 'QWF-PART-3', 'QWF-ITEM-3', 'QWF-DWG-03', 'A', NULL, 'Quotation workflow test part 3', 'EN8', '300.000', '3600.000', '25.000', '2026-07-22 18:30:00', 'NOS', 'QUOTED', 'SUBMITTED', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_enquiry_parts` (`enquiry_part_id`, `enquiry_id`, `part_id`, `line_number`, `part_number`, `item_code`, `drawing_number`, `drawing_revision_number`, `drawing_revision_date`, `product_description`, `material_and_grade`, `required_quantity`, `annual_quantity`, `moq`, `required_date`, `unit_of_measurement`, `part_status`, `save_status`, `active_flag`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990004, 990001, NULL, 4, 'QWF-PART-4', 'QWF-ITEM-4', 'QWF-DWG-04', 'A', NULL, 'Quotation workflow test part 4', 'EN8', '400.000', '4800.000', '25.000', '2026-07-22 18:30:00', 'NOS', 'NOT_FEASIBLE', 'SUBMITTED', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_enquiry_parts` (`enquiry_part_id`, `enquiry_id`, `part_id`, `line_number`, `part_number`, `item_code`, `drawing_number`, `drawing_revision_number`, `drawing_revision_date`, `product_description`, `material_and_grade`, `required_quantity`, `annual_quantity`, `moq`, `required_date`, `unit_of_measurement`, `part_status`, `save_status`, `active_flag`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990005, 990001, NULL, 5, 'QWF-PART-5', 'QWF-ITEM-5', 'QWF-DWG-05', 'A', NULL, 'Quotation workflow test part 5', 'EN8', '500.000', '6000.000', '25.000', '2026-07-22 18:30:00', 'NOS', 'QUOTED', 'SUBMITTED', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_feasibilities
INSERT INTO `marketing_feasibilities` (`feasibility_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_date`, `communication_address`, `contact_person`, `telephone_number`, `fax_number`, `email_address`, `is_new_customer`, `existing_products_details`, `similar_product_processing`, `similar_product_details`, `drawing_reviewed_completely`, `drawing_requirements_understood`, `customer_clarification_required`, `product_technically_feasible`, `tolerance_achievable`, `acceptance_criteria_understood`, `customer_special_characteristics`, `special_characteristics_details`, `customer_final_inspection_format`, `final_inspection_format_details`, `batch_supply_reports`, `customer_required_volume`, `volume_uom`, `statutory_requirements`, `customer_specified_packing`, `packing_details`, `customer_specified_labelling`, `labelling_details`, `transportation_mode`, `customer_specified_transporter`, `transporter_details`, `freight_paid_by`, `payment_terms`, `feasibility_decision`, `regret_reason`, `final_remarks`, `save_status`, `feasibility_check_completed_on`, `closed_by_code`, `closed_by_name`, `closed_by_role`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 990001, 990001, '2026-07-22 18:30:00', 'API Integration Test Address, Chennai', 'Workflow Test Contact', '9000000000', NULL, 'quotation.workflow@example.test', 'YES', NULL, 'NO', NULL, 'YES', 'YES', NULL, 'YES', 'YES', 'YES', 'NO', NULL, 'NO', NULL, 'Material certificate with every batch', '100.000', 'NOS', 'Standard statutory requirements', 'NO', NULL, 'NO', NULL, 'ROAD', 'NO', NULL, 'BY_COMPANY', 'Net 30 Days', 'FEASIBLE', NULL, 'Approved for commercial workout.', 'CLOSED', '2026-07-23 03:31:40', 'SYSTEM', 'System Administrator', 'Administrator', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:40');
INSERT INTO `marketing_feasibilities` (`feasibility_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_date`, `communication_address`, `contact_person`, `telephone_number`, `fax_number`, `email_address`, `is_new_customer`, `existing_products_details`, `similar_product_processing`, `similar_product_details`, `drawing_reviewed_completely`, `drawing_requirements_understood`, `customer_clarification_required`, `product_technically_feasible`, `tolerance_achievable`, `acceptance_criteria_understood`, `customer_special_characteristics`, `special_characteristics_details`, `customer_final_inspection_format`, `final_inspection_format_details`, `batch_supply_reports`, `customer_required_volume`, `volume_uom`, `statutory_requirements`, `customer_specified_packing`, `packing_details`, `customer_specified_labelling`, `labelling_details`, `transportation_mode`, `customer_specified_transporter`, `transporter_details`, `freight_paid_by`, `payment_terms`, `feasibility_decision`, `regret_reason`, `final_remarks`, `save_status`, `feasibility_check_completed_on`, `closed_by_code`, `closed_by_name`, `closed_by_role`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990002, 990001, 990002, '2026-07-22 18:30:00', 'API Integration Test Address, Chennai', 'Workflow Test Contact', '9000000000', NULL, 'quotation.workflow@example.test', 'YES', NULL, 'NO', NULL, 'YES', 'YES', NULL, 'NO', 'NO', 'NO', 'NO', NULL, 'NO', NULL, 'Material certificate with every batch', '200.000', 'NOS', 'Standard statutory requirements', 'NO', NULL, 'NO', NULL, 'ROAD', 'NO', NULL, 'BY_COMPANY', 'Net 30 Days', 'NOT_FEASIBLE', 'Required tolerance is outside the available process capability.', 'Regret communication required.', 'CLOSED', '2026-07-23 03:31:40', 'SYSTEM', 'System Administrator', 'Administrator', 'Y', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:40');
INSERT INTO `marketing_feasibilities` (`feasibility_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_date`, `communication_address`, `contact_person`, `telephone_number`, `fax_number`, `email_address`, `is_new_customer`, `existing_products_details`, `similar_product_processing`, `similar_product_details`, `drawing_reviewed_completely`, `drawing_requirements_understood`, `customer_clarification_required`, `product_technically_feasible`, `tolerance_achievable`, `acceptance_criteria_understood`, `customer_special_characteristics`, `special_characteristics_details`, `customer_final_inspection_format`, `final_inspection_format_details`, `batch_supply_reports`, `customer_required_volume`, `volume_uom`, `statutory_requirements`, `customer_specified_packing`, `packing_details`, `customer_specified_labelling`, `labelling_details`, `transportation_mode`, `customer_specified_transporter`, `transporter_details`, `freight_paid_by`, `payment_terms`, `feasibility_decision`, `regret_reason`, `final_remarks`, `save_status`, `feasibility_check_completed_on`, `closed_by_code`, `closed_by_name`, `closed_by_role`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990003, 990001, 990003, '2026-07-22 18:30:00', 'API Integration Test Address, Chennai', 'Workflow Test Contact', '9000000000', NULL, 'quotation.workflow@example.test', 'YES', NULL, 'NO', NULL, 'YES', 'YES', NULL, 'YES', 'YES', 'YES', 'NO', NULL, 'NO', NULL, 'Material certificate with every batch', '300.000', 'NOS', 'Standard statutory requirements', 'NO', NULL, 'NO', NULL, 'ROAD', 'NO', NULL, 'BY_COMPANY', 'Net 30 Days', 'FEASIBLE', NULL, 'Approved for commercial workout.', 'CLOSED', '2026-07-23 03:31:41', 'SYSTEM', 'System Administrator', 'Administrator', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_feasibilities` (`feasibility_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_date`, `communication_address`, `contact_person`, `telephone_number`, `fax_number`, `email_address`, `is_new_customer`, `existing_products_details`, `similar_product_processing`, `similar_product_details`, `drawing_reviewed_completely`, `drawing_requirements_understood`, `customer_clarification_required`, `product_technically_feasible`, `tolerance_achievable`, `acceptance_criteria_understood`, `customer_special_characteristics`, `special_characteristics_details`, `customer_final_inspection_format`, `final_inspection_format_details`, `batch_supply_reports`, `customer_required_volume`, `volume_uom`, `statutory_requirements`, `customer_specified_packing`, `packing_details`, `customer_specified_labelling`, `labelling_details`, `transportation_mode`, `customer_specified_transporter`, `transporter_details`, `freight_paid_by`, `payment_terms`, `feasibility_decision`, `regret_reason`, `final_remarks`, `save_status`, `feasibility_check_completed_on`, `closed_by_code`, `closed_by_name`, `closed_by_role`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990004, 990001, 990004, '2026-07-22 18:30:00', 'API Integration Test Address, Chennai', 'Workflow Test Contact', '9000000000', NULL, 'quotation.workflow@example.test', 'YES', NULL, 'NO', NULL, 'YES', 'YES', NULL, 'NO', 'NO', 'NO', 'NO', NULL, 'NO', NULL, 'Material certificate with every batch', '400.000', 'NOS', 'Standard statutory requirements', 'NO', NULL, 'NO', NULL, 'ROAD', 'NO', NULL, 'BY_COMPANY', 'Net 30 Days', 'NOT_FEASIBLE', 'Required tolerance is outside the available process capability.', 'Regret communication required.', 'CLOSED', '2026-07-23 03:31:41', 'SYSTEM', 'System Administrator', 'Administrator', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_feasibilities` (`feasibility_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_date`, `communication_address`, `contact_person`, `telephone_number`, `fax_number`, `email_address`, `is_new_customer`, `existing_products_details`, `similar_product_processing`, `similar_product_details`, `drawing_reviewed_completely`, `drawing_requirements_understood`, `customer_clarification_required`, `product_technically_feasible`, `tolerance_achievable`, `acceptance_criteria_understood`, `customer_special_characteristics`, `special_characteristics_details`, `customer_final_inspection_format`, `final_inspection_format_details`, `batch_supply_reports`, `customer_required_volume`, `volume_uom`, `statutory_requirements`, `customer_specified_packing`, `packing_details`, `customer_specified_labelling`, `labelling_details`, `transportation_mode`, `customer_specified_transporter`, `transporter_details`, `freight_paid_by`, `payment_terms`, `feasibility_decision`, `regret_reason`, `final_remarks`, `save_status`, `feasibility_check_completed_on`, `closed_by_code`, `closed_by_name`, `closed_by_role`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990005, 990001, 990005, '2026-07-22 18:30:00', 'API Integration Test Address, Chennai', 'Workflow Test Contact', '9000000000', NULL, 'quotation.workflow@example.test', 'YES', NULL, 'NO', NULL, 'YES', 'YES', NULL, 'YES', 'YES', 'YES', 'NO', NULL, 'NO', NULL, 'Material certificate with every batch', '500.000', 'NOS', 'Standard statutory requirements', 'NO', NULL, 'NO', NULL, 'ROAD', 'NO', NULL, 'BY_COMPANY', 'Net 30 Days', 'FEASIBLE', NULL, 'Approved for commercial workout.', 'CLOSED', '2026-07-23 03:31:41', 'SYSTEM', 'System Administrator', 'Administrator', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_regret_letters
INSERT INTO `marketing_regret_letters` (`regret_letter_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_id`, `letter_status`, `regret_reason`, `generated_on`, `approved_on`, `approved_by`, `sent_on`, `sent_by`, `file_path`, `letter_content`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 990001, 990002, 990002, 'APPROVED', 'Required tolerance is outside the available process capability.', '2026-07-23 03:31:41', '2026-07-23 03:31:41', 'SYSTEM', NULL, NULL, NULL, '<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Regret Letter - ENQ/QWF/TEST/0001</title>\n<style>body{font-family:Arial,sans-serif;color:#202634;max-width:760px;margin:36px auto;line-height:1.6}header{border-bottom:3px solid #b8322a;padding-bottom:14px;margin-bottom:28px}h1{font-size:22px;margin:0;color:#253a83}.meta{color:#657087;font-size:13px}.subject{font-weight:700;margin:24px 0 16px}.signature{margin-top:44px}.reason{padding:12px 14px;background:#f7f8fb;border-left:4px solid #b8322a}</style></head>\n<body><header><h1>A Tech Automation Pvt. Ltd.</h1><div class=\"meta\">Feasibility Review Regret Letter</div></header>\n<p>Date: 23 July 2026</p><p>To,<br><strong>Quotation Workflow Test Customer</strong><br>API Integration Test Address, Chennai</p>\n<p class=\"subject\">Subject: Regret against enquiry ENQ/QWF/TEST/0001 - Quotation workflow test part 2</p>\n<p>Dear Sir / Madam,</p><p>Thank you for giving us the opportunity to review the following requirement:</p>\n<p><strong>Drawing:</strong> QWF-DWG-02 / Rev. A<br><strong>Material:</strong> EN8</p>\n<p>After completing our technical and commercial feasibility review, we regret that we are unable to proceed with this requirement at present.</p>\n<div class=\"reason\"><strong>Reason:</strong><br>Required tolerance is outside the available process capability.</div>\n<p>We appreciate your enquiry and look forward to supporting your future requirements.</p>\n<p class=\"signature\">For A Tech Automation Pvt. Ltd.<br><strong>System Administrator</strong><br>Administrator</p></body></html>', 'SYSTEM', '2026-07-23 03:31:40', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_regret_letters` (`regret_letter_id`, `enquiry_id`, `enquiry_part_id`, `feasibility_id`, `letter_status`, `regret_reason`, `generated_on`, `approved_on`, `approved_by`, `sent_on`, `sent_by`, `file_path`, `letter_content`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990002, 990001, 990004, 990004, 'APPROVED', 'Required tolerance is outside the available process capability.', '2026-07-23 03:31:41', '2026-07-23 03:31:41', 'SYSTEM', NULL, NULL, NULL, '<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Regret Letter - ENQ/QWF/TEST/0001</title>\n<style>body{font-family:Arial,sans-serif;color:#202634;max-width:760px;margin:36px auto;line-height:1.6}header{border-bottom:3px solid #b8322a;padding-bottom:14px;margin-bottom:28px}h1{font-size:22px;margin:0;color:#253a83}.meta{color:#657087;font-size:13px}.subject{font-weight:700;margin:24px 0 16px}.signature{margin-top:44px}.reason{padding:12px 14px;background:#f7f8fb;border-left:4px solid #b8322a}</style></head>\n<body><header><h1>A Tech Automation Pvt. Ltd.</h1><div class=\"meta\">Feasibility Review Regret Letter</div></header>\n<p>Date: 23 July 2026</p><p>To,<br><strong>Quotation Workflow Test Customer</strong><br>API Integration Test Address, Chennai</p>\n<p class=\"subject\">Subject: Regret against enquiry ENQ/QWF/TEST/0001 - Quotation workflow test part 4</p>\n<p>Dear Sir / Madam,</p><p>Thank you for giving us the opportunity to review the following requirement:</p>\n<p><strong>Drawing:</strong> QWF-DWG-04 / Rev. A<br><strong>Material:</strong> EN8</p>\n<p>After completing our technical and commercial feasibility review, we regret that we are unable to proceed with this requirement at present.</p>\n<div class=\"reason\"><strong>Reason:</strong><br>Required tolerance is outside the available process capability.</div>\n<p>We appreciate your enquiry and look forward to supporting your future requirements.</p>\n<p class=\"signature\">For A Tech Automation Pvt. Ltd.<br><strong>System Administrator</strong><br>Administrator</p></body></html>', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_workouts
INSERT INTO `marketing_workouts` (`workout_id`, `workout_no`, `enquiry_id`, `enquiry_part_id`, `workout_date`, `reference_no`, `currency_code`, `currency_rate`, `exchange_rate_effective_date`, `overhead_profit_percent`, `profit_calculation_type`, `profit_value`, `commission_percent`, `payment_terms`, `development_time`, `pilot_batch_delivery`, `item_code`, `machining_drawing_number`, `revision_number`, `description`, `annual_quantity`, `required_quantity_snapshot`, `moq`, `material`, `weight_kg`, `material_rate_per_kg`, `additional_material_cost_inr`, `material_cost_inr`, `material_cost_foreign`, `turning_cost_inr`, `vmc_cost_inr`, `keyway_spline_cost_inr`, `heat_treatment_cost_inr`, `shaping_gear_cost_inr`, `packing_forwarding_cost_inr`, `total_machining_cost_inr`, `overhead_profit_amount_inr`, `profit_amount_inr`, `adjusted_machining_cost_inr`, `adjusted_machining_cost_foreign`, `part_cost_with_overhead_inr`, `part_cost_with_overhead_foreign`, `machining_cost_with_va_inr`, `packing_cost_foreign`, `part_price_fob_inr`, `part_price_fob_foreign`, `commission_amount_inr`, `commission_amount_foreign`, `final_part_price_fob_inr`, `final_part_price_fob_foreign`, `pattern_cost_inr`, `fixture_cost_inr`, `special_tool_cost_inr`, `gauge_cost_inr`, `trial_cost_inr`, `total_development_cost_inr`, `total_development_cost_foreign`, `save_status`, `active_flag`, `submitted_by`, `submitted_on`, `completed_by_name`, `completed_by_role`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 'ENQ/QWF/TEST/0001/01', 990001, 990001, '2026-07-22 18:30:00', 'QWF-TEST-0001', 'EUR', '100.000000', '2026-07-22 18:30:00', '12.0000', 'PERCENTAGE', '15.0000', '2.0000', 'Net 30 Days', '4 weeks', '6 weeks', 'QWF-ITEM-1', 'QWF-DWG-01', 'A', 'Quotation workflow test part 1', '1200.000', '100.000', '25.000', 'EN8', '3.0000', '90.0000', '25.0000', '295.0000', '2.9500', '650.0000', '850.0000', '0.0000', '0.0000', '0.0000', '50.0000', '1500.0000', '180.0000', '252.0000', '1932.0000', '19.3200', '1932.0000', '19.3200', '1500.0000', '0.5000', '2277.0000', '22.7700', '45.5400', '0.4554', '2322.5400', '23.2254', '1000.0000', '500.0000', '250.0000', '150.0000', '100.0000', '2000.0000', '20.0000', 'COMPLETED', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'System Administrator', 'Administrator', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workouts` (`workout_id`, `workout_no`, `enquiry_id`, `enquiry_part_id`, `workout_date`, `reference_no`, `currency_code`, `currency_rate`, `exchange_rate_effective_date`, `overhead_profit_percent`, `profit_calculation_type`, `profit_value`, `commission_percent`, `payment_terms`, `development_time`, `pilot_batch_delivery`, `item_code`, `machining_drawing_number`, `revision_number`, `description`, `annual_quantity`, `required_quantity_snapshot`, `moq`, `material`, `weight_kg`, `material_rate_per_kg`, `additional_material_cost_inr`, `material_cost_inr`, `material_cost_foreign`, `turning_cost_inr`, `vmc_cost_inr`, `keyway_spline_cost_inr`, `heat_treatment_cost_inr`, `shaping_gear_cost_inr`, `packing_forwarding_cost_inr`, `total_machining_cost_inr`, `overhead_profit_amount_inr`, `profit_amount_inr`, `adjusted_machining_cost_inr`, `adjusted_machining_cost_foreign`, `part_cost_with_overhead_inr`, `part_cost_with_overhead_foreign`, `machining_cost_with_va_inr`, `packing_cost_foreign`, `part_price_fob_inr`, `part_price_fob_foreign`, `commission_amount_inr`, `commission_amount_foreign`, `final_part_price_fob_inr`, `final_part_price_fob_foreign`, `pattern_cost_inr`, `fixture_cost_inr`, `special_tool_cost_inr`, `gauge_cost_inr`, `trial_cost_inr`, `total_development_cost_inr`, `total_development_cost_foreign`, `save_status`, `active_flag`, `submitted_by`, `submitted_on`, `completed_by_name`, `completed_by_role`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990002, 'ENQ/QWF/TEST/0001/03', 990001, 990003, '2026-07-22 18:30:00', 'QWF-TEST-0001', 'EUR', '100.000000', '2026-07-22 18:30:00', '12.0000', 'PERCENTAGE', '15.0000', '2.0000', 'Net 30 Days', '4 weeks', '6 weeks', 'QWF-ITEM-3', 'QWF-DWG-03', 'A', 'Quotation workflow test part 3', '3600.000', '300.000', '25.000', 'EN8', '5.0000', '90.0000', '25.0000', '475.0000', '4.7500', '750.0000', '950.0000', '0.0000', '0.0000', '0.0000', '50.0000', '1700.0000', '204.0000', '285.6000', '2189.6000', '21.8960', '2189.6000', '21.8960', '1700.0000', '0.5000', '2714.6000', '27.1460', '54.2900', '0.5429', '2768.8900', '27.6889', '3000.0000', '1500.0000', '750.0000', '450.0000', '300.0000', '6000.0000', '60.0000', 'COMPLETED', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'System Administrator', 'Administrator', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workouts` (`workout_id`, `workout_no`, `enquiry_id`, `enquiry_part_id`, `workout_date`, `reference_no`, `currency_code`, `currency_rate`, `exchange_rate_effective_date`, `overhead_profit_percent`, `profit_calculation_type`, `profit_value`, `commission_percent`, `payment_terms`, `development_time`, `pilot_batch_delivery`, `item_code`, `machining_drawing_number`, `revision_number`, `description`, `annual_quantity`, `required_quantity_snapshot`, `moq`, `material`, `weight_kg`, `material_rate_per_kg`, `additional_material_cost_inr`, `material_cost_inr`, `material_cost_foreign`, `turning_cost_inr`, `vmc_cost_inr`, `keyway_spline_cost_inr`, `heat_treatment_cost_inr`, `shaping_gear_cost_inr`, `packing_forwarding_cost_inr`, `total_machining_cost_inr`, `overhead_profit_amount_inr`, `profit_amount_inr`, `adjusted_machining_cost_inr`, `adjusted_machining_cost_foreign`, `part_cost_with_overhead_inr`, `part_cost_with_overhead_foreign`, `machining_cost_with_va_inr`, `packing_cost_foreign`, `part_price_fob_inr`, `part_price_fob_foreign`, `commission_amount_inr`, `commission_amount_foreign`, `final_part_price_fob_inr`, `final_part_price_fob_foreign`, `pattern_cost_inr`, `fixture_cost_inr`, `special_tool_cost_inr`, `gauge_cost_inr`, `trial_cost_inr`, `total_development_cost_inr`, `total_development_cost_foreign`, `save_status`, `active_flag`, `submitted_by`, `submitted_on`, `completed_by_name`, `completed_by_role`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990003, 'ENQ/QWF/TEST/0001/05', 990001, 990005, '2026-07-22 18:30:00', 'QWF-TEST-0001', 'EUR', '100.000000', '2026-07-22 18:30:00', '12.0000', 'PERCENTAGE', '15.0000', '2.0000', 'Net 30 Days', '4 weeks', '6 weeks', 'QWF-ITEM-5', 'QWF-DWG-05', 'A', 'Quotation workflow test part 5', '6000.000', '500.000', '25.000', 'EN8', '7.0000', '90.0000', '25.0000', '655.0000', '6.5500', '850.0000', '1050.0000', '0.0000', '0.0000', '0.0000', '50.0000', '1900.0000', '228.0000', '319.2000', '2447.2000', '24.4720', '2447.2000', '24.4720', '1900.0000', '0.5000', '3152.2000', '31.5220', '63.0400', '0.6304', '3215.2400', '32.1524', '5000.0000', '2500.0000', '1250.0000', '750.0000', '500.0000', '10000.0000', '100.0000', 'COMPLETED', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'System Administrator', 'Administrator', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_workout_process_costs
INSERT INTO `marketing_workout_process_costs` (`workout_process_cost_id`, `workout_id`, `process_type`, `process_description`, `cost_inr`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990001, 990001, 'TURNING', 'CNC turning', '650.0000', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_process_costs` (`workout_process_cost_id`, `workout_id`, `process_type`, `process_description`, `cost_inr`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990002, 990001, 'VMC', 'VMC machining', '850.0000', 2, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_process_costs` (`workout_process_cost_id`, `workout_id`, `process_type`, `process_description`, `cost_inr`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990003, 990002, 'TURNING', 'CNC turning', '750.0000', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_process_costs` (`workout_process_cost_id`, `workout_id`, `process_type`, `process_description`, `cost_inr`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990004, 990002, 'VMC', 'VMC machining', '950.0000', 2, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_process_costs` (`workout_process_cost_id`, `workout_id`, `process_type`, `process_description`, `cost_inr`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990005, 990003, 'TURNING', 'CNC turning', '850.0000', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_process_costs` (`workout_process_cost_id`, `workout_id`, `process_type`, `process_description`, `cost_inr`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990006, 990003, 'VMC', 'VMC machining', '1050.0000', 2, 'Y', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_workout_notes
INSERT INTO `marketing_workout_notes` (`workout_note_id`, `workout_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990001, 990001, 'API test cost sheet for item 1', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_notes` (`workout_note_id`, `workout_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990002, 990002, 'API test cost sheet for item 3', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_workout_notes` (`workout_note_id`, `workout_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990003, 990003, 'API test cost sheet for item 5', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_quotations
INSERT INTO `marketing_quotations` (`quotation_id`, `quotation_no`, `enquiry_id`, `quotation_date`, `quote_for`, `reference_no`, `customer_id`, `customer_code_snapshot`, `customer_name_snapshot`, `customer_address_snapshot`, `customer_email_snapshot`, `salutation`, `introduction`, `currency_code`, `revision_number`, `revision_date`, `quotation_status`, `pdf_status`, `pdf_file_path`, `pdf_generated_on`, `email_status`, `email_to`, `email_subject`, `email_sent_on`, `email_sent_by`, `email_failure_reason`, `finalized_by`, `finalized_by_name`, `finalized_by_role`, `finalized_on`, `active_flag`, `submitted_by`, `submitted_on`, `created_by`, `created_on`, `updated_by`, `updated_on`) VALUES (990001, 'QUO/QWF/TEST/0001', 990001, '2026-07-22 18:30:00', 'ENQ/QWF/TEST/0001', 'QWF-TEST-0001', 990001, 'CUS/QWF/TEST/0001', 'Quotation Workflow Test Customer', 'API Integration Test Address, Chennai', 'quotation.workflow@example.test', 'Dear Sir / Madam,', 'Please find our quotation for the feasible items from your enquiry.', 'EUR', NULL, NULL, 'FINALIZED', 'NOT_GENERATED', NULL, NULL, 'NOT_SENT', NULL, NULL, NULL, NULL, NULL, 'SYSTEM', 'System Administrator', 'Administrator', '2026-07-23 03:31:41', 'Y', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_quotation_items
INSERT INTO `marketing_quotation_items` (`quotation_item_id`, `quotation_id`, `enquiry_part_id`, `workout_id`, `line_number`, `item_code`, `machining_drawing_number`, `revision_number`, `description`, `annual_quantity`, `required_quantity`, `moq`, `material`, `weight_kg`, `currency_code`, `part_price_fob_inr`, `part_price_fob_foreign`, `total_development_cost_inr`, `total_development_cost_foreign`, `active_flag`, `created_by`, `created_on`) VALUES (990001, 990001, 990001, 990001, 1, 'QWF-ITEM-1', 'QWF-DWG-01', 'A', 'Quotation workflow test part 1', '1200.000', '100.000', '25.000', 'EN8', '3.0000', 'EUR', '2322.5400', '23.2254', '2000.0000', '20.0000', 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_items` (`quotation_item_id`, `quotation_id`, `enquiry_part_id`, `workout_id`, `line_number`, `item_code`, `machining_drawing_number`, `revision_number`, `description`, `annual_quantity`, `required_quantity`, `moq`, `material`, `weight_kg`, `currency_code`, `part_price_fob_inr`, `part_price_fob_foreign`, `total_development_cost_inr`, `total_development_cost_foreign`, `active_flag`, `created_by`, `created_on`) VALUES (990002, 990001, 990003, 990002, 2, 'QWF-ITEM-3', 'QWF-DWG-03', 'A', 'Quotation workflow test part 3', '3600.000', '300.000', '25.000', 'EN8', '5.0000', 'EUR', '2768.8900', '27.6889', '6000.0000', '60.0000', 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_items` (`quotation_item_id`, `quotation_id`, `enquiry_part_id`, `workout_id`, `line_number`, `item_code`, `machining_drawing_number`, `revision_number`, `description`, `annual_quantity`, `required_quantity`, `moq`, `material`, `weight_kg`, `currency_code`, `part_price_fob_inr`, `part_price_fob_foreign`, `total_development_cost_inr`, `total_development_cost_foreign`, `active_flag`, `created_by`, `created_on`) VALUES (990003, 990001, 990005, 990003, 3, 'QWF-ITEM-5', 'QWF-DWG-05', 'A', 'Quotation workflow test part 5', '6000.000', '500.000', '25.000', 'EN8', '7.0000', 'EUR', '3215.2400', '32.1524', '10000.0000', '100.0000', 'Y', 'SYSTEM', '2026-07-23 03:31:41');

-- marketing_quotation_notes
INSERT INTO `marketing_quotation_notes` (`quotation_note_id`, `quotation_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990001, 990001, 'Part prices are quoted FOB Chennai.', 1, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_notes` (`quotation_note_id`, `quotation_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990002, 990001, 'Payment terms are 30 days from the date of Bill of Lading.', 2, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_notes` (`quotation_note_id`, `quotation_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990003, 990001, 'Supply quantity is subject to the MOQ stated against each item.', 3, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_notes` (`quotation_note_id`, `quotation_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990004, 990001, 'Prices are based on the quotation currency and exchange rate used in the completed Workout.', 4, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_notes` (`quotation_note_id`, `quotation_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990005, 990001, 'This quotation is valid for 30 days from the quotation date.', 5, 'Y', 'SYSTEM', '2026-07-23 03:31:41');
INSERT INTO `marketing_quotation_notes` (`quotation_note_id`, `quotation_id`, `note_text`, `display_order`, `active_flag`, `created_by`, `created_on`) VALUES (990006, 990001, 'Development time and pilot batch delivery are as stated in the completed Workout.', 6, 'Y', 'SYSTEM', '2026-07-23 03:31:41');

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

-- Verification
SELECT enquiry_id, doc_no, current_stage, enquiry_status, enquiry_conversion
FROM marketing_enquiries WHERE enquiry_id = 990001;
SELECT line_number, part_number, part_status
FROM marketing_enquiry_parts WHERE enquiry_id = 990001 ORDER BY line_number;
SELECT quotation_no, quotation_status, pdf_status
FROM marketing_quotations WHERE enquiry_id = 990001;
