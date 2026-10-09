-- Formal Return-to-Vendor documents and uploaded rejection evidence.

CREATE TABLE IF NOT EXISTS grn_rejection_attachments (
  grn_rejection_attachment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(50) NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grn_rejection_attachment_id),
  KEY ix_grn_rejection_attachment_item (tenant_id, grn_id, grn_item_id),
  CONSTRAINT fk_grn_rejection_attachment_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_rejection_attachment_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_to_vendor_documents (
  rtv_document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  rtv_number VARCHAR(80) NOT NULL,
  rtv_date DATE NOT NULL,
  document_status ENUM('DISPATCHED','CANCELLED') NOT NULL DEFAULT 'DISPATCHED',
  rejection_inventory_balance_id BIGINT UNSIGNED NOT NULL,
  grn_rejection_id BIGINT UNSIGNED NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  dispatch_reference VARCHAR(160) NULL,
  transport_reference VARCHAR(160) NULL,
  remarks VARCHAR(1000) NULL,
  pdf_file_name VARCHAR(255) NULL,
  pdf_file_path VARCHAR(500) NULL,
  pdf_file_size_bytes BIGINT UNSIGNED NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rtv_document_id),
  UNIQUE KEY uq_rtv_number (tenant_id, rtv_number),
  KEY ix_rtv_balance (tenant_id, rejection_inventory_balance_id, created_at),
  KEY ix_rtv_supplier (tenant_id, supplier_id, rtv_date),
  CONSTRAINT fk_rtv_balance FOREIGN KEY (rejection_inventory_balance_id)
    REFERENCES inventory_rejection_balance(rejection_inventory_balance_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rtv_rejection FOREIGN KEY (grn_rejection_id)
    REFERENCES grn_rejection_records(grn_rejection_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rtv_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rtv_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master(supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_to_vendor_document_items (
  rtv_document_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rtv_document_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(80) NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  returned_quantity DECIMAL(18,3) NOT NULL,
  rejection_reason_snapshot VARCHAR(255) NULL,
  PRIMARY KEY (rtv_document_item_id),
  KEY ix_rtv_document_items (rtv_document_id),
  CONSTRAINT fk_rtv_item_document FOREIGN KEY (rtv_document_id)
    REFERENCES return_to_vendor_documents(rtv_document_id) ON DELETE CASCADE,
  CONSTRAINT fk_rtv_item_grn_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rtv_item_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
