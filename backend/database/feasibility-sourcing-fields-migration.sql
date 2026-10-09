ALTER TABLE marketing_feasibilities
  ADD COLUMN raw_material_source VARCHAR(20) NULL
    AFTER product_technically_feasible,
  ADD COLUMN purchase_source_available VARCHAR(3) NULL
    AFTER raw_material_source,
  ADD COLUMN material_source_details TEXT NULL
    AFTER purchase_source_available,
  ADD COLUMN outsource_process_required VARCHAR(3) NULL
    AFTER material_source_details,
  ADD COLUMN outsource_source_details TEXT NULL
    AFTER outsource_process_required;
