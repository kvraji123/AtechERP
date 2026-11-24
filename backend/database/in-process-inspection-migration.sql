-- Per-piece, per-characteristic in-process inspection control.
-- This migration depends on Part Master Process Plans and their READY
-- operation inspection plans.

CREATE TABLE IF NOT EXISTS in_process_inspection_run (
  in_process_inspection_run_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  work_order_reference VARCHAR(120) NOT NULL,
  batch_reference VARCHAR(120) NOT NULL DEFAULT '',
  part_id BIGINT UNSIGNED NOT NULL,
  process_plan_id BIGINT UNSIGNED NOT NULL,
  process_operation_id BIGINT UNSIGNED NOT NULL,
  part_number_snapshot VARCHAR(100) NOT NULL,
  part_name_snapshot VARCHAR(200) NOT NULL,
  operation_number_snapshot INT NOT NULL,
  operation_name_snapshot VARCHAR(150) NOT NULL,
  next_piece_sequence INT UNSIGNED NOT NULL DEFAULT 1,
  run_status ENUM('ACTIVE','ON_HOLD','CLOSED') NOT NULL DEFAULT 'ACTIVE',
  hold_reason VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (in_process_inspection_run_id),
  UNIQUE KEY uq_in_process_inspection_run (tenant_id,work_order_reference,batch_reference,process_operation_id),
  KEY ix_in_process_inspection_run_part (tenant_id,part_id,run_status),
  CONSTRAINT fk_in_process_run_part FOREIGN KEY (part_id)
    REFERENCES part_master(part_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_in_process_run_plan FOREIGN KEY (process_plan_id)
    REFERENCES part_process_plan(process_plan_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_in_process_run_operation FOREIGN KEY (process_operation_id)
    REFERENCES part_process_operation(process_operation_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS in_process_inspection_piece (
  in_process_inspection_piece_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  in_process_inspection_run_id BIGINT UNSIGNED NOT NULL,
  piece_sequence INT UNSIGNED NOT NULL,
  piece_reference VARCHAR(180) NOT NULL,
  produced_at DATETIME NOT NULL,
  produced_by VARCHAR(50) NOT NULL,
  piece_status ENUM('PENDING_INSPECTION','READY_FOR_TRANSFER','RELEASED','HOLD','REJECTED') NOT NULL DEFAULT 'READY_FOR_TRANSFER',
  status_updated_by VARCHAR(50) NULL,
  status_updated_at DATETIME NULL,
  PRIMARY KEY (in_process_inspection_piece_id),
  UNIQUE KEY uq_in_process_piece_sequence (in_process_inspection_run_id,piece_sequence),
  UNIQUE KEY uq_in_process_piece_reference (in_process_inspection_run_id,piece_reference),
  KEY ix_in_process_piece_status (in_process_inspection_run_id,piece_status),
  CONSTRAINT fk_in_process_piece_run FOREIGN KEY (in_process_inspection_run_id)
    REFERENCES in_process_inspection_run(in_process_inspection_run_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS in_process_inspection_requirement (
  in_process_inspection_requirement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  in_process_inspection_run_id BIGINT UNSIGNED NOT NULL,
  source_inspection_characteristic_id BIGINT UNSIGNED NOT NULL,
  trigger_piece_id BIGINT UNSIGNED NOT NULL,
  trigger_piece_sequence INT UNSIGNED NOT NULL,
  sample_window_start_sequence INT UNSIGNED NOT NULL,
  sample_window_end_sequence INT UNSIGNED NOT NULL,
  frequency_code_snapshot VARCHAR(100) NOT NULL,
  sample_size_code_snapshot VARCHAR(50) NOT NULL,
  required_sample_count INT UNSIGNED NOT NULL,
  characteristic_code_snapshot VARCHAR(30) NULL,
  characteristic_name_snapshot VARCHAR(150) NOT NULL,
  characteristic_type_snapshot ENUM('VARIABLE','ATTRIBUTE') NOT NULL DEFAULT 'VARIABLE',
  specified_dimension_snapshot DECIMAL(18,4) NULL,
  lsl_snapshot DECIMAL(18,4) NULL,
  usl_snapshot DECIMAL(18,4) NULL,
  drawing_grid_snapshot VARCHAR(50) NULL,
  instrument_name_snapshot VARCHAR(150) NULL,
  requirement_status ENUM('AWAITING_SAMPLE_SELECTION','PENDING_INSPECTION','PASS','FAIL','HOLD','DISPOSED') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_by VARCHAR(50) NULL,
  completed_at DATETIME NULL,
  failure_remarks VARCHAR(1000) NULL,
  PRIMARY KEY (in_process_inspection_requirement_id),
  UNIQUE KEY uq_in_process_requirement_trigger (in_process_inspection_run_id,source_inspection_characteristic_id,trigger_piece_sequence),
  KEY ix_in_process_requirement_queue (in_process_inspection_run_id,requirement_status,trigger_piece_sequence),
  CONSTRAINT fk_in_process_requirement_run FOREIGN KEY (in_process_inspection_run_id)
    REFERENCES in_process_inspection_run(in_process_inspection_run_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_in_process_requirement_characteristic FOREIGN KEY (source_inspection_characteristic_id)
    REFERENCES part_inspection_characteristic(inspection_characteristic_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_in_process_requirement_trigger_piece FOREIGN KEY (trigger_piece_id)
    REFERENCES in_process_inspection_piece(in_process_inspection_piece_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS in_process_inspection_sample (
  in_process_inspection_sample_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  in_process_inspection_requirement_id BIGINT UNSIGNED NOT NULL,
  in_process_inspection_piece_id BIGINT UNSIGNED NOT NULL,
  actual_value VARCHAR(500) NULL,
  inspection_result ENUM('PENDING','PASS','FAIL') NOT NULL DEFAULT 'PENDING',
  remarks VARCHAR(1000) NULL,
  inspected_by VARCHAR(50) NULL,
  inspected_at DATETIME NULL,
  PRIMARY KEY (in_process_inspection_sample_id),
  UNIQUE KEY uq_in_process_requirement_piece (in_process_inspection_requirement_id,in_process_inspection_piece_id),
  KEY ix_in_process_sample_piece (in_process_inspection_piece_id),
  CONSTRAINT fk_in_process_sample_requirement FOREIGN KEY (in_process_inspection_requirement_id)
    REFERENCES in_process_inspection_requirement(in_process_inspection_requirement_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_in_process_sample_piece FOREIGN KEY (in_process_inspection_piece_id)
    REFERENCES in_process_inspection_piece(in_process_inspection_piece_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
