-- Reactivate and move these categories, retaining IDs and item codes.
START TRANSACTION;
INSERT INTO item_group_master (group_code,group_name) VALUES ('PU','Purchased Item')
ON DUPLICATE KEY UPDATE group_name=VALUES(group_name),active_flag='Y';
UPDATE item_type_master T
JOIN item_group_master G ON G.item_group_id=T.item_group_id AND G.group_code='CM'
JOIN item_group_master P ON P.group_code='PU'
SET T.item_group_id=P.item_group_id,T.active_flag='Y',
 T.type_name=CASE T.type_name WHEN 'Plug' THEN 'Plugs' WHEN 'Spring' THEN 'Springs' ELSE T.type_name END
WHERE T.item_type_id>0 AND T.type_name IN ('Fasteners','Plug','Plugs','Spring','Springs');
INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix)
SELECT P.item_group_id,X.type_name,X.prefix_code,X.prefix_code
FROM (SELECT 'Fasteners' type_name,'FST' prefix_code UNION ALL SELECT 'Plugs','PLG' UNION ALL SELECT 'Springs','SPR') X
JOIN item_group_master P ON P.group_code='PU'
ON DUPLICATE KEY UPDATE active_flag='Y';
UPDATE item_master I JOIN item_type_master T ON T.item_type_id=I.item_type_id
JOIN item_group_master P ON P.item_group_id=T.item_group_id AND P.group_code='PU'
SET I.item_group_id=P.item_group_id,I.shelf_life_applicable='N',I.shelf_life_days=NULL
WHERE I.item_id>0 AND I.item_group_id<>P.item_group_id
 AND T.type_name IN ('Fasteners','Plugs','Springs');
COMMIT;
