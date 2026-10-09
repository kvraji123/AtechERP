-- ============================================================================
-- ATECH production update: Item Master and Enquiry / Feasibility
-- Target: MySQL 8.0+
--
-- This is an idempotent release file. It retains existing item, enquiry and
-- feasibility records. Run it once against the selected production database.
-- DDL statements commit automatically, so take a database backup first.
-- ============================================================================

SET NAMES utf8mb4;

-- ============================================================================
-- Item Master: Purchased Items and Fixtures groups
-- ============================================================================
START TRANSACTION;
INSERT INTO item_group_master (group_code,group_name) VALUES ('PU','Purchased Item')
ON DUPLICATE KEY UPDATE group_name=VALUES(group_name),active_flag='Y';

UPDATE item_type_master AS type_row
JOIN item_group_master AS consumables ON consumables.item_group_id=type_row.item_group_id AND consumables.group_code='CM'
JOIN item_group_master AS purchased ON purchased.group_code='PU'
SET type_row.item_group_id=purchased.item_group_id,type_row.active_flag='Y',
    type_row.type_name=CASE type_row.type_name WHEN 'Plug' THEN 'Plugs' WHEN 'Spring' THEN 'Springs' ELSE type_row.type_name END
WHERE type_row.item_type_id>0
  AND type_row.type_name IN ('Purchase Items','Purchased Items','Purchased Item','Fasteners','Plug','Plugs','Spring','Springs');

INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix)
SELECT purchased.item_group_id,seed.type_name,seed.prefix_code,seed.prefix_code
FROM (
  SELECT 'Purchased Items' AS type_name,'PUR' AS prefix_code UNION ALL
  SELECT 'Fasteners','FST' UNION ALL SELECT 'Plugs','PLG' UNION ALL SELECT 'Springs','SPR'
) AS seed
JOIN item_group_master AS purchased ON purchased.group_code='PU'
ON DUPLICATE KEY UPDATE active_flag='Y';

UPDATE item_master AS item_row
JOIN item_type_master AS type_row ON type_row.item_type_id=item_row.item_type_id
JOIN item_group_master AS purchased ON purchased.item_group_id=type_row.item_group_id AND purchased.group_code='PU'
SET item_row.item_group_id=purchased.item_group_id,
    item_row.shelf_life_applicable='N',item_row.shelf_life_days=NULL
WHERE item_row.item_id>0 AND item_row.item_group_id<>purchased.item_group_id;

UPDATE item_group_master SET group_name='Tools' WHERE group_code='TL';
INSERT INTO item_group_master (group_code,group_name) VALUES ('FX','Fixtures')
ON DUPLICATE KEY UPDATE group_name=VALUES(group_name),active_flag='Y';

UPDATE item_type_master AS type_row
JOIN item_group_master AS tools ON tools.item_group_id=type_row.item_group_id AND tools.group_code='TL'
JOIN item_group_master AS fixtures ON fixtures.group_code='FX'
SET type_row.item_group_id=fixtures.item_group_id,
    type_row.type_name=IF(type_row.type_name='Clamp Pads','Clamp Pad',type_row.type_name)
WHERE type_row.item_type_id>0
  AND type_row.type_name IN ('Chuck','Clamp Pad','Clamp Pads','Fixture','Grinding Wheel','Jig','Mandrel','Measuring Fixture');

INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix)
SELECT fixtures.item_group_id,seed.type_name,seed.prefix_code,seed.prefix_code
FROM (
  SELECT 'Chuck' AS type_name,'CHK' AS prefix_code UNION ALL SELECT 'Clamp Pad','CLP'
  UNION ALL SELECT 'Fixture','FIX' UNION ALL SELECT 'Grinding Wheel','GRW'
  UNION ALL SELECT 'Jig','JIG' UNION ALL SELECT 'Mandrel','MAN' UNION ALL SELECT 'Measuring Fixture','MFX'
) AS seed
JOIN item_group_master AS fixtures ON fixtures.group_code='FX'
ON DUPLICATE KEY UPDATE active_flag='Y';

UPDATE item_master AS item_row
JOIN item_type_master AS type_row ON type_row.item_type_id=item_row.item_type_id
JOIN item_group_master AS fixtures ON fixtures.item_group_id=type_row.item_group_id AND fixtures.group_code='FX'
SET item_row.item_group_id=fixtures.item_group_id
WHERE item_row.item_id>0 AND item_row.item_group_id<>fixtures.item_group_id;
COMMIT;

-- ============================================================================
-- Item Master: Customer-supplied, packing, furniture and rod definitions
-- ============================================================================
INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix,active_flag)
SELECT item_group_id,'CS - Customer supplied','CS','CS','Y'
FROM item_group_master WHERE group_code='RM'
ON DUPLICATE KEY UPDATE type_name=VALUES(type_name),active_flag='Y';

INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,display_order)
SELECT type_row.item_type_id,'size','Size','TEXT','Y',10
FROM item_type_master AS type_row
JOIN item_group_master AS group_row ON group_row.item_group_id=type_row.item_group_id
WHERE group_row.group_code='PC'
ON DUPLICATE KEY UPDATE field_label='Size',input_type='TEXT',required_flag='Y',active_flag='Y';

INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,display_order)
SELECT type_row.item_type_id,'item_subtype','Item Type','SELECT','N',JSON_ARRAY('CHAIRS','TABLE'),5
FROM item_type_master AS type_row
JOIN item_group_master AS group_row ON group_row.item_group_id=type_row.item_group_id
WHERE group_row.group_code='CA' AND type_row.type_name='Furniture'
ON DUPLICATE KEY UPDATE field_label='Item Type',input_type='SELECT',required_flag='N',option_values_json=VALUES(option_values_json),active_flag='Y';

INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,display_order)
SELECT item_type_id,'rod_type','Rod Type','SELECT','Y',JSON_ARRAY('BLACK_ROD','POLISH_ROD','BRIGHT_ROD'),5
FROM item_type_master WHERE type_name='Rod'
ON DUPLICATE KEY UPDATE field_label='Rod Type',input_type='SELECT',required_flag='Y',option_values_json=VALUES(option_values_json),display_order=5,active_flag='Y';

START TRANSACTION;
INSERT INTO item_type_spec_field (item_type_id,field_code,field_label,input_type,required_flag,allowed_uom_codes_json,default_uom_code,display_order)
SELECT item_type_id,'length','Length','NUMBER','N',JSON_ARRAY('MM','CM','MTR'),'MM',60
FROM item_type_master WHERE type_name='Rod'
ON DUPLICATE KEY UPDATE required_flag='N',active_flag='Y',allowed_uom_codes_json=VALUES(allowed_uom_codes_json),default_uom_code='MM';
UPDATE item_type_description_template AS template_row
JOIN item_type_master AS type_row ON type_row.item_type_id=template_row.item_type_id
SET template_row.template_text=CONCAT(REPLACE(REPLACE(template_row.template_text,' × {length} {lengthUom}',''),'{optionalLength}',''),'{optionalLength}')
WHERE template_row.item_type_description_template_id>0 AND type_row.type_name='Rod';
COMMIT;

-- ============================================================================
-- Item Master: additional Item Categories and Item Type specifications
-- Existing specification fields remain available.
-- ============================================================================
START TRANSACTION;
INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix,active_flag)
SELECT group_row.item_group_id,seed.type_name,seed.prefix_code,seed.prefix_code,'Y'
FROM (
  SELECT 'CA' AS group_code,'Dies & Patterns' AS type_name,'DIE' AS prefix_code UNION ALL
  SELECT 'CA','Fixtures','FIX' UNION ALL SELECT 'CA','Collet','COL' UNION ALL SELECT 'CA','Holders','HLD'
  UNION ALL SELECT 'CA','Turning Bars','TBR' UNION ALL SELECT 'CA','Boring Bar','CBR'
  UNION ALL SELECT 'CA','Boring Bar Head','BBH' UNION ALL SELECT 'CA','Turning Bar Spares','TBS'
  UNION ALL SELECT 'TL','End Mill','ENM' UNION ALL SELECT 'TL','Drill','DRL' UNION ALL SELECT 'TL','Tap','TAP'
  UNION ALL SELECT 'TL','Insert','INS' UNION ALL SELECT 'TL','Chamfer Tool','CHT' UNION ALL SELECT 'TL','Center Drill','CDR'
  UNION ALL SELECT 'PU','Fasteners','FST' UNION ALL SELECT 'PU','Plugs','PLG' UNION ALL SELECT 'PU','Springs','SPR'
) AS seed
JOIN item_group_master AS group_row ON group_row.group_code=seed.group_code
ON DUPLICATE KEY UPDATE description_prefix=VALUES(description_prefix),item_code_prefix=VALUES(item_code_prefix),active_flag='Y';

INSERT INTO item_type_spec_field
  (item_type_id,field_code,field_label,input_type,required_flag,option_values_json,allowed_uom_codes_json,default_uom_code,visible_when_field,visible_when_value,require_one_group,display_order,active_flag)
SELECT type_row.item_type_id,seed.field_code,seed.field_label,seed.input_type,seed.required_flag,seed.options_json,seed.uoms_json,seed.default_uom,seed.visible_field,seed.visible_value,seed.one_group,seed.display_order,'Y'
FROM (
  SELECT 'CA' AS group_code,'Dies & Patterns' AS type_name,'drawing_codes' AS field_code,'Drawing Code(s)' AS field_label,'SELECT' AS input_type,'N' AS required_flag,NULL AS options_json,NULL AS uoms_json,NULL AS default_uom,NULL AS visible_field,NULL AS visible_value,NULL AS one_group,10 AS display_order UNION ALL
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
) AS seed
JOIN item_group_master AS group_row ON group_row.group_code=seed.group_code
JOIN item_type_master AS type_row ON type_row.item_group_id=group_row.item_group_id AND type_row.type_name=seed.type_name
ON DUPLICATE KEY UPDATE field_label=VALUES(field_label),input_type=VALUES(input_type),required_flag=VALUES(required_flag),option_values_json=VALUES(option_values_json),allowed_uom_codes_json=VALUES(allowed_uom_codes_json),default_uom_code=VALUES(default_uom_code),visible_when_field=VALUES(visible_when_field),visible_when_value=VALUES(visible_when_value),require_one_group=VALUES(require_one_group),display_order=VALUES(display_order),active_flag='Y';
COMMIT;

-- ============================================================================
-- Enquiry and Feasibility
-- ============================================================================
UPDATE marketing_enquiries
SET enquiry_status='IN_PROGRESS'
WHERE enquiry_status='ENQUIRED';

ALTER TABLE marketing_enquiries
  MODIFY enquiry_status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS';

-- Compatible with MySQL versions that do not support ADD COLUMN IF NOT EXISTS.
SET @migration_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='marketing_enquiry_parts' AND column_name='alternative_material'),
  'SELECT 1',
  'ALTER TABLE marketing_enquiry_parts ADD COLUMN alternative_material VARCHAR(300) NULL AFTER material_and_grade'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='marketing_feasibilities' AND column_name='raw_material_source'),
  'SELECT 1',
  'ALTER TABLE marketing_feasibilities ADD COLUMN raw_material_source VARCHAR(20) NULL AFTER product_technically_feasible'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='marketing_feasibilities' AND column_name='purchase_source_available'),
  'SELECT 1',
  'ALTER TABLE marketing_feasibilities ADD COLUMN purchase_source_available VARCHAR(3) NULL AFTER raw_material_source'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='marketing_feasibilities' AND column_name='material_source_details'),
  'SELECT 1',
  'ALTER TABLE marketing_feasibilities ADD COLUMN material_source_details TEXT NULL AFTER purchase_source_available'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='marketing_feasibilities' AND column_name='outsource_process_required'),
  'SELECT 1',
  'ALTER TABLE marketing_feasibilities ADD COLUMN outsource_process_required VARCHAR(3) NULL AFTER material_source_details'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='marketing_feasibilities' AND column_name='outsource_source_details'),
  'SELECT 1',
  'ALTER TABLE marketing_feasibilities ADD COLUMN outsource_source_details TEXT NULL AFTER outsource_process_required'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- ============================================================================
-- Verification output
SELECT 'Item Groups' AS result_set,group_code,group_name FROM item_group_master WHERE group_code IN ('PU','TL','FX') ORDER BY group_code;
SELECT 'Rod Length' AS result_set,type_row.type_name,field_row.required_flag,field_row.active_flag
FROM item_type_spec_field AS field_row JOIN item_type_master AS type_row ON type_row.item_type_id=field_row.item_type_id
WHERE type_row.type_name='Rod' AND field_row.field_code='length';
SELECT 'Enquiry Status' AS result_set,enquiry_status,COUNT(*) AS record_count FROM marketing_enquiries GROUP BY enquiry_status ORDER BY enquiry_status;
