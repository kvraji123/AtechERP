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
  actual_material_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
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
  sample_cost_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  sample_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0,
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
  total_cycle_time_seconds DECIMAL(14,4) NULL,
  machine_cost_inr DECIMAL(18,4) NULL,
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
  total_cycle_time_seconds DECIMAL(14,4) NULL,
  machine_cost_inr DECIMAL(18,4) NULL,
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
  ('SUBPART_MATERIAL_TYPE', 'PURCHASE', 'Purchase', 10),
  ('SUBPART_MATERIAL_TYPE', 'MANUFACTURING', 'Manufacturing', 20)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, numeric_value, sort_order)
VALUES
  ('MACHINING_PROCESS', 'TURNING', 'Turning', 300, 10),
  ('MACHINING_PROCESS', 'VMC', 'VMC', 500, 20),
  ('MACHINING_PROCESS', 'HMC', 'HMC', 1000, 30),
  ('MACHINING_PROCESS', 'KEYWAY_SPLINE', 'Keyway / Spline', NULL, 40),
  ('MACHINING_PROCESS', 'HEAT_TREATMENT', 'Heat Treatment', NULL, 50),
  ('MACHINING_PROCESS', 'SHAPING_GEAR', 'Shaping / Gear', NULL, 60),
  ('MACHINING_PROCESS', 'OTHER', 'Other Process', NULL, 70),
  ('CURRENCY', 'INR', 'Indian Rupee', NULL, 10),
  ('CURRENCY', 'EUR', 'Euro', NULL, 20),
  ('CURRENCY', 'USD', 'US Dollar', NULL, 30),
  ('CURRENCY', 'GBP', 'British Pound', NULL, 40)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  numeric_value = COALESCE(numeric_value, VALUES(numeric_value)),
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
