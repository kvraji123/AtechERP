-- Part Process Flow and operation-wise Inspection Plan
-- Run after machine-master-schema.sql and part-bom-schema.sql.

SET @has_machine_type_hourly_cost := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='machine_type_master' AND COLUMN_NAME='hourly_cost_inr'
);
SET @machine_type_hourly_cost_sql := IF(@has_machine_type_hourly_cost=0,
  'ALTER TABLE machine_type_master ADD COLUMN hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER machine_type_name',
  'SELECT 1');
PREPARE machine_type_hourly_cost_statement FROM @machine_type_hourly_cost_sql;
EXECUTE machine_type_hourly_cost_statement;
DEALLOCATE PREPARE machine_type_hourly_cost_statement;

SET @has_machine_hourly_cost := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='machine_unit' AND COLUMN_NAME='hourly_cost_inr'
);
SET @machine_hourly_cost_sql := IF(@has_machine_hourly_cost=0,
  'ALTER TABLE machine_unit ADD COLUMN hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER unit_status',
  'SELECT 1');
PREPARE machine_hourly_cost_statement FROM @machine_hourly_cost_sql;
EXECUTE machine_hourly_cost_statement;
DEALLOCATE PREPARE machine_hourly_cost_statement;

CREATE TABLE IF NOT EXISTS operation_master (
  operation_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operation_code VARCHAR(30) NOT NULL,
  operation_name VARCHAR(120) NOT NULL,
  default_source ENUM('INHOUSE','OUTSOURCE') NOT NULL DEFAULT 'INHOUSE',
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (operation_master_id),
  UNIQUE KEY uq_operation_code (operation_code),
  UNIQUE KEY uq_operation_name (operation_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE operation_master MODIFY operation_code VARCHAR(60) NOT NULL;

CREATE TABLE IF NOT EXISTS operation_source_master (
  source_code VARCHAR(30) NOT NULL,
  source_name VARCHAR(80) NOT NULL,
  costing_mode ENUM('INHOUSE','OUTSOURCE') NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_code),
  UNIQUE KEY uq_operation_source_name (source_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_characteristic_master (
  characteristic_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  characteristic_code VARCHAR(30) NOT NULL,
  characteristic_name VARCHAR(150) NOT NULL,
  characteristic_type ENUM('VARIABLE','ATTRIBUTE') NOT NULL DEFAULT 'VARIABLE',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (characteristic_master_id),
  UNIQUE KEY uq_inspection_characteristic_code (characteristic_code),
  UNIQUE KEY uq_inspection_characteristic_name (characteristic_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_instrument_master (
  instrument_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  instrument_code VARCHAR(30) NOT NULL,
  instrument_name VARCHAR(150) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (instrument_master_id),
  UNIQUE KEY uq_inspection_instrument_code (instrument_code),
  UNIQUE KEY uq_inspection_instrument_name (instrument_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_sample_size_master (
  sample_size_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sample_size_code VARCHAR(30) NOT NULL,
  sample_size_label VARCHAR(80) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (sample_size_id),
  UNIQUE KEY uq_inspection_sample_size_code (sample_size_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_frequency_master (
  frequency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  frequency_code VARCHAR(30) NOT NULL,
  frequency_label VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (frequency_id),
  UNIQUE KEY uq_inspection_frequency_code (frequency_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tolerance_grade_master (
  tolerance_grade_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  grade_code VARCHAR(20) NOT NULL,
  basic_size_from DECIMAL(12,4) NOT NULL,
  basic_size_to DECIMAL(12,4) NOT NULL,
  lower_deviation_microns DECIMAL(12,4) NOT NULL DEFAULT 0,
  upper_deviation_microns DECIMAL(12,4) NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (tolerance_grade_id),
  UNIQUE KEY uq_tolerance_grade_range (grade_code,basic_size_from,basic_size_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS part_process_plan (
  process_plan_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  part_id BIGINT UNSIGNED NOT NULL,
  drawing_revision_number VARCHAR(50) NULL,
  production_capacity_per_day DECIMAL(18,3) NULL,
  plan_status ENUM('DRAFT','APPROVED') NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (process_plan_id),
  UNIQUE KEY uq_part_process_revision (part_id,drawing_revision_number),
  CONSTRAINT fk_process_plan_part FOREIGN KEY (part_id)
    REFERENCES part_master(part_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS part_process_operation (
  process_operation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  process_plan_id BIGINT UNSIGNED NOT NULL,
  operation_number INT NOT NULL,
  operation_master_id BIGINT UNSIGNED NULL,
  operation_description VARCHAR(500) NULL,
  source_type ENUM('INHOUSE','OUTSOURCE') NOT NULL,
  machine_type_id BIGINT UNSIGNED NULL,
  machine_unit_id BIGINT UNSIGNED NULL,
  cycle_time_seconds DECIMAL(18,3) NULL,
  clamping_time_seconds DECIMAL(18,3) NULL,
  setting_time_hours DECIMAL(18,3) NULL,
  outsource_cost_inr DECIMAL(18,2) NULL,
  process_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0,
  inspection_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  sequence_authorization_type ENUM('REWORK','DEVIATION','OVERRIDE_APPROVAL') NULL,
  sequence_authorization_reason VARCHAR(1000) NULL,
  sequence_authorized_by VARCHAR(50) NULL,
  sequence_authorized_name VARCHAR(150) NULL,
  sequence_authorized_role VARCHAR(100) NULL,
  sequence_authorized_on DATETIME NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (process_operation_id),
  UNIQUE KEY uq_process_operation_number (process_plan_id,operation_number),
  KEY ix_process_operation_master (operation_master_id),
  KEY ix_process_operation_machine_type (machine_type_id),
  KEY ix_process_operation_machine (machine_unit_id),
  CONSTRAINT fk_process_operation_plan FOREIGN KEY (process_plan_id)
    REFERENCES part_process_plan(process_plan_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_process_operation_master FOREIGN KEY (operation_master_id)
    REFERENCES operation_master(operation_master_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_process_operation_machine_type FOREIGN KEY (machine_type_id)
    REFERENCES machine_type_master(machine_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_process_operation_machine FOREIGN KEY (machine_unit_id)
    REFERENCES machine_unit(machine_unit_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS part_operation_inspection_plan (
  inspection_plan_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  process_operation_id BIGINT UNSIGNED NOT NULL,
  cmm_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  plan_status ENUM('DRAFT','READY') NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inspection_plan_id),
  UNIQUE KEY uq_operation_inspection_plan (process_operation_id),
  CONSTRAINT fk_inspection_plan_operation FOREIGN KEY (process_operation_id)
    REFERENCES part_process_operation(process_operation_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS part_inspection_characteristic (
  inspection_characteristic_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inspection_plan_id BIGINT UNSIGNED NOT NULL,
  sequence_number INT NOT NULL,
  balloon_number VARCHAR(30) NULL,
  characteristic_master_id BIGINT UNSIGNED NULL,
  characteristic_text VARCHAR(150) NULL,
  specified_dimension DECIMAL(18,4) NULL,
  tolerance_mode ENUM('GRADE','MANUAL','NOT_APPLICABLE') NOT NULL DEFAULT 'MANUAL',
  tolerance_grade_id BIGINT UNSIGNED NULL,
  tolerance_grade_text VARCHAR(50) NULL,
  tolerance_minus DECIMAL(18,4) NULL,
  tolerance_plus DECIMAL(18,4) NULL,
  lsl DECIMAL(18,4) NULL,
  usl DECIMAL(18,4) NULL,
  drawing_grid VARCHAR(50) NULL,
  instrument_master_id BIGINT UNSIGNED NULL,
  sample_size VARCHAR(50) NULL,
  inspection_frequency VARCHAR(100) NULL,
  sc_cc_identification ENUM('Y','N') NOT NULL DEFAULT 'N',
  patrol_qa_result ENUM('OK','NOT_OK') NULL,
  periodic_operator_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  final_inspection_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inspection_characteristic_id),
  UNIQUE KEY uq_inspection_characteristic_sequence (inspection_plan_id,sequence_number),
  KEY ix_part_inspection_characteristic (characteristic_master_id),
  KEY ix_part_inspection_instrument (instrument_master_id),
  CONSTRAINT fk_characteristic_inspection_plan FOREIGN KEY (inspection_plan_id)
    REFERENCES part_operation_inspection_plan(inspection_plan_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_characteristic_master FOREIGN KEY (characteristic_master_id)
    REFERENCES inspection_characteristic_master(characteristic_master_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_characteristic_tolerance FOREIGN KEY (tolerance_grade_id)
    REFERENCES tolerance_grade_master(tolerance_grade_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_characteristic_instrument FOREIGN KEY (instrument_master_id)
    REFERENCES inspection_instrument_master(instrument_master_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE part_process_operation MODIFY operation_master_id BIGINT UNSIGNED NULL;
ALTER TABLE part_inspection_characteristic MODIFY characteristic_master_id BIGINT UNSIGNED NULL;

SET @has_process_machine_type := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='machine_type_id'
);
SET @process_machine_type_sql := IF(@has_process_machine_type=0,
  'ALTER TABLE part_process_operation ADD COLUMN machine_type_id BIGINT UNSIGNED NULL AFTER source_type',
  'SELECT 1');
PREPARE process_machine_type_statement FROM @process_machine_type_sql;
EXECUTE process_machine_type_statement;
DEALLOCATE PREPARE process_machine_type_statement;

UPDATE part_process_operation PO
JOIN machine_unit MU ON MU.machine_unit_id=PO.machine_unit_id
JOIN machine_master MM ON MM.machine_master_id=MU.machine_master_id
JOIN item_master I ON I.item_id=MM.item_id
SET PO.machine_type_id=I.machine_type_id
WHERE PO.process_operation_id > 0 AND PO.machine_type_id IS NULL;

SET @has_process_machine_type_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND CONSTRAINT_NAME='fk_process_operation_machine_type'
);
SET @process_machine_type_fk_sql := IF(@has_process_machine_type_fk=0,
  'ALTER TABLE part_process_operation ADD CONSTRAINT fk_process_operation_machine_type FOREIGN KEY (machine_type_id) REFERENCES machine_type_master(machine_type_id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE process_machine_type_fk_statement FROM @process_machine_type_fk_sql;
EXECUTE process_machine_type_fk_statement;
DEALLOCATE PREPARE process_machine_type_fk_statement;

SET @has_cmm_required := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_operation_inspection_plan'
    AND COLUMN_NAME='cmm_required'
);
SET @cmm_required_sql := IF(@has_cmm_required=0,
  "ALTER TABLE part_operation_inspection_plan ADD COLUMN cmm_required ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER process_operation_id",
  'SELECT 1');
PREPARE cmm_required_statement FROM @cmm_required_sql;
EXECUTE cmm_required_statement;
DEALLOCATE PREPARE cmm_required_statement;

SET @has_tolerance_grade_text := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND COLUMN_NAME='tolerance_grade_text'
);
SET @tolerance_grade_text_sql := IF(@has_tolerance_grade_text=0,
  'ALTER TABLE part_inspection_characteristic ADD COLUMN tolerance_grade_text VARCHAR(50) NULL AFTER tolerance_grade_id',
  'SELECT 1');
PREPARE tolerance_grade_text_statement FROM @tolerance_grade_text_sql;
EXECUTE tolerance_grade_text_statement;
DEALLOCATE PREPARE tolerance_grade_text_statement;

SET @has_part_characteristic_text := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND COLUMN_NAME='characteristic_text'
);
SET @part_characteristic_text_sql := IF(@has_part_characteristic_text=0,
  'ALTER TABLE part_inspection_characteristic ADD COLUMN characteristic_text VARCHAR(150) NULL AFTER characteristic_master_id',
  'SELECT 1');
PREPARE part_characteristic_text_statement FROM @part_characteristic_text_sql;
EXECUTE part_characteristic_text_statement;
DEALLOCATE PREPARE part_characteristic_text_statement;

UPDATE part_inspection_characteristic PIC
JOIN tolerance_grade_master TGM ON TGM.tolerance_grade_id=PIC.tolerance_grade_id
SET PIC.tolerance_grade_text=TGM.grade_code
WHERE PIC.inspection_characteristic_id > 0
  AND PIC.tolerance_grade_text IS NULL;

-- Sequential operation control. A later operation may start while its previous
-- operation is still DRAFT only when an authorised release is recorded.
SET @has_sequence_authorization_type := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='sequence_authorization_type'
);
SET @sequence_authorization_type_sql := IF(@has_sequence_authorization_type=0,
  "ALTER TABLE part_process_operation ADD COLUMN sequence_authorization_type ENUM('REWORK','DEVIATION','OVERRIDE_APPROVAL') NULL AFTER inspection_required",
  'SELECT 1');
PREPARE sequence_authorization_type_statement FROM @sequence_authorization_type_sql;
EXECUTE sequence_authorization_type_statement;
DEALLOCATE PREPARE sequence_authorization_type_statement;

SET @has_sequence_authorization_reason := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='sequence_authorization_reason'
);
SET @sequence_authorization_reason_sql := IF(@has_sequence_authorization_reason=0,
  'ALTER TABLE part_process_operation ADD COLUMN sequence_authorization_reason VARCHAR(1000) NULL AFTER sequence_authorization_type',
  'SELECT 1');
PREPARE sequence_authorization_reason_statement FROM @sequence_authorization_reason_sql;
EXECUTE sequence_authorization_reason_statement;
DEALLOCATE PREPARE sequence_authorization_reason_statement;

SET @has_sequence_authorized_by := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='sequence_authorized_by'
);
SET @sequence_authorized_by_sql := IF(@has_sequence_authorized_by=0,
  'ALTER TABLE part_process_operation ADD COLUMN sequence_authorized_by VARCHAR(50) NULL AFTER sequence_authorization_reason',
  'SELECT 1');
PREPARE sequence_authorized_by_statement FROM @sequence_authorized_by_sql;
EXECUTE sequence_authorized_by_statement;
DEALLOCATE PREPARE sequence_authorized_by_statement;

SET @has_sequence_authorized_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='sequence_authorized_name'
);
SET @sequence_authorized_name_sql := IF(@has_sequence_authorized_name=0,
  'ALTER TABLE part_process_operation ADD COLUMN sequence_authorized_name VARCHAR(150) NULL AFTER sequence_authorized_by',
  'SELECT 1');
PREPARE sequence_authorized_name_statement FROM @sequence_authorized_name_sql;
EXECUTE sequence_authorized_name_statement;
DEALLOCATE PREPARE sequence_authorized_name_statement;

SET @has_sequence_authorized_role := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='sequence_authorized_role'
);
SET @sequence_authorized_role_sql := IF(@has_sequence_authorized_role=0,
  'ALTER TABLE part_process_operation ADD COLUMN sequence_authorized_role VARCHAR(100) NULL AFTER sequence_authorized_name',
  'SELECT 1');
PREPARE sequence_authorized_role_statement FROM @sequence_authorized_role_sql;
EXECUTE sequence_authorized_role_statement;
DEALLOCATE PREPARE sequence_authorized_role_statement;

SET @has_sequence_authorized_on := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_process_operation'
    AND COLUMN_NAME='sequence_authorized_on'
);
SET @sequence_authorized_on_sql := IF(@has_sequence_authorized_on=0,
  'ALTER TABLE part_process_operation ADD COLUMN sequence_authorized_on DATETIME NULL AFTER sequence_authorized_role',
  'SELECT 1');
PREPARE sequence_authorized_on_statement FROM @sequence_authorized_on_sql;
EXECUTE sequence_authorized_on_statement;
DEALLOCATE PREPARE sequence_authorized_on_statement;

INSERT INTO operation_master (operation_code,operation_name,default_source,display_order) VALUES
 ('MILLING','Milling','INHOUSE',10),('DRILLING','Drilling','INHOUSE',20),
 ('MILLING_DRILLING','Milling and Drilling','INHOUSE',21),
 ('MILLING_DRILLING_TAPPING','Milling, Drilling and Tapping','INHOUSE',22),
 ('MILLING_BORING_DRILLING_TAPPING','Milling, Boring, Drilling and Tapping','INHOUSE',23),
 ('FINAL_INSPECTION','Final Inspection','INHOUSE',30),('INWARD_INSPECTION','Inward Inspection','INHOUSE',40),
 ('HEAT_TREATMENT','Heat Treatment','OUTSOURCE',50),('TURNING','Turning','INHOUSE',60),
 ('POWDER_COATING','Powder Coating','OUTSOURCE',70),('PHOSPHATING','Phosphating','OUTSOURCE',80),
 ('PACKING','Packing','INHOUSE',90),('OIL_APPLICATION','Oil Dipping / Application','INHOUSE',100)
ON DUPLICATE KEY UPDATE operation_name=VALUES(operation_name),default_source=VALUES(default_source),active_flag='Y';

INSERT INTO operation_source_master
 (source_code,source_name,costing_mode,display_order,active_flag) VALUES
 ('INHOUSE','In-house','INHOUSE',10,'Y'),
 ('OUTSOURCE','Outsource','OUTSOURCE',20,'Y')
ON DUPLICATE KEY UPDATE source_name=VALUES(source_name),costing_mode=VALUES(costing_mode),
 display_order=VALUES(display_order),active_flag=VALUES(active_flag);

INSERT INTO inspection_characteristic_master (characteristic_code,characteristic_name,characteristic_type) VALUES
 ('BORE_DIA','Bore Diameter','VARIABLE'),('HOLE_DIA','Hole Diameter','VARIABLE'),
 ('TAP','Tap','ATTRIBUTE'),('DRILL_DIA','Drill Diameter','VARIABLE'),('DEPTH','Depth','VARIABLE'),
 ('CENTER_DISTANCE','Centre Distance','VARIABLE'),('FLATNESS','Flatness','VARIABLE'),
 ('SURFACE_FINISH','Surface Finish','ATTRIBUTE'),('VISUAL','Visual Inspection','ATTRIBUTE')
ON DUPLICATE KEY UPDATE characteristic_name=VALUES(characteristic_name),characteristic_type=VALUES(characteristic_type),active_flag='Y';

INSERT INTO inspection_instrument_master (instrument_code,instrument_name) VALUES
 ('VERNIER','Vernier Caliper'),('DIGITAL_VERNIER','Digital Vernier Caliper'),
 ('MICROMETER','Micrometer'),('DIGITAL_MICROMETER','Digital Micrometer'),
 ('BORE_GAUGE','Bore Gauge'),('HEIGHT_GAUGE','Height Gauge'),('DEPTH_GAUGE','Depth Gauge'),
 ('THREAD_PLUG','Thread Plug Gauge'),('PLAIN_PLUG','Plain Plug Gauge'),('THREAD_RING','Thread Ring Gauge'),
 ('PLAIN_RING','Plain Ring Gauge'),('DIAL_INDICATOR','Dial Indicator'),('CMM','CMM'),
 ('WIDTH_GAUGE','Width Gauge'),('VISUAL','Visual'),('HEIGHT_GAUGE_2D','2D Height Gauge'),
 ('BORE_DIAL','Bore Dial'),('PIN_GAUGE','Pin Gauge'),('TPG_VERNIER','TPG + Vernier'),
 ('PPG_VERNIER','PPG + Vernier'),('PIN_VERNIER','Pin + Vernier'),
 ('BEVEL_PROTRACTOR','Bevel Protractor'),('LEVER_DIAL','Lever Dial'),('TEMPLATE','Template'),
 ('FUNCTION_GAUGE','Function Gauge'),('MANDREL','Mandrel'),('SCREW_VERNIER','Screw + Vernier'),
 ('TORQUE_WRENCH','Torque Wrench'),('RADIUS_GAUGE','Radius Gauge'),
 ('DEPTH_VERNIER','Depth Vernier'),('DEPTH_MICROMETER','Depth Micrometer'),
 ('INSIDE_CALIPER','Inside Caliper'),('SNAP_GAUGE','Snap Gauge'),('GROOVE_DIAL','Groove Dial'),
 ('PROGRAM_QUALIFIED','Program Qualified'),('TOOL_QUALIFIED','Tool Qualified'),
 ('FEELER_GAUGE','Feeler Gauge'),('SLIP_GAUGE','Slip Gauge')
ON DUPLICATE KEY UPDATE instrument_name=VALUES(instrument_name),active_flag='Y';

INSERT INTO inspection_sample_size_master (sample_size_code,sample_size_label,display_order) VALUES
 ('1','1',10),('2','2',20),('3','3',30),('5','5',40),('10','10',50),('100_PERCENT','100%',60)
ON DUPLICATE KEY UPDATE sample_size_label=VALUES(sample_size_label),display_order=VALUES(display_order),active_flag='Y';

INSERT INTO inspection_frequency_master (frequency_code,frequency_label,display_order) VALUES
 ('EVERY_PART','Every Part',10),('EVERY_5','Every 5 Parts',20),('EVERY_10','Every 10 Parts',30),
 ('HOURLY','Hourly',40),('PER_SHIFT','Once per Shift',50),('ONCE_PER_LOT','Once per Lot',55),
 ('FIRST_LAST','First & Last Part',60),('FINAL','Final Inspection',70)
ON DUPLICATE KEY UPDATE frequency_label=VALUES(frequency_label),display_order=VALUES(display_order),active_flag='Y';

INSERT INTO tolerance_grade_master
 (grade_code,basic_size_from,basic_size_to,lower_deviation_microns,upper_deviation_microns) VALUES
 ('H6',0,3,0,6),('H6',3,6,0,8),('H6',6,10,0,9),('H6',10,18,0,11),
 ('H7',0,3,0,10),('H7',3,6,0,12),('H7',6,10,0,15),('H7',10,18,0,18),
 ('H8',0,3,0,14),('H8',3,6,0,18),('H8',6,10,0,22),('H8',10,18,0,27)
ON DUPLICATE KEY UPDATE lower_deviation_microns=VALUES(lower_deviation_microns),
 upper_deviation_microns=VALUES(upper_deviation_microns),active_flag='Y';
