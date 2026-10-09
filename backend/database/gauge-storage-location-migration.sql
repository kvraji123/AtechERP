-- Gauge Master home storage locations.
-- The standard location seed provides both normal storage and the controlled
-- holding rack used before an external calibration dispatch.

CREATE TABLE IF NOT EXISTS inventory_locations (
  location_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL,
  bin_location VARCHAR(80) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  UNIQUE KEY uq_inventory_location (tenant_id,warehouse_code,bin_location),
  UNIQUE KEY uq_inventory_location_tenant (tenant_id,location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO inventory_locations (tenant_id,warehouse_code,bin_location,active_flag) VALUES
  ('DEFAULT','Main Stores','Gauge Rack','Y'),
  ('DEFAULT','Calibration Hold','Dispatch Rack','Y')
ON DUPLICATE KEY UPDATE active_flag='Y';

ALTER TABLE gauge_master
  ADD COLUMN storage_location_id BIGINT UNSIGNED NULL;

ALTER TABLE gauge_master
  ADD CONSTRAINT fk_gauge_storage_location
  FOREIGN KEY (tenant_id,storage_location_id)
  REFERENCES inventory_locations(tenant_id,location_id);
