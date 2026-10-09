-- ATECH ERP
-- 02 - Create Machine Master and Machine Unit records from Machine Master.xlsx
--
-- Prerequisite:
--   Run 01-machine-items-from-machine-master.sql, review its 11-row output,
--   and confirm every Machine Type before running this file.
--
-- This file imports 11 machine models and 18 physical machine units from the
-- "existin machine details" sheet. Machine Type Hourly Cost is initialized as
-- INR 0.00 and must be maintained in Machine Master before Process Cost is calculated.
--
-- The sample V1 record in sheet "Machine master list (2)" is intentionally not
-- imported because it conflicts with the JYOTI RX20 existing-list ID VMC-01.

SET @ATECH_OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_machine_master_import;
CREATE TEMPORARY TABLE tmp_machine_master_import (
  source_order INT NOT NULL,
  source_key VARCHAR(20) NOT NULL,
  machine_name VARCHAR(250) NOT NULL,
  machine_type_code VARCHAR(30) NOT NULL,
  expected_unit_count INT UNSIGNED NOT NULL,
  PRIMARY KEY (source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_machine_master_import
  (source_order,source_key,machine_name,machine_type_code,expected_unit_count)
VALUES
  (1, 'MM-001','JYOTI RX20',             'HMC',1),
  (2, 'MM-002','STM VL850',              'VMC',1),
  (3, 'MM-003','AMS MCV450',             'VMC',5),
  (4, 'MM-004','STM VL1000',             'VMC',1),
  (5, 'MM-005','JYOTI DX 200 5A',        'CNC_TURNING',4),
  (6, 'MM-006','VMC 850',                'VMC',1),
  (7, 'MM-007','MCV 800',                'VMC',1),
  (8, 'MM-008','VINTAGE 800',            'CNC_TURNING',1),
  (9, 'MM-009','MAKINO A51',             'HMC',1),
  (10,'MM-010','STAR MICRONICS CO. LTD', 'VMC',1),
  (11,'MM-011','BFW 50 TC24',            'VMC',1);

DROP TEMPORARY TABLE IF EXISTS tmp_machine_unit_import;
CREATE TEMPORARY TABLE tmp_machine_unit_import (
  source_key VARCHAR(20) NOT NULL,
  machine_code VARCHAR(50) NOT NULL,
  serial_number VARCHAR(120) NULL,
  installation_date DATE NULL,
  PRIMARY KEY (machine_code),
  KEY ix_tmp_machine_unit_source (source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_machine_unit_import
  (source_key,machine_code,serial_number,installation_date)
VALUES
  ('MM-001','VMC-01',NULL,NULL),
  ('MM-002','VMC-02',NULL,NULL),
  ('MM-003','V03',NULL,NULL),
  ('MM-003','V08',NULL,NULL),
  ('MM-003','V09',NULL,NULL),
  ('MM-003','V10',NULL,NULL),
  ('MM-003','V12',NULL,NULL),
  ('MM-004','VMC-05',NULL,NULL),
  ('MM-005','T01',NULL,NULL),
  ('MM-005','T04',NULL,NULL),
  ('MM-005','T05',NULL,NULL),
  ('MM-005','T06',NULL,NULL),
  ('MM-006','V07',NULL,NULL),
  ('MM-007','V06',NULL,NULL),
  ('MM-008','T02',NULL,NULL),
  ('MM-009','H01',NULL,NULL),
  ('MM-010','T03',NULL,NULL),
  ('MM-011','V11',NULL,NULL);

DELIMITER $$
DROP PROCEDURE IF EXISTS import_machine_master_from_xlsx$$
CREATE PROCEDURE import_machine_master_from_xlsx()
BEGIN
  DECLARE v_missing_items INT DEFAULT 0;
  DECLARE v_type_mismatch INT DEFAULT 0;
  DECLARE v_unit_count_mismatch INT DEFAULT 0;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema=DATABASE() AND table_name='machine_master'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema=DATABASE() AND table_name='machine_unit'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Machine Master tables are missing. Run machine-master-schema.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='machine_type_master' AND column_name='hourly_cost_inr'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='machine_type_master.hourly_cost_inr is missing. Run machine-master-schema.sql first.';
  END IF;

  SELECT COUNT(*) INTO v_missing_items
  FROM tmp_machine_master_import S
  LEFT JOIN item_master I
    ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%')
      AND I.active_flag='Y'
  WHERE I.item_id IS NULL;

  IF v_missing_items>0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Required Machine Item records are missing. Run and verify file 01 first.';
  END IF;

  SELECT COUNT(*) INTO v_type_mismatch
  FROM tmp_machine_master_import S
  JOIN item_master I
    ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%')
  JOIN machine_type_master T ON T.machine_type_id=I.machine_type_id
  WHERE T.machine_type_code<>S.machine_type_code;

  IF v_type_mismatch>0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Machine Type differs from the confirmed workbook mapping. Correct file 02 mapping or Item Master before import.';
  END IF;

  SELECT COUNT(*) INTO v_unit_count_mismatch
  FROM tmp_machine_master_import S
  LEFT JOIN (
    SELECT source_key,COUNT(*) unit_count
    FROM tmp_machine_unit_import GROUP BY source_key
  ) U ON U.source_key=S.source_key
  WHERE COALESCE(U.unit_count,0)<>S.expected_unit_count;

  IF v_unit_count_mismatch>0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Physical machine count does not match the workbook No of Machines value.';
  END IF;

  START TRANSACTION;

  INSERT INTO machine_master
    (item_id,other_specification,machine_status,active_flag,created_by)
  SELECT
    I.item_id,
    CONCAT('Imported from Machine Master.xlsx [',S.source_key,']'),
    'ACTIVE','Y','MACHINE_XLSX_IMPORT'
  FROM tmp_machine_master_import S
  JOIN item_master I
    ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%')
  ON DUPLICATE KEY UPDATE
    machine_status='ACTIVE',
    active_flag='Y',
    other_specification=VALUES(other_specification),
    updated_by='MACHINE_XLSX_IMPORT';

  INSERT INTO machine_unit
    (machine_master_id,machine_code,serial_number,installation_date,plant_location,
     department_name,unit_status,remarks,created_by)
  SELECT
    M.machine_master_id,U.machine_code,U.serial_number,U.installation_date,NULL,
    'PRODUCTION','ACTIVE',
    CONCAT('Imported from Machine Master.xlsx [',U.source_key,']'),
    'MACHINE_XLSX_IMPORT'
  FROM tmp_machine_unit_import U
  JOIN item_master I
    ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',U.source_key,']%')
  JOIN machine_master M ON M.item_id=I.item_id
  ON DUPLICATE KEY UPDATE
    machine_master_id=VALUES(machine_master_id),
    serial_number=COALESCE(machine_unit.serial_number,VALUES(serial_number)),
    installation_date=COALESCE(machine_unit.installation_date,VALUES(installation_date)),
    department_name=COALESCE(machine_unit.department_name,VALUES(department_name)),
    unit_status='ACTIVE',
    remarks=VALUES(remarks),
    updated_by='MACHINE_XLSX_IMPORT';

  COMMIT;
END$$
CALL import_machine_master_from_xlsx()$$
DROP PROCEDURE import_machine_master_from_xlsx$$
DELIMITER ;

-- Verification: expected result is 11 models and 18 physical machines.
SELECT
  I.item_code AS `Item Code`,
  I.item_description AS `Machine`,
  T.machine_type_code AS `Machine Type`,
  I.make_name AS `Make`,
  I.model_name AS `Model`,
  I.machine_capacity AS `Capacity`,
  U.machine_code AS `M/C ID`,
  U.serial_number AS `Serial Number`,
  U.installation_date AS `Installation Date`,
  T.hourly_cost_inr AS `Machine Type Hourly Cost INR`
FROM tmp_machine_master_import S
JOIN item_master I
  ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%')
JOIN machine_type_master T ON T.machine_type_id=I.machine_type_id
JOIN machine_master M ON M.item_id=I.item_id
JOIN machine_unit U ON U.machine_master_id=M.machine_master_id
ORDER BY S.source_order,U.machine_code;

SELECT
  COUNT(DISTINCT M.machine_master_id) AS machine_models,
  COUNT(U.machine_unit_id) AS physical_machines,
  CASE WHEN COUNT(DISTINCT M.machine_master_id)=11 AND COUNT(U.machine_unit_id)=18
       THEN 'PASS - Machine Master import completed.'
       ELSE 'FAIL - Review imported record counts.' END AS import_status
FROM tmp_machine_master_import S
JOIN item_master I
  ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%')
JOIN machine_master M ON M.item_id=I.item_id
LEFT JOIN machine_unit U ON U.machine_master_id=M.machine_master_id;

DROP TEMPORARY TABLE IF EXISTS tmp_machine_unit_import;
DROP TEMPORARY TABLE IF EXISTS tmp_machine_master_import;
SET SQL_SAFE_UPDATES = @ATECH_OLD_SQL_SAFE_UPDATES;
