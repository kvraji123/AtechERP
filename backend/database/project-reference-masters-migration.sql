CREATE TABLE IF NOT EXISTS material_grade_master (
  material_grade_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id BIGINT UNSIGNED NOT NULL,
  grade_code VARCHAR(50) NOT NULL,
  grade_name VARCHAR(120) NOT NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (material_grade_id),
  UNIQUE KEY uq_material_grade (material_id, grade_code),
  CONSTRAINT fk_material_grade_material FOREIGN KEY (material_id)
    REFERENCES material_master(material_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO uom_master (uom_code,uom_name) VALUES
 ('KG','Kilogram'),('GRAM','Gram'),('NOS','Numbers'),('MM','Millimetre'),('MTR','Metre')
ON DUPLICATE KEY UPDATE uom_name=VALUES(uom_name),active_flag='Y';

INSERT INTO material_master (material_name) VALUES
 ('Mild Steel'),('Stainless Steel'),('Aluminium'),('Cast Iron')
ON DUPLICATE KEY UPDATE active_flag='Y';

INSERT INTO material_grade_master (material_id,grade_code,grade_name)
SELECT material_id,'IS2062','IS 2062' FROM material_master WHERE material_name='Mild Steel'
UNION ALL SELECT material_id,'EN8','EN8' FROM material_master WHERE material_name='Mild Steel'
UNION ALL SELECT material_id,'EN19','EN19' FROM material_master WHERE material_name='Mild Steel'
UNION ALL SELECT material_id,'SS304','SS 304' FROM material_master WHERE material_name='Stainless Steel'
ON DUPLICATE KEY UPDATE grade_name=VALUES(grade_name),active_flag='Y';

INSERT INTO marketing_reference_values (reference_type,value_code,display_label,sort_order) VALUES
 ('CUSTOMER_PARTY_TYPE','CUSTOMER','Customer',10),('CUSTOMER_PARTY_TYPE','SUPPLIER','Supplier',20),('CUSTOMER_PARTY_TYPE','BOTH','Both',30),
 ('RECORD_STATUS','ACTIVE','Active',10),('RECORD_STATUS','INACTIVE','Inactive',20),
 ('INVOICE_TYPE','TAX_INVOICE','Tax Invoice',10),('INVOICE_TYPE','LABOUR_INVOICE','Labour Invoice',20),('INVOICE_TYPE','EXPORT_INVOICE','Export Invoice',30),
 ('CUSTOMER_ATTACHMENT_TYPE','NDA','NDA',10),('CUSTOMER_ATTACHMENT_TYPE','AGREEMENT','Agreement',20),('CUSTOMER_ATTACHMENT_TYPE','GST_CERTIFICATE','GST Certificate',30),('CUSTOMER_ATTACHMENT_TYPE','PAN_CARD','PAN Card',40),('CUSTOMER_ATTACHMENT_TYPE','OTHER','Other',50),
 ('PART_CATEGORY','MACHINING','Machining',10),('PART_CATEGORY','ASSEMBLY','Assembly',20),
 ('DRAWING_CODE_MODE','AUTO_GENERATED','Auto Generated',10),('DRAWING_CODE_MODE','MANUAL','Manual',20),
 ('PART_ATTACHMENT_TYPE','CUSTOMER_DRAWING','Customer Drawing',10),('PART_ATTACHMENT_TYPE','CUSTOMER_STANDARD','Customer Standard',20),('PART_ATTACHMENT_TYPE','PART_MODEL','Part Model (STEP/STP only)',30),('PART_ATTACHMENT_TYPE','BALLOONED_DRAWING','Ballooned Drawing',40),('PART_ATTACHMENT_TYPE','PATTERN_DIE_DRAWING','Pattern / Die Drawing',50),('PART_ATTACHMENT_TYPE','OTHER','Other',60),
 ('ENQUIRY_MODE','MAIL','Mail',10),('ENQUIRY_MODE','ORAL','Oral',20),('ENQUIRY_MODE','VISIT','Visit',30),
 ('ORDER_TYPE','SALES','Sales',10),('ORDER_TYPE','LABOUR','Labour',20),
 ('ENQUIRY_STATUS_TRANSITION','QUOTED','Quoted',10),('ENQUIRY_STATUS_TRANSITION','ORDER_RECEIVED','Order Received',20),
 ('YES_NO','N','No',10),('YES_NO','Y','Yes',20),
 ('DOCUMENT_TYPE','IMAGE','Image',10),('DOCUMENT_TYPE','DRAWING','Drawing',20),('DOCUMENT_TYPE','DATASHEET','Datasheet',30),('DOCUMENT_TYPE','OTHER','Other',40),
 ('PROFIT_CALCULATION_TYPE','FIXED_AMOUNT','Fixed Amount',10),('PROFIT_CALCULATION_TYPE','PERCENTAGE','Percentage',20)
ON DUPLICATE KEY UPDATE display_label=VALUES(display_label),sort_order=VALUES(sort_order),active_flag='Y';

ALTER TABLE part_master ADD COLUMN IF NOT EXISTS material_id BIGINT UNSIGNED NULL AFTER material_specification;
ALTER TABLE part_master ADD COLUMN IF NOT EXISTS material_grade_id BIGINT UNSIGNED NULL AFTER material_id;
ALTER TABLE part_master ADD COLUMN IF NOT EXISTS uom_id BIGINT UNSIGNED NULL AFTER unit_of_measurement;
ALTER TABLE part_master ADD KEY IF NOT EXISTS ix_part_material (material_id);
ALTER TABLE part_master ADD KEY IF NOT EXISTS ix_part_material_grade (material_grade_id);
ALTER TABLE part_master ADD KEY IF NOT EXISTS ix_part_uom (uom_id);

ALTER TABLE part_master ADD CONSTRAINT fk_part_material FOREIGN KEY(material_id) REFERENCES material_master(material_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE part_master ADD CONSTRAINT fk_part_material_grade FOREIGN KEY(material_grade_id) REFERENCES material_grade_master(material_grade_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE part_master ADD CONSTRAINT fk_part_uom FOREIGN KEY(uom_id) REFERENCES uom_master(uom_id) ON UPDATE CASCADE ON DELETE RESTRICT;
UPDATE part_master P JOIN uom_master U ON U.uom_code=CASE WHEN P.unit_of_measurement='KGS' THEN 'KG' ELSE P.unit_of_measurement END SET P.uom_id=U.uom_id WHERE P.uom_id IS NULL;
