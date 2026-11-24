-- Persist whether the Part requires a Bill of Material, even before its first
-- component row is entered. This lets the Part Master list distinguish
-- "Not required" from "Not started".

SET @part_bom_required_sql := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'part_master'
      AND COLUMN_NAME = 'bom_required'
  ),
  'SELECT 1',
  'ALTER TABLE part_master ADD COLUMN bom_required ENUM(''Y'',''N'') NOT NULL DEFAULT ''N'' AFTER bom_release_status'
);
PREPARE part_bom_required_statement FROM @part_bom_required_sql;
EXECUTE part_bom_required_statement;
DEALLOCATE PREPARE part_bom_required_statement;

-- Existing Parts with BOM lines clearly require a BOM. An older record with no
-- rows cannot be inferred safely, so it remains N until it is next saved.
UPDATE part_master P
SET P.bom_required = 'Y'
WHERE P.bom_required = 'N'
  AND EXISTS (
    SELECT 1
    FROM part_bill_of_material B
    WHERE B.parent_part_id = P.part_id
  );

SELECT
  'Part BOM required status is ready.' AS result,
  SUM(bom_required = 'Y') AS bom_required_parts,
  SUM(bom_required = 'N') AS bom_not_required_parts
FROM part_master;
