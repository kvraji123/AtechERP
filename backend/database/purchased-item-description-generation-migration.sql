-- Category-specific fields and templates used to generate Purchased Item descriptions.
-- Descriptions are generated as PU-<template result>; the UI contains no category-specific hard-coded values.
START TRANSACTION;

INSERT INTO item_type_spec_field
  (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,
   allowed_uom_codes_json,default_uom_code,visible_when_field,visible_when_value,
   require_one_group,display_order,active_flag)
SELECT T.item_type_id,X.field_code,X.field_label,X.input_type,X.required_flag,NULL,
  NULL,NULL,NULL,NULL,NULL,X.display_order,'Y'
FROM (
  SELECT 'Fasteners' AS type_name,'fastener_details' AS field_code,'Fastener Details' AS field_label,'TEXT' AS input_type,'Y' AS required_flag,70 AS display_order
  UNION ALL SELECT 'Plugs','plug_gauge_details','Plug / Gauge Details','TEXT','Y',10
) X
JOIN item_group_master G ON G.group_code='PU'
JOIN item_type_master T ON T.item_group_id=G.item_group_id AND T.type_name=X.type_name
ON DUPLICATE KEY UPDATE
  field_label=VALUES(field_label),input_type=VALUES(input_type),required_flag=VALUES(required_flag),
  option_values_json=NULL,allowed_uom_codes_json=NULL,default_uom_code=NULL,
  visible_when_field=NULL,visible_when_value=NULL,require_one_group=NULL,
  display_order=VALUES(display_order),active_flag='Y';

UPDATE item_type_spec_field F
JOIN item_type_master T ON T.item_type_id=F.item_type_id
JOIN item_group_master G ON G.item_group_id=T.item_group_id
SET F.required_flag='Y',F.active_flag='Y'
WHERE G.group_code='PU' AND T.type_name='Springs'
  AND F.field_code IN ('spring_id_diameter','wire_diameter','length');

INSERT INTO item_type_description_template
  (item_type_id,condition_field_code,condition_operator,condition_value,template_text,display_order,active_flag)
SELECT T.item_type_id,NULL,'DEFAULT',NULL,X.template_text,10,'Y'
FROM (
  SELECT 'Fasteners' AS type_name,'{fastener_details}' AS template_text
  UNION ALL SELECT 'Plugs','{plug_gauge_details}'
  UNION ALL SELECT 'Springs','Ø{spring_id_diameter} {spring_id_diameterUom} × Ø{wire_diameter} {wire_diameterUom} × {length} {lengthUom}'
) X
JOIN item_group_master G ON G.group_code='PU'
JOIN item_type_master T ON T.item_group_id=G.item_group_id AND T.type_name=X.type_name
ON DUPLICATE KEY UPDATE
  condition_field_code=VALUES(condition_field_code),condition_operator=VALUES(condition_operator),
  condition_value=VALUES(condition_value),template_text=VALUES(template_text),active_flag='Y';

COMMIT;
