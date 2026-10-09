-- Rod Type applies to every Rod category and all rod shapes.
INSERT INTO item_type_spec_field
 (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,display_order)
SELECT item_type_id,'rod_type','Rod Type','SELECT','Y',
 JSON_ARRAY('BLACK_ROD','POLISH_ROD','BRIGHT_ROD'),5
FROM item_type_master WHERE type_name='Rod'
ON DUPLICATE KEY UPDATE field_label='Rod Type',input_type='SELECT',required_flag='Y',
 option_values_json=VALUES(option_values_json),display_order=5,active_flag='Y';
