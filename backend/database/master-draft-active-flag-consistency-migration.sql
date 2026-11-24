-- Master draft active-flag consistency migration.
-- MySQL 8.0+
--
-- `active_flag` now represents only lifecycle state. A record remains active
-- until a user explicitly deactivates it. `save_status` represents DRAFT vs
-- SUBMITTED, and operational lookups must require both active_flag='Y' and
-- save_status='SUBMITTED'.
--
-- This is idempotent. It repairs drafts written by the previous workflow,
-- which set active_flag='N' merely because save_status was DRAFT.

START TRANSACTION;

UPDATE customer_master
SET active_flag = 'Y'
WHERE active_flag = 'N'
  AND COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND COALESCE(customer_status, 'ACTIVE') <> 'INACTIVE';

UPDATE supplier_master
SET active_flag = 'Y'
WHERE active_flag = 'N'
  AND COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND COALESCE(supplier_status, 'ACTIVE') <> 'INACTIVE';

UPDATE part_master
SET active_flag = 'Y'
WHERE active_flag = 'N'
  AND COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND COALESCE(part_status, 'ACTIVE') <> 'INACTIVE';

COMMIT;

-- Verification: every active draft is visible in its master list, but cannot
-- be used by submitted-only operational lookups.
SELECT 'customer_master' AS entity, COUNT(*) AS draft_still_inactive
FROM customer_master
WHERE COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND active_flag = 'N'
  AND COALESCE(customer_status, 'ACTIVE') <> 'INACTIVE'
UNION ALL
SELECT 'supplier_master', COUNT(*)
FROM supplier_master
WHERE COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND active_flag = 'N'
  AND COALESCE(supplier_status, 'ACTIVE') <> 'INACTIVE'
UNION ALL
SELECT 'part_master', COUNT(*)
FROM part_master
WHERE COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND active_flag = 'N'
  AND COALESCE(part_status, 'ACTIVE') <> 'INACTIVE';
