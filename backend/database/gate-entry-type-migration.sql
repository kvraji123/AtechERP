-- Gate entry types and references for receipts that are not linked to a PO.
ALTER TABLE purchase_gate_entries
  MODIFY COLUMN purchase_order_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN supplier_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN supplier_name_snapshot VARCHAR(200) NULL;

ALTER TABLE purchase_gate_entries
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(40) NOT NULL DEFAULT 'REGULAR_PURCHASE' AFTER entry_datetime,
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100) NULL AFTER entry_type,
  ADD KEY IF NOT EXISTS ix_gate_entry_type (tenant_id, entry_type, entry_datetime);
