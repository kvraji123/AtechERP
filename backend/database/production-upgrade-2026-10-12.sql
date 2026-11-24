-- ============================================================================
-- A TECH AUTOMATION ERP - PRODUCTION UPGRADE (12 October 2026)
-- ============================================================================
-- Run this file in Adminer after selecting the LIVE ATECH ERP database.
--
-- It is safe to run again: every column addition is skipped when the column
-- already exists. It supports MySQL 5.7+ and does not use
-- the unsupported MySQL conditional-column-add syntax.
--
-- Take a database backup before running any production migration.
-- Do NOT run a Node migration script for the same changes after this file has
-- completed successfully.
-- ============================================================================

-- Customer enquiry / request reference fields
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_enquiries'
      AND COLUMN_NAME = 'customer_enquiry_reference'),
  'SELECT ''marketing_enquiries.customer_enquiry_reference already exists'' AS result',
  'ALTER TABLE marketing_enquiries ADD COLUMN customer_enquiry_reference VARCHAR(100) NULL AFTER required_date'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_enquiries'
      AND COLUMN_NAME = 'customer_enquiry_date'),
  'SELECT ''marketing_enquiries.customer_enquiry_date already exists'' AS result',
  'ALTER TABLE marketing_enquiries ADD COLUMN customer_enquiry_date DATE NULL AFTER customer_enquiry_reference'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Item Master HSN tax percentage
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master'
      AND COLUMN_NAME = 'tax_percent'),
  'SELECT ''item_master.tax_percent already exists'' AS result',
  'ALTER TABLE item_master ADD COLUMN tax_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000 AFTER hsn_code'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Assembled-part workout fields
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_enquiry_parts'
      AND COLUMN_NAME = 'is_assembled_part'),
  'SELECT ''marketing_enquiry_parts.is_assembled_part already exists'' AS result',
  'ALTER TABLE marketing_enquiry_parts ADD COLUMN is_assembled_part TINYINT(1) NOT NULL DEFAULT 0 AFTER alternative_material'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workouts'
      AND COLUMN_NAME = 'assembly_labour_cost_inr'),
  'SELECT ''marketing_workouts.assembly_labour_cost_inr already exists'' AS result',
  'ALTER TABLE marketing_workouts ADD COLUMN assembly_labour_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER additional_material_cost_inr'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Workout sample cost and sample-cost percentage
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workouts'
      AND COLUMN_NAME = 'sample_cost_inr'),
  'SELECT ''marketing_workouts.sample_cost_inr already exists'' AS result',
  'ALTER TABLE marketing_workouts ADD COLUMN sample_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER trial_cost_inr'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workouts'
      AND COLUMN_NAME = 'sample_cost_percent'),
  'SELECT ''marketing_workouts.sample_cost_percent already exists'' AS result',
  'ALTER TABLE marketing_workouts ADD COLUMN sample_cost_percent DECIMAL(7,4) NOT NULL DEFAULT 0 AFTER trial_cost_inr'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Main-part process cycle time and machine cost
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workout_process_costs'
      AND COLUMN_NAME = 'total_cycle_time_seconds'),
  'SELECT ''marketing_workout_process_costs.total_cycle_time_seconds already exists'' AS result',
  'ALTER TABLE marketing_workout_process_costs ADD COLUMN total_cycle_time_seconds DECIMAL(14,4) NULL AFTER process_description'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workout_process_costs'
      AND COLUMN_NAME = 'machine_cost_inr'),
  'SELECT ''marketing_workout_process_costs.machine_cost_inr already exists'' AS result',
  'ALTER TABLE marketing_workout_process_costs ADD COLUMN machine_cost_inr DECIMAL(18,4) NULL AFTER total_cycle_time_seconds'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Sub-part workout tables (created only when absent)
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

-- Add the process fields when the sub-part process table was created by an
-- earlier version of the application.
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workout_subpart_process_costs'
      AND COLUMN_NAME = 'total_cycle_time_seconds'),
  'SELECT ''marketing_workout_subpart_process_costs.total_cycle_time_seconds already exists'' AS result',
  'ALTER TABLE marketing_workout_subpart_process_costs ADD COLUMN total_cycle_time_seconds DECIMAL(14,4) NULL AFTER process_description'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workout_subpart_process_costs'
      AND COLUMN_NAME = 'machine_cost_inr'),
  'SELECT ''marketing_workout_subpart_process_costs.machine_cost_inr already exists'' AS result',
  'ALTER TABLE marketing_workout_subpart_process_costs ADD COLUMN machine_cost_inr DECIMAL(18,4) NULL AFTER total_cycle_time_seconds'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Convert legacy sub-part cycle times stored in minutes to seconds when the
-- former column is present.
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_workout_subpart_process_costs'
      AND COLUMN_NAME = 'total_cycle_time_minutes'),
  'UPDATE marketing_workout_subpart_process_costs SET total_cycle_time_seconds = COALESCE(total_cycle_time_seconds, total_cycle_time_minutes * 60)',
  'SELECT ''No legacy total_cycle_time_minutes column to convert'' AS result'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Process master rates. Existing non-null user-configured rates are retained.
INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, numeric_value, sort_order, active_flag)
VALUES
  ('MACHINING_PROCESS', 'TURNING', 'Turning', 300, 10, 'Y'),
  ('MACHINING_PROCESS', 'VMC', 'VMC', 500, 20, 'Y'),
  ('MACHINING_PROCESS', 'HMC', 'HMC', 1000, 30, 'Y')
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  numeric_value = COALESCE(numeric_value, VALUES(numeric_value)),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, sort_order, active_flag)
VALUES
  ('SUBPART_MATERIAL_TYPE', 'PURCHASE', 'Purchase', 10, 'Y'),
  ('SUBPART_MATERIAL_TYPE', 'MANUFACTURING', 'Manufacturing', 20, 'Y')
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

-- Quotation optional development-cost lines
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

-- Persisted sample-cost value for quotation PDF output
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketing_quotation_items'
      AND COLUMN_NAME = 'sample_cost_inr'),
  'SELECT ''marketing_quotation_items.sample_cost_inr already exists'' AS result',
  'ALTER TABLE marketing_quotation_items ADD COLUMN sample_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER total_development_cost_foreign'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

UPDATE marketing_quotation_items QI
INNER JOIN marketing_workouts W ON W.workout_id = QI.workout_id
   SET QI.sample_cost_inr = W.sample_cost_inr
 WHERE QI.sample_cost_inr = 0;

-- Default quotation commercial notes
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

INSERT INTO quotation_notes_master
  (note_code, note_text, default_flag, sort_order, active_flag)
VALUES
  ('RAW_MATERIAL_WEIGHT_VARIATION', 'Any change in raw material weight during production may lead to a price revision.', 'Y', 70, 'Y'),
  ('CURRENCY_RAW_MATERIAL_REVISION', 'Currency value changes and raw material price changes may lead to a price revision once every three months.', 'Y', 80, 'Y')
ON DUPLICATE KEY UPDATE
  note_text = VALUES(note_text),
  default_flag = 'Y',
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

-- Physical Location Master. This is intentionally separate from the
-- Warehouse / Rack / Bin inventory location table.
CREATE TABLE IF NOT EXISTS location_master (
  location_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  location_name VARCHAR(100) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_location_master_tenant_name (tenant_id, location_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO location_master (tenant_id, location_name, active_flag, created_by)
SELECT tenants.tenant_id, locations.location_name, 'Y', 'SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION
  SELECT DISTINCT tenant_id FROM inventory_locations
  UNION
  SELECT DISTINCT tenant_id FROM purchase_requests
) AS tenants
CROSS JOIN (
  SELECT 'Quality Room' AS location_name
  UNION ALL SELECT 'Tooling'
  UNION ALL SELECT 'Project'
  UNION ALL SELECT 'V01'
  UNION ALL SELECT 'V02'
  UNION ALL SELECT 'V03'
  UNION ALL SELECT 'V05'
  UNION ALL SELECT 'V06'
  UNION ALL SELECT 'V07'
  UNION ALL SELECT 'V08'
  UNION ALL SELECT 'V09'
  UNION ALL SELECT 'V10'
  UNION ALL SELECT 'V11'
  UNION ALL SELECT 'V12'
  UNION ALL SELECT 'T01'
  UNION ALL SELECT 'T02'
  UNION ALL SELECT 'T03'
  UNION ALL SELECT 'T04'
  UNION ALL SELECT 'T05'
  UNION ALL SELECT 'T06'
  UNION ALL SELECT 'Assembly'
  UNION ALL SELECT 'Final Inspection'
  UNION ALL SELECT 'CMM'
  UNION ALL SELECT 'CMS'
  UNION ALL SELECT 'Office'
  UNION ALL SELECT 'Turning Area'
  UNION ALL SELECT 'Gauge Rack1'
  UNION ALL SELECT 'Gauge Rack2'
  UNION ALL SELECT 'Gauge Rack3'
  UNION ALL SELECT 'Gauge Rack4'
  UNION ALL SELECT 'Gauge Rack5'
  UNION ALL SELECT 'Gauge Rack6'
) AS locations;

-- Controlled GRN Outward / Material Outward workflow.
-- Submission and approval do not reduce inventory; stock changes only at dispatch.
CREATE TABLE IF NOT EXISTS material_outward_documents (
  material_outward_document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  outward_number VARCHAR(50) NOT NULL,
  outward_date DATE NOT NULL,
  outward_type VARCHAR(30) NOT NULL,
  document_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
  customer_id BIGINT UNSIGNED NULL,
  supplier_id BIGINT UNSIGNED NULL,
  party_code_snapshot VARCHAR(80) NULL,
  party_name_snapshot VARCHAR(255) NOT NULL,
  transport_mode VARCHAR(50) NULL,
  transport_reference VARCHAR(160) NULL,
  gate_exit_reference VARCHAR(160) NULL,
  remarks VARCHAR(1000) NULL,
  approval_remarks VARCHAR(1000) NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  dispatched_by VARCHAR(50) NULL,
  dispatched_at DATETIME NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_material_outward_number (tenant_id, outward_number),
  KEY ix_material_outward_workflow (tenant_id, document_status, outward_date),
  KEY ix_material_outward_customer (tenant_id, customer_id),
  KEY ix_material_outward_supplier (tenant_id, supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS material_outward_document_items (
  material_outward_document_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  material_outward_document_id BIGINT UNSIGNED NOT NULL,
  inventory_stock_balance_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(100) NULL,
  item_description_snapshot VARCHAR(500) NOT NULL,
  uom_code_snapshot VARCHAR(50) NULL,
  warehouse_code_snapshot VARCHAR(80) NOT NULL,
  bin_location_snapshot VARCHAR(80) NOT NULL,
  batch_serial_number_snapshot VARCHAR(120) NOT NULL DEFAULT '',
  outward_quantity DECIMAL(18,3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_material_outward_document_items_document (material_outward_document_id),
  KEY ix_material_outward_document_items_stock (inventory_stock_balance_id),
  CONSTRAINT fk_material_outward_item_document FOREIGN KEY (material_outward_document_id)
    REFERENCES material_outward_documents(material_outward_document_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outsourcing_issue_wip_balance (
  outsourcing_issue_wip_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  material_outward_document_id BIGINT UNSIGNED NOT NULL,
  material_outward_document_item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_name_snapshot VARCHAR(255) NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(100) NULL,
  item_description_snapshot VARCHAR(500) NOT NULL,
  uom_code_snapshot VARCHAR(50) NULL,
  source_warehouse_code VARCHAR(80) NOT NULL,
  source_bin_location VARCHAR(80) NOT NULL,
  batch_serial_number VARCHAR(120) NOT NULL DEFAULT '',
  quantity_issued DECIMAL(18,3) NOT NULL,
  quantity_returned DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  wip_status VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50) NOT NULL,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_outsource_issue_document_line (material_outward_document_item_id),
  KEY ix_outsource_issue_wip (tenant_id, supplier_id, wip_status),
  CONSTRAINT fk_outsource_issue_document FOREIGN KEY (material_outward_document_id)
    REFERENCES material_outward_documents(material_outward_document_id) ON DELETE CASCADE,
  CONSTRAINT fk_outsource_issue_document_item FOREIGN KEY (material_outward_document_item_id)
    REFERENCES material_outward_document_items(material_outward_document_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'ATECH production upgrade completed successfully.' AS result;
