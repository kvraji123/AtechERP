-- ATECH ERP - Machine Master
-- Links installed physical machines to CA / Machines & Equipment Item Master records.

SET @ATECH_OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

CREATE TABLE IF NOT EXISTS machine_type_master (
  machine_type_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  machine_type_code VARCHAR(30) NOT NULL,
  machine_type_name VARCHAR(120) NOT NULL,
  hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (machine_type_id),
  UNIQUE KEY uq_machine_type_code (machine_type_code),
  UNIQUE KEY uq_machine_type_name (machine_type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO machine_type_master
  (machine_type_code,machine_type_name,display_order,active_flag)
VALUES
  ('VMC','Vertical Machining Centre',10,'Y'),
  ('HMC','Horizontal Machining Centre',20,'Y'),
  ('CNC_TURNING','CNC Turning Centre',30,'Y'),
  ('SWISS_TYPE','Swiss Type / Sliding Head CNC',40,'Y'),
  ('GRINDING','Grinding Machine',50,'Y'),
  ('CONVENTIONAL','Conventional Machine',60,'Y'),
  ('OTHER','Other',999,'Y')
ON DUPLICATE KEY UPDATE
  machine_type_name=VALUES(machine_type_name),
  display_order=VALUES(display_order),
  active_flag='Y';

DELIMITER $$
DROP PROCEDURE IF EXISTS add_machine_item_columns$$
CREATE PROCEDURE add_machine_item_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='machine_type_master' AND column_name='hourly_cost_inr'
  ) THEN
    ALTER TABLE machine_type_master ADD COLUMN hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER machine_type_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='machine_type_id'
  ) THEN
    ALTER TABLE item_master ADD COLUMN machine_type_id BIGINT UNSIGNED NULL AFTER model_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='machine_capacity'
  ) THEN
    ALTER TABLE item_master ADD COLUMN machine_capacity VARCHAR(500) NULL AFTER machine_type_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema=DATABASE() AND table_name='item_master'
      AND constraint_name='fk_item_machine_type'
  ) THEN
    ALTER TABLE item_master
      ADD CONSTRAINT fk_item_machine_type
      FOREIGN KEY (machine_type_id) REFERENCES machine_type_master(machine_type_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END$$
CALL add_machine_item_columns()$$
DROP PROCEDURE add_machine_item_columns$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS machine_master (
  machine_master_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  other_specification VARCHAR(1000) NULL,
  machine_status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (machine_master_id),
  UNIQUE KEY uq_machine_master_item (item_id),
  CONSTRAINT fk_machine_master_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS machine_unit (
  machine_unit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  machine_master_id BIGINT UNSIGNED NOT NULL,
  machine_code VARCHAR(50) NOT NULL,
  serial_number VARCHAR(120) NULL,
  installation_date DATE NULL,
  plant_location VARCHAR(150) NULL,
  department_name VARCHAR(120) NULL,
  unit_status ENUM('ACTIVE','UNDER_MAINTENANCE','BREAKDOWN','IDLE','DECOMMISSIONED') NOT NULL DEFAULT 'ACTIVE',
  hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (machine_unit_id),
  UNIQUE KEY uq_machine_unit_code (machine_code),
  KEY idx_machine_unit_master (machine_master_id),
  KEY idx_machine_unit_status (unit_status),
  CONSTRAINT fk_machine_unit_master FOREIGN KEY (machine_master_id)
    REFERENCES machine_master(machine_master_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_legacy_unit_hourly_cost := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='machine_unit' AND COLUMN_NAME='hourly_cost_inr'
);
SET @legacy_unit_hourly_cost_sql := IF(@has_legacy_unit_hourly_cost=0,
  'ALTER TABLE machine_unit ADD COLUMN hourly_cost_inr DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER unit_status',
  'SELECT 1');
PREPARE legacy_unit_hourly_cost_statement FROM @legacy_unit_hourly_cost_sql;
EXECUTE legacy_unit_hourly_cost_statement;
DEALLOCATE PREPARE legacy_unit_hourly_cost_statement;

-- Preserve an existing unit rate only when every configured positive unit rate
-- for the Machine Type is identical. Conflicting rates remain 0 for review.
UPDATE machine_type_master MT
JOIN (
  SELECT I.machine_type_id,MAX(MU.hourly_cost_inr) AS hourly_cost_inr
  FROM machine_unit MU
  JOIN machine_master MM ON MM.machine_master_id=MU.machine_master_id
  JOIN item_master I ON I.item_id=MM.item_id
  WHERE MU.hourly_cost_inr > 0
  GROUP BY I.machine_type_id
  HAVING COUNT(DISTINCT MU.hourly_cost_inr)=1
) R ON R.machine_type_id=MT.machine_type_id
SET MT.hourly_cost_inr=R.hourly_cost_inr
WHERE MT.machine_type_id > 0 AND MT.hourly_cost_inr=0;

SET SQL_SAFE_UPDATES = @ATECH_OLD_SQL_SAFE_UPDATES;

-- Verification
SELECT machine_type_id,machine_type_code,machine_type_name,hourly_cost_inr
FROM machine_type_master WHERE active_flag='Y' ORDER BY display_order,machine_type_name;
