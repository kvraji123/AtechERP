-- Receipt classification and customer-supplied material references for GRN inward.

ALTER TABLE goods_receipt_notes
  ADD COLUMN IF NOT EXISTS receipt_type VARCHAR(40) NOT NULL DEFAULT 'REGULAR_PURCHASE' AFTER grn_date,
  ADD COLUMN IF NOT EXISTS customer_id BIGINT UNSIGNED NULL AFTER supplier_id,
  ADD COLUMN IF NOT EXISTS customer_name_snapshot VARCHAR(200) NULL AFTER customer_id,
  ADD COLUMN IF NOT EXISTS customer_plant_code VARCHAR(80) NULL AFTER customer_name_snapshot,
  ADD KEY IF NOT EXISTS ix_grn_receipt_type (tenant_id, receipt_type);
