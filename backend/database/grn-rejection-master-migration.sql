-- Rejection masters and per-line GRN rejection records.
-- A rejection record is created only when Quality rejects a quantity.

CREATE TABLE IF NOT EXISTS rejection_disposition_master (
  rejection_disposition_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  disposition_code VARCHAR(60) NOT NULL,
  disposition_name VARCHAR(160) NOT NULL,
  party_action ENUM('SUPPLIER','CUSTOMER','INTERNAL') NOT NULL DEFAULT 'INTERNAL',
  stock_action ENUM('QUARANTINE','RETURN','REWORK','SCRAP','RELEASE') NOT NULL DEFAULT 'QUARANTINE',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rejection_disposition_id),
  UNIQUE KEY uq_rejection_disposition_code (disposition_code),
  UNIQUE KEY uq_rejection_disposition_name (disposition_name),
  KEY ix_rejection_disposition_active (active_flag, disposition_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rejection_reason_master (
  rejection_reason_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reason_code VARCHAR(60) NOT NULL,
  reason_name VARCHAR(255) NOT NULL,
  reason_category VARCHAR(60) NOT NULL,
  applicable_receipt_types VARCHAR(255) NOT NULL DEFAULT 'ALL',
  default_disposition_id BIGINT UNSIGNED NULL,
  require_remarks ENUM('Y','N') NOT NULL DEFAULT 'Y',
  require_attachment ENUM('Y','N') NOT NULL DEFAULT 'N',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rejection_reason_id),
  UNIQUE KEY uq_rejection_reason_code (reason_code),
  UNIQUE KEY uq_rejection_reason_name (reason_name),
  KEY ix_rejection_reason_active (active_flag, reason_name),
  CONSTRAINT fk_rejection_reason_default_disposition FOREIGN KEY (default_disposition_id)
    REFERENCES rejection_disposition_master(rejection_disposition_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grn_rejection_records (
  grn_rejection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  receipt_type VARCHAR(40) NOT NULL,
  responsible_party ENUM('SUPPLIER','CUSTOMER') NOT NULL,
  supplier_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  rejection_reason_id BIGINT UNSIGNED NULL,
  rejection_reason_code_snapshot VARCHAR(60) NOT NULL,
  rejection_reason_name_snapshot VARCHAR(255) NOT NULL,
  rejection_disposition_id BIGINT UNSIGNED NULL,
  rejection_disposition_code_snapshot VARCHAR(60) NOT NULL,
  rejection_disposition_name_snapshot VARCHAR(160) NOT NULL,
  rejected_quantity DECIMAL(18,3) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  quality_remarks VARCHAR(1000) NULL,
  attachment_reference VARCHAR(500) NULL,
  status ENUM('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_by VARCHAR(50) NULL,
  closed_at DATETIME NULL,
  PRIMARY KEY (grn_rejection_id),
  UNIQUE KEY uq_grn_rejection_item (grn_item_id),
  KEY ix_grn_rejection_queue (tenant_id, status, responsible_party, created_at),
  KEY ix_grn_rejection_header (tenant_id, grn_id),
  CONSTRAINT fk_grn_rejection_header FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_rejection_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_rejection_reason FOREIGN KEY (rejection_reason_id)
    REFERENCES rejection_reason_master(rejection_reason_id) ON DELETE SET NULL,
  CONSTRAINT fk_grn_rejection_disposition FOREIGN KEY (rejection_disposition_id)
    REFERENCES rejection_disposition_master(rejection_disposition_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO rejection_disposition_master
  (disposition_code, disposition_name, party_action, stock_action, active_flag)
VALUES
  ('HOLD', 'Quality hold', 'INTERNAL', 'QUARANTINE', 'Y'),
  ('RETURN_TO_VENDOR', 'Return to vendor', 'SUPPLIER', 'RETURN', 'Y'),
  ('RETURN_TO_CUSTOMER', 'Return to customer', 'CUSTOMER', 'RETURN', 'Y'),
  ('REPLACEMENT', 'Replacement required', 'SUPPLIER', 'QUARANTINE', 'Y'),
  ('REWORK', 'Rework', 'INTERNAL', 'REWORK', 'Y'),
  ('SCRAP', 'Scrap', 'INTERNAL', 'SCRAP', 'Y'),
  ('DEVIATION_APPROVAL', 'Deviation approval', 'INTERNAL', 'QUARANTINE', 'Y')
ON DUPLICATE KEY UPDATE disposition_name=VALUES(disposition_name);

INSERT INTO rejection_reason_master
  (reason_code, reason_name, reason_category, applicable_receipt_types,
   default_disposition_id, require_remarks, require_attachment, active_flag)
SELECT seed.reason_code, seed.reason_name, seed.reason_category, 'ALL',
  disposition.rejection_disposition_id, 'Y', seed.require_attachment, 'Y'
FROM (
  SELECT 'DIMENSION_OUT' AS reason_code, 'Dimension out of tolerance' AS reason_name, 'QUALITY' AS reason_category, 'N' AS require_attachment
  UNION ALL SELECT 'SURFACE_DAMAGE', 'Surface damage', 'QUALITY', 'Y'
  UNION ALL SELECT 'WRONG_MATERIAL', 'Wrong material received', 'MATERIAL', 'Y'
  UNION ALL SELECT 'QUANTITY_SHORT', 'Quantity short', 'QUANTITY', 'N'
  UNION ALL SELECT 'PACKING_DAMAGE', 'Packing damage', 'PACKING', 'Y'
  UNION ALL SELECT 'DOCUMENT_MISMATCH', 'Document mismatch', 'DOCUMENT', 'N'
) AS seed
JOIN rejection_disposition_master disposition ON disposition.disposition_code='HOLD'
ON DUPLICATE KEY UPDATE reason_name=VALUES(reason_name);
