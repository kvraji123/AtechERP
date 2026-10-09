-- ATECH ERP
-- 01 - Create the Item Master records required by Machine Master.xlsx
--
-- Run this file first. Review the final verification result and confirm the
-- Machine Type for every record before running:
--   02-machine-master-from-machine-master.sql
--
-- Workbook mapping retained as supplied:
--   HMC            -> HMC (Horizontal Machining Centre)
--   VMC            -> VMC (Vertical Machining Centre)
--   Turning Center -> CNC_TURNING (CNC Turning Centre)
--
-- Important source-data review notes:
--   1. JYOTI RX20 is classified as HMC although its M/C ID is VMC-01.
--   2. STAR MICRONICS CO. LTD is classified as VMC in the workbook.
--      Change the staging row below to SWISS_TYPE before running if required.
--   3. The sample V1 row from sheet "Machine master list (2)" is not imported
--      here because it duplicates JYOTI RX20 and conflicts with the existing
--      machine list M/C ID VMC-01.

SET @ATECH_OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_machine_item_import;
CREATE TEMPORARY TABLE tmp_machine_item_import (
  source_order INT NOT NULL,
  source_key VARCHAR(20) NOT NULL,
  machine_name VARCHAR(250) NOT NULL,
  machine_type_code VARCHAR(30) NOT NULL,
  make_name VARCHAR(150) NOT NULL,
  model_name VARCHAR(150) NOT NULL,
  machine_capacity VARCHAR(500) NOT NULL,
  PRIMARY KEY (source_key),
  UNIQUE KEY uq_tmp_machine_item_order (source_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_machine_item_import
  (source_order,source_key,machine_name,machine_type_code,make_name,model_name,machine_capacity)
VALUES
  (1, 'MM-001', 'JYOTI RX20',              'HMC',         'JYOTI',                 'RX20',                    'X-820 mm / Y-510 mm / Z-510 mm'),
  (2, 'MM-002', 'STM VL850',               'VMC',         'S&T MANFORD',           'VL850',                   'X-850 mm / Y-510 mm / Z-560 mm'),
  (3, 'MM-003', 'AMS MCV450',              'VMC',         'ACE MICROMATIC GROUP',  'MCV450',                  'X-800 mm / Y-450 mm / Z-500 mm'),
  (4, 'MM-004', 'STM VL1000',              'VMC',         'S&T MANFORD',           'VL1000',                  'X-1000 mm / Y-510 mm / Z-560 mm'),
  (5, 'MM-005', 'JYOTI DX 200 5A',         'CNC_TURNING', 'JYOTI',                 'DX 200 5A',               'X-350 mm / Z-500 mm / Chuck Dia 254 mm'),
  (6, 'MM-006', 'VMC 850',                 'VMC',         'JYOTI',                 'VMC 850',                 'X-850 mm / Y-510 mm / Z-820 mm'),
  (7, 'MM-007', 'MCV 800',                 'VMC',         'COSMOS',                'MCV 800',                 'X-1000 mm / Y-510 mm / Z-760 mm'),
  (8, 'MM-008', 'VINTAGE 800',             'CNC_TURNING', 'ACE MICROMATIC',        'VINTAGE 800',             'X-550 mm / Z-850 mm / Chuck Dia 300 mm'),
  (9, 'MM-009', 'MAKINO A51',              'HMC',         'MAKINO',                'A51',                     'X-560 mm / Y-560 mm / Z-600 mm'),
  (10,'MM-010', 'STAR MICRONICS CO. LTD',  'VMC',         'STAR',                  'STAR MICRONICS CO. LTD',  'Collet size 2 to 20 mm'),
  (11,'MM-011', 'BFW 50 TC24',             'VMC',         'BFW',                   '50 TC24',                 'X-800 mm / Y-510 mm / Z-510 mm');

DELIMITER $$
DROP PROCEDURE IF EXISTS import_machine_items_from_xlsx$$
CREATE PROCEDURE import_machine_items_from_xlsx()
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_source_key VARCHAR(20);
  DECLARE v_machine_name VARCHAR(250);
  DECLARE v_machine_type_code VARCHAR(30);
  DECLARE v_make_name VARCHAR(150);
  DECLARE v_model_name VARCHAR(150);
  DECLARE v_machine_capacity VARCHAR(500);
  DECLARE v_group_id BIGINT UNSIGNED;
  DECLARE v_type_id BIGINT UNSIGNED;
  DECLARE v_uom_id BIGINT UNSIGNED;
  DECLARE v_machine_type_id BIGINT UNSIGNED;
  DECLARE v_item_id BIGINT UNSIGNED;
  DECLARE v_next_number INT UNSIGNED;
  DECLARE v_item_code VARCHAR(50);

  DECLARE machine_cursor CURSOR FOR
    SELECT source_key,machine_name,machine_type_code,make_name,model_name,machine_capacity
    FROM tmp_machine_item_import ORDER BY source_order;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='machine_type_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='machine_capacity'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Machine Item columns are missing. Run machine-master-schema.sql first.';
  END IF;

  SELECT MAX(item_group_id) INTO v_group_id
  FROM item_group_master WHERE group_code='CA' AND active_flag='Y';
  SELECT MAX(item_type_id) INTO v_type_id
  FROM item_type_master
  WHERE item_group_id=v_group_id AND type_name='Machines & Equipment' AND active_flag='Y';
  SELECT MAX(uom_id) INTO v_uom_id
  FROM uom_master WHERE uom_code='NOS' AND active_flag='Y';

  IF v_group_id IS NULL OR v_type_id IS NULL OR v_uom_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Required CA group, Machines & Equipment type, or NOS UOM is missing. Run item-master-schema.sql first.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tmp_machine_item_import S
    LEFT JOIN machine_type_master T
      ON T.machine_type_code=S.machine_type_code AND T.active_flag='Y'
    WHERE T.machine_type_id IS NULL
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='One or more Machine Type mappings are unavailable. Review tmp_machine_item_import and machine_type_master.';
  END IF;

  START TRANSACTION;

  -- Protect Item Code generation when older/manual records already exist.
  UPDATE item_type_master T
  SET T.current_number=GREATEST(
    T.current_number,
    COALESCE((
      SELECT MAX(CAST(SUBSTRING_INDEX(I.item_code,'-',-1) AS UNSIGNED))
      FROM item_master I
      WHERE I.item_type_id=v_type_id AND I.item_code LIKE 'CA-MAC-%'
    ),0)
  )
  WHERE T.item_type_id=v_type_id;

  OPEN machine_cursor;
  machine_loop: LOOP
    FETCH machine_cursor INTO v_source_key,v_machine_name,v_machine_type_code,
      v_make_name,v_model_name,v_machine_capacity;
    IF v_done=1 THEN LEAVE machine_loop; END IF;

    SELECT MAX(machine_type_id) INTO v_machine_type_id
    FROM machine_type_master
    WHERE machine_type_code=v_machine_type_code AND active_flag='Y';

    -- First locate a previous run by its source key; otherwise reuse an exact
    -- existing Item Master record instead of creating a duplicate.
    SELECT MAX(item_id) INTO v_item_id
    FROM item_master
    WHERE item_group_id=v_group_id AND item_type_id=v_type_id
      AND remarks LIKE CONCAT('%Machine Master.xlsx [',v_source_key,']%');

    IF v_item_id IS NULL THEN
      SELECT MAX(item_id) INTO v_item_id
      FROM item_master
      WHERE item_group_id=v_group_id AND item_type_id=v_type_id
        AND UPPER(TRIM(item_description))=UPPER(CONCAT('MAC - ',v_machine_name))
        AND UPPER(TRIM(COALESCE(make_name,'')))=UPPER(v_make_name)
        AND UPPER(TRIM(COALESCE(model_name,'')))=UPPER(v_model_name);
    END IF;

    IF v_item_id IS NULL THEN
      UPDATE item_type_master
      SET current_number=current_number+1
      WHERE item_type_id=v_type_id;

      SELECT current_number INTO v_next_number
      FROM item_type_master WHERE item_type_id=v_type_id;
      SET v_item_code=CONCAT('CA-MAC-',LPAD(v_next_number,6,'0'));

      INSERT INTO item_master (
        item_code,item_group_id,item_type_id,item_description,item_specification,
        additional_description,uom_id,inspection_required,make_name,model_name,
        machine_type_id,machine_capacity,batch_tracking_required,serial_tracking_required,asset_category,
        installation_required,remarks,item_status,active_flag,created_by
      ) VALUES (
        v_item_code,v_group_id,v_type_id,CONCAT('MAC - ',v_machine_name),
        CONCAT('Machine Type: ',v_machine_type_code,'; Capacity: ',v_machine_capacity),
        CONCAT('Imported machine model: ',v_machine_name),v_uom_id,'N',v_make_name,v_model_name,
        v_machine_type_id,v_machine_capacity,'N','Y',
        'MACHINE','Y',CONCAT('Imported from Machine Master.xlsx [',v_source_key,']'),
        'ACTIVE','Y','MACHINE_XLSX_IMPORT'
      );
    ELSE
      UPDATE item_master
      SET item_description=CONCAT('MAC - ',v_machine_name),
          item_specification=CONCAT('Machine Type: ',v_machine_type_code,'; Capacity: ',v_machine_capacity),
          uom_id=v_uom_id,
          make_name=v_make_name,
          model_name=v_model_name,
          machine_type_id=v_machine_type_id,
          machine_capacity=v_machine_capacity,
          serial_tracking_required='Y',
          asset_category='MACHINE',
          installation_required='Y',
          item_status='ACTIVE',
          active_flag='Y',
          remarks=CONCAT('Imported from Machine Master.xlsx [',v_source_key,']'),
          updated_by='MACHINE_XLSX_IMPORT'
      WHERE item_id=v_item_id;
    END IF;
  END LOOP;
  CLOSE machine_cursor;

  COMMIT;
END$$
CALL import_machine_items_from_xlsx()$$
DROP PROCEDURE import_machine_items_from_xlsx$$
DELIMITER ;

-- Mandatory review: confirm all 11 Machine Types before running file 02.
SELECT
  S.source_order AS `Sl No`,
  I.item_code AS `Item Code`,
  I.item_description AS `Machine Item`,
  T.machine_type_code AS `Machine Type Code`,
  T.machine_type_name AS `Machine Type`,
  I.make_name AS `Make`,
  I.model_name AS `Model`,
  I.machine_capacity AS `Capacity`
FROM tmp_machine_item_import S
JOIN item_master I
  ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%')
JOIN machine_type_master T ON T.machine_type_id=I.machine_type_id
ORDER BY S.source_order;

SELECT
  CASE WHEN COUNT(*)=11 THEN 'PASS - 11 machine Item Master records are ready. Confirm Machine Types, then run file 02.'
       ELSE CONCAT('FAIL - Expected 11 machine items but found ',COUNT(*),'.') END AS import_status
FROM tmp_machine_item_import S
JOIN item_master I
  ON I.remarks LIKE CONCAT('%Machine Master.xlsx [',S.source_key,']%');

DROP TEMPORARY TABLE IF EXISTS tmp_machine_item_import;
SET SQL_SAFE_UPDATES = @ATECH_OLD_SQL_SAFE_UPDATES;
