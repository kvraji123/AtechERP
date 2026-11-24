-- Links the calibration-dispatch detail/history batch to its single GRN Outward document.
-- The movement batch stores Gauge-ID traceability; it is not a second challan.

ALTER TABLE gauge_movement_batches
  ADD COLUMN material_outward_document_id BIGINT UNSIGNED NULL AFTER source_calibration_dispatch_id;

ALTER TABLE gauge_movement_batches
  ADD UNIQUE KEY uq_gauge_calibration_outward_document (material_outward_document_id);

ALTER TABLE gauge_movement_batches
  ADD CONSTRAINT fk_gauge_calibration_outward_document
  FOREIGN KEY (material_outward_document_id)
  REFERENCES material_outward_documents(material_outward_document_id)
  ON UPDATE CASCADE ON DELETE RESTRICT;
