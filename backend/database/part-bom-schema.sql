CREATE TABLE IF NOT EXISTS part_bill_of_material (
  bom_component_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_part_id BIGINT UNSIGNED NOT NULL,
  component_type ENUM('PART', 'ITEM') NOT NULL,
  component_part_id BIGINT UNSIGNED NULL,
  component_item_id BIGINT UNSIGNED NULL,
  uom_id BIGINT UNSIGNED NULL,
  quantity DECIMAL(18,3) NOT NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bom_component_id),
  UNIQUE KEY uq_part_bom_component_part (parent_part_id, component_part_id),
  UNIQUE KEY uq_part_bom_component_item (parent_part_id, component_item_id),
  KEY ix_part_bom_parent (parent_part_id),
  KEY ix_part_bom_part (component_part_id),
  KEY ix_part_bom_item (component_item_id),
  KEY ix_part_bom_uom (uom_id),
  CONSTRAINT fk_part_bom_parent FOREIGN KEY (parent_part_id)
    REFERENCES part_master (part_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_part_bom_part FOREIGN KEY (component_part_id)
    REFERENCES part_master (part_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_part_bom_item FOREIGN KEY (component_item_id)
    REFERENCES item_master (item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_part_bom_uom FOREIGN KEY (uom_id)
    REFERENCES uom_master (uom_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_part_bom_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
