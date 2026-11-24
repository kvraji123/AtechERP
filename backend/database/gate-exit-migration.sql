-- Outbound gate-exit register. One GRN Outward document can leave through one gate exit.
-- The physical exit is intentionally separate from the GRN Outward approval step.

CREATE TABLE IF NOT EXISTS material_gate_exits (
  material_gate_exit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  gate_exit_number VARCHAR(50) NOT NULL,
  material_outward_document_id BIGINT UNSIGNED NOT NULL,
  exit_datetime DATETIME NOT NULL,
  transport_mode VARCHAR(50) NULL,
  vehicle_number VARCHAR(80) NULL,
  driver_name VARCHAR(150) NULL,
  driving_licence_number VARCHAR(100) NULL,
  courier_name VARCHAR(150) NULL,
  courier_receipt_number VARCHAR(120) NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_material_gate_exit_number (tenant_id, gate_exit_number),
  UNIQUE KEY uq_material_gate_exit_outward (tenant_id, material_outward_document_id),
  KEY ix_material_gate_exit_date (tenant_id, exit_datetime),
  CONSTRAINT fk_material_gate_exit_outward
    FOREIGN KEY (material_outward_document_id)
    REFERENCES material_outward_documents(material_outward_document_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
