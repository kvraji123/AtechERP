-- Party details for Gate Entry types that are not linked to a purchase order.
ALTER TABLE purchase_gate_entries
  ADD COLUMN IF NOT EXISTS customer_id BIGINT UNSIGNED NULL AFTER supplier_id,
  ADD COLUMN IF NOT EXISTS customer_name_snapshot VARCHAR(200) NULL AFTER customer_id,
  ADD KEY IF NOT EXISTS ix_gate_entry_customer (tenant_id, customer_id);
