-- Gauge Master bulk Issue and Return vouchers.
-- One header represents the common handover; each Gauge ID remains traceable
-- through its own linked lifecycle-history row.

CREATE TABLE IF NOT EXISTS gauge_movement_batches (
  gauge_movement_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  movement_number VARCHAR(80) NOT NULL,
  movement_type ENUM('ISSUE','RETURN') NOT NULL,
  movement_date DATE NOT NULL,
  issued_to VARCHAR(120) NULL,
  location_name VARCHAR(150) NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gauge_movement_batch_id),
  UNIQUE KEY uq_gauge_movement_batch_number (tenant_id,movement_number),
  KEY ix_gauge_movement_batch_list (tenant_id,movement_type,movement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE gauge_history
  ADD COLUMN gauge_movement_batch_id BIGINT UNSIGNED NULL AFTER gauge_master_id;

ALTER TABLE gauge_history
  ADD KEY ix_gauge_history_movement_batch (tenant_id,gauge_movement_batch_id);

ALTER TABLE gauge_history
  ADD CONSTRAINT fk_gauge_history_movement_batch
  FOREIGN KEY (gauge_movement_batch_id)
  REFERENCES gauge_movement_batches(gauge_movement_batch_id)
  ON DELETE SET NULL;
