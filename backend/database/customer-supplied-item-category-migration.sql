-- Customer supplied category belongs to Raw Material.
INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix,active_flag)
SELECT item_group_id,'CS - Customer supplied','CS','CS','Y'
FROM item_group_master WHERE group_code='RM'
ON DUPLICATE KEY UPDATE type_name=VALUES(type_name),active_flag='Y';
