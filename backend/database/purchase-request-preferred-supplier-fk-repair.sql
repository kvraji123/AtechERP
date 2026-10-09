-- ============================================================================
-- Purchase Request preferred-supplier foreign-key repair
-- Target: MySQL 8.0+
--
-- Reason:
-- Older production databases can retain a foreign key from
-- purchase_requests.preferred_supplier_id to customer_master.  The current
-- Purchase Request screen sends an ID from supplier_master instead, causing
-- MySQL error ER_NO_REFERENCED_ROW_2 (shown in the UI as
-- "A referenced master record does not exist.").
--
-- Run during a maintenance window. DDL statements commit automatically.
-- ============================================================================

-- Pre-flight: record the current relationship before changing it.
SELECT
  kcu.constraint_name,
  kcu.table_name,
  kcu.column_name,
  kcu.referenced_table_name,
  kcu.referenced_column_name
FROM information_schema.key_column_usage AS kcu
WHERE kcu.constraint_schema = DATABASE()
  AND kcu.table_name = 'purchase_requests'
  AND kcu.column_name = 'preferred_supplier_id'
  AND kcu.referenced_table_name IS NOT NULL;

-- Preferred Supplier is optional. Clear only legacy values that do not map to
-- a current Supplier Master record, so the corrected foreign key can be added.
UPDATE purchase_requests AS pr
LEFT JOIN supplier_master AS supplier
  ON supplier.supplier_id = pr.preferred_supplier_id
SET pr.preferred_supplier_id = NULL
WHERE pr.preferred_supplier_id IS NOT NULL
  AND supplier.supplier_id IS NULL;

-- Remove any existing foreign key on preferred_supplier_id. Constraint names
-- differ across older production installations, so discover them dynamically.
DROP PROCEDURE IF EXISTS repair_purchase_request_preferred_supplier_fk;
DELIMITER $$
CREATE PROCEDURE repair_purchase_request_preferred_supplier_fk()
BEGIN
  DECLARE complete BOOLEAN DEFAULT FALSE;
  DECLARE foreign_key_name VARCHAR(64);
  DECLARE foreign_key_cursor CURSOR FOR
    SELECT DISTINCT constraint_name
    FROM information_schema.key_column_usage
    WHERE constraint_schema = DATABASE()
      AND table_name = 'purchase_requests'
      AND column_name = 'preferred_supplier_id'
      AND referenced_table_name IS NOT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET complete = TRUE;

  OPEN foreign_key_cursor;
  drop_foreign_keys: LOOP
    FETCH foreign_key_cursor INTO foreign_key_name;
    IF complete THEN
      LEAVE drop_foreign_keys;
    END IF;

    SET @purchase_request_fk_sql = CONCAT(
      'ALTER TABLE `purchase_requests` DROP FOREIGN KEY `',
      REPLACE(foreign_key_name, '`', '``'), '`'
    );
    PREPARE purchase_request_fk_statement FROM @purchase_request_fk_sql;
    EXECUTE purchase_request_fk_statement;
    DEALLOCATE PREPARE purchase_request_fk_statement;
  END LOOP;
  CLOSE foreign_key_cursor;
END$$
DELIMITER ;

CALL repair_purchase_request_preferred_supplier_fk();
DROP PROCEDURE repair_purchase_request_preferred_supplier_fk;

ALTER TABLE purchase_requests
  ADD CONSTRAINT fk_purchase_request_preferred_supplier
  FOREIGN KEY (preferred_supplier_id)
  REFERENCES supplier_master (supplier_id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Verification: this must return supplier_master as the referenced table.
SELECT
  kcu.constraint_name,
  kcu.table_name,
  kcu.column_name,
  kcu.referenced_table_name,
  kcu.referenced_column_name
FROM information_schema.key_column_usage AS kcu
WHERE kcu.constraint_schema = DATABASE()
  AND kcu.table_name = 'purchase_requests'
  AND kcu.column_name = 'preferred_supplier_id'
  AND kcu.referenced_table_name IS NOT NULL;

