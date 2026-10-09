-- Remove retired Item Master attributes and restrict Material/Grade to Raw Material.

DROP TABLE IF EXISTS item_customer;

UPDATE item_master I
JOIN item_group_master G ON G.item_group_id=I.item_group_id
SET I.material_id=NULL,I.material_grade_id=NULL
WHERE G.group_code<>'RM'
  AND I.item_id>0;

DELETE FROM item_reference_value
WHERE reference_group IN ('MAKE_BUY','STOCK_CLASSIFICATION','VALUATION_METHOD')
  AND item_reference_value_id>0;

SET @sql=IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='make_buy_classification'),
  'ALTER TABLE item_master DROP COLUMN make_buy_classification','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql=IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='stock_classification'),
  'ALTER TABLE item_master DROP COLUMN stock_classification','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql=IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='item_master' AND column_name='valuation_method'),
  'ALTER TABLE item_master DROP COLUMN valuation_method','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
