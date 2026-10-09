-- Store packing size using the existing item specification fields.
INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,display_order)
SELECT T.item_type_id,'size','Size','TEXT','Y',10
FROM item_type_master T JOIN item_group_master G ON G.item_group_id=T.item_group_id
WHERE G.group_code='PC'
ON DUPLICATE KEY UPDATE field_label='Size',input_type='TEXT',required_flag='Y',active_flag='Y';
