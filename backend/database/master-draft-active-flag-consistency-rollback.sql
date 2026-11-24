-- Roll back only when reverting to the old application behaviour.
-- This intentionally affects drafts only; explicitly inactive records remain
-- unchanged.

START TRANSACTION;

UPDATE customer_master
SET active_flag = 'N'
WHERE active_flag = 'Y'
  AND COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND COALESCE(customer_status, 'ACTIVE') <> 'INACTIVE';

UPDATE supplier_master
SET active_flag = 'N'
WHERE active_flag = 'Y'
  AND COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND COALESCE(supplier_status, 'ACTIVE') <> 'INACTIVE';

UPDATE part_master
SET active_flag = 'N'
WHERE active_flag = 'Y'
  AND COALESCE(save_status, 'SUBMITTED') = 'DRAFT'
  AND COALESCE(part_status, 'ACTIVE') <> 'INACTIVE';

COMMIT;
