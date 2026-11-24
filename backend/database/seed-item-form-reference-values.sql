-- Item Master form lookup values.
-- MySQL / MariaDB. Run only in the primary ATECH database (DB_NAME), because
-- item_reference_value is not part of the CMS marketing database.
-- This script is idempotent and reactivates the seeded lookup values.

START TRANSACTION;

INSERT INTO item_reference_value (
  reference_group,
  reference_code,
  reference_label,
  display_order,
  active_flag
)
VALUES
  ('ASSET_CATEGORY', 'MACHINE', 'Machine', 10, 'Y'),
  ('ASSET_CATEGORY', 'COMPUTER', 'Computer', 20, 'Y'),
  ('ASSET_CATEGORY', 'FURNITURE', 'Furniture', 30, 'Y'),
  ('ASSET_CATEGORY', 'SOFTWARE', 'Software', 40, 'Y'),
  ('ASSET_CATEGORY', 'MEASURING_EQUIPMENT', 'Measuring Equipment', 50, 'Y'),

  ('CALIBRATION_FREQUENCY', 'MONTHLY', 'Monthly', 10, 'Y'),
  ('CALIBRATION_FREQUENCY', 'QUARTERLY', 'Quarterly', 20, 'Y'),
  ('CALIBRATION_FREQUENCY', 'HALF_YEARLY', 'Half-yearly', 30, 'Y'),
  ('CALIBRATION_FREQUENCY', 'YEARLY', 'Yearly', 40, 'Y'),

  ('ITEM_STATUS', 'ACTIVE', 'Active', 10, 'Y'),
  ('ITEM_STATUS', 'INACTIVE', 'Inactive', 20, 'Y'),
  ('ITEM_STATUS', 'OBSOLETE', 'Obsolete', 30, 'Y'),

  ('CURRENCY', 'INR', 'INR', 10, 'Y'),
  ('CURRENCY', 'EUR', 'EUR', 20, 'Y'),
  ('CURRENCY', 'USD', 'USD', 30, 'Y'),
  ('CURRENCY', 'GBP', 'GBP', 40, 'Y')
ON DUPLICATE KEY UPDATE
  reference_label = VALUES(reference_label),
  display_order = VALUES(display_order),
  active_flag = 'Y';

COMMIT;

SELECT
  reference_group,
  reference_code,
  reference_label,
  display_order,
  active_flag
FROM item_reference_value
WHERE reference_group IN (
  'ASSET_CATEGORY',
  'CALIBRATION_FREQUENCY',
  'ITEM_STATUS',
  'CURRENCY'
)
ORDER BY reference_group, display_order, reference_label;
