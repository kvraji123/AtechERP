-- Adds direct return dispositions for tools issued to production.
-- Safe to run after tooling-lifecycle-migration.sql on an existing database.

ALTER TABLE tooling_stock_movements
  MODIFY COLUMN movement_type ENUM(
    'GRN_RECEIPT','ISSUE_TO_PRODUCTION','RETURN_FROM_PRODUCTION',
    'RETURN_DAMAGED_REGRIND','RETURN_LOST','RETURN_SCRAP',
    'REGRIND_DISPATCH','REGRIND_RECEIPT','REGRIND_ACCEPTED',
    'REGRIND_REJECTED_SCRAP','REGRIND_REJECTED_REPEAT','REGRIND_REJECTED_RETURN'
  ) NOT NULL;
