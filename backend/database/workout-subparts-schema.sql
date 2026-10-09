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

INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, sort_order)
VALUES
  ('SUBPART_MATERIAL_TYPE', 'PURCHASE', 'Purchase', 10),
  ('SUBPART_MATERIAL_TYPE', 'MANUFACTURING', 'Manufacturing', 20)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

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
