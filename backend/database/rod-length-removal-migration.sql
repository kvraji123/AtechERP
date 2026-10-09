-- Retire Rod Length without deleting historical specification records.
START TRANSACTION;
UPDATE item_type_spec_field F JOIN item_type_master T ON T.item_type_id=F.item_type_id
SET F.active_flag='N',F.required_flag='N'
WHERE F.item_type_spec_field_id>0 AND T.type_name='Rod' AND F.field_code='length';
UPDATE item_type_description_template D JOIN item_type_master T ON T.item_type_id=D.item_type_id
SET D.template_text=REPLACE(D.template_text,' × {length} {lengthUom}','')
WHERE D.item_type_description_template_id>0 AND T.type_name='Rod';
COMMIT;
