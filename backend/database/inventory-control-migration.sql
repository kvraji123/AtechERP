-- Production inventory control foundation.
-- This migration is additive: existing GRN, customer material, tooling and gauge
-- balances remain valid and are classified as GENERAL / AVAILABLE until moved.

CREATE TABLE IF NOT EXISTS inventory_subinventory_master (
  inventory_subinventory_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  subinventory_code VARCHAR(40) NOT NULL,
  subinventory_name VARCHAR(120) NOT NULL,
  inventory_purpose VARCHAR(30) NOT NULL DEFAULT 'STOCK',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (inventory_subinventory_master_id),
  UNIQUE KEY uq_inventory_subinventory (tenant_id,subinventory_code),
  KEY ix_inventory_subinventory_active (tenant_id,active_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_stock_status_master (
  inventory_stock_status_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  stock_status_code VARCHAR(40) NOT NULL,
  stock_status_name VARCHAR(120) NOT NULL,
  available_for_issue_flag ENUM('Y','N') NOT NULL DEFAULT 'N',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inventory_stock_status_master_id),
  UNIQUE KEY uq_inventory_stock_status (tenant_id,stock_status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO inventory_subinventory_master
  (tenant_id,subinventory_code,subinventory_name,inventory_purpose,active_flag,created_by)
SELECT T.tenant_id,S.subinventory_code,S.subinventory_name,S.inventory_purpose,'Y','SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION SELECT DISTINCT tenant_id FROM inventory_stock_balance
  UNION SELECT DISTINCT tenant_id FROM location_master
) T
CROSS JOIN (
  SELECT 'GENERAL' AS subinventory_code,'Legacy / unclassified stock' AS subinventory_name,'STOCK' AS inventory_purpose
  UNION ALL SELECT 'RM','Raw material','STOCK'
  UNION ALL SELECT 'FG','Finished goods','STOCK'
  UNION ALL SELECT 'WIP','Work in progress','WIP'
  UNION ALL SELECT 'MTR','Material return','RETURN'
  UNION ALL SELECT 'PRR','Production return','RETURN'
  UNION ALL SELECT 'MATERIAL_REJECTION','Material rejection','REJECTION'
  UNION ALL SELECT 'PROCESS_REJECTION','Process rejection','REJECTION'
  UNION ALL SELECT 'SCRAP','Scrap','SCRAP'
  UNION ALL SELECT 'TOOLS','Tools and fixtures','TOOLING'
  UNION ALL SELECT 'GAUGES','Gauges and instruments','GAUGE'
) S
WHERE 1=1
ON DUPLICATE KEY UPDATE subinventory_name=VALUES(subinventory_name),inventory_purpose=VALUES(inventory_purpose),active_flag='Y';

INSERT INTO inventory_stock_status_master
  (tenant_id,stock_status_code,stock_status_name,available_for_issue_flag,active_flag,created_by)
SELECT T.tenant_id,S.stock_status_code,S.stock_status_name,S.available_for_issue_flag,'Y','SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION SELECT DISTINCT tenant_id FROM inventory_stock_balance
  UNION SELECT DISTINCT tenant_id FROM location_master
) T
CROSS JOIN (
  SELECT 'AVAILABLE' AS stock_status_code,'Available for issue' AS stock_status_name,'Y' AS available_for_issue_flag
  UNION ALL SELECT 'HOLD','Quality or stores hold','N'
  UNION ALL SELECT 'ISSUED','Issued to work order','N'
  UNION ALL SELECT 'QUARANTINE','Quarantine','N'
  UNION ALL SELECT 'REWORK','Under rework','N'
  UNION ALL SELECT 'REJECTED','Rejected','N'
  UNION ALL SELECT 'SCRAP','Scrap pending disposal','N'
  UNION ALL SELECT 'RETURN_PENDING','Awaiting external return','N'
) S
WHERE 1=1
ON DUPLICATE KEY UPDATE stock_status_name=VALUES(stock_status_name),available_for_issue_flag=VALUES(available_for_issue_flag),active_flag='Y';

ALTER TABLE inventory_stock_balance
  ADD COLUMN IF NOT EXISTS sub_inventory_code VARCHAR(40) NOT NULL DEFAULT 'GENERAL' AFTER warehouse_code;
ALTER TABLE inventory_stock_balance
  ADD COLUMN IF NOT EXISTS stock_status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE' AFTER bin_location;
ALTER TABLE inventory_stock_balance
  ADD COLUMN IF NOT EXISTS work_order_reference VARCHAR(120) NOT NULL DEFAULT '' AFTER batch_serial_number;
ALTER TABLE inventory_stock_balance
  ADD COLUMN IF NOT EXISTS quantity_reserved DECIMAL(18,3) NOT NULL DEFAULT 0.000 AFTER quantity_on_hand;

ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN transaction_type VARCHAR(60) NOT NULL;
ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN grn_id BIGINT UNSIGNED NULL;
ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN grn_item_id BIGINT UNSIGNED NULL;
ALTER TABLE inventory_stock_transaction
  ADD COLUMN IF NOT EXISTS sub_inventory_code VARCHAR(40) NOT NULL DEFAULT 'GENERAL' AFTER warehouse_code;
ALTER TABLE inventory_stock_transaction
  ADD COLUMN IF NOT EXISTS stock_status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE' AFTER bin_location;
ALTER TABLE inventory_stock_transaction
  ADD COLUMN IF NOT EXISTS work_order_reference VARCHAR(120) NOT NULL DEFAULT '' AFTER batch_serial_number;
ALTER TABLE inventory_stock_transaction
  ADD COLUMN IF NOT EXISTS inventory_movement_document_id BIGINT UNSIGNED NULL AFTER grn_item_id;

ALTER TABLE inventory_stock_balance DROP INDEX IF EXISTS uq_inventory_stock_balance_location;
ALTER TABLE inventory_stock_balance ADD UNIQUE KEY IF NOT EXISTS uq_inventory_stock_balance_control
  (tenant_id,plant_id,item_id,warehouse_code,sub_inventory_code,bin_location,batch_serial_number,work_order_reference,stock_status,stock_owner_type,stock_owner_id);
ALTER TABLE inventory_stock_balance ADD KEY IF NOT EXISTS ix_inventory_stock_balance_control
  (tenant_id,warehouse_code,sub_inventory_code,stock_status,stock_owner_type);
ALTER TABLE inventory_stock_transaction ADD KEY IF NOT EXISTS ix_inventory_stock_transaction_control
  (tenant_id,warehouse_code,sub_inventory_code,stock_status,transaction_date);

CREATE TABLE IF NOT EXISTS inventory_movement_documents (
  inventory_movement_document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  movement_number VARCHAR(80) NOT NULL,
  movement_type VARCHAR(50) NOT NULL,
  movement_date DATE NOT NULL,
  document_status ENUM('POSTED','CANCELLED') NOT NULL DEFAULT 'POSTED',
  work_order_reference VARCHAR(120) NULL,
  source_reference_type VARCHAR(50) NULL,
  source_reference_number VARCHAR(160) NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_by VARCHAR(50) NULL,
  cancelled_at DATETIME NULL,
  PRIMARY KEY (inventory_movement_document_id),
  UNIQUE KEY uq_inventory_movement_number (tenant_id,movement_number),
  KEY ix_inventory_movement_document (tenant_id,movement_type,movement_date),
  KEY ix_inventory_movement_work_order (tenant_id,work_order_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movement_lines (
  inventory_movement_line_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inventory_movement_document_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  stock_owner_type VARCHAR(16) NOT NULL DEFAULT 'COMPANY',
  stock_owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  batch_serial_number VARCHAR(120) NOT NULL DEFAULT '',
  work_order_reference VARCHAR(120) NOT NULL DEFAULT '',
  quantity DECIMAL(18,3) NOT NULL,
  from_inventory_stock_balance_id BIGINT UNSIGNED NULL,
  from_warehouse_code VARCHAR(80) NULL,
  from_sub_inventory_code VARCHAR(40) NULL,
  from_bin_location VARCHAR(80) NULL,
  from_stock_status VARCHAR(40) NULL,
  to_inventory_stock_balance_id BIGINT UNSIGNED NULL,
  to_warehouse_code VARCHAR(80) NULL,
  to_sub_inventory_code VARCHAR(40) NULL,
  to_bin_location VARCHAR(80) NULL,
  to_stock_status VARCHAR(40) NULL,
  remarks VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inventory_movement_line_id),
  UNIQUE KEY uq_inventory_movement_line (inventory_movement_document_id,line_number),
  KEY ix_inventory_movement_line_source (from_inventory_stock_balance_id),
  KEY ix_inventory_movement_line_destination (to_inventory_stock_balance_id),
  CONSTRAINT fk_inventory_movement_line_document FOREIGN KEY (inventory_movement_document_id)
    REFERENCES inventory_movement_documents(inventory_movement_document_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_line_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_rejection_cases (
  inventory_rejection_case_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  rejection_number VARCHAR(80) NOT NULL,
  source_type ENUM('GRN','WORK_ORDER','CUSTOMER_RETURN','OUTSOURCE','OTHER') NOT NULL DEFAULT 'WORK_ORDER',
  rejection_type ENUM('MATERIAL','PROCESS') NOT NULL,
  case_status ENUM('OPEN','UNDER_REWORK','RETURN_PENDING','SCRAP_PENDING','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  work_order_reference VARCHAR(120) NULL,
  operation_reference VARCHAR(160) NULL,
  machine_reference VARCHAR(160) NULL,
  process_card_reference VARCHAR(160) NULL,
  rejection_report_reference VARCHAR(160) NULL,
  reported_date DATE NOT NULL,
  remarks VARCHAR(1000) NOT NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (inventory_rejection_case_id),
  UNIQUE KEY uq_inventory_rejection_number (tenant_id,rejection_number),
  KEY ix_inventory_rejection_case_status (tenant_id,case_status,rejection_type),
  KEY ix_inventory_rejection_case_work_order (tenant_id,work_order_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_rejection_case_lines (
  inventory_rejection_case_line_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inventory_rejection_case_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(80) NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  uom_code_snapshot VARCHAR(30) NULL,
  stock_owner_type VARCHAR(16) NOT NULL DEFAULT 'COMPANY',
  stock_owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  batch_serial_number VARCHAR(120) NOT NULL DEFAULT '',
  reported_quantity DECIMAL(18,3) NOT NULL,
  quantity_open DECIMAL(18,3) NOT NULL,
  quarantine_inventory_stock_balance_id BIGINT UNSIGNED NOT NULL,
  final_disposition VARCHAR(40) NULL,
  disposition_reference VARCHAR(160) NULL,
  disposition_remarks VARCHAR(1000) NULL,
  resolved_by VARCHAR(50) NULL,
  resolved_at DATETIME NULL,
  PRIMARY KEY (inventory_rejection_case_line_id),
  KEY ix_inventory_rejection_line_open (inventory_rejection_case_id,quantity_open),
  CONSTRAINT fk_inventory_rejection_line_case FOREIGN KEY (inventory_rejection_case_id)
    REFERENCES inventory_rejection_cases(inventory_rejection_case_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_rejection_line_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_rejection_line_balance FOREIGN KEY (quarantine_inventory_stock_balance_id)
    REFERENCES inventory_stock_balance(inventory_stock_balance_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO location_master (tenant_id,warehouse_name,location_name,active_flag,created_by)
SELECT T.tenant_id,L.warehouse_name,L.location_name,'Y','SYSTEM'
FROM (
  SELECT 'DEFAULT' AS tenant_id
  UNION SELECT DISTINCT tenant_id FROM location_master
) T
CROSS JOIN (
  SELECT 'Main Stores' AS warehouse_name,'RM' AS location_name
  UNION ALL SELECT 'Main Stores','FG'
  UNION ALL SELECT 'Main Stores','MTR'
  UNION ALL SELECT 'Main Stores','PRR'
  UNION ALL SELECT 'Production Stores','RM Staging'
  UNION ALL SELECT 'Production Stores','WIP'
  UNION ALL SELECT 'Production Stores','FG Staging'
  UNION ALL SELECT 'Production Stores','MTR'
  UNION ALL SELECT 'Production Stores','PRR'
  UNION ALL SELECT 'Rejection Yard','Material Quarantine'
  UNION ALL SELECT 'Rejection Yard','Process Quarantine'
  UNION ALL SELECT 'Rejection Yard','Return Pending'
  UNION ALL SELECT 'Scrap Yard','Scrap'
  UNION ALL SELECT 'Production Tools','Tooling'
  UNION ALL SELECT 'Gauge Store','Gauge Rack'
  UNION ALL SELECT 'Production Gauge Store','Gauge Rack'
  UNION ALL SELECT 'Customer Material Stores','RM'
  UNION ALL SELECT 'Customer Material Stores','FG'
  UNION ALL SELECT 'Customer Material Stores','MTR'
  UNION ALL SELECT 'Customer Material Stores','PRR'
) L
WHERE 1=1
ON DUPLICATE KEY UPDATE active_flag='Y';

INSERT INTO inventory_locations (tenant_id,warehouse_code,bin_location,active_flag)
SELECT tenant_id,warehouse_name,location_name,active_flag
FROM location_master
WHERE 1=1
ON DUPLICATE KEY UPDATE active_flag=VALUES(active_flag);

INSERT INTO app_document_sequences (sequence_key,financial_year,prefix,current_number,number_padding)
VALUES ('INVENTORY_MOVE','2026-27','IMV',0,5),('PRODUCTION_REJECTION','2026-27','PRJ',0,5)
ON DUPLICATE KEY UPDATE prefix=VALUES(prefix),number_padding=VALUES(number_padding);
