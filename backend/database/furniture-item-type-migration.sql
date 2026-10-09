-- Item Type choices for Capital Item / Furniture.
INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,display_order)
SELECT T.item_type_id,'item_subtype','Item Type','SELECT','N',JSON_ARRAY('CHAIRS','TABLE'),5
FROM item_type_master T JOIN item_group_master G ON G.item_group_id=T.item_group_id
WHERE G.group_code='CA' AND T.type_name='Furniture'
ON DUPLICATE KEY UPDATE field_label='Item Type',input_type='SELECT',option_values_json=VALUES(option_values_json),active_flag='Y';
