-- GRN incoming-inspection snapshots and sampled-lot disposition workflow.
-- Run after purchase-module-migration.sql and item-incoming-inspection-plan-migration.sql.

ALTER TABLE goods_receipt_notes
  MODIFY COLUMN status ENUM('DRAFT','INWARD','INSPECTION_PENDING','INSPECTION_HOLD','ACCEPTED','PARTIALLY_ACCEPTED','REJECTED','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  MODIFY COLUMN inspection_status ENUM('NOT_REQUIRED','PENDING','PASSED','FAILED','PARTIAL','HOLD') NOT NULL DEFAULT 'PENDING';

ALTER TABLE goods_receipt_note_items
  ADD COLUMN IF NOT EXISTS on_hold_quantity DECIMAL(18,3) NOT NULL DEFAULT 0 AFTER rejected_quantity,
  ADD COLUMN IF NOT EXISTS inspection_disposition ENUM('PENDING','HOLD','FULL_INSPECTION','REJECT_LOT','PARTIAL_ACCEPT','DEVIATION_ACCEPT') NOT NULL DEFAULT 'PENDING' AFTER replacement_required,
  ADD COLUMN IF NOT EXISTS quality_remarks VARCHAR(1000) NULL AFTER inspection_disposition;

CREATE TABLE IF NOT EXISTS grn_inspection_characteristics (
  grn_inspection_characteristic_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  sequence_number INT NOT NULL,
  source_item_inspection_characteristic_id BIGINT UNSIGNED NULL,
  characteristic_code_snapshot VARCHAR(80) NULL,
  characteristic_name_snapshot VARCHAR(255) NOT NULL,
  characteristic_type_snapshot VARCHAR(100) NULL,
  specified_dimension DECIMAL(18,4) NULL,
  tolerance_grade_text VARCHAR(50) NULL,
  tolerance_minus DECIMAL(18,4) NULL,
  tolerance_plus DECIMAL(18,4) NULL,
  lsl DECIMAL(18,4) NULL,
  usl DECIMAL(18,4) NULL,
  drawing_grid VARCHAR(50) NULL,
  instrument_name_snapshot VARCHAR(255) NULL,
  sample_size_snapshot VARCHAR(50) NULL,
  inspection_frequency_snapshot VARCHAR(100) NULL,
  actual_value VARCHAR(250) NULL,
  inspection_result ENUM('PENDING','PASS','FAIL') NOT NULL DEFAULT 'PENDING',
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grn_inspection_characteristic_id),
  UNIQUE KEY uq_grn_inspection_characteristic_sequence (grn_item_id, sequence_number),
  KEY ix_grn_inspection_characteristic_tenant (tenant_id, grn_item_id),
  CONSTRAINT fk_grn_inspection_characteristic_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
