-- Purchased Item Master: Fastener Diameter and Length specifications.
-- The Item Master form renders these fields dynamically for PU > Fasteners.
-- Diameter LOVs are limited to the requested metric thread sizes; Length is free text.

START TRANSACTION;

INSERT INTO item_type_spec_field
  (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,
   allowed_uom_codes_json,default_uom_code,visible_when_field,visible_when_value,
   require_one_group,display_order,active_flag)
SELECT type_row.item_type_id,seed.field_code,seed.field_label,seed.input_type,seed.required_flag,
  seed.option_values_json,NULL,NULL,seed.visible_when_field,seed.visible_when_value,
  NULL,seed.display_order,'Y'
FROM (
  SELECT 'fastener_diameter' AS field_code,'Diameter' AS field_label,'SELECT' AS input_type,'Y' AS required_flag,
    JSON_ARRAY('M4','M5','M6','M8','M10') AS option_values_json,'item_subtype' AS visible_when_field,
    'BOLTS_AND_SCREWS|NUTS|STUDS|PINS' AS visible_when_value,40 AS display_order
  UNION ALL SELECT 'fastener_length','Length','TEXT','Y',NULL,'item_subtype','BOLTS_AND_SCREWS|NUTS|STUDS|PINS',50
) AS seed
JOIN item_group_master AS group_row ON group_row.group_code='PU'
JOIN item_type_master AS type_row
  ON type_row.item_group_id=group_row.item_group_id AND type_row.type_name='Fasteners'
ON DUPLICATE KEY UPDATE
  field_label=VALUES(field_label),input_type=VALUES(input_type),required_flag=VALUES(required_flag),
  option_values_json=VALUES(option_values_json),allowed_uom_codes_json=NULL,default_uom_code=NULL,
  visible_when_field=VALUES(visible_when_field),visible_when_value=VALUES(visible_when_value),
  require_one_group=NULL,display_order=VALUES(display_order),active_flag='Y';

-- The selected subtype determines which existing type LOV is mandatory.
UPDATE item_type_spec_field AS field_row
JOIN item_type_master AS type_row ON type_row.item_type_id=field_row.item_type_id
JOIN item_group_master AS group_row ON group_row.item_group_id=type_row.item_group_id
SET field_row.required_flag='Y',field_row.active_flag='Y',field_row.display_order=30
WHERE group_row.group_code='PU' AND type_row.type_name='Fasteners'
  AND field_row.field_code='bolt_screw_type';

UPDATE item_type_spec_field AS field_row
JOIN item_type_master AS type_row ON type_row.item_type_id=field_row.item_type_id
JOIN item_group_master AS group_row ON group_row.item_group_id=type_row.item_group_id
SET field_row.required_flag='Y',field_row.active_flag='Y',field_row.display_order=30
WHERE group_row.group_code='PU' AND type_row.type_name='Fasteners'
  AND field_row.field_code='nut_type';

-- Replace the unstructured and superseded fields with the two requested specifications.
UPDATE item_type_spec_field AS field_row
JOIN item_type_master AS type_row ON type_row.item_type_id=field_row.item_type_id
JOIN item_group_master AS group_row ON group_row.item_group_id=type_row.item_group_id
SET field_row.required_flag='N',field_row.active_flag='N'
WHERE group_row.group_code='PU' AND type_row.type_name='Fasteners'
  AND field_row.field_code IN (
    'fastener_details','fastener_material_specification',
    'bolt_screw_diameter','bolt_screw_length','nut_diameter','nut_length',
    'stud_diameter','stud_length','pin_diameter','pin_length'
  );

COMMIT;

-- Verification: returns the active Fastener fields, including Diameter and Length.
SELECT field_row.field_code,field_row.field_label,field_row.input_type,field_row.required_flag,
  field_row.visible_when_field,field_row.visible_when_value,field_row.option_values_json,field_row.display_order
FROM item_type_spec_field AS field_row
JOIN item_type_master AS type_row ON type_row.item_type_id=field_row.item_type_id
JOIN item_group_master AS group_row ON group_row.item_group_id=type_row.item_group_id
WHERE group_row.group_code='PU' AND type_row.type_name='Fasteners'
  AND field_row.active_flag='Y'
ORDER BY field_row.display_order,field_row.item_type_spec_field_id;
