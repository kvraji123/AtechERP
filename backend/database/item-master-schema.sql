CREATE TABLE IF NOT EXISTS item_group_master (
  item_group_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_code VARCHAR(10) NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  current_number INT UNSIGNED NOT NULL DEFAULT 0,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_group_id),
  UNIQUE KEY uq_item_group_code (group_code),
  UNIQUE KEY uq_item_group_name (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_type_master (
  item_type_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_group_id BIGINT UNSIGNED NOT NULL,
  type_name VARCHAR(120) NOT NULL,
  description_prefix VARCHAR(10) NOT NULL,
  item_code_prefix VARCHAR(10) NOT NULL,
  current_number INT UNSIGNED NOT NULL DEFAULT 0,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_type_id),
  UNIQUE KEY uq_item_type_group_name (item_group_id, type_name),
  UNIQUE KEY uq_item_type_code_prefix (item_group_id, item_code_prefix),
  KEY ix_item_type_group (item_group_id),
  CONSTRAINT fk_item_type_group FOREIGN KEY (item_group_id)
    REFERENCES item_group_master (item_group_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uom_master (
  uom_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uom_code VARCHAR(20) NOT NULL,
  uom_name VARCHAR(100) NOT NULL,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (uom_id),
  UNIQUE KEY uq_uom_code (uom_code),
  UNIQUE KEY uq_uom_name (uom_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS material_master (
  material_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_name VARCHAR(120) NOT NULL,
  material_short_code VARCHAR(20) NULL,
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (material_id),
  UNIQUE KEY uq_material_name (material_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS material_grade_master (
  material_grade_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id BIGINT UNSIGNED NOT NULL,
  grade_code VARCHAR(50) NOT NULL,
  grade_name VARCHAR(120) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (material_grade_id),
  UNIQUE KEY uq_material_grade (material_id, grade_code),
  CONSTRAINT fk_material_grade_material FOREIGN KEY (material_id)
    REFERENCES material_master(material_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_master (
  item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_code VARCHAR(50) NOT NULL,
  item_group_id BIGINT UNSIGNED NOT NULL,
  item_type_id BIGINT UNSIGNED NOT NULL,
  item_description VARCHAR(250) NOT NULL,
  item_specification VARCHAR(1000) NULL,
  additional_description VARCHAR(1000) NULL,
  uom_id BIGINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NULL,
  material_grade_id BIGINT UNSIGNED NULL,
  inspection_required ENUM('Y', 'N') NOT NULL DEFAULT 'N',
  hsn_code VARCHAR(20) NULL,
  purchase_rate DECIMAL(18,2) NULL,
  minimum_stock DECIMAL(18,3) NULL,
  make_name VARCHAR(150) NULL,
  model_name VARCHAR(150) NULL,
  lead_time_days INT UNSIGNED NULL,
  reorder_level DECIMAL(18,3) NULL,
  maximum_stock DECIMAL(18,3) NULL,
  storage_location VARCHAR(150) NULL,
  shelf_life_applicable ENUM('Y','N') NOT NULL DEFAULT 'N',
  shelf_life_days INT UNSIGNED NULL,
  batch_tracking_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  serial_tracking_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  drawing_number VARCHAR(120) NULL,
  drawing_revision VARCHAR(50) NULL,
  serial_number VARCHAR(120) NULL,
  asset_category VARCHAR(50) NULL,
  warranty_applicable ENUM('Y','N') NOT NULL DEFAULT 'N',
  warranty_period_months INT UNSIGNED NULL,
  installation_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  calibration_required ENUM('Y','N') NOT NULL DEFAULT 'N',
  calibration_frequency VARCHAR(30) NULL,
  measurement_range VARCHAR(120) NULL,
  least_count VARCHAR(120) NULL,
  accuracy VARCHAR(120) NULL,
  calibration_agency_id BIGINT UNSIGNED NULL,
  remarks VARCHAR(1000) NULL,
  item_status ENUM('ACTIVE', 'INACTIVE', 'OBSOLETE') NOT NULL DEFAULT 'ACTIVE',
  active_flag ENUM('Y', 'N') NOT NULL DEFAULT 'Y',
  deactivation_remarks VARCHAR(500) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  UNIQUE KEY uq_item_code (item_code),
  KEY ix_item_description (item_description),
  KEY ix_item_group_type (item_group_id, item_type_id),
  KEY ix_item_material (material_id),
  KEY ix_item_material_grade (material_grade_id),
  KEY ix_item_uom (uom_id),
  KEY ix_item_active (active_flag),
  CONSTRAINT fk_item_group FOREIGN KEY (item_group_id)
    REFERENCES item_group_master (item_group_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_item_type FOREIGN KEY (item_type_id)
    REFERENCES item_type_master (item_type_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_item_uom FOREIGN KEY (uom_id)
    REFERENCES uom_master (uom_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_item_material FOREIGN KEY (material_id)
    REFERENCES material_master (material_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_item_material_grade FOREIGN KEY (material_grade_id)
    REFERENCES material_grade_master (material_grade_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_supplier (
  item_supplier_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  supplier_item_code VARCHAR(120) NULL,
  purchase_rate DECIMAL(18,2) NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
  moq DECIMAL(18,3) NULL,
  lead_time_days INT UNSIGNED NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  preferred_supplier ENUM('Y', 'N') NOT NULL DEFAULT 'N',
  remarks VARCHAR(500) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_supplier_id),
  UNIQUE KEY uq_item_supplier (item_id, supplier_id),
  KEY ix_item_supplier_party (supplier_id),
  CONSTRAINT fk_item_supplier_item FOREIGN KEY (item_id)
    REFERENCES item_master (item_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_item_supplier_party FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_reference_value (
  item_reference_value_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_group VARCHAR(50) NOT NULL,
  reference_code VARCHAR(50) NOT NULL,
  reference_label VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (item_reference_value_id),
  UNIQUE KEY uq_item_reference (reference_group,reference_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hsn_master (
  hsn_code VARCHAR(20) NOT NULL,
  hsn_description VARCHAR(250) NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (hsn_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_type_spec_field (
  item_type_spec_field_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_type_id BIGINT UNSIGNED NOT NULL,
  field_code VARCHAR(60) NOT NULL,
  field_label VARCHAR(120) NOT NULL,
  input_type ENUM('TEXT','NUMBER','SELECT') NOT NULL,
  required_flag ENUM('Y','N') NOT NULL DEFAULT 'N',
  option_values_json JSON NULL,
  allowed_uom_codes_json JSON NULL,
  default_uom_code VARCHAR(20) NULL,
  visible_when_field VARCHAR(60) NULL,
  visible_when_value VARCHAR(120) NULL,
  require_one_group VARCHAR(60) NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (item_type_spec_field_id),
  UNIQUE KEY uq_item_type_spec_field (item_type_id,field_code),
  CONSTRAINT fk_item_type_spec_type FOREIGN KEY (item_type_id) REFERENCES item_type_master(item_type_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_type_description_template (
  item_type_description_template_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_type_id BIGINT UNSIGNED NOT NULL,
  condition_field_code VARCHAR(60) NULL,
  condition_operator ENUM('EQUALS','PRESENT','DEFAULT') NOT NULL DEFAULT 'DEFAULT',
  condition_value VARCHAR(120) NULL,
  template_text VARCHAR(1000) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (item_type_description_template_id),
  UNIQUE KEY uq_item_type_description_template (item_type_id,display_order),
  CONSTRAINT fk_item_description_template_type FOREIGN KEY (item_type_id) REFERENCES item_type_master(item_type_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_specification_value (
  item_specification_value_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  item_type_spec_field_id BIGINT UNSIGNED NOT NULL,
  value_text VARCHAR(500) NULL,
  value_number DECIMAL(18,4) NULL,
  uom_id BIGINT UNSIGNED NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_specification_value_id),
  UNIQUE KEY uq_item_specification_value (item_id,item_type_spec_field_id),
  CONSTRAINT fk_item_specification_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_item_specification_field FOREIGN KEY (item_type_spec_field_id) REFERENCES item_type_spec_field(item_type_spec_field_id) ON DELETE RESTRICT,
  CONSTRAINT fk_item_specification_uom FOREIGN KEY (uom_id) REFERENCES uom_master(uom_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_attachment (
  item_attachment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  document_description VARCHAR(250) NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NULL,
  file_size BIGINT UNSIGNED NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_attachment_id),
  KEY ix_item_attachment_item (item_id),
  CONSTRAINT fk_item_attachment_item FOREIGN KEY (item_id)
    REFERENCES item_master (item_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO item_group_master (group_code, group_name) VALUES
  ('CA', 'Capital Item'), ('CM', 'Consumables'),
  ('IG', 'Instruments & Gauges'), ('PC', 'Packing Materials'),
  ('RM', 'Raw Material'), ('TL', 'Tools')
ON DUPLICATE KEY UPDATE group_name = VALUES(group_name), active_flag = 'Y';

INSERT INTO item_type_master (item_group_id, type_name, description_prefix, item_code_prefix)
SELECT G.item_group_id, X.type_name, X.description_prefix, X.description_prefix
FROM (
  SELECT 'CA' group_code, 'IT - Hardware' type_name, 'HRD' description_prefix UNION ALL
  SELECT 'CA', 'Machines & Equipment', 'MAC' UNION ALL SELECT 'CA', 'Machine Accessories', 'MSA' UNION ALL
  SELECT 'CA', 'Software', 'SFT' UNION ALL SELECT 'CA', 'Die & Pattern', 'DIE' UNION ALL
  SELECT 'CA', 'Furniture', 'FUR' UNION ALL SELECT 'CA', 'Holders', 'HLD' UNION ALL SELECT 'CA', 'Fixtures', 'FIX' UNION ALL
  SELECT 'CM', 'Fasteners', 'FST' UNION ALL SELECT 'CM', 'Purchase Items', 'PUR' UNION ALL
  SELECT 'CM', 'Spring', 'SPR' UNION ALL SELECT 'CM', 'Plug', 'PLG' UNION ALL SELECT 'CM', 'Adhesive Materials', 'ADH' UNION ALL
  SELECT 'IG', 'Variable', 'VAR' UNION ALL SELECT 'IG', 'Attribute', 'ATT' UNION ALL
  SELECT 'IG', 'Thread Plug Gauge', 'TPG' UNION ALL SELECT 'IG', 'Plain Plug Gauge', 'PPG' UNION ALL
  SELECT 'IG', 'Slip Gauge', 'SLG' UNION ALL SELECT 'IG', 'Vernier Caliper', 'VCL' UNION ALL
  SELECT 'IG', 'Micrometer', 'MIC' UNION ALL SELECT 'IG', 'Micrometer - Digital', 'MID' UNION ALL
  SELECT 'IG', 'Vernier Caliper - Digital', 'VCD' UNION ALL SELECT 'IG', 'Width Gauge', 'WDG' UNION ALL
  SELECT 'IG', 'Bore Gauge', 'BRG' UNION ALL SELECT 'IG', 'Dial Indicator', 'DIN' UNION ALL SELECT 'IG', 'Bore Gauge Dial', 'BGD' UNION ALL
  SELECT 'PC', 'Cotton Box', 'CTB' UNION ALL SELECT 'PC', 'Packing Cover', 'PKC' UNION ALL
  SELECT 'PC', 'Silicon Gel', 'SGL' UNION ALL SELECT 'PC', 'Plywood', 'PLY' UNION ALL
  SELECT 'PC', 'Steel Bin', 'STB' UNION ALL SELECT 'PC', 'Partition', 'PAR' UNION ALL
  SELECT 'RM', 'Rod', 'ROD' UNION ALL SELECT 'RM', 'Plate', 'PLT' UNION ALL SELECT 'RM', 'Casting', 'CAS' UNION ALL
  SELECT 'TL', 'Inserts', 'INS' UNION ALL SELECT 'TL', 'Drill', 'DRL' UNION ALL SELECT 'TL', 'Tap', 'TAP' UNION ALL
  SELECT 'TL', 'Clamp Pads', 'CLP' UNION ALL SELECT 'TL', 'Stud', 'STD' UNION ALL SELECT 'TL', 'Bush', 'BSH'
) X JOIN item_group_master G ON G.group_code = X.group_code
WHERE NOT (X.group_code='TL' AND EXISTS (
  SELECT 1 FROM item_type_master FT JOIN item_group_master FG ON FG.item_group_id=FT.item_group_id
  WHERE FG.group_code='FX' AND FT.item_code_prefix=X.description_prefix))
AND NOT (X.group_code='CM' AND EXISTS (
 SELECT 1 FROM item_type_master C JOIN item_group_master CG ON CG.item_group_id=C.item_group_id
 WHERE CG.group_code='PU' AND C.item_code_prefix=X.description_prefix))
AND NOT (X.group_code='CM' AND X.type_name IN ('Purchase Items','Purchased Items')
  AND EXISTS (SELECT 1 FROM item_type_master P JOIN item_group_master PG ON PG.item_group_id=P.item_group_id
    WHERE PG.group_code='PU' AND P.type_name IN ('Purchase Items','Purchased Items')))
ON DUPLICATE KEY UPDATE description_prefix = VALUES(description_prefix), active_flag = 'Y';

INSERT INTO uom_master (uom_code, uom_name) VALUES
  ('NOS','Numbers'),('KG','Kilogram'),('GM','Gram'),('MT','Metric Ton'),('MM','Millimetre'),
  ('CM','Centimetre'),('MTR','Metre'),('SQM','Square Metre'),('LTR','Litre'),('ML','Millilitre'),
  ('PCS','Pieces'),('SET','Set'),('PAIR','Pair'),('BOX','Box'),('PACK','Packet'),('ROLL','Roll'),
  ('SHEET','Sheet'),('COIL','Coil'),('TUBE','Tube'),('LOT','Lot'),('HR','Hour'),('DAY','Day')
ON DUPLICATE KEY UPDATE uom_name = VALUES(uom_name), active_flag = 'Y';

INSERT INTO item_reference_value (reference_group,reference_code,reference_label,display_order) VALUES
 ('ASSET_CATEGORY','MACHINE','Machine',10),('ASSET_CATEGORY','COMPUTER','Computer',20),('ASSET_CATEGORY','FURNITURE','Furniture',30),
 ('ASSET_CATEGORY','SOFTWARE','Software',40),('ASSET_CATEGORY','MEASURING_EQUIPMENT','Measuring Equipment',50),
 ('CALIBRATION_FREQUENCY','MONTHLY','Monthly',10),('CALIBRATION_FREQUENCY','QUARTERLY','Quarterly',20),
 ('CALIBRATION_FREQUENCY','HALF_YEARLY','Half-yearly',30),('CALIBRATION_FREQUENCY','YEARLY','Yearly',40),
 ('ITEM_STATUS','ACTIVE','Active',10),('ITEM_STATUS','INACTIVE','Inactive',20),('ITEM_STATUS','OBSOLETE','Obsolete',30),
 ('CURRENCY','INR','INR',10),('CURRENCY','EUR','EUR',20),('CURRENCY','USD','USD',30),('CURRENCY','GBP','GBP',40)
ON DUPLICATE KEY UPDATE reference_label=VALUES(reference_label),display_order=VALUES(display_order),active_flag='Y';

INSERT INTO material_master (material_name) VALUES
  ('Aluminium'), ('Alloy Steel'), ('Carbon Steel'), ('Mild Steel'),
  ('Stainless Steel'), ('Cast Iron'), ('Brass'), ('Bronze'), ('Gun Metal'),
  ('Carbide'), ('High-Speed Steel'), ('Nylon'), ('Delrin'), ('Teflon'),
  ('Plastic'), ('Granite'), ('Spring Steel'), ('Iron'), ('Steel')
ON DUPLICATE KEY UPDATE active_flag = 'Y';
