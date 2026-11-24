-- External calibration dispatch batches.
-- Each header is the dispatch challan, while individual Gauge IDs remain linked through gauge_history.

-- Do not replace the existing ENUM definition. Older installations can contain
-- additional, valid movement types. Append the new value while keeping every
-- value already present in production.
SET @atech_gauge_movement_type_sql := COALESCE((
  SELECT IF(
    LOCATE('''CALIBRATION_DISPATCH''', COLUMN_TYPE) > 0,
    'SELECT 1',
    CONCAT(
      'ALTER TABLE gauge_movement_batches MODIFY COLUMN movement_type ',
      REPLACE(COLUMN_TYPE, ')', ',''CALIBRATION_DISPATCH'')'),
      ' NOT NULL'
    )
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gauge_movement_batches'
    AND COLUMN_NAME = 'movement_type'
), 'SELECT 1');
PREPARE atech_gauge_movement_type_statement FROM @atech_gauge_movement_type_sql;
EXECUTE atech_gauge_movement_type_statement;
DEALLOCATE PREPARE atech_gauge_movement_type_statement;

ALTER TABLE gauge_movement_batches
  ADD COLUMN calibration_agency VARCHAR(180) NULL AFTER issued_to;

ALTER TABLE gauge_movement_batches
  ADD COLUMN service_purchase_order_id BIGINT UNSIGNED NULL AFTER calibration_agency;

ALTER TABLE gauge_movement_batches
  ADD COLUMN service_po_number_snapshot VARCHAR(50) NULL AFTER service_purchase_order_id;

ALTER TABLE gauge_movement_batches
  ADD COLUMN challan_number VARCHAR(80) NULL AFTER service_po_number_snapshot;

ALTER TABLE gauge_movement_batches
  ADD COLUMN expected_return_date DATE NULL AFTER challan_number;

ALTER TABLE gauge_movement_batches
  ADD COLUMN courier_reference VARCHAR(180) NULL AFTER expected_return_date;

ALTER TABLE gauge_movement_batches
  ADD COLUMN dispatch_status ENUM('DISPATCHED','RETURNED','CANCELLED') NOT NULL DEFAULT 'DISPATCHED' AFTER courier_reference;

ALTER TABLE gauge_movement_batches
  ADD KEY ix_gauge_calibration_dispatch_list (tenant_id,movement_type,movement_date);

ALTER TABLE gauge_movement_batches
  ADD KEY ix_gauge_calibration_dispatch_po (tenant_id,service_purchase_order_id);

ALTER TABLE gauge_movement_batches
  ADD CONSTRAINT fk_gauge_calibration_dispatch_po
    FOREIGN KEY (service_purchase_order_id)
    REFERENCES purchase_orders(purchase_order_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
