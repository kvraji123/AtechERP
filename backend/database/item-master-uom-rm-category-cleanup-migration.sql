-- Keep one kilogram UOM and retire obsolete Raw Material categories.
-- Historical items remain intact; their UOM references are normalized to KG.
START TRANSACTION;

INSERT INTO uom_master (uom_code,uom_name,active_flag,created_by)
VALUES ('KG','Kilogram','Y','SYSTEM')
ON DUPLICATE KEY UPDATE uom_name=VALUES(uom_name),active_flag='Y';

SET @kg_uom_id := (
  SELECT uom_id
  FROM uom_master
  WHERE UPPER(TRIM(uom_code))='KG'
  ORDER BY uom_id
  LIMIT 1
);

UPDATE item_master I
JOIN uom_master U ON U.uom_id=I.uom_id
SET I.uom_id=@kg_uom_id
WHERE @kg_uom_id IS NOT NULL
  AND UPPER(TRIM(U.uom_code))='KGS';

UPDATE item_specification_value V
JOIN uom_master U ON U.uom_id=V.uom_id
SET V.uom_id=@kg_uom_id
WHERE @kg_uom_id IS NOT NULL
  AND UPPER(TRIM(U.uom_code))='KGS';

UPDATE uom_master
SET active_flag='N'
WHERE UPPER(TRIM(uom_code))='KGS';

-- Do not delete legacy categories that may be linked to existing items.
UPDATE item_type_master T
JOIN item_group_master G ON G.item_group_id=T.item_group_id
SET T.active_flag='N',T.updated_by='SYSTEM'
WHERE G.group_code='RM'
  AND UPPER(TRIM(T.type_name)) IN (
    'ROUND BAR','SQUARE BAR','SQUARE ROD','PROFILE','TERMINAL','POWDER','EXTRUSION'
  );

COMMIT;
