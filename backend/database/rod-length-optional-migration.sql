START TRANSACTION;
INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,allowed_uom_codes_json,default_uom_code,display_order)
SELECT item_type_id,'length','Length','NUMBER','N',JSON_ARRAY('MM','CM','MTR'),'MM',60
FROM item_type_master WHERE type_name='Rod'
ON DUPLICATE KEY UPDATE required_flag='N',active_flag='Y',allowed_uom_codes_json=VALUES(allowed_uom_codes_json),default_uom_code='MM';
UPDATE item_type_description_template D JOIN item_type_master T ON T.item_type_id=D.item_type_id
SET D.template_text=CONCAT(REPLACE(REPLACE(D.template_text,' × {length} {lengthUom}',''),'{optionalLength}',''),'{optionalLength}')
WHERE D.item_type_description_template_id>0 AND T.type_name='Rod';
COMMIT;
