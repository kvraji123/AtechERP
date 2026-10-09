-- ATECH ERP - Gauge Master and calibration lifecycle
-- Run after Item Master, Purchase/GRN and inventory migrations.

CREATE TABLE IF NOT EXISTS gauge_id_sequence (
  instrument_abbreviation VARCHAR(12) NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (instrument_abbreviation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gauge_master (
  gauge_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  gauge_id VARCHAR(64) NOT NULL,
  instrument_abbreviation VARCHAR(12) NOT NULL,
  instrument_name_snapshot VARCHAR(255) NOT NULL,
  item_code_snapshot VARCHAR(80) NOT NULL,
  manufacturer_serial_number VARCHAR(120) NULL,
  make_name VARCHAR(120) NULL,
  model_number VARCHAR(120) NULL,
  measurement_range VARCHAR(120) NULL,
  least_count VARCHAR(120) NULL,
  accuracy VARCHAR(120) NULL,
  calibration_frequency_months SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  last_calibration_date DATE NULL,
  calibration_due_date DATE NULL,
  calibration_agency VARCHAR(180) NULL,
  current_location VARCHAR(150) NOT NULL,
  assigned_to VARCHAR(120) NULL,
  operational_status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (gauge_master_id),
  UNIQUE KEY uq_gauge_master_tenant_gauge_id (tenant_id,gauge_id),
  KEY ix_gauge_master_grn_item (tenant_id,grn_item_id),
  KEY ix_gauge_master_item (tenant_id,item_id),
  KEY ix_gauge_master_status_due (tenant_id,operational_status,calibration_due_date),
  CONSTRAINT fk_gauge_master_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_gauge_master_grn_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_gauge_master_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gauge_history (
  gauge_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  gauge_master_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  event_date DATE NOT NULL,
  operational_status VARCHAR(40) NULL,
  location_name VARCHAR(150) NULL,
  assigned_to VARCHAR(120) NULL,
  calibration_agency VARCHAR(180) NULL,
  calibration_result VARCHAR(20) NULL,
  calibration_due_date DATE NULL,
  certificate_number VARCHAR(120) NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gauge_history_id),
  KEY ix_gauge_history_master_date (gauge_master_id,event_date,gauge_history_id),
  CONSTRAINT fk_gauge_history_master FOREIGN KEY (gauge_master_id)
    REFERENCES gauge_master(gauge_master_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification
SELECT gauge_master_id,gauge_id,instrument_name_snapshot,operational_status,calibration_due_date
FROM gauge_master ORDER BY gauge_master_id DESC LIMIT 20;
