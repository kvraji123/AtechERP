-- Courier gate entries need a traceable carrier and receipt / docket reference.

ALTER TABLE purchase_gate_entries
  ADD COLUMN courier_name VARCHAR(150) NULL AFTER transport_mode;

ALTER TABLE purchase_gate_entries
  ADD COLUMN courier_receipt_number VARCHAR(120) NULL AFTER courier_name;
