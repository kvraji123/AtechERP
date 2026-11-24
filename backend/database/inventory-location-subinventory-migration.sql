-- Bind each physical location to one operational sub-inventory.
-- A bin may be renamed, but it must not silently change its sub-inventory.
-- This migration is safe to re-run on MySQL 5.7 and MySQL 8.

SET @atech_location_subinventory_sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'location_master'
      AND COLUMN_NAME = 'sub_inventory_code'
  ),
  'SELECT 1',
  'ALTER TABLE location_master ADD COLUMN sub_inventory_code VARCHAR(40) NOT NULL DEFAULT ''GENERAL'' AFTER warehouse_name'
);
PREPARE atech_location_subinventory_statement FROM @atech_location_subinventory_sql;
EXECUTE atech_location_subinventory_statement;
DEALLOCATE PREPARE atech_location_subinventory_statement;

SET @atech_grn_location_subinventory_sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'goods_receipt_note_items'
      AND COLUMN_NAME = 'sub_inventory_code'
  ),
  'SELECT 1',
  'ALTER TABLE goods_receipt_note_items ADD COLUMN sub_inventory_code VARCHAR(40) NOT NULL DEFAULT ''GENERAL'' AFTER warehouse_code'
);
PREPARE atech_grn_location_subinventory_statement FROM @atech_grn_location_subinventory_sql;
EXECUTE atech_grn_location_subinventory_statement;
DEALLOCATE PREPARE atech_grn_location_subinventory_statement;

-- Preserve all legacy bins as GENERAL until Stores deliberately remaps them.
UPDATE location_master
SET sub_inventory_code = 'GENERAL'
WHERE COALESCE(NULLIF(TRIM(sub_inventory_code), ''), 'GENERAL') = 'GENERAL';

-- Temporary seed table avoids INSERT ... SELECT ... ON DUPLICATE KEY syntax,
-- which differs between older production MySQL installations.
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_inventory_location_seed (
  warehouse_name VARCHAR(80) NOT NULL,
  sub_inventory_code VARCHAR(40) NOT NULL,
  location_name VARCHAR(120) NOT NULL,
  PRIMARY KEY (warehouse_name, location_name)
) ENGINE=MEMORY;

DELETE FROM tmp_inventory_location_seed;

INSERT INTO tmp_inventory_location_seed
  (warehouse_name, sub_inventory_code, location_name)
VALUES
  ('Main Stores', 'RM', 'RM'),
  ('Main Stores', 'FG', 'FG'),
  ('Production Stores', 'RM', 'RM Staging'),
  ('Production Stores', 'WIP', 'WIP'),
  ('Production Stores', 'FG', 'FG Staging'),
  ('Production Stores', 'MTR', 'MTR'),
  ('Production Stores', 'PRR', 'PRR'),
  ('Tool Crib', 'TOOLS', 'Tooling'),
  ('Gauge Store', 'GAUGES', 'Gauge Rack'),
  ('Production Gauge Store', 'GAUGES', 'Gauge Rack'),
  ('Rejection Yard', 'MATERIAL_REJECTION', 'Material Quarantine'),
  ('Rejection Yard', 'PROCESS_REJECTION', 'Process Quarantine'),
  ('Rejection Yard', 'MATERIAL_REJECTION', 'Material Return Pending'),
  ('Rejection Yard', 'PROCESS_REJECTION', 'Process Return Pending'),
  ('Scrap Yard', 'SCRAP', 'Scrap'),
  ('Customer Material Stores', 'RM', 'RM'),
  ('Customer Material Stores', 'FG', 'FG'),
  ('Customer Material Stores', 'MTR', 'MTR'),
  ('Customer Material Stores', 'PRR', 'PRR');

-- Add a missing operational location for every tenant.
INSERT IGNORE INTO location_master
  (tenant_id, warehouse_name, sub_inventory_code, location_name, active_flag, created_by)
SELECT T.tenant_id, S.warehouse_name, S.sub_inventory_code, S.location_name, 'Y', 'SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION SELECT DISTINCT tenant_id FROM location_master
  UNION SELECT DISTINCT tenant_id FROM inventory_stock_balance
) T
CROSS JOIN tmp_inventory_location_seed S;

-- Correct the classification and activation of seeded operational locations.
UPDATE location_master LM
INNER JOIN tmp_inventory_location_seed S
  ON S.warehouse_name = LM.warehouse_name
 AND S.location_name = LM.location_name
SET LM.sub_inventory_code = S.sub_inventory_code,
    LM.active_flag = 'Y';

-- Keep the legacy physical-location bridge available for Gauge and other existing features.
INSERT IGNORE INTO inventory_locations (tenant_id, warehouse_code, bin_location, active_flag)
SELECT tenant_id, warehouse_name, location_name, active_flag
FROM location_master;

UPDATE inventory_locations IL
INNER JOIN location_master LM
  ON LM.tenant_id = IL.tenant_id
 AND LM.warehouse_name = IL.warehouse_code
 AND LM.location_name = IL.bin_location
SET IL.active_flag = LM.active_flag;

DROP TEMPORARY TABLE IF EXISTS tmp_inventory_location_seed;
