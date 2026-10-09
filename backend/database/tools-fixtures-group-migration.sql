-- Separate fixtures while retaining category IDs, specifications and existing item codes.
START TRANSACTION;
UPDATE item_group_master SET group_name='Tools' WHERE group_code='TL';
INSERT INTO item_group_master (group_code,group_name) VALUES ('FX','Fixtures')
ON DUPLICATE KEY UPDATE group_name=VALUES(group_name),active_flag='Y';
UPDATE item_type_master T
JOIN item_group_master G ON G.item_group_id=T.item_group_id AND G.group_code='TL'
JOIN item_group_master F ON F.group_code='FX'
SET T.item_group_id=F.item_group_id, T.type_name=IF(T.type_name='Clamp Pads','Clamp Pad',T.type_name)
WHERE T.item_type_id>0 AND T.type_name IN ('Chuck','Clamp Pad','Clamp Pads','Fixture','Grinding Wheel','Jig','Mandrel','Measuring Fixture');
INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix)
SELECT F.item_group_id,X.type_name,X.prefix_code,X.prefix_code
FROM (
 SELECT 'Chuck' type_name,'CHK' prefix_code UNION ALL SELECT 'Clamp Pad','CLP'
 UNION ALL SELECT 'Fixture','FIX' UNION ALL SELECT 'Grinding Wheel','GRW'
 UNION ALL SELECT 'Jig','JIG' UNION ALL SELECT 'Mandrel','MAN' UNION ALL SELECT 'Measuring Fixture','MFX'
) X JOIN item_group_master F ON F.group_code='FX'
ON DUPLICATE KEY UPDATE active_flag='Y';
UPDATE item_master I JOIN item_type_master T ON T.item_type_id=I.item_type_id
JOIN item_group_master F ON F.item_group_id=T.item_group_id AND F.group_code='FX'
SET I.item_group_id=F.item_group_id
WHERE I.item_id>0 AND I.item_group_id<>F.item_group_id;
COMMIT;
