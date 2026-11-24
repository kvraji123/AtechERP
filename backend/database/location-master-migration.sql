-- Warehouse and Location / Rack / Bin master for clean installations.
-- A location is unique within a warehouse, so the same location name may exist
-- under more than one warehouse when required.

CREATE TABLE IF NOT EXISTS location_master (
  location_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  warehouse_name VARCHAR(80) NOT NULL,
  location_name VARCHAR(100) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_location_master_tenant_warehouse_location (tenant_id, warehouse_name, location_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve the legacy storage rows so existing Gauge storage IDs remain valid.
INSERT INTO location_master (tenant_id, warehouse_name, location_name, active_flag, created_by)
SELECT tenant_id, warehouse_code, bin_location, active_flag, 'SYSTEM'
FROM inventory_locations
ON DUPLICATE KEY UPDATE active_flag=VALUES(active_flag);

-- Approved physical-location mapping, including segregated customer-owned material.
INSERT INTO location_master (tenant_id, warehouse_name, location_name, active_flag, created_by)
SELECT tenants.tenant_id, locations.warehouse_name, locations.location_name, 'Y', 'SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION SELECT DISTINCT tenant_id FROM inventory_locations
  UNION SELECT DISTINCT tenant_id FROM purchase_requests
) AS tenants
CROSS JOIN (
  SELECT 'Main Stores' AS warehouse_name, 'Project' AS location_name
  UNION ALL SELECT 'Main Stores', 'Office'
  UNION ALL SELECT 'Production Stores', 'V01'
  UNION ALL SELECT 'Production Stores', 'V02'
  UNION ALL SELECT 'Production Stores', 'V03'
  UNION ALL SELECT 'Production Stores', 'V05'
  UNION ALL SELECT 'Production Stores', 'V06'
  UNION ALL SELECT 'Production Stores', 'V07'
  UNION ALL SELECT 'Production Stores', 'V08'
  UNION ALL SELECT 'Production Stores', 'V09'
  UNION ALL SELECT 'Production Stores', 'V10'
  UNION ALL SELECT 'Production Stores', 'V11'
  UNION ALL SELECT 'Production Stores', 'V12'
  UNION ALL SELECT 'Production Stores', 'T01'
  UNION ALL SELECT 'Production Stores', 'T02'
  UNION ALL SELECT 'Production Stores', 'T03'
  UNION ALL SELECT 'Production Stores', 'T04'
  UNION ALL SELECT 'Production Stores', 'T05'
  UNION ALL SELECT 'Production Stores', 'T06'
  UNION ALL SELECT 'Production Stores', 'Assembly'
  UNION ALL SELECT 'Production Stores', 'Turning Area'
  UNION ALL SELECT 'Tool Crib', 'Tooling'
  UNION ALL SELECT 'Tool Crib', 'Gauge Rack1'
  UNION ALL SELECT 'Tool Crib', 'Gauge Rack2'
  UNION ALL SELECT 'Tool Crib', 'Gauge Rack3'
  UNION ALL SELECT 'Tool Crib', 'Gauge Rack4'
  UNION ALL SELECT 'Tool Crib', 'Gauge Rack5'
  UNION ALL SELECT 'Tool Crib', 'Gauge Rack6'
  UNION ALL SELECT 'Quality Hold Area', 'Quality Room'
  UNION ALL SELECT 'Quality Hold Area', 'Final Inspection'
  UNION ALL SELECT 'Quality Hold Area', 'CMM'
  UNION ALL SELECT 'Quality Hold Area', 'CMS'
  UNION ALL SELECT 'Customer Material Stores', 'Customer Material Receiving'
  UNION ALL SELECT 'Customer Material Stores', 'Customer Material Rack'
  UNION ALL SELECT 'Customer Material Stores', 'Customer Material Hold'
) AS locations
WHERE 1=1
ON DUPLICATE KEY UPDATE active_flag='Y';

-- inventory_locations remains the foreign-key target for existing Gauge records.
-- Keep it synchronised from Location Master during a clean installation.
INSERT INTO inventory_locations (tenant_id, warehouse_code, bin_location, active_flag)
SELECT tenant_id, warehouse_name, location_name, active_flag
FROM location_master
ON DUPLICATE KEY UPDATE active_flag=VALUES(active_flag);
