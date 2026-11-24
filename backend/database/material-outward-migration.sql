-- Controlled outbound material documents.
-- Company stock is reduced only when an approved document is dispatched.

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

-- Tracks stock that has physically left the company for an outsource operation.
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
