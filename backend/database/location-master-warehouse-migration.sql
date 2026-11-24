-- Upgrade an existing Location Master so it owns Warehouse + Location/Rack values.
-- Safe to run more than once.

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

CREATE TABLE IF NOT EXISTS inventory_locations (
  location_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL,
  bin_location VARCHAR(100) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  UNIQUE KEY uq_inventory_location (tenant_id,warehouse_code,bin_location),
  UNIQUE KEY uq_inventory_location_tenant (tenant_id,location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @location_master_warehouse_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='location_master' AND COLUMN_NAME='warehouse_name'),
  'SELECT 1',
  'ALTER TABLE location_master ADD COLUMN warehouse_name VARCHAR(80) NOT NULL DEFAULT ''Main Stores'' AFTER tenant_id'
);
PREPARE location_master_warehouse_statement FROM @location_master_warehouse_sql;
EXECUTE location_master_warehouse_statement;
DEALLOCATE PREPARE location_master_warehouse_statement;

SET @location_master_key_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='location_master'
      AND INDEX_NAME='uq_location_master_tenant_warehouse_location'),
  'SELECT 1',
  IF(
    EXISTS(SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='location_master'
        AND INDEX_NAME='uq_location_master_tenant_name'),
    'ALTER TABLE location_master DROP INDEX uq_location_master_tenant_name, ADD UNIQUE KEY uq_location_master_tenant_warehouse_location (tenant_id,warehouse_name,location_name)',
    'ALTER TABLE location_master ADD UNIQUE KEY uq_location_master_tenant_warehouse_location (tenant_id,warehouse_name,location_name)'
  )
);
PREPARE location_master_key_statement FROM @location_master_key_sql;
EXECUTE location_master_key_statement;
DEALLOCATE PREPARE location_master_key_statement;

UPDATE location_master
SET warehouse_name = CASE UPPER(location_name)
  WHEN 'PROJECT' THEN 'Main Stores'
  WHEN 'OFFICE' THEN 'Main Stores'
  WHEN 'V01' THEN 'Production Stores'
  WHEN 'V02' THEN 'Production Stores'
  WHEN 'V03' THEN 'Production Stores'
  WHEN 'V05' THEN 'Production Stores'
  WHEN 'V06' THEN 'Production Stores'
  WHEN 'V07' THEN 'Production Stores'
  WHEN 'V08' THEN 'Production Stores'
  WHEN 'V09' THEN 'Production Stores'
  WHEN 'V10' THEN 'Production Stores'
  WHEN 'V11' THEN 'Production Stores'
  WHEN 'V12' THEN 'Production Stores'
  WHEN 'T01' THEN 'Production Stores'
  WHEN 'T02' THEN 'Production Stores'
  WHEN 'T03' THEN 'Production Stores'
  WHEN 'T04' THEN 'Production Stores'
  WHEN 'T05' THEN 'Production Stores'
  WHEN 'T06' THEN 'Production Stores'
  WHEN 'ASSEMBLY' THEN 'Production Stores'
  WHEN 'TURNING AREA' THEN 'Production Stores'
  WHEN 'TOOLING' THEN 'Tool Crib'
  WHEN 'GAUGE RACK1' THEN 'Tool Crib'
  WHEN 'GAUGE RACK2' THEN 'Tool Crib'
  WHEN 'GAUGE RACK3' THEN 'Tool Crib'
  WHEN 'GAUGE RACK4' THEN 'Tool Crib'
  WHEN 'GAUGE RACK5' THEN 'Tool Crib'
  WHEN 'GAUGE RACK6' THEN 'Tool Crib'
  WHEN 'QUALITY ROOM' THEN 'Quality Hold Area'
  WHEN 'FINAL INSPECTION' THEN 'Quality Hold Area'
  WHEN 'CMM' THEN 'Quality Hold Area'
  WHEN 'CMS' THEN 'Quality Hold Area'
  ELSE COALESCE(NULLIF(TRIM(warehouse_name),''),'Main Stores')
END;

INSERT INTO location_master (tenant_id, warehouse_name, location_name, active_flag, created_by)
SELECT IL.tenant_id, IL.warehouse_code, IL.bin_location, IL.active_flag, 'SYSTEM'
FROM inventory_locations IL
LEFT JOIN location_master LM
  ON LM.tenant_id=IL.tenant_id
 AND LM.warehouse_name=IL.warehouse_code
 AND LM.location_name=IL.bin_location
WHERE LM.location_master_id IS NULL;

INSERT INTO location_master (tenant_id, warehouse_name, location_name, active_flag, created_by)
SELECT tenants.tenant_id, locations.warehouse_name, locations.location_name, 'Y', 'SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION SELECT DISTINCT tenant_id FROM inventory_locations
  UNION SELECT DISTINCT tenant_id FROM purchase_requests
  UNION SELECT DISTINCT tenant_id FROM location_master
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

INSERT INTO inventory_locations (tenant_id, warehouse_code, bin_location, active_flag)
SELECT tenant_id, warehouse_name, location_name, active_flag
FROM location_master
ON DUPLICATE KEY UPDATE active_flag=VALUES(active_flag);
