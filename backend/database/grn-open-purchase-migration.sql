-- Open purchase GRNs have no PO and use item lines entered at receipt.
ALTER TABLE goods_receipt_notes
  MODIFY COLUMN purchase_order_id BIGINT UNSIGNED NULL;
ALTER TABLE goods_receipt_note_items
  MODIFY COLUMN purchase_order_item_id BIGINT UNSIGNED NULL;
ALTER TABLE goods_receipt_note_items
  ADD COLUMN IF NOT EXISTS direct_rate_per_qty DECIMAL(18,2) NULL AFTER received_quantity;
ALTER TABLE goods_receipt_note_items
  ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(8,3) NULL AFTER direct_rate_per_qty;
