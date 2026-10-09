-- Customer supplied items are kept in their own Item Group and linked to a customer.
INSERT INTO item_group_master (group_code,group_name,active_flag)
VALUES ('CS','Customer Supplied','Y')
ON DUPLICATE KEY UPDATE group_name=VALUES(group_name),active_flag='Y';

-- Move the previous Raw Material category to Customer Supplied > Child Parts,
-- preserving the category's existing item-code sequence.
UPDATE item_type_master Legacy
JOIN item_group_master RawMaterial ON RawMaterial.item_group_id=Legacy.item_group_id
JOIN item_group_master CustomerSupplied ON CustomerSupplied.group_code='CS'
LEFT JOIN item_type_master ExistingChild
  ON ExistingChild.item_group_id=CustomerSupplied.item_group_id
 AND ExistingChild.type_name='Child Parts'
SET Legacy.item_group_id=CustomerSupplied.item_group_id,
    Legacy.type_name='Child Parts',
    Legacy.description_prefix='CPT',
    Legacy.item_code_prefix='CPT',
    Legacy.active_flag='Y'
WHERE RawMaterial.group_code='RM'
  AND Legacy.type_name='CS - Customer supplied'
  AND ExistingChild.item_type_id IS NULL;

INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix,active_flag)
SELECT CustomerSupplied.item_group_id,'Child Parts','CPT','CPT','Y'
FROM item_group_master CustomerSupplied
LEFT JOIN item_type_master ExistingChild
  ON ExistingChild.item_group_id=CustomerSupplied.item_group_id
 AND ExistingChild.type_name='Child Parts'
WHERE CustomerSupplied.group_code='CS'
  AND ExistingChild.item_type_id IS NULL;

INSERT INTO item_type_master (item_group_id,type_name,description_prefix,item_code_prefix,active_flag)
SELECT CustomerSupplied.item_group_id,'Casting','CAS','CAS','Y'
FROM item_group_master CustomerSupplied
LEFT JOIN item_type_master ExistingCasting
  ON ExistingCasting.item_group_id=CustomerSupplied.item_group_id
 AND ExistingCasting.type_name='Casting'
WHERE CustomerSupplied.group_code='CS'
  AND ExistingCasting.item_type_id IS NULL;

CREATE TABLE IF NOT EXISTS customer_supplied_item (
  item_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  KEY ix_customer_supplied_item_customer (customer_id),
  CONSTRAINT fk_customer_supplied_item_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_customer_supplied_item_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master(customer_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
