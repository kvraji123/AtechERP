-- Go-live number reset for financial year 2026-27.
--
-- Run this ONLY after all test Customer, Supplier, and Enquiry records have
-- been permanently removed and a production database backup has been taken.
-- The insert does nothing if any of those records remain, preventing
-- duplicate document codes. It uses plain MySQL statements, so it can be
-- imported by Adminer and phpMyAdmin without stored-procedure support.

START TRANSACTION;

INSERT INTO app_document_sequences
  (sequence_key, financial_year, prefix, current_number, number_padding)
SELECT 'CUSTOMER', '2026-27', 'CUS', 0, 4
WHERE NOT EXISTS (SELECT 1 FROM customer_master LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM supplier_master LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM marketing_enquiries LIMIT 1)
UNION ALL
SELECT 'SUPPLIER', '2026-27', 'SUP', 0, 4
WHERE NOT EXISTS (SELECT 1 FROM customer_master LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM supplier_master LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM marketing_enquiries LIMIT 1)
UNION ALL
SELECT 'ENQUIRY', '2026-27', 'ENQ', 0, 4
WHERE NOT EXISTS (SELECT 1 FROM customer_master LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM supplier_master LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM marketing_enquiries LIMIT 1)
ON DUPLICATE KEY UPDATE
  prefix = VALUES(prefix),
  current_number = VALUES(current_number),
  number_padding = VALUES(number_padding);

COMMIT;

-- Verify that all counts are zero. If any count is non-zero, the reset was
-- deliberately skipped. Expected next records after a successful reset are
-- CUS/2026-27/0001, SUP/2026-27/0001, and ENQ/0001/26-27.
SELECT
  (SELECT COUNT(*) FROM customer_master) AS remaining_customers,
  (SELECT COUNT(*) FROM supplier_master) AS remaining_suppliers,
  (SELECT COUNT(*) FROM marketing_enquiries) AS remaining_enquiries;

SELECT sequence_key, financial_year, prefix, current_number, number_padding
FROM app_document_sequences
WHERE financial_year = '2026-27'
  AND sequence_key IN ('CUSTOMER', 'SUPPLIER', 'ENQUIRY')
ORDER BY sequence_key;
