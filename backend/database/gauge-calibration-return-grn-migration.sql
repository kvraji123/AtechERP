-- Calibration Return GRN headers are linked to the original external calibration dispatch.
-- A return can contain one or more Gauge IDs from a GCD, which supports partial receipts.

-- Retain movement types already stored by older installations, then append the
-- calibration return type required by this workflow.
SET @atech_gauge_movement_type_sql := COALESCE((
  SELECT IF(
    LOCATE('''CALIBRATION_RETURN''', COLUMN_TYPE) > 0,
    'SELECT 1',
    CONCAT(
      'ALTER TABLE gauge_movement_batches MODIFY COLUMN movement_type ',
      REPLACE(COLUMN_TYPE, ')', ',''CALIBRATION_RETURN'')'),
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

-- The same rule applies to an existing status list: preserve old statuses and
-- append PARTIALLY_RETURNED for the new partial GRN workflow.
SET @atech_gauge_dispatch_status_sql := COALESCE((
  SELECT IF(
    LOCATE('''PARTIALLY_RETURNED''', COLUMN_TYPE) > 0,
    'SELECT 1',
    CONCAT(
      'ALTER TABLE gauge_movement_batches MODIFY COLUMN dispatch_status ',
      REPLACE(COLUMN_TYPE, ')', ',''PARTIALLY_RETURNED'')'),
      ' NOT NULL DEFAULT ''DISPATCHED'''
    )
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'gauge_movement_batches'
    AND COLUMN_NAME = 'dispatch_status'
), 'SELECT 1');
PREPARE atech_gauge_dispatch_status_statement FROM @atech_gauge_dispatch_status_sql;
EXECUTE atech_gauge_dispatch_status_statement;
DEALLOCATE PREPARE atech_gauge_dispatch_status_statement;

ALTER TABLE gauge_movement_batches
  ADD COLUMN source_calibration_dispatch_id BIGINT UNSIGNED NULL AFTER courier_reference;

ALTER TABLE gauge_movement_batches
  ADD KEY ix_gauge_calibration_return_source (tenant_id,source_calibration_dispatch_id,movement_date);

ALTER TABLE gauge_movement_batches
  ADD CONSTRAINT fk_gauge_calibration_return_source
  FOREIGN KEY (source_calibration_dispatch_id)
  REFERENCES gauge_movement_batches(gauge_movement_batch_id)
  ON UPDATE CASCADE ON DELETE RESTRICT;
