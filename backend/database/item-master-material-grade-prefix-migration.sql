-- ATECH Item Master migration
-- 1. Keeps the existing Item Description prefix behaviour.
-- 2. Adds a dedicated backend Item Code prefix and per-type running number.
-- 3. Adds one Item Master Material & Grade selection backed by material_grade_master.
-- Run this file after selecting the ATECH application database.

SET NAMES utf8mb4;
SET @ATECH_OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_item_master_prefix_columns$$
CREATE PROCEDURE add_item_master_prefix_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'item_type_master'
      AND column_name = 'item_code_prefix'
  ) THEN
    ALTER TABLE item_type_master
      ADD COLUMN item_code_prefix VARCHAR(10) NULL AFTER description_prefix;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'item_type_master'
      AND column_name = 'current_number'
  ) THEN
    ALTER TABLE item_type_master
      ADD COLUMN current_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER item_code_prefix;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'item_master'
      AND column_name = 'material_grade_id'
  ) THEN
    ALTER TABLE item_master
      ADD COLUMN material_grade_id BIGINT UNSIGNED NULL AFTER material_id;
  END IF;
END$$

CALL add_item_master_prefix_columns()$$
DROP PROCEDURE add_item_master_prefix_columns$$

DROP PROCEDURE IF EXISTS add_item_master_extended_columns$$
CREATE PROCEDURE add_item_master_extended_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='additional_description') THEN ALTER TABLE item_master ADD COLUMN additional_description VARCHAR(1000) NULL AFTER item_specification; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='lead_time_days') THEN ALTER TABLE item_master ADD COLUMN lead_time_days INT UNSIGNED NULL AFTER model_name; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='reorder_level') THEN ALTER TABLE item_master ADD COLUMN reorder_level DECIMAL(18,3) NULL AFTER lead_time_days; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='maximum_stock') THEN ALTER TABLE item_master ADD COLUMN maximum_stock DECIMAL(18,3) NULL AFTER reorder_level; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='storage_location') THEN ALTER TABLE item_master ADD COLUMN storage_location VARCHAR(150) NULL AFTER maximum_stock; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='shelf_life_applicable') THEN ALTER TABLE item_master ADD COLUMN shelf_life_applicable ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER storage_location; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='batch_tracking_required') THEN ALTER TABLE item_master ADD COLUMN batch_tracking_required ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER shelf_life_applicable; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='serial_tracking_required') THEN ALTER TABLE item_master ADD COLUMN serial_tracking_required ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER batch_tracking_required; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='drawing_number') THEN ALTER TABLE item_master ADD COLUMN drawing_number VARCHAR(120) NULL AFTER serial_tracking_required; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='drawing_revision') THEN ALTER TABLE item_master ADD COLUMN drawing_revision VARCHAR(50) NULL AFTER drawing_number; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='serial_number') THEN ALTER TABLE item_master ADD COLUMN serial_number VARCHAR(120) NULL AFTER drawing_revision; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='asset_category') THEN ALTER TABLE item_master ADD COLUMN asset_category VARCHAR(50) NULL AFTER serial_number; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='warranty_applicable') THEN ALTER TABLE item_master ADD COLUMN warranty_applicable ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER asset_category; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='warranty_period_months') THEN ALTER TABLE item_master ADD COLUMN warranty_period_months INT UNSIGNED NULL AFTER warranty_applicable; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='installation_required') THEN ALTER TABLE item_master ADD COLUMN installation_required ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER warranty_period_months; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='calibration_required') THEN ALTER TABLE item_master ADD COLUMN calibration_required ENUM('Y','N') NOT NULL DEFAULT 'N' AFTER installation_required; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='calibration_frequency') THEN ALTER TABLE item_master ADD COLUMN calibration_frequency VARCHAR(30) NULL AFTER calibration_required; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='measurement_range') THEN ALTER TABLE item_master ADD COLUMN measurement_range VARCHAR(120) NULL AFTER calibration_frequency; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='least_count') THEN ALTER TABLE item_master ADD COLUMN least_count VARCHAR(120) NULL AFTER measurement_range; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='accuracy') THEN ALTER TABLE item_master ADD COLUMN accuracy VARCHAR(120) NULL AFTER least_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='calibration_agency_id') THEN ALTER TABLE item_master ADD COLUMN calibration_agency_id BIGINT UNSIGNED NULL AFTER accuracy; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='remarks') THEN ALTER TABLE item_master ADD COLUMN remarks VARCHAR(1000) NULL AFTER calibration_agency_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_supplier' AND column_name='supplier_item_code') THEN ALTER TABLE item_supplier ADD COLUMN supplier_item_code VARCHAR(120) NULL AFTER supplier_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_supplier' AND column_name='currency_code') THEN ALTER TABLE item_supplier ADD COLUMN currency_code VARCHAR(10) NOT NULL DEFAULT 'INR' AFTER purchase_rate; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_supplier' AND column_name='moq') THEN ALTER TABLE item_supplier ADD COLUMN moq DECIMAL(18,3) NULL AFTER currency_code; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_supplier' AND column_name='effective_from') THEN ALTER TABLE item_supplier ADD COLUMN effective_from DATE NULL AFTER lead_time_days; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='item_supplier' AND column_name='effective_to') THEN ALTER TABLE item_supplier ADD COLUMN effective_to DATE NULL AFTER effective_from; END IF;
END$$

CALL add_item_master_extended_columns()$$
DROP PROCEDURE add_item_master_extended_columns$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS item_reference_value (
  item_reference_value_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_group VARCHAR(50) NOT NULL, reference_code VARCHAR(50) NOT NULL,
  reference_label VARCHAR(120) NOT NULL, display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  PRIMARY KEY (item_reference_value_id), UNIQUE KEY uq_item_reference (reference_group,reference_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hsn_master (
  hsn_code VARCHAR(20) NOT NULL, hsn_description VARCHAR(250) NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y', PRIMARY KEY (hsn_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO item_reference_value (reference_group,reference_code,reference_label,display_order) VALUES
 ('ASSET_CATEGORY','MACHINE','Machine',10),('ASSET_CATEGORY','COMPUTER','Computer',20),('ASSET_CATEGORY','FURNITURE','Furniture',30),
 ('ASSET_CATEGORY','SOFTWARE','Software',40),('ASSET_CATEGORY','MEASURING_EQUIPMENT','Measuring Equipment',50),
 ('CALIBRATION_FREQUENCY','MONTHLY','Monthly',10),('CALIBRATION_FREQUENCY','QUARTERLY','Quarterly',20),
 ('CALIBRATION_FREQUENCY','HALF_YEARLY','Half-yearly',30),('CALIBRATION_FREQUENCY','YEARLY','Yearly',40),
 ('ITEM_STATUS','ACTIVE','Active',10),('ITEM_STATUS','INACTIVE','Inactive',20),('ITEM_STATUS','OBSOLETE','Obsolete',30),
 ('CURRENCY','INR','INR',10),('CURRENCY','EUR','EUR',20),('CURRENCY','USD','USD',30),('CURRENCY','GBP','GBP',40)
ON DUPLICATE KEY UPDATE reference_label=VALUES(reference_label),display_order=VALUES(display_order),active_flag='Y';

INSERT INTO hsn_master (hsn_code,hsn_description)
SELECT DISTINCT hsn_code,'Migrated from Item Master' FROM item_master
WHERE hsn_code IS NOT NULL AND TRIM(hsn_code)<>''
ON DUPLICATE KEY UPDATE active_flag='Y';

-- Existing description_prefix stays unchanged and continues to prefix Item Description.
-- It is also the initial Item Code prefix unless a separate prefix is configured later.
UPDATE item_type_master
SET item_code_prefix = UPPER(description_prefix)
WHERE item_code_prefix IS NULL OR TRIM(item_code_prefix) = '';

-- Standardise legacy labels without changing their ids or existing item links.
UPDATE item_group_master SET group_name = 'Tools' WHERE group_code = 'TL';
UPDATE item_type_master T JOIN item_group_master G ON G.item_group_id=T.item_group_id
SET T.type_name = CASE T.type_name
  WHEN 'IT - Hardware' THEN 'IT Hardware'
  WHEN 'Die & Pattern' THEN 'Dies & Patterns'
  WHEN 'Purchase Items' THEN 'Purchased Items'
  WHEN 'Spring' THEN 'Springs'
  WHEN 'Plug' THEN 'Plugs'
  WHEN 'Variable' THEN 'Variable Measuring Instrument'
  WHEN 'Attribute' THEN 'Attribute Gauge'
  WHEN 'Vernier Caliper - Digital' THEN 'Digital Vernier Caliper'
  WHEN 'Micrometer - Digital' THEN 'Digital Micrometer'
  WHEN 'Cotton Box' THEN 'Carton Box'
  WHEN 'Silicon Gel' THEN 'Silica Gel'
  WHEN 'Clamp Pads' THEN 'Clamp Pad'
  ELSE T.type_name
END
WHERE T.type_name IN ('IT - Hardware','Die & Pattern','Purchase Items','Spring','Plug',
  'Variable','Attribute','Vernier Caliper - Digital','Micrometer - Digital',
  'Cotton Box','Silicon Gel','Clamp Pads');

-- Full controlled, group-dependent Item Type LOV. The same configured prefix is
-- used for backend Item Code generation; description_prefix remains independent
-- and continues the current Item Description prefix behaviour.
INSERT INTO item_type_master
  (item_group_id, type_name, description_prefix, item_code_prefix, active_flag)
SELECT G.item_group_id, X.type_name, X.prefix_code, X.prefix_code, 'Y'
FROM (
  SELECT 'CA' group_code, 'IT Hardware' type_name, 'HRD' prefix_code UNION ALL
  SELECT 'CA','Machines & Equipment','MAC' UNION ALL SELECT 'CA','Machine Accessories','MSA' UNION ALL
  SELECT 'CA','Software','SFT' UNION ALL SELECT 'CA','Dies & Patterns','DIE' UNION ALL
  SELECT 'CA','Furniture','FUR' UNION ALL SELECT 'CA','Holders','HLD' UNION ALL SELECT 'CA','Fixtures','FIX' UNION ALL
  SELECT 'CM','Fasteners','FST' UNION ALL SELECT 'CM','Purchased Items','PUR' UNION ALL
  SELECT 'CM','Springs','SPR' UNION ALL SELECT 'CM','Plugs','PLG' UNION ALL
  SELECT 'CM','Adhesive Materials','ADH' UNION ALL SELECT 'CM','Lubricants','LUB' UNION ALL
  SELECT 'CM','Cutting Oil','CTO' UNION ALL SELECT 'CM','Coolant','COL' UNION ALL
  SELECT 'CM','Welding Consumables','WLC' UNION ALL SELECT 'CM','Electrical Consumables','ELC' UNION ALL
  SELECT 'CM','Cleaning Consumables','CLC' UNION ALL SELECT 'CM','Safety Consumables','SFC' UNION ALL
  SELECT 'CM','Office Consumables','OFC' UNION ALL
  SELECT 'IG','Variable Measuring Instrument','VMI' UNION ALL SELECT 'IG','Attribute Gauge','ATG' UNION ALL
  SELECT 'IG','Thread Plug Gauge','TPG' UNION ALL SELECT 'IG','Plain Plug Gauge','PPG' UNION ALL
  SELECT 'IG','Slip Gauge','SLG' UNION ALL SELECT 'IG','Vernier Caliper','VCL' UNION ALL
  SELECT 'IG','Digital Vernier Caliper','DVC' UNION ALL SELECT 'IG','Micrometer','MIC' UNION ALL
  SELECT 'IG','Digital Micrometer','DMI' UNION ALL SELECT 'IG','Width Gauge','WDG' UNION ALL
  SELECT 'IG','Bore Gauge','BRG' UNION ALL SELECT 'IG','Dial Indicator','DIN' UNION ALL
  SELECT 'IG','Bore Gauge Dial','BGD' UNION ALL SELECT 'IG','Height Gauge','HTG' UNION ALL
  SELECT 'IG','Depth Gauge','DPG' UNION ALL SELECT 'IG','Thread Ring Gauge','TRG' UNION ALL
  SELECT 'IG','Plain Ring Gauge','PRG' UNION ALL SELECT 'IG','Snap Gauge','SNG' UNION ALL
  SELECT 'IG','Surface Roughness Tester','SRT' UNION ALL SELECT 'IG','Hardness Tester','HRT' UNION ALL
  SELECT 'IG','CMM Probe','CMP' UNION ALL SELECT 'IG','Measuring Tape','MTP' UNION ALL
  SELECT 'PC','Carton Box','CTB' UNION ALL SELECT 'PC','Packing Cover','PKC' UNION ALL
  SELECT 'PC','Silica Gel','SGL' UNION ALL SELECT 'PC','Plywood','PLY' UNION ALL
  SELECT 'PC','Wooden Box','WDB' UNION ALL SELECT 'PC','Steel Bin','STB' UNION ALL
  SELECT 'PC','Partition','PAR' UNION ALL SELECT 'PC','Bubble Wrap','BWR' UNION ALL
  SELECT 'PC','Stretch Film','SFM' UNION ALL SELECT 'PC','Polythene Cover','PHC' UNION ALL
  SELECT 'PC','Foam Sheet','FMS' UNION ALL SELECT 'PC','Corrugated Sheet','CRS' UNION ALL
  SELECT 'PC','Pallet','PLT' UNION ALL SELECT 'PC','Strapping Material','STM' UNION ALL
  SELECT 'PC','Packing Tape','PKT' UNION ALL SELECT 'PC','Labels','LBL' UNION ALL
  SELECT 'RM','Rod','ROD' UNION ALL SELECT 'RM','Round Bar','RNB' UNION ALL
  SELECT 'RM','Square Bar','SQB' UNION ALL SELECT 'RM','Flat Bar','FLB' UNION ALL
  SELECT 'RM','Plate','PLT' UNION ALL SELECT 'RM','Sheet','SHT' UNION ALL SELECT 'RM','Coil','COI' UNION ALL
  SELECT 'RM','Tube','TUB' UNION ALL SELECT 'RM','Pipe','PIP' UNION ALL SELECT 'RM','Block','BLK' UNION ALL
  SELECT 'RM','Casting','CAS' UNION ALL SELECT 'RM','Forging','FOR' UNION ALL SELECT 'RM','Wire','WIR' UNION ALL
  SELECT 'RM','Profile','PRO' UNION ALL SELECT 'RM','Extrusion','EXT' UNION ALL SELECT 'RM','Powder','PWD' UNION ALL
  SELECT 'TL','Inserts','INS' UNION ALL SELECT 'TL','Drill','DRL' UNION ALL SELECT 'TL','Tap','TAP' UNION ALL
  SELECT 'TL','End Mill','ENM' UNION ALL SELECT 'TL','Reamer','REA' UNION ALL SELECT 'TL','Cutter','CUT' UNION ALL
  SELECT 'TL','Boring Bar','BRB' UNION ALL SELECT 'TL','Tool Holder','THD' UNION ALL
  SELECT 'TL','Collet','CLT' UNION ALL SELECT 'TL','Chuck','CHK' UNION ALL SELECT 'TL','Clamp Pad','CLP' UNION ALL
  SELECT 'TL','Fixture','FIX' UNION ALL SELECT 'TL','Jig','JIG' UNION ALL SELECT 'TL','Mandrel','MAN' UNION ALL
  SELECT 'TL','Die','DIE' UNION ALL SELECT 'TL','Punch','PUN' UNION ALL SELECT 'TL','Grinding Wheel','GRW' UNION ALL
  SELECT 'TL','Abrasive Tool','ABT' UNION ALL SELECT 'TL','Measuring Fixture','MFX' UNION ALL
  SELECT 'TL','Assembly Fixture','AFX'
) X JOIN item_group_master G ON G.group_code=X.group_code
WHERE NOT (X.group_code='TL' AND EXISTS (
 SELECT 1 FROM item_type_master FT JOIN item_group_master FG ON FG.item_group_id=FT.item_group_id
 WHERE FG.group_code='FX' AND FT.item_code_prefix=X.prefix_code))
AND NOT (X.group_code='CM' AND EXISTS (
 SELECT 1 FROM item_type_master C JOIN item_group_master CG ON CG.item_group_id=C.item_group_id
 WHERE CG.group_code='PU' AND C.item_code_prefix=X.prefix_code))
AND NOT (X.group_code='CM' AND X.type_name='Purchased Items' AND EXISTS (
 SELECT 1 FROM item_type_master PT JOIN item_group_master PG ON PG.item_group_id=PT.item_group_id
 WHERE PG.group_code='PU' AND PT.type_name='Purchased Items'))
ON DUPLICATE KEY UPDATE
  active_flag='Y';

-- Legacy standard Stud/Bush rows remain for historical item links but are no
-- longer offered under Tools & Fixtures.
UPDATE item_type_master T JOIN item_group_master G ON G.item_group_id=T.item_group_id
SET T.active_flag='N'
WHERE G.group_code='TL' AND T.type_name IN ('Stud','Bush');

INSERT INTO uom_master (uom_code, uom_name, active_flag) VALUES
  ('NOS','Numbers','Y'), ('KG','Kilogram','Y'), ('GM','Gram','Y'), ('MT','Metric Ton','Y'),
  ('MM','Millimetre','Y'), ('CM','Centimetre','Y'), ('MTR','Metre','Y'), ('SQM','Square Metre','Y'),
  ('LTR','Litre','Y'), ('ML','Millilitre','Y'), ('PCS','Pieces','Y'), ('SET','Set','Y'),
  ('PAIR','Pair','Y'), ('BOX','Box','Y'), ('PACK','Packet','Y'), ('ROLL','Roll','Y'),
  ('SHEET','Sheet','Y'), ('COIL','Coil','Y'), ('TUBE','Tube','Y'), ('LOT','Lot','Y'),
  ('HR','Hour','Y'), ('DAY','Day','Y')
ON DUPLICATE KEY UPDATE uom_name=VALUES(uom_name), active_flag='Y';

ALTER TABLE item_type_master
  MODIFY item_code_prefix VARCHAR(10) NOT NULL;

ALTER TABLE item_master
  MODIFY item_status ENUM('ACTIVE','INACTIVE','OBSOLETE') NOT NULL DEFAULT 'ACTIVE';

-- Material Category and Grade remain normalized in the database, while Item Master
-- presents them as a single searchable Material & Grade field.
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
    REFERENCES material_master(material_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO material_master (material_name, active_flag) VALUES
  ('Aluminium','Y'), ('Alloy Steel','Y'), ('Carbon Steel','Y'),
  ('Mild Steel','Y'), ('Stainless Steel','Y'), ('Cast Iron','Y'),
  ('Brass','Y'), ('Bronze','Y'), ('Gun Metal','Y'), ('Carbide','Y'),
  ('High-Speed Steel','Y'), ('Nylon','Y'), ('Delrin','Y'), ('Teflon','Y'),
  ('Plastic','Y'), ('Granite','Y'), ('Spring Steel','Y')
ON DUPLICATE KEY UPDATE active_flag = 'Y';

INSERT INTO material_grade_master (material_id, grade_code, grade_name, active_flag)
SELECT M.material_id, X.grade_code, X.grade_name, 'Y'
FROM (
  SELECT 'Aluminium' material_name, 'GENERAL' grade_code, 'Aluminium' grade_name UNION ALL
  SELECT 'Aluminium', '6061', 'Aluminium 6061' UNION ALL
  SELECT 'Aluminium', '6063', 'Aluminium 6063' UNION ALL
  SELECT 'Alloy Steel', '16MNCR5', '16MnCr5' UNION ALL
  SELECT 'Alloy Steel', 'EN19', 'EN19' UNION ALL
  SELECT 'Alloy Steel', 'EN24', 'EN24' UNION ALL
  SELECT 'Alloy Steel', 'EN353', 'EN353' UNION ALL
  SELECT 'Alloy Steel', 'EN47', 'EN47' UNION ALL
  SELECT 'Carbon Steel', 'C45', 'C45' UNION ALL
  SELECT 'Carbon Steel', 'EN8', 'EN8' UNION ALL
  SELECT 'Mild Steel', 'GENERAL', 'Mild Steel' UNION ALL
  SELECT 'Mild Steel', 'LOW-CARBON', 'Low Carbon Steel' UNION ALL
  SELECT 'Mild Steel', 'CR-SHEET', 'CR Sheet' UNION ALL
  SELECT 'Stainless Steel', 'SS303', 'SS303' UNION ALL
  SELECT 'Stainless Steel', 'SS304', 'SS304' UNION ALL
  SELECT 'Stainless Steel', 'SS316', 'SS316' UNION ALL
  SELECT 'Stainless Steel', 'SS402', 'SS402' UNION ALL
  SELECT 'Stainless Steel', 'SS410', 'SS410' UNION ALL
  SELECT 'Stainless Steel', 'SS416', 'SS416' UNION ALL
  SELECT 'Stainless Steel', 'SS420', 'SS420' UNION ALL
  SELECT 'Stainless Steel', 'SS431', 'SS431' UNION ALL
  SELECT 'Cast Iron', 'GENERAL', 'Cast Iron' UNION ALL
  SELECT 'Brass', 'GENERAL', 'Brass' UNION ALL
  SELECT 'Bronze', 'GENERAL', 'Bronze' UNION ALL
  SELECT 'Gun Metal', 'GENERAL', 'Gun Metal' UNION ALL
  SELECT 'Carbide', 'GENERAL', 'Carbide' UNION ALL
  SELECT 'High-Speed Steel', 'HSS', 'HSS' UNION ALL
  SELECT 'Nylon', 'GENERAL', 'Nylon' UNION ALL
  SELECT 'Delrin', 'GENERAL', 'Delrin' UNION ALL
  SELECT 'Teflon', 'GENERAL', 'Teflon' UNION ALL
  SELECT 'Plastic', 'GENERAL', 'Plastic' UNION ALL
  SELECT 'Granite', 'GENERAL', 'Granite' UNION ALL
  SELECT 'Spring Steel', 'GENERAL', 'Spring Steel'
) X
JOIN material_master M ON M.material_name = X.material_name
ON DUPLICATE KEY UPDATE
  grade_name = VALUES(grade_name), active_flag = 'Y';

-- Preserve existing Item material selections by matching legacy mixed values to
-- the new controlled Material & Grade display values.
UPDATE item_master I
JOIN material_master OLD_M ON OLD_M.material_id = I.material_id
CROSS JOIN material_grade_master MG
JOIN material_master CAT ON CAT.material_id = MG.material_id
SET I.material_grade_id = MG.material_grade_id
WHERE I.material_grade_id IS NULL
  AND (
    UPPER(REPLACE(REPLACE(REPLACE(OLD_M.material_name, ' ', ''), '-', ''), '/', '')) =
    UPPER(REPLACE(REPLACE(REPLACE(MG.grade_code, ' ', ''), '-', ''), '/', ''))
    OR UPPER(TRIM(OLD_M.material_name)) = UPPER(TRIM(MG.grade_name))
    OR (
      UPPER(TRIM(OLD_M.material_name)) = UPPER(TRIM(CAT.material_name))
      AND MG.grade_code = 'GENERAL'
    )
  );

DELIMITER $$

DROP PROCEDURE IF EXISTS add_item_material_grade_constraints$$
CREATE PROCEDURE add_item_material_grade_constraints()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'item_type_master'
      AND index_name = 'uq_item_type_code_prefix'
  ) THEN
    ALTER TABLE item_type_master
      ADD UNIQUE KEY uq_item_type_code_prefix (item_group_id, item_code_prefix);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'item_master'
      AND index_name = 'ix_item_material_grade'
  ) THEN
    ALTER TABLE item_master
      ADD KEY ix_item_material_grade (material_grade_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'item_master'
      AND constraint_name = 'fk_item_material_grade'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE item_master
      ADD CONSTRAINT fk_item_material_grade
      FOREIGN KEY (material_grade_id)
      REFERENCES material_grade_master(material_grade_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END$$

CALL add_item_material_grade_constraints()$$
DROP PROCEDURE add_item_material_grade_constraints$$

DELIMITER ;

-- Resume a per-type counter safely when records already use the new format.
UPDATE item_type_master T
JOIN item_group_master G ON G.item_group_id = T.item_group_id
LEFT JOIN (
  SELECT I.item_type_id,
    MAX(CAST(SUBSTRING_INDEX(I.item_code, '-', -1) AS UNSIGNED)) AS max_number
  FROM item_master I
  WHERE I.item_code REGEXP '^[A-Za-z0-9]+-[A-Za-z0-9]+-[0-9]{1,}$'
  GROUP BY I.item_type_id
) X ON X.item_type_id = T.item_type_id
SET T.current_number = GREATEST(T.current_number, COALESCE(X.max_number, 0));

-- Backend-configured dynamic specification fields. The frontend renders these
-- rows generically and does not contain Rod/Plate/Pipe-specific field logic.
DELIMITER $$
DROP PROCEDURE IF EXISTS add_material_short_code$$
CREATE PROCEDURE add_material_short_code()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='material_master' AND column_name='material_short_code') THEN
    ALTER TABLE material_master ADD COLUMN material_short_code VARCHAR(20) NULL AFTER material_name;
  END IF;
END$$
CALL add_material_short_code()$$
DROP PROCEDURE add_material_short_code$$
DELIMITER ;

UPDATE material_master SET material_short_code=CASE material_name
 WHEN 'Mild Steel' THEN 'MS' WHEN 'Stainless Steel' THEN 'SS' WHEN 'Aluminium' THEN 'AL'
 WHEN 'Alloy Steel' THEN 'AS' WHEN 'Carbon Steel' THEN 'CS' WHEN 'Cast Iron' THEN 'CI'
 WHEN 'High-Speed Steel' THEN 'HSS' WHEN 'Spring Steel' THEN 'SPRING STEEL'
 ELSE UPPER(material_name) END
WHERE material_short_code IS NULL OR TRIM(material_short_code)='';

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

INSERT INTO item_type_spec_field
 (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,allowed_uom_codes_json,default_uom_code,visible_when_field,visible_when_value,require_one_group,display_order)
SELECT T.item_type_id,X.field_code,X.field_label,X.input_type,X.required_flag,X.options_json,X.uoms_json,X.default_uom,X.visible_field,X.visible_value,X.one_group,X.sort_order
FROM (
 SELECT 'Rod' type_name,'shape' field_code,'Rod Shape' field_label,'SELECT' input_type,'Y' required_flag,JSON_ARRAY('ROUND','SQUARE','HEXAGONAL') options_json,NULL uoms_json,NULL default_uom,NULL visible_field,NULL visible_value,NULL one_group,10 sort_order UNION ALL
 SELECT 'Rod','diameter','Diameter','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM','shape','ROUND',NULL,20 UNION ALL
 SELECT 'Rod','width','Width','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM','shape','SQUARE',NULL,30 UNION ALL
 SELECT 'Rod','height','Height','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM','shape','SQUARE',NULL,40 UNION ALL
 SELECT 'Rod','across_flats','Across Flats','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM','shape','HEXAGONAL',NULL,50 UNION ALL
 SELECT 'Plate','length','Length','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,10 UNION ALL
 SELECT 'Plate','width','Width','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,20 UNION ALL
 SELECT 'Plate','thickness','Thickness','NUMBER','Y',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,NULL,30 UNION ALL
 SELECT 'Sheet','length','Length','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,10 UNION ALL
 SELECT 'Sheet','width','Width','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,20 UNION ALL
 SELECT 'Sheet','thickness','Thickness','NUMBER','Y',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,NULL,30 UNION ALL
 SELECT 'Pipe','outer_diameter','Outer Diameter','NUMBER','Y',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,NULL,10 UNION ALL
 SELECT 'Pipe','inner_diameter','Inner Diameter','NUMBER','N',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,'PIPE_SIZE',20 UNION ALL
 SELECT 'Pipe','wall_thickness','Wall Thickness','NUMBER','N',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,'PIPE_SIZE',30 UNION ALL
 SELECT 'Pipe','length','Length','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,40 UNION ALL
 SELECT 'Tube','outer_diameter','Outer Diameter','NUMBER','Y',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,NULL,10 UNION ALL
 SELECT 'Tube','inner_diameter','Inner Diameter','NUMBER','N',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,'PIPE_SIZE',20 UNION ALL
 SELECT 'Tube','wall_thickness','Wall Thickness','NUMBER','N',NULL,JSON_ARRAY('MM','CM'),'MM',NULL,NULL,'PIPE_SIZE',30 UNION ALL
 SELECT 'Tube','length','Length','NUMBER','Y',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,40
) X JOIN item_type_master T ON T.type_name=X.type_name
ON DUPLICATE KEY UPDATE field_label=VALUES(field_label),input_type=VALUES(input_type),required_flag=VALUES(required_flag),option_values_json=VALUES(option_values_json),allowed_uom_codes_json=VALUES(allowed_uom_codes_json),default_uom_code=VALUES(default_uom_code),visible_when_field=VALUES(visible_when_field),visible_when_value=VALUES(visible_when_value),require_one_group=VALUES(require_one_group),display_order=VALUES(display_order),active_flag='Y';

INSERT INTO item_type_description_template
 (item_type_id,condition_field_code,condition_operator,condition_value,template_text,display_order)
SELECT T.item_type_id,X.condition_field,X.condition_operator,X.condition_value,X.template_text,X.sort_order
FROM (
 SELECT 'Rod' type_name,'shape' condition_field,'EQUALS' condition_operator,'ROUND' condition_value,'{materialShort} {grade} {shapeLabel} Rod Ø{diameter} {diameterUom}' template_text,10 sort_order UNION ALL
 SELECT 'Rod','shape','EQUALS','SQUARE','{materialShort} {grade} {shapeLabel} Rod {width} {widthUom} × {height} {heightUom}',20 UNION ALL
 SELECT 'Rod','shape','EQUALS','HEXAGONAL','{materialShort} {grade} {shapeLabel} Rod AF {across_flats} {across_flatsUom}',30 UNION ALL
 SELECT 'Plate',NULL,'DEFAULT',NULL,'{gradeOrMaterial} Plate {length} {lengthUom} × {width} {widthUom} × {thickness} {thicknessUom}',10 UNION ALL
 SELECT 'Sheet',NULL,'DEFAULT',NULL,'{gradeOrMaterial} Sheet {length} {lengthUom} × {width} {widthUom} × {thickness} {thicknessUom}',10 UNION ALL
 SELECT 'Pipe','wall_thickness','PRESENT',NULL,'{materialShort} Pipe OD {outer_diameter} {outer_diameterUom} × {wall_thickness} {wall_thicknessUom} THK × {length} {lengthUom} – {grade}',10 UNION ALL
 SELECT 'Pipe','inner_diameter','PRESENT',NULL,'{materialShort} Pipe OD {outer_diameter} {outer_diameterUom} × ID {inner_diameter} {inner_diameterUom} × {length} {lengthUom} – {grade}',20 UNION ALL
 SELECT 'Tube','wall_thickness','PRESENT',NULL,'{materialShort} Tube OD {outer_diameter} {outer_diameterUom} × {wall_thickness} {wall_thicknessUom} THK × {length} {lengthUom} – {grade}',10 UNION ALL
 SELECT 'Tube','inner_diameter','PRESENT',NULL,'{materialShort} Tube OD {outer_diameter} {outer_diameterUom} × ID {inner_diameter} {inner_diameterUom} × {length} {lengthUom} – {grade}',20
) X JOIN item_type_master T ON T.type_name=X.type_name
ON DUPLICATE KEY UPDATE condition_field_code=VALUES(condition_field_code),condition_operator=VALUES(condition_operator),condition_value=VALUES(condition_value),template_text=VALUES(template_text),active_flag='Y';

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = @ATECH_OLD_SQL_SAFE_UPDATES;

-- Verification
SELECT G.group_code, T.type_name, T.description_prefix,
       T.item_code_prefix, T.current_number
FROM item_type_master T
JOIN item_group_master G ON G.item_group_id = T.item_group_id
ORDER BY G.group_code, T.type_name;

SELECT MG.material_grade_id, MG.grade_name AS material_and_grade,
       M.material_name AS hidden_category
FROM material_grade_master MG
JOIN material_master M ON M.material_id = MG.material_id
WHERE MG.active_flag = 'Y' AND M.active_flag = 'Y'
ORDER BY MG.grade_name;

START TRANSACTION;
INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,allowed_uom_codes_json,default_uom_code,display_order)
SELECT item_type_id,'length','Length','NUMBER','N',JSON_ARRAY('MM','CM','MTR'),'MM',60
FROM item_type_master WHERE type_name='Rod'
ON DUPLICATE KEY UPDATE required_flag='N',active_flag='Y',allowed_uom_codes_json=VALUES(allowed_uom_codes_json),default_uom_code='MM';
UPDATE item_type_description_template D JOIN item_type_master T ON T.item_type_id=D.item_type_id
SET D.template_text=CONCAT(REPLACE(REPLACE(D.template_text,' × {length} {lengthUom}',''),'{optionalLength}',''),'{optionalLength}')
WHERE D.item_type_description_template_id>0 AND T.type_name='Rod';
COMMIT;
