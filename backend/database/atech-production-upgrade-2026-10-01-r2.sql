-- ============================================================================
-- A TECH AUTOMATION ERP - PRODUCTION UPGRADE
-- Baseline: atech-production-complete_26sep.sql (26 September 2026)
-- Target: current application schema as of 01 October 2026
-- Target database: MySQL 8.0+
--
-- This is an additive, repeat-safe upgrade. It does not remove business data.
-- Take a verified backup before running it. Change the database name below if
-- the production database is not named atech_erp.
-- ============================================================================

USE `atech_erp`;
SET NAMES utf8mb4;
SET time_zone = '+05:30';
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Inspection plans: free-text characteristics and Once per Lot frequency
-- ============================================================================

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
      AND COLUMN_NAME='characteristic_text'),
  'SELECT 1',
  'ALTER TABLE part_inspection_characteristic ADD COLUMN characteristic_text VARCHAR(150) NULL AFTER characteristic_master_id'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

ALTER TABLE item_incoming_inspection_characteristic
  MODIFY COLUMN characteristic_master_id BIGINT UNSIGNED NULL;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='item_incoming_inspection_characteristic'
      AND COLUMN_NAME='characteristic_text'),
  'SELECT 1',
  'ALTER TABLE item_incoming_inspection_characteristic ADD COLUMN characteristic_text VARCHAR(150) NULL AFTER characteristic_master_id'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

INSERT INTO inspection_frequency_master
  (frequency_code,frequency_label,display_order)
VALUES
  ('ONCE_PER_LOT','Once per Lot',55)
ON DUPLICATE KEY UPDATE
  frequency_label=VALUES(frequency_label),
  display_order=VALUES(display_order),
  active_flag='Y';

-- ============================================================================
-- Material and Grade master normalization
-- ============================================================================

INSERT INTO material_master (material_name,active_flag) VALUES
  ('Aluminium','Y'),('Alloy Steel','Y'),('Carbon Steel','Y'),
  ('Mild Steel','Y'),('Stainless Steel','Y'),('Cast Iron','Y'),
  ('Brass','Y'),('Bronze','Y'),('Gun Metal','Y'),('Carbide','Y'),
  ('High-Speed Steel','Y'),('Nylon','Y'),('Delrin','Y'),('Teflon','Y'),
  ('Plastic','Y'),('Granite','Y'),('Spring Steel','Y'),('Iron','Y'),('Steel','Y')
ON DUPLICATE KEY UPDATE active_flag='Y';

INSERT INTO material_grade_master (material_id,grade_code,grade_name,active_flag)
SELECT M.material_id,X.grade_code,X.grade_name,'Y'
FROM (
  SELECT 'Aluminium' AS material_name,'GENERAL' AS grade_code,'General' AS grade_name UNION ALL
  SELECT 'Aluminium','6061','6061' UNION ALL
  SELECT 'Aluminium','6063','6063' UNION ALL
  SELECT 'Alloy Steel','16MNCR5','16MnCr5' UNION ALL
  SELECT 'Alloy Steel','EN19','EN19' UNION ALL
  SELECT 'Alloy Steel','EN24','EN24' UNION ALL
  SELECT 'Alloy Steel','EN353','EN353' UNION ALL
  SELECT 'Alloy Steel','EN47','EN47' UNION ALL
  SELECT 'Carbon Steel','C45','C45' UNION ALL
  SELECT 'Carbon Steel','EN8','EN8' UNION ALL
  SELECT 'Carbon Steel','EN8/45','EN8/45' UNION ALL
  SELECT 'Mild Steel','GENERAL','General' UNION ALL
  SELECT 'Mild Steel','LOW-CARBON','Low Carbon Steel' UNION ALL
  SELECT 'Mild Steel','CR-SHEET','CR Sheet' UNION ALL
  SELECT 'Stainless Steel','SS303','SS303' UNION ALL
  SELECT 'Stainless Steel','SS304','SS304' UNION ALL
  SELECT 'Stainless Steel','SS316','SS316' UNION ALL
  SELECT 'Stainless Steel','SS402','SS402' UNION ALL
  SELECT 'Stainless Steel','SS410','SS410' UNION ALL
  SELECT 'Stainless Steel','SS416','SS416' UNION ALL
  SELECT 'Stainless Steel','SS420','SS420' UNION ALL
  SELECT 'Stainless Steel','SS431','SS431' UNION ALL
  SELECT 'Cast Iron','GENERAL','General' UNION ALL
  SELECT 'Brass','GENERAL','General' UNION ALL
  SELECT 'Bronze','GENERAL','General' UNION ALL
  SELECT 'Gun Metal','GENERAL','General' UNION ALL
  SELECT 'Carbide','GENERAL','General' UNION ALL
  SELECT 'High-Speed Steel','HSS','HSS' UNION ALL
  SELECT 'Nylon','GENERAL','General' UNION ALL
  SELECT 'Delrin','GENERAL','General' UNION ALL
  SELECT 'Teflon','GENERAL','General' UNION ALL
  SELECT 'Plastic','GENERAL','General' UNION ALL
  SELECT 'Granite','GENERAL','General' UNION ALL
  SELECT 'Spring Steel','GENERAL','General' UNION ALL
  SELECT 'Iron','GENERAL','General' UNION ALL
  SELECT 'Steel','GENERAL','General'
) X
JOIN material_master M ON M.material_name=X.material_name
ON DUPLICATE KEY UPDATE grade_name=VALUES(grade_name),active_flag='Y';

UPDATE part_master P
JOIN material_grade_master MG ON MG.material_grade_id=P.material_grade_id
SET P.material_id=MG.material_id
WHERE P.material_grade_id IS NOT NULL AND P.material_id<>MG.material_id;

UPDATE item_master I
JOIN material_grade_master MG ON MG.material_grade_id=I.material_grade_id
SET I.material_id=MG.material_id
WHERE I.material_grade_id IS NOT NULL AND I.material_id<>MG.material_id;

UPDATE part_master P
JOIN material_master L ON L.material_id=P.material_id
JOIN (
  SELECT '6061' AS legacy_name,'Aluminium' AS material_name,'6061' AS grade_code UNION ALL
  SELECT '6063','Aluminium','6063' UNION ALL
  SELECT '16MnCr5','Alloy Steel','16MNCR5' UNION ALL
  SELECT 'C45','Carbon Steel','C45' UNION ALL
  SELECT 'CR Sheet (MS)','Mild Steel','CR-SHEET' UNION ALL
  SELECT 'EN 24','Alloy Steel','EN24' UNION ALL
  SELECT 'EN 353','Alloy Steel','EN353' UNION ALL
  SELECT 'EN 47','Alloy Steel','EN47' UNION ALL
  SELECT 'EN 8','Carbon Steel','EN8' UNION ALL
  SELECT 'EN 8/45','Carbon Steel','EN8/45' UNION ALL
  SELECT 'EN19','Alloy Steel','EN19' UNION ALL
  SELECT 'HSS','High-Speed Steel','HSS' UNION ALL
  SELECT 'Low Carbon Steel','Mild Steel','LOW-CARBON' UNION ALL
  SELECT 'SS 303','Stainless Steel','SS303' UNION ALL
  SELECT 'SS 304','Stainless Steel','SS304' UNION ALL
  SELECT 'SS 316','Stainless Steel','SS316' UNION ALL
  SELECT 'SS 402','Stainless Steel','SS402' UNION ALL
  SELECT 'SS 410','Stainless Steel','SS410' UNION ALL
  SELECT 'SS 416','Stainless Steel','SS416' UNION ALL
  SELECT 'SS 420','Stainless Steel','SS420' UNION ALL
  SELECT 'SS 431','Stainless Steel','SS431'
) X ON X.legacy_name=L.material_name
JOIN material_master M ON M.material_name=X.material_name
JOIN material_grade_master MG ON MG.material_id=M.material_id AND MG.grade_code=X.grade_code
SET P.material_id=M.material_id,P.material_grade_id=MG.material_grade_id
WHERE P.material_grade_id IS NULL;

UPDATE item_master I
JOIN material_master L ON L.material_id=I.material_id
JOIN (
  SELECT '6061' AS legacy_name,'Aluminium' AS material_name,'6061' AS grade_code UNION ALL
  SELECT '6063','Aluminium','6063' UNION ALL
  SELECT '16MnCr5','Alloy Steel','16MNCR5' UNION ALL
  SELECT 'C45','Carbon Steel','C45' UNION ALL
  SELECT 'CR Sheet (MS)','Mild Steel','CR-SHEET' UNION ALL
  SELECT 'EN 24','Alloy Steel','EN24' UNION ALL
  SELECT 'EN 353','Alloy Steel','EN353' UNION ALL
  SELECT 'EN 47','Alloy Steel','EN47' UNION ALL
  SELECT 'EN 8','Carbon Steel','EN8' UNION ALL
  SELECT 'EN 8/45','Carbon Steel','EN8/45' UNION ALL
  SELECT 'EN19','Alloy Steel','EN19' UNION ALL
  SELECT 'HSS','High-Speed Steel','HSS' UNION ALL
  SELECT 'Low Carbon Steel','Mild Steel','LOW-CARBON' UNION ALL
  SELECT 'SS 303','Stainless Steel','SS303' UNION ALL
  SELECT 'SS 304','Stainless Steel','SS304' UNION ALL
  SELECT 'SS 316','Stainless Steel','SS316' UNION ALL
  SELECT 'SS 402','Stainless Steel','SS402' UNION ALL
  SELECT 'SS 410','Stainless Steel','SS410' UNION ALL
  SELECT 'SS 416','Stainless Steel','SS416' UNION ALL
  SELECT 'SS 420','Stainless Steel','SS420' UNION ALL
  SELECT 'SS 431','Stainless Steel','SS431'
) X ON X.legacy_name=L.material_name
JOIN material_master M ON M.material_name=X.material_name
JOIN material_grade_master MG ON MG.material_id=M.material_id AND MG.grade_code=X.grade_code
SET I.material_id=M.material_id,I.material_grade_id=MG.material_grade_id
WHERE I.material_grade_id IS NULL;

UPDATE material_master
SET active_flag='N'
WHERE material_name IN (
  '6061','6063','16MnCr5','C45','CR Sheet (MS)','EN 24','EN 353','EN 47',
  'EN 8','EN 8/45','EN19','HSS','Low Carbon Steel','SS 303','SS 304','SS 316',
  'SS 402','SS 410','SS 416','SS 420','SS 431'
);

-- ============================================================================
-- Gauge Master: storage locations, bulk movements, certificates and dispatch
-- ============================================================================

-- These core Gauge Master tables are included because some production databases
-- imported before the calibration release do not contain them yet.
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

CREATE TABLE IF NOT EXISTS inventory_locations (
  location_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL,
  bin_location VARCHAR(80) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  UNIQUE KEY uq_inventory_location (tenant_id,warehouse_code,bin_location),
  UNIQUE KEY uq_inventory_location_tenant (tenant_id,location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the normal home rack and the external-calibration holding rack for all
-- currently known tenants. The DEFAULT row also supports the standard install.
INSERT IGNORE INTO inventory_locations (tenant_id,warehouse_code,bin_location,active_flag)
SELECT T.tenant_id,L.warehouse_code,L.bin_location,'Y'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION
  SELECT DISTINCT tenant_id FROM gauge_master
  UNION
  SELECT DISTINCT tenant_id FROM purchase_requests
) T
CROSS JOIN (
  SELECT 'Main Stores' AS warehouse_code,'Gauge Rack' AS bin_location
  UNION ALL SELECT 'Calibration Hold','Dispatch Rack'
) L
;

UPDATE inventory_locations
SET active_flag='Y'
WHERE (warehouse_code='Main Stores' AND bin_location='Gauge Rack')
   OR (warehouse_code='Calibration Hold' AND bin_location='Dispatch Rack');

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_master' AND COLUMN_NAME='storage_location_id'),
  'SELECT 1',
  'ALTER TABLE gauge_master ADD COLUMN storage_location_id BIGINT UNSIGNED NULL'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='gauge_master'
      AND CONSTRAINT_NAME='fk_gauge_storage_location'),
  'SELECT 1',
  'ALTER TABLE gauge_master ADD CONSTRAINT fk_gauge_storage_location FOREIGN KEY (tenant_id,storage_location_id) REFERENCES inventory_locations(tenant_id,location_id)'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

CREATE TABLE IF NOT EXISTS gauge_movement_batches (
  gauge_movement_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  movement_number VARCHAR(80) NOT NULL,
  movement_type ENUM('ISSUE','RETURN','CALIBRATION_DISPATCH') NOT NULL,
  movement_date DATE NOT NULL,
  issued_to VARCHAR(120) NULL,
  calibration_agency VARCHAR(180) NULL,
  service_purchase_order_id BIGINT UNSIGNED NULL,
  service_po_number_snapshot VARCHAR(50) NULL,
  challan_number VARCHAR(80) NULL,
  expected_return_date DATE NULL,
  courier_reference VARCHAR(180) NULL,
  dispatch_status ENUM('DISPATCHED','RETURNED','CANCELLED') NOT NULL DEFAULT 'DISPATCHED',
  location_name VARCHAR(150) NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gauge_movement_batch_id),
  UNIQUE KEY uq_gauge_movement_batch_number (tenant_id,movement_number),
  KEY ix_gauge_movement_batch_list (tenant_id,movement_type,movement_date),
  KEY ix_gauge_calibration_dispatch_list (tenant_id,movement_type,movement_date),
  KEY ix_gauge_calibration_dispatch_po (tenant_id,service_purchase_order_id),
  CONSTRAINT fk_gauge_calibration_dispatch_po FOREIGN KEY (service_purchase_order_id)
    REFERENCES purchase_orders(purchase_order_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE gauge_movement_batches
  MODIFY COLUMN movement_type ENUM('ISSUE','RETURN','CALIBRATION_DISPATCH') NOT NULL;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND COLUMN_NAME='gauge_movement_batch_id'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD COLUMN gauge_movement_batch_id BIGINT UNSIGNED NULL AFTER gauge_master_id'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND INDEX_NAME='ix_gauge_history_movement_batch'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD KEY ix_gauge_history_movement_batch (tenant_id,gauge_movement_batch_id)'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND CONSTRAINT_NAME='fk_gauge_history_movement_batch'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD CONSTRAINT fk_gauge_history_movement_batch FOREIGN KEY (gauge_movement_batch_id) REFERENCES gauge_movement_batches(gauge_movement_batch_id) ON DELETE SET NULL'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND COLUMN_NAME='certificate_file_name'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD COLUMN certificate_file_name VARCHAR(255) NULL AFTER certificate_number'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND COLUMN_NAME='certificate_file_path'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD COLUMN certificate_file_path VARCHAR(500) NULL AFTER certificate_file_name'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND COLUMN_NAME='certificate_file_size_bytes'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD COLUMN certificate_file_size_bytes BIGINT UNSIGNED NULL AFTER certificate_file_path'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='calibration_agency'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN calibration_agency VARCHAR(180) NULL AFTER issued_to'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='service_purchase_order_id'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN service_purchase_order_id BIGINT UNSIGNED NULL AFTER calibration_agency'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='service_po_number_snapshot'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN service_po_number_snapshot VARCHAR(50) NULL AFTER service_purchase_order_id'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='challan_number'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN challan_number VARCHAR(80) NULL AFTER service_po_number_snapshot'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='expected_return_date'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN expected_return_date DATE NULL AFTER challan_number'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='courier_reference'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN courier_reference VARCHAR(180) NULL AFTER expected_return_date'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='dispatch_status'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN dispatch_status ENUM(''DISPATCHED'',''RETURNED'',''CANCELLED'') NOT NULL DEFAULT ''DISPATCHED'' AFTER courier_reference'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='ix_gauge_calibration_dispatch_list'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD KEY ix_gauge_calibration_dispatch_list (tenant_id,movement_type,movement_date)'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='ix_gauge_calibration_dispatch_po'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD KEY ix_gauge_calibration_dispatch_po (tenant_id,service_purchase_order_id)'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND CONSTRAINT_NAME='fk_gauge_calibration_dispatch_po'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD CONSTRAINT fk_gauge_calibration_dispatch_po FOREIGN KEY (service_purchase_order_id) REFERENCES purchase_orders(purchase_order_id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

-- ============================================================================
-- Party transport modes and shipment transport selections
-- ============================================================================

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_master' AND COLUMN_NAME='allowed_transport_modes'),
  'SELECT 1',
  'ALTER TABLE customer_master ADD COLUMN allowed_transport_modes JSON NULL AFTER transport_mode'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='supplier_master' AND COLUMN_NAME='allowed_transport_modes'),
  'SELECT 1',
  'ALTER TABLE supplier_master ADD COLUMN allowed_transport_modes JSON NULL AFTER transport_mode'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

UPDATE customer_master C
JOIN marketing_reference_values R
  ON R.reference_type='TRANSPORT_MODE' AND R.active_flag='Y'
  AND (UPPER(TRIM(C.transport_mode))=R.value_code OR UPPER(TRIM(C.transport_mode))=UPPER(R.display_label))
SET C.allowed_transport_modes=JSON_ARRAY(R.value_code)
WHERE C.allowed_transport_modes IS NULL AND NULLIF(TRIM(C.transport_mode),'') IS NOT NULL;

UPDATE supplier_master S
JOIN marketing_reference_values R
  ON R.reference_type='TRANSPORT_MODE' AND R.active_flag='Y'
  AND (UPPER(TRIM(S.transport_mode))=R.value_code OR UPPER(TRIM(S.transport_mode))=UPPER(R.display_label))
SET S.allowed_transport_modes=JSON_ARRAY(R.value_code)
WHERE S.allowed_transport_modes IS NULL AND NULLIF(TRIM(S.transport_mode),'') IS NOT NULL;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND COLUMN_NAME='transport_mode'),
  'SELECT 1',
  'ALTER TABLE purchase_orders ADD COLUMN transport_mode VARCHAR(50) NULL AFTER delivery_terms'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_gate_entries' AND COLUMN_NAME='transport_mode'),
  'SELECT 1',
  'ALTER TABLE purchase_gate_entries ADD COLUMN transport_mode VARCHAR(50) NULL AFTER customer_name_snapshot'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='return_to_vendor_documents' AND COLUMN_NAME='transport_mode'),
  'SELECT 1',
  'ALTER TABLE return_to_vendor_documents ADD COLUMN transport_mode VARCHAR(50) NULL AFTER dispatch_reference'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

SET @atech_upgrade_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='return_to_customer_documents' AND COLUMN_NAME='transport_mode'),
  'SELECT 1',
  'ALTER TABLE return_to_customer_documents ADD COLUMN transport_mode VARCHAR(50) NULL AFTER dispatch_reference'
);
PREPARE atech_upgrade_statement FROM @atech_upgrade_sql;
EXECUTE atech_upgrade_statement;
DEALLOCATE PREPARE atech_upgrade_statement;

-- ============================================================================
-- Purchased Item description templates
-- ============================================================================

START TRANSACTION;

INSERT INTO item_type_spec_field
  (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,
   allowed_uom_codes_json,default_uom_code,visible_when_field,visible_when_value,
   require_one_group,display_order,active_flag)
SELECT T.item_type_id,X.field_code,X.field_label,X.input_type,X.required_flag,NULL,
  NULL,NULL,NULL,NULL,NULL,X.display_order,'Y'
FROM (
  SELECT 'Fasteners' AS type_name,'fastener_details' AS field_code,'Fastener Details' AS field_label,'TEXT' AS input_type,'Y' AS required_flag,70 AS display_order
  UNION ALL SELECT 'Plugs','plug_gauge_details','Plug / Gauge Details','TEXT','Y',10
) X
JOIN item_group_master G ON G.group_code='PU'
JOIN item_type_master T ON T.item_group_id=G.item_group_id AND T.type_name=X.type_name
ON DUPLICATE KEY UPDATE
  field_label=VALUES(field_label),input_type=VALUES(input_type),required_flag=VALUES(required_flag),
  option_values_json=NULL,allowed_uom_codes_json=NULL,default_uom_code=NULL,
  visible_when_field=NULL,visible_when_value=NULL,require_one_group=NULL,
  display_order=VALUES(display_order),active_flag='Y';

UPDATE item_type_spec_field F
JOIN item_type_master T ON T.item_type_id=F.item_type_id
JOIN item_group_master G ON G.item_group_id=T.item_group_id
SET F.required_flag='Y',F.active_flag='Y'
WHERE G.group_code='PU' AND T.type_name='Springs'
  AND F.field_code IN ('spring_id_diameter','wire_diameter','length');

INSERT INTO item_type_description_template
  (item_type_id,condition_field_code,condition_operator,condition_value,template_text,display_order,active_flag)
SELECT T.item_type_id,NULL,'DEFAULT',NULL,X.template_text,10,'Y'
FROM (
  SELECT 'Fasteners' AS type_name,'{fastener_details}' AS template_text
  UNION ALL SELECT 'Plugs','{plug_gauge_details}'
  UNION ALL SELECT 'Springs','Ø{spring_id_diameter} {spring_id_diameterUom} × Ø{wire_diameter} {wire_diameterUom} × {length} {lengthUom}'
) X
JOIN item_group_master G ON G.group_code='PU'
JOIN item_type_master T ON T.item_group_id=G.item_group_id AND T.type_name=X.type_name
ON DUPLICATE KEY UPDATE
  condition_field_code=VALUES(condition_field_code),condition_operator=VALUES(condition_operator),
  condition_value=VALUES(condition_value),template_text=VALUES(template_text),active_flag='Y';

COMMIT;

-- ============================================================================
-- Verification: the result should show no missing required upgrade columns.
-- ============================================================================

SELECT expected.table_name,expected.column_name
FROM (
  SELECT 'part_inspection_characteristic' AS table_name,'characteristic_text' AS column_name UNION ALL
  SELECT 'item_incoming_inspection_characteristic','characteristic_text' UNION ALL
  SELECT 'gauge_master','storage_location_id' UNION ALL
  SELECT 'gauge_history','gauge_movement_batch_id' UNION ALL
  SELECT 'gauge_history','certificate_file_name' UNION ALL
  SELECT 'gauge_history','certificate_file_path' UNION ALL
  SELECT 'gauge_history','certificate_file_size_bytes' UNION ALL
  SELECT 'gauge_movement_batches','calibration_agency' UNION ALL
  SELECT 'gauge_movement_batches','service_purchase_order_id' UNION ALL
  SELECT 'gauge_movement_batches','challan_number' UNION ALL
  SELECT 'gauge_movement_batches','dispatch_status' UNION ALL
  SELECT 'customer_master','allowed_transport_modes' UNION ALL
  SELECT 'supplier_master','allowed_transport_modes' UNION ALL
  SELECT 'purchase_orders','transport_mode' UNION ALL
  SELECT 'purchase_gate_entries','transport_mode' UNION ALL
  SELECT 'return_to_vendor_documents','transport_mode' UNION ALL
  SELECT 'return_to_customer_documents','transport_mode'
) expected
LEFT JOIN information_schema.COLUMNS actual
  ON actual.TABLE_SCHEMA=DATABASE()
  AND actual.TABLE_NAME=expected.table_name
  AND actual.COLUMN_NAME=expected.column_name
WHERE actual.COLUMN_NAME IS NULL;

SELECT 'A TECH production upgrade from 26 September 2026 completed.' AS result;
