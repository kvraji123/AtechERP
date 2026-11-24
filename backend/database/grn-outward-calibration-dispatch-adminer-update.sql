-- ATECH ERP: GRN Outward / Calibration Dispatch update
--
-- Import this file only after selecting the target ERP database in Adminer.
-- It is safe to run more than once: existing tables, columns, keys and foreign
-- keys are detected before an alteration is applied.
--
-- Prerequisite: the Gauge Master and Purchase Gate Entry base tables already
-- exist (gauge_master, gauge_history, purchase_gate_entries and purchase_orders).

-- ---------------------------------------------------------------------------
-- GRN Outward / Material Outward document tables
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Calibration dispatch / return traceability
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gauge_movement_batches (
  gauge_movement_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  movement_number VARCHAR(80) NOT NULL,
  movement_type ENUM('ISSUE','RETURN','CALIBRATION_DISPATCH','CALIBRATION_RETURN') NOT NULL,
  movement_date DATE NOT NULL,
  issued_to VARCHAR(120) NULL,
  calibration_agency VARCHAR(180) NULL,
  service_purchase_order_id BIGINT UNSIGNED NULL,
  service_po_number_snapshot VARCHAR(50) NULL,
  challan_number VARCHAR(80) NULL,
  expected_return_date DATE NULL,
  courier_reference VARCHAR(180) NULL,
  dispatch_status ENUM('DISPATCHED','PARTIALLY_RETURNED','RETURNED','CANCELLED') NOT NULL DEFAULT 'DISPATCHED',
  source_calibration_dispatch_id BIGINT UNSIGNED NULL,
  material_outward_document_id BIGINT UNSIGNED NULL,
  gate_entry_id BIGINT UNSIGNED NULL,
  location_name VARCHAR(150) NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gauge_movement_batch_id),
  UNIQUE KEY uq_gauge_movement_batch_number (tenant_id,movement_number),
  KEY ix_gauge_movement_batch_list (tenant_id,movement_type,movement_date),
  KEY ix_gauge_calibration_dispatch_list (tenant_id,movement_type,movement_date),
  KEY ix_gauge_calibration_dispatch_po (tenant_id,service_purchase_order_id),
  KEY ix_gauge_calibration_return_source (tenant_id,source_calibration_dispatch_id,movement_date),
  UNIQUE KEY uq_gauge_calibration_outward_document (material_outward_document_id),
  UNIQUE KEY uq_gauge_calibration_return_gate_entry (gate_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The current API records every movement batch in Gauge History.
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND COLUMN_NAME='gauge_movement_batch_id'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD COLUMN gauge_movement_batch_id BIGINT UNSIGNED NULL AFTER gauge_master_id'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND INDEX_NAME='ix_gauge_history_movement_batch'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD KEY ix_gauge_history_movement_batch (tenant_id,gauge_movement_batch_id)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_history' AND CONSTRAINT_NAME='fk_gauge_history_movement_batch'),
  'SELECT 1',
  'ALTER TABLE gauge_history ADD CONSTRAINT fk_gauge_history_movement_batch FOREIGN KEY (gauge_movement_batch_id) REFERENCES gauge_movement_batches(gauge_movement_batch_id) ON DELETE SET NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Allow the two calibration movement types on old Gauge Master installations.
ALTER TABLE gauge_movement_batches
  MODIFY COLUMN movement_type ENUM('ISSUE','RETURN','CALIBRATION_DISPATCH','CALIBRATION_RETURN') NOT NULL;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='calibration_agency'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN calibration_agency VARCHAR(180) NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='service_purchase_order_id'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN service_purchase_order_id BIGINT UNSIGNED NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='service_po_number_snapshot'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN service_po_number_snapshot VARCHAR(50) NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='challan_number'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN challan_number VARCHAR(80) NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='expected_return_date'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN expected_return_date DATE NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='courier_reference'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN courier_reference VARCHAR(180) NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='dispatch_status'),
  'ALTER TABLE gauge_movement_batches MODIFY COLUMN dispatch_status ENUM(''DISPATCHED'',''PARTIALLY_RETURNED'',''RETURNED'',''CANCELLED'') NOT NULL DEFAULT ''DISPATCHED''',
  'ALTER TABLE gauge_movement_batches ADD COLUMN dispatch_status ENUM(''DISPATCHED'',''PARTIALLY_RETURNED'',''RETURNED'',''CANCELLED'') NOT NULL DEFAULT ''DISPATCHED'''
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='source_calibration_dispatch_id'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN source_calibration_dispatch_id BIGINT UNSIGNED NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='material_outward_document_id'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN material_outward_document_id BIGINT UNSIGNED NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND COLUMN_NAME='gate_entry_id'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD COLUMN gate_entry_id BIGINT UNSIGNED NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='ix_gauge_calibration_dispatch_list'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD KEY ix_gauge_calibration_dispatch_list (tenant_id,movement_type,movement_date)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='ix_gauge_calibration_dispatch_po'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD KEY ix_gauge_calibration_dispatch_po (tenant_id,service_purchase_order_id)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='ix_gauge_calibration_return_source'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD KEY ix_gauge_calibration_return_source (tenant_id,source_calibration_dispatch_id,movement_date)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='uq_gauge_calibration_outward_document'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD UNIQUE KEY uq_gauge_calibration_outward_document (material_outward_document_id)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND INDEX_NAME='uq_gauge_calibration_return_gate_entry'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD UNIQUE KEY uq_gauge_calibration_return_gate_entry (gate_entry_id)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND CONSTRAINT_NAME='fk_gauge_calibration_dispatch_po'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD CONSTRAINT fk_gauge_calibration_dispatch_po FOREIGN KEY (service_purchase_order_id) REFERENCES purchase_orders(purchase_order_id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND CONSTRAINT_NAME='fk_gauge_calibration_return_source'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD CONSTRAINT fk_gauge_calibration_return_source FOREIGN KEY (source_calibration_dispatch_id) REFERENCES gauge_movement_batches(gauge_movement_batch_id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND CONSTRAINT_NAME='fk_gauge_calibration_outward_document'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD CONSTRAINT fk_gauge_calibration_outward_document FOREIGN KEY (material_outward_document_id) REFERENCES material_outward_documents(material_outward_document_id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Gate Entry service classification is used when calibrated gauges return.
SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_gate_entries' AND COLUMN_NAME='service_type'),
  'SELECT 1',
  'ALTER TABLE purchase_gate_entries ADD COLUMN service_type VARCHAR(40) NULL'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_gate_entries' AND INDEX_NAME='ix_gate_entry_service_type'),
  'SELECT 1',
  'ALTER TABLE purchase_gate_entries ADD KEY ix_gate_entry_service_type (tenant_id,entry_type,service_type,status)'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

SET @atech_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gauge_movement_batches' AND CONSTRAINT_NAME='fk_gauge_calibration_return_gate_entry'),
  'SELECT 1',
  'ALTER TABLE gauge_movement_batches ADD CONSTRAINT fk_gauge_calibration_return_gate_entry FOREIGN KEY (gate_entry_id) REFERENCES purchase_gate_entries(gate_entry_id) ON UPDATE CASCADE ON DELETE RESTRICT'
);
PREPARE atech_statement FROM @atech_sql;
EXECUTE atech_statement;
DEALLOCATE PREPARE atech_statement;

-- Optional post-import verification. All listed fields should be returned.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND ((table_name = 'material_outward_documents')
    OR (table_name = 'gauge_movement_batches' AND column_name IN (
      'calibration_agency','expected_return_date','courier_reference',
      'material_outward_document_id','source_calibration_dispatch_id','gate_entry_id'
    )))
ORDER BY table_name, ordinal_position;
