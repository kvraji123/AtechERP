-- Links tooling regrinding DCs to GRN Outward and records the GRN Inward return.

ALTER TABLE tooling_regrind_batches
  ADD COLUMN material_outward_document_id BIGINT UNSIGNED NULL AFTER dispatch_bin_location,
  ADD COLUMN return_grn_number VARCHAR(80) NULL AFTER material_outward_document_id,
  ADD COLUMN return_gate_entry_id BIGINT UNSIGNED NULL AFTER return_grn_number,
  ADD UNIQUE KEY uq_tooling_regrind_return_grn (tenant_id,return_grn_number),
  ADD KEY ix_tooling_regrind_outward_document (material_outward_document_id),
  ADD KEY ix_tooling_regrind_return_gate (return_gate_entry_id);
