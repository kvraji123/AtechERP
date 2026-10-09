-- Additional Item Category, Item Type and specification fields from Item Master_new.xlsx.
-- Existing Item Master records and fields are retained.
START TRANSACTION;

INSERT INTO item_type_master
  (item_group_id,type_name,description_prefix,item_code_prefix,active_flag)
SELECT G.item_group_id,X.type_name,X.prefix_code,X.prefix_code,'Y'
FROM (
  SELECT 'CA' group_code,'Dies & Patterns' type_name,'DIE' prefix_code UNION ALL
  SELECT 'CA','Fixtures','FIX' UNION ALL
  SELECT 'CA','Collet','COL' UNION ALL
  SELECT 'CA','Holders','HLD' UNION ALL
  SELECT 'CA','Turning Bars','TBR' UNION ALL
  SELECT 'CA','Boring Bar','CBR' UNION ALL
  SELECT 'CA','Boring Bar Head','BBH' UNION ALL
  SELECT 'CA','Turning Bar Spares','TBS' UNION ALL
  SELECT 'TL','End Mill','ENM' UNION ALL
  SELECT 'TL','Drill','DRL' UNION ALL
  SELECT 'TL','Tap','TAP' UNION ALL
  SELECT 'TL','Insert','INS' UNION ALL
  SELECT 'TL','Chamfer Tool','CHT' UNION ALL
  SELECT 'TL','Center Drill','CDR' UNION ALL
  SELECT 'PU','Fasteners','FST' UNION ALL
  SELECT 'PU','Plugs','PLG' UNION ALL
  SELECT 'PU','Springs','SPR'
) X
JOIN item_group_master G ON G.group_code=X.group_code
ON DUPLICATE KEY UPDATE
  type_name=VALUES(type_name),
  description_prefix=VALUES(description_prefix),
  item_code_prefix=VALUES(item_code_prefix),
  active_flag='Y';

INSERT INTO item_type_spec_field
  (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,
   allowed_uom_codes_json,default_uom_code,visible_when_field,visible_when_value,
   require_one_group,display_order,active_flag)
SELECT T.item_type_id,X.field_code,X.field_label,X.input_type,X.required_flag,X.options_json,
  X.uoms_json,X.default_uom,X.visible_field,X.visible_value,X.one_group,X.display_order,'Y'
FROM (
  SELECT 'CA' group_code,'Dies & Patterns' type_name,'drawing_codes' field_code,'Drawing Code(s)' field_label,'SELECT' input_type,'N' required_flag,NULL options_json,NULL uoms_json,NULL default_uom,NULL visible_field,NULL visible_value,NULL one_group,10 display_order UNION ALL
  SELECT 'CA','Dies & Patterns','life','Life','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,20 UNION ALL
  SELECT 'CA','Dies & Patterns','cavity_count','No. of Cavities','NUMBER','N',NULL,NULL,NULL,NULL,NULL,NULL,30 UNION ALL
  SELECT 'CA','Dies & Patterns','core_box_type','Core Box Type','SELECT','N',JSON_ARRAY('WITH_CORE','WITHOUT_CORE_BOX'),NULL,NULL,NULL,NULL,NULL,40 UNION ALL
  SELECT 'CA','Dies & Patterns','attachment_mandatory','Attachment Mandatory','SELECT','Y',JSON_ARRAY('YES','NO'),NULL,NULL,NULL,NULL,NULL,50 UNION ALL

  SELECT 'CA','Fixtures','drawing_codes','Drawing Code(s)','SELECT','N',NULL,NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'CA','Fixtures','operation_no','Operation No.','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,20 UNION ALL
  SELECT 'CA','Fixtures','purpose','Purpose','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,30 UNION ALL
  SELECT 'CA','Fixtures','process_plan','Process Plan','SELECT','N',JSON_ARRAY('VMC','HMC','TURNING','WELDING','PRESSURE_TESTING','NUMBER_PUNCHING'),NULL,NULL,NULL,NULL,NULL,40 UNION ALL

  SELECT 'CA','Collet','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('ER11','ER16','ER20','ER25','ER32','ER40'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'CA','Collet','from_size','From Size','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'CA','Collet','to_size','To Size','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,30 UNION ALL

  SELECT 'CA','Holders','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('BT40','BT50'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'CA','Holders','holder_length','Holder Length','NUMBER','N',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'CA','Holders','holder_type','Holder Type','SELECT','N',JSON_ARRAY('ER11','ER16','ER20','ER25','ER32','ER40'),NULL,NULL,NULL,NULL,NULL,30 UNION ALL

  SELECT 'CA','Turning Bars','specification','Specification','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,10 UNION ALL

  SELECT 'CA','Boring Bar','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('BT40','BT50'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'CA','Boring Bar','bar_length','Length','NUMBER','N',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'CA','Boring Bar','specification','Specification','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,30 UNION ALL
  SELECT 'CA','Boring Bar','bar_type','Bar Type','SELECT','N',JSON_ARRAY('CKP1','CKP6_UPTO'),NULL,NULL,NULL,NULL,NULL,40 UNION ALL

  SELECT 'CA','Boring Bar Head','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('CKP1','CKP6_UPTO'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'CA','Boring Bar Head','specification','Specification','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,20 UNION ALL

  SELECT 'TL','End Mill','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('TWO_FLUTE','FOUR_FLUTE'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'TL','End Mill','diameter','Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'TL','End Mill','flute_length','Flute Length','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,30 UNION ALL
  SELECT 'TL','End Mill','overall_length','Overall Length','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,40 UNION ALL
  SELECT 'TL','End Mill','make','Make','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,50 UNION ALL

  SELECT 'TL','Drill','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('FLAT','CONICAL'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'TL','Drill','tool_material','Material','SELECT','N',JSON_ARRAY('HSS','CARBIDE'),NULL,NULL,NULL,NULL,NULL,20 UNION ALL
  SELECT 'TL','Drill','diameter','Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,30 UNION ALL
  SELECT 'TL','Drill','flute_length','Flute Length','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,40 UNION ALL
  SELECT 'TL','Drill','overall_length','Overall Length','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,50 UNION ALL
  SELECT 'TL','Drill','make','Make','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,60 UNION ALL

  SELECT 'TL','Tap','specification','Specification','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'TL','Tap','pitch','Pitch','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'TL','Tap','make','Make','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,30 UNION ALL

  SELECT 'TL','Insert','specification','Specification','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'TL','Insert','make','Make','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,20 UNION ALL

  SELECT 'TL','Chamfer Tool','diameter','Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,10 UNION ALL
  SELECT 'TL','Chamfer Tool','overall_length','Overall Length','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'TL','Chamfer Tool','angle','Angle','NUMBER','N',NULL,NULL,NULL,NULL,NULL,NULL,30 UNION ALL

  SELECT 'TL','Center Drill','tool_material','Material','TEXT','N',NULL,NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'TL','Center Drill','shank_diameter','Shank Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'TL','Center Drill','plunge_diameter','Plunge Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,30 UNION ALL

  SELECT 'PU','Fasteners','item_subtype','Item Type','SELECT','Y',JSON_ARRAY('BOLTS_AND_SCREWS','NUTS','STUDS','PINS','RIVETS','RETAINING_RINGS','KEYS','WASHERS'),NULL,NULL,NULL,NULL,NULL,10 UNION ALL
  SELECT 'PU','Fasteners','bolt_screw_type','Bolt / Screw Type','SELECT','N',JSON_ARRAY('HEX_BOLTS','ALLEN_SCREWS'),NULL,NULL,'item_subtype','BOLTS_AND_SCREWS',NULL,20 UNION ALL
  SELECT 'PU','Fasteners','nut_type','Nut Type','SELECT','N',JSON_ARRAY('HEX_NUT','LOCK_NUT','WING_NUT','CAP_NUT','NYLOC_NUT','JAM_NUT','SQUARE_NUT','ACORN_NUT','FLANGE_NUT'),NULL,NULL,'item_subtype','NUTS',NULL,30 UNION ALL
  SELECT 'PU','Fasteners','pin_type','Pin Type','SELECT','N',JSON_ARRAY('FLUSH_PIN','DOWEL_PIN','COTTER_PIN'),NULL,NULL,'item_subtype','PINS',NULL,40 UNION ALL
  SELECT 'PU','Fasteners','rivet_type','Rivet Type','SELECT','N',JSON_ARRAY('FLAT','BUTTON','COUNTERSUNK'),NULL,NULL,'item_subtype','RIVETS',NULL,50 UNION ALL
  SELECT 'PU','Fasteners','washer_type','Washer Type','SELECT','N',JSON_ARRAY('FLAT','LOCK'),NULL,NULL,'item_subtype','WASHERS',NULL,60 UNION ALL

  SELECT 'PU','Springs','spring_id_diameter','Spring ID Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,10 UNION ALL
  SELECT 'PU','Springs','wire_diameter','Wire Diameter','NUMBER','N',NULL,JSON_ARRAY('MM'),'MM',NULL,NULL,NULL,20 UNION ALL
  SELECT 'PU','Springs','length','Length','NUMBER','N',NULL,JSON_ARRAY('MM','CM','MTR'),'MM',NULL,NULL,NULL,30
) X
JOIN item_group_master G ON G.group_code=X.group_code
JOIN item_type_master T ON T.item_group_id=G.item_group_id AND T.type_name=X.type_name
ON DUPLICATE KEY UPDATE
  field_label=VALUES(field_label),
  input_type=VALUES(input_type),
  required_flag=VALUES(required_flag),
  option_values_json=VALUES(option_values_json),
  allowed_uom_codes_json=VALUES(allowed_uom_codes_json),
  default_uom_code=VALUES(default_uom_code),
  visible_when_field=VALUES(visible_when_field),
  visible_when_value=VALUES(visible_when_value),
  require_one_group=VALUES(require_one_group),
  display_order=VALUES(display_order),
  active_flag='Y';

COMMIT;
