-- Item Master incoming-inspection characteristics.
-- Run after item-master-schema.sql and part-process-inspection-schema.sql.

CREATE TABLE IF NOT EXISTS item_incoming_inspection_characteristic (
  item_inspection_characteristic_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  sequence_number INT NOT NULL,
  balloon_number VARCHAR(30) NULL,
  characteristic_master_id BIGINT UNSIGNED NULL,
  characteristic_text VARCHAR(150) NULL,
  specified_dimension DECIMAL(18,4) NULL,
  tolerance_mode ENUM('GRADE','MANUAL') NOT NULL DEFAULT 'MANUAL',
  tolerance_grade_id BIGINT UNSIGNED NULL,
  tolerance_grade_text VARCHAR(50) NULL,
  tolerance_minus DECIMAL(18,4) NULL,
  tolerance_plus DECIMAL(18,4) NULL,
  lsl DECIMAL(18,4) NULL,
  usl DECIMAL(18,4) NULL,
  drawing_grid VARCHAR(50) NULL,
  instrument_master_id BIGINT UNSIGNED NULL,
  sample_size VARCHAR(50) NULL,
  inspection_frequency VARCHAR(100) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_inspection_characteristic_id),
  UNIQUE KEY uq_item_incoming_inspection_sequence (item_id,sequence_number),
  KEY ix_item_incoming_inspection_characteristic (characteristic_master_id),
  KEY ix_item_incoming_inspection_instrument (instrument_master_id),
  CONSTRAINT fk_item_incoming_inspection_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_item_incoming_inspection_characteristic FOREIGN KEY (characteristic_master_id)
    REFERENCES inspection_characteristic_master(characteristic_master_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_item_incoming_inspection_tolerance FOREIGN KEY (tolerance_grade_id)
    REFERENCES tolerance_grade_master(tolerance_grade_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_item_incoming_inspection_instrument FOREIGN KEY (instrument_master_id)
    REFERENCES inspection_instrument_master(instrument_master_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE item_incoming_inspection_characteristic
  MODIFY COLUMN characteristic_master_id BIGINT UNSIGNED NULL;

SET @has_item_characteristic_text := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='item_incoming_inspection_characteristic'
    AND COLUMN_NAME='characteristic_text'
);
SET @item_characteristic_text_sql := IF(@has_item_characteristic_text=0,
  'ALTER TABLE item_incoming_inspection_characteristic ADD COLUMN characteristic_text VARCHAR(150) NULL AFTER characteristic_master_id',
  'SELECT 1');
PREPARE item_characteristic_text_statement FROM @item_characteristic_text_sql;
EXECUTE item_characteristic_text_statement;
DEALLOCATE PREPARE item_characteristic_text_statement;
