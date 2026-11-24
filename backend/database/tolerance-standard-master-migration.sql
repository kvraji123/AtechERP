-- ISO 2768 tolerance-standard master seeded from Tol Standard.xlsx.
-- The Inspection Plan uses the LINEAR_DIMENSIONS rows to calculate mm Tol-/Tol+ and LSL/USL.
-- MySQL 8.0+; safe to run more than once.

CREATE TABLE IF NOT EXISTS inspection_tolerance_standard_master (
  tolerance_standard_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  standard_code VARCHAR(64) NOT NULL,
  standard_name VARCHAR(150) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tolerance_standard_id),
  UNIQUE KEY uq_tolerance_standard_code (standard_code),
  KEY ix_tolerance_standard_active (active_flag,standard_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_tolerance_standard_band (
  tolerance_standard_band_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tolerance_standard_id BIGINT UNSIGNED NOT NULL,
  characteristic_type VARCHAR(80) NOT NULL,
  range_label VARCHAR(100) NOT NULL,
  nominal_from DECIMAL(14,4) NULL,
  nominal_to DECIMAL(14,4) NULL,
  minimum_inclusive ENUM('Y','N') NOT NULL DEFAULT 'Y',
  maximum_inclusive ENUM('Y','N') NOT NULL DEFAULT 'Y',
  tolerance_minus_mm DECIMAL(14,4) NULL,
  tolerance_plus_mm DECIMAL(14,4) NULL,
  tolerance_display VARCHAR(50) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tolerance_standard_band_id),
  UNIQUE KEY uq_tolerance_standard_band (tolerance_standard_id,characteristic_type,range_label),
  KEY ix_tolerance_standard_band_lookup (tolerance_standard_id,characteristic_type,active_flag,nominal_from,nominal_to),
  CONSTRAINT fk_tolerance_standard_band_standard FOREIGN KEY (tolerance_standard_id)
    REFERENCES inspection_tolerance_standard_master(tolerance_standard_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO inspection_tolerance_standard_master (standard_code,standard_name,active_flag) VALUES
  ('ISO_2768_F','ISO 2768 - f (Fine)','Y'),
  ('ISO_2768_M','ISO 2768 - m (Medium)','Y'),
  ('ISO_2768_C','ISO 2768 - c (Coarse)','Y'),
  ('ISO_2768_V','ISO 2768 - v (Very Coarse)','Y')
ON DUPLICATE KEY UPDATE standard_name=VALUES(standard_name),active_flag='Y';

INSERT INTO inspection_tolerance_standard_band
  (tolerance_standard_id,characteristic_type,range_label,nominal_from,nominal_to,
   minimum_inclusive,maximum_inclusive,tolerance_minus_mm,tolerance_plus_mm,tolerance_display,display_order,active_flag)
SELECT S.tolerance_standard_id,B.characteristic_type,B.range_label,B.nominal_from,B.nominal_to,
  B.minimum_inclusive,B.maximum_inclusive,B.tolerance_minus_mm,B.tolerance_plus_mm,B.tolerance_display,B.display_order,'Y'
FROM (
  SELECT 'ISO_2768_F' standard_code,'LINEAR_DIMENSIONS' characteristic_type,'0.5 up to 3' range_label,0.5 nominal_from,3 nominal_to,'Y' minimum_inclusive,'Y' maximum_inclusive,0.05 tolerance_minus_mm,0.05 tolerance_plus_mm,'±0.05' tolerance_display,10 display_order
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 3 up to 6',3,6,'N','Y',0.05,0.05,'±0.05',20
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 6 up to 30',6,30,'N','Y',0.1,0.1,'±0.1',30
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 30 up to 120',30,120,'N','Y',0.15,0.15,'±0.15',40
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',0.2,0.2,'±0.2',50
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 400 up to 1000',400,1000,'N','Y',0.3,0.3,'±0.3',60
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 1000 up to 2000',1000,2000,'N','Y',0.5,0.5,'±0.5',70
  UNION ALL SELECT 'ISO_2768_F','LINEAR_DIMENSIONS','over 2000 up to 4000',2000,4000,'N','Y',NULL,NULL,'-',80
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','0.5 up to 3',0.5,3,'Y','Y',0.1,0.1,'±0.1',10
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 3 up to 6',3,6,'N','Y',0.1,0.1,'±0.1',20
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 6 up to 30',6,30,'N','Y',0.2,0.2,'±0.2',30
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 30 up to 120',30,120,'N','Y',0.3,0.3,'±0.3',40
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',0.5,0.5,'±0.5',50
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 400 up to 1000',400,1000,'N','Y',0.8,0.8,'±0.8',60
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 1000 up to 2000',1000,2000,'N','Y',1.2,1.2,'±1.2',70
  UNION ALL SELECT 'ISO_2768_M','LINEAR_DIMENSIONS','over 2000 up to 4000',2000,4000,'N','Y',2,2,'±2.0',80
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','0.5 up to 3',0.5,3,'Y','Y',0.2,0.2,'±0.2',10
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 3 up to 6',3,6,'N','Y',0.3,0.3,'±0.3',20
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 6 up to 30',6,30,'N','Y',0.5,0.5,'±0.5',30
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 30 up to 120',30,120,'N','Y',0.8,0.8,'±0.8',40
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',1.2,1.2,'±1.2',50
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 400 up to 1000',400,1000,'N','Y',2,2,'±2.0',60
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 1000 up to 2000',1000,2000,'N','Y',3,3,'±3.0',70
  UNION ALL SELECT 'ISO_2768_C','LINEAR_DIMENSIONS','over 2000 up to 4000',2000,4000,'N','Y',4,4,'±4.0',80
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','0.5 up to 3',0.5,3,'Y','Y',NULL,NULL,'-',10
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 3 up to 6',3,6,'N','Y',0.5,0.5,'±0.5',20
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 6 up to 30',6,30,'N','Y',1,1,'±1.0',30
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 30 up to 120',30,120,'N','Y',1.5,1.5,'±1.5',40
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',2.5,2.5,'±2.5',50
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 400 up to 1000',400,1000,'N','Y',4,4,'±4.0',60
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 1000 up to 2000',1000,2000,'N','Y',6,6,'±6.0',70
  UNION ALL SELECT 'ISO_2768_V','LINEAR_DIMENSIONS','over 2000 up to 4000',2000,4000,'N','Y',8,8,'±8.0',80
  UNION ALL SELECT 'ISO_2768_F','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','0.5 up to 3',0.5,3,'Y','Y',0.2,0.2,'±0.2',10
  UNION ALL SELECT 'ISO_2768_F','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 3 up to 6',3,6,'N','Y',0.5,0.5,'±0.5',20
  UNION ALL SELECT 'ISO_2768_F','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 6',6,NULL,'N','Y',1,1,'±1.0',30
  UNION ALL SELECT 'ISO_2768_M','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','0.5 up to 3',0.5,3,'Y','Y',0.2,0.2,'±0.2',10
  UNION ALL SELECT 'ISO_2768_M','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 3 up to 6',3,6,'N','Y',0.5,0.5,'±0.5',20
  UNION ALL SELECT 'ISO_2768_M','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 6',6,NULL,'N','Y',1,1,'±1.0',30
  UNION ALL SELECT 'ISO_2768_C','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','0.5 up to 3',0.5,3,'Y','Y',0.4,0.4,'±0.4',10
  UNION ALL SELECT 'ISO_2768_C','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 3 up to 6',3,6,'N','Y',1,1,'±1.0',20
  UNION ALL SELECT 'ISO_2768_C','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 6',6,NULL,'N','Y',2,2,'±2.0',30
  UNION ALL SELECT 'ISO_2768_V','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','0.5 up to 3',0.5,3,'Y','Y',0.4,0.4,'±0.4',10
  UNION ALL SELECT 'ISO_2768_V','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 3 up to 6',3,6,'N','Y',1,1,'±1.0',20
  UNION ALL SELECT 'ISO_2768_V','EXTERNAL_RADIUS_AND_CHAMFER_HEIGHTS','over 6',6,NULL,'N','Y',2,2,'±2.0',30
  UNION ALL SELECT 'ISO_2768_F','ANGULAR_DIMENSIONS','up to 10',NULL,10,'Y','Y',NULL,NULL,'±1º',10
  UNION ALL SELECT 'ISO_2768_F','ANGULAR_DIMENSIONS','over 10 up to 50',10,50,'N','Y',NULL,NULL,'±0º30''',20
  UNION ALL SELECT 'ISO_2768_F','ANGULAR_DIMENSIONS','over 50 up to 120',50,120,'N','Y',NULL,NULL,'±0º20''',30
  UNION ALL SELECT 'ISO_2768_F','ANGULAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',NULL,NULL,'±0º10''',40
  UNION ALL SELECT 'ISO_2768_F','ANGULAR_DIMENSIONS','over 400',400,NULL,'N','Y',NULL,NULL,'±0º5''',50
  UNION ALL SELECT 'ISO_2768_M','ANGULAR_DIMENSIONS','up to 10',NULL,10,'Y','Y',NULL,NULL,'±1º',10
  UNION ALL SELECT 'ISO_2768_M','ANGULAR_DIMENSIONS','over 10 up to 50',10,50,'N','Y',NULL,NULL,'±0º30',20
  UNION ALL SELECT 'ISO_2768_M','ANGULAR_DIMENSIONS','over 50 up to 120',50,120,'N','Y',NULL,NULL,'±0º20''',30
  UNION ALL SELECT 'ISO_2768_M','ANGULAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',NULL,NULL,'±0º20''',40
  UNION ALL SELECT 'ISO_2768_M','ANGULAR_DIMENSIONS','over 400',400,NULL,'N','Y',NULL,NULL,'±0º5''',50
  UNION ALL SELECT 'ISO_2768_C','ANGULAR_DIMENSIONS','up to 10',NULL,10,'Y','Y',NULL,NULL,'±1º30''',10
  UNION ALL SELECT 'ISO_2768_C','ANGULAR_DIMENSIONS','over 10 up to 50',10,50,'N','Y',NULL,NULL,'±1º',20
  UNION ALL SELECT 'ISO_2768_C','ANGULAR_DIMENSIONS','over 50 up to 120',50,120,'N','Y',NULL,NULL,'±0º30''',30
  UNION ALL SELECT 'ISO_2768_C','ANGULAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',NULL,NULL,'±0º15''',40
  UNION ALL SELECT 'ISO_2768_C','ANGULAR_DIMENSIONS','over 400',400,NULL,'N','Y',NULL,NULL,'±0º10''',50
  UNION ALL SELECT 'ISO_2768_V','ANGULAR_DIMENSIONS','up to 10',NULL,10,'Y','Y',NULL,NULL,'±3º',10
  UNION ALL SELECT 'ISO_2768_V','ANGULAR_DIMENSIONS','over 10 up to 50',10,50,'N','Y',NULL,NULL,'±2º',20
  UNION ALL SELECT 'ISO_2768_V','ANGULAR_DIMENSIONS','over 50 up to 120',50,120,'N','Y',NULL,NULL,'±1º',30
  UNION ALL SELECT 'ISO_2768_V','ANGULAR_DIMENSIONS','over 120 up to 400',120,400,'N','Y',NULL,NULL,'±0º30''',40
  UNION ALL SELECT 'ISO_2768_V','ANGULAR_DIMENSIONS','over 400',400,NULL,'N','Y',NULL,NULL,'±0º20''',50
) B
JOIN inspection_tolerance_standard_master S ON S.standard_code=B.standard_code
ON DUPLICATE KEY UPDATE
  nominal_from=VALUES(nominal_from),nominal_to=VALUES(nominal_to),
  minimum_inclusive=VALUES(minimum_inclusive),maximum_inclusive=VALUES(maximum_inclusive),
  tolerance_minus_mm=VALUES(tolerance_minus_mm),tolerance_plus_mm=VALUES(tolerance_plus_mm),
  tolerance_display=VALUES(tolerance_display),display_order=VALUES(display_order),active_flag='Y';

SET @has_tolerance_standard_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND COLUMN_NAME='tolerance_standard_id'
);
SET @tolerance_standard_column_sql := IF(@has_tolerance_standard_id=0,
  'ALTER TABLE part_inspection_characteristic ADD COLUMN tolerance_standard_id BIGINT UNSIGNED NULL AFTER tolerance_grade_text',
  'SELECT 1');
PREPARE tolerance_standard_column_statement FROM @tolerance_standard_column_sql;
EXECUTE tolerance_standard_column_statement;
DEALLOCATE PREPARE tolerance_standard_column_statement;

ALTER TABLE part_inspection_characteristic
  MODIFY COLUMN tolerance_mode ENUM('GRADE','MANUAL','NOT_APPLICABLE','STANDARD') NOT NULL DEFAULT 'MANUAL';

SET @has_tolerance_standard_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND INDEX_NAME='ix_part_inspection_tolerance_standard'
);
SET @tolerance_standard_index_sql := IF(@has_tolerance_standard_index=0,
  'ALTER TABLE part_inspection_characteristic ADD KEY ix_part_inspection_tolerance_standard (tolerance_standard_id)',
  'SELECT 1');
PREPARE tolerance_standard_index_statement FROM @tolerance_standard_index_sql;
EXECUTE tolerance_standard_index_statement;
DEALLOCATE PREPARE tolerance_standard_index_statement;

SET @has_tolerance_standard_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_inspection_characteristic'
    AND CONSTRAINT_NAME='fk_part_inspection_tolerance_standard'
);
SET @tolerance_standard_fk_sql := IF(@has_tolerance_standard_fk=0,
  'ALTER TABLE part_inspection_characteristic ADD CONSTRAINT fk_part_inspection_tolerance_standard FOREIGN KEY (tolerance_standard_id) REFERENCES inspection_tolerance_standard_master(tolerance_standard_id) ON UPDATE CASCADE ON DELETE RESTRICT',
  'SELECT 1');
PREPARE tolerance_standard_fk_statement FROM @tolerance_standard_fk_sql;
EXECUTE tolerance_standard_fk_statement;
DEALLOCATE PREPARE tolerance_standard_fk_statement;
