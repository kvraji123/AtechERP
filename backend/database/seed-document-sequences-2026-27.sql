-- Production document-number configuration for financial year 2026-27.
-- MySQL / MariaDB. Run only in the primary ATECH database (DB_NAME).
-- This never resets an existing current_number.

START TRANSACTION;

INSERT INTO app_document_sequences (
  sequence_key,
  financial_year,
  prefix,
  current_number,
  number_padding
)
VALUES
  ('CUSTOMER', '2026-27', 'CUS', 0, 4),
  ('SUPPLIER', '2026-27', 'SUP', 0, 4),
  ('PART', '2026-27', 'PRT', 0, 4),
  ('DRAWING_CODE', 'GLOBAL', '', 0, 1),

  ('ENQUIRY', '2026-27', 'ENQ', 0, 4),
  ('QUOTATION', '2026-27', 'QUO', 0, 4),

  ('PURCHASE_REQUEST', '2026-27', 'PR', 0, 4),
  ('PURCHASE_ENQUIRY', '2026-27', 'PE', 0, 4),
  ('PURCHASE_ORDER', '2026-27', 'PO', 0, 4),
  ('GATE_ENTRY', '2026-27', 'GE', 0, 4),
  ('GRN', '2026-27', 'GRN', 0, 4),

  ('INVENTORY_MOVE', '2026-27', 'IMV', 0, 5),
  ('PRODUCTION_REJECTION', '2026-27', 'PRJ', 0, 5),
  ('RTV', '2026-27', 'RTV', 0, 4),
  ('RTC', '2026-27', 'RTC', 0, 4),
  ('RWR', '2026-27', 'RWR', 0, 4),
  ('SCR', '2026-27', 'SCR', 0, 4),
  ('DVR', '2026-27', 'DVR', 0, 4),

  ('MATERIAL_OUTWARD', '2026-27', 'MOUT', 0, 4),
  ('GATE_EXIT', '2026-27', 'GEX', 0, 4),
  ('TOOL_REGRIND_DC', '2026-27', 'TDC', 0, 4),
  ('TOOL_REGRIND_RETURN_GRN', '2026-27', 'TRGN', 0, 4),
  ('GAUGE_CALIBRATION_DISPATCH', '2026-27', 'GCD', 0, 4),
  ('GAUGE_CALIBRATION_RETURN_GRN', '2026-27', 'CGRN', 0, 4),
  ('GAUGE_ISSUE', '2026-27', 'GI', 0, 4),
  ('GAUGE_RETURN', '2026-27', 'GR', 0, 4)
ON DUPLICATE KEY UPDATE
  prefix = VALUES(prefix),
  number_padding = VALUES(number_padding);

COMMIT;

SELECT
  sequence_key,
  financial_year,
  prefix,
  current_number,
  number_padding
FROM app_document_sequences
WHERE financial_year IN ('2026-27', 'GLOBAL')
ORDER BY financial_year, sequence_key;
