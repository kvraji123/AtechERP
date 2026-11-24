-- Calibration returns arrive through Gate Entry as a service receipt and are
-- completed from GRN Inward against the original calibration dispatch challan.

ALTER TABLE purchase_gate_entries
  ADD COLUMN service_type VARCHAR(40) NULL AFTER entry_type,
  ADD KEY ix_gate_entry_service_type (tenant_id, entry_type, service_type, status);

ALTER TABLE gauge_movement_batches
  ADD COLUMN gate_entry_id BIGINT UNSIGNED NULL AFTER material_outward_document_id,
  ADD UNIQUE KEY uq_gauge_calibration_return_gate_entry (gate_entry_id),
  ADD CONSTRAINT fk_gauge_calibration_return_gate_entry
    FOREIGN KEY (gate_entry_id)
    REFERENCES purchase_gate_entries(gate_entry_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
