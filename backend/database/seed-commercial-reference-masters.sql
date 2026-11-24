-- Shared application reference values for Customer, Supplier, Part, Item,
-- Enquiry, Feasibility, Workout, Purchase Order, Gate Entry, and inventory.
--
-- MySQL / MariaDB
-- Run after selecting the application's operational database (the database
-- that contains marketing_reference_values). Run it once for the primary
-- ATECH database and again for cms_erp when the CMS/labour workflow is enabled.
-- The script is idempotent:
-- existing records are updated with the approved label/order and reactivated.
-- Existing currency exchange rates are deliberately preserved.

START TRANSACTION;

INSERT INTO marketing_reference_values (
  reference_type,
  value_code,
  display_label,
  numeric_value,
  effective_date,
  sort_order,
  active_flag
)
VALUES
  -- Shared Customer / Supplier status and attachment lists
  ('RECORD_STATUS', 'ACTIVE', 'Active', NULL, NULL, 10, 'Y'),
  ('RECORD_STATUS', 'INACTIVE', 'Inactive', NULL, NULL, 20, 'Y'),
  ('CUSTOMER_ATTACHMENT_TYPE', 'NDA', 'NDA', NULL, NULL, 10, 'Y'),
  ('CUSTOMER_ATTACHMENT_TYPE', 'AGREEMENT', 'Agreement', NULL, NULL, 20, 'Y'),
  ('CUSTOMER_ATTACHMENT_TYPE', 'GST_CERTIFICATE', 'GST Certificate', NULL, NULL, 30, 'Y'),
  ('CUSTOMER_ATTACHMENT_TYPE', 'PAN_CARD', 'PAN Card', NULL, NULL, 40, 'Y'),
  ('CUSTOMER_ATTACHMENT_TYPE', 'OTHER', 'Other', NULL, NULL, 50, 'Y'),
  ('CUSTOMER_PARTY_TYPE', 'CUSTOMER', 'Customer', NULL, NULL, 10, 'Y'),
  ('CUSTOMER_PARTY_TYPE', 'SUPPLIER', 'Supplier', NULL, NULL, 20, 'Y'),
  ('CUSTOMER_PARTY_TYPE', 'BOTH', 'Both', NULL, NULL, 30, 'Y'),

  -- Part and Item Master lists served by the shared Reference API
  ('PART_CATEGORY', 'MACHINING', 'Machining', NULL, NULL, 10, 'Y'),
  ('PART_CATEGORY', 'ASSEMBLY', 'Assembly', NULL, NULL, 20, 'Y'),
  ('DRAWING_CODE_MODE', 'AUTO_GENERATED', 'Auto Generated', NULL, NULL, 10, 'Y'),
  ('DRAWING_CODE_MODE', 'MANUAL', 'Manual', NULL, NULL, 20, 'Y'),
  ('PART_ATTACHMENT_TYPE', 'CUSTOMER_DRAWING', 'Customer Drawing', NULL, NULL, 10, 'Y'),
  ('PART_ATTACHMENT_TYPE', 'CUSTOMER_STANDARD', 'Customer Standard', NULL, NULL, 20, 'Y'),
  ('PART_ATTACHMENT_TYPE', 'PART_MODEL', 'Part Model (STEP/STP only)', NULL, NULL, 30, 'Y'),
  ('PART_ATTACHMENT_TYPE', 'BALLOONED_DRAWING', 'Ballooned Drawing', NULL, NULL, 40, 'Y'),
  ('PART_ATTACHMENT_TYPE', 'PATTERN_DIE_DRAWING', 'Pattern / Die Drawing', NULL, NULL, 50, 'Y'),
  ('PART_ATTACHMENT_TYPE', 'OTHER', 'Other', NULL, NULL, 60, 'Y'),
  ('YES_NO', 'N', 'No', NULL, NULL, 10, 'Y'),
  ('YES_NO', 'Y', 'Yes', NULL, NULL, 20, 'Y'),
  ('DOCUMENT_TYPE', 'IMAGE', 'Image', NULL, NULL, 10, 'Y'),
  ('DOCUMENT_TYPE', 'DRAWING', 'Drawing', NULL, NULL, 20, 'Y'),
  ('DOCUMENT_TYPE', 'DATASHEET', 'Datasheet', NULL, NULL, 30, 'Y'),
  ('DOCUMENT_TYPE', 'OTHER', 'Other', NULL, NULL, 40, 'Y'),

  -- Enquiry workflow lists
  ('ENQUIRY_MODE', 'MAIL', 'Mail', NULL, NULL, 10, 'Y'),
  ('ENQUIRY_MODE', 'ORAL', 'Oral', NULL, NULL, 20, 'Y'),
  ('ENQUIRY_MODE', 'VISIT', 'Visit', NULL, NULL, 30, 'Y'),
  ('ORDER_TYPE', 'SALES', 'Sales', NULL, NULL, 10, 'Y'),
  ('ORDER_TYPE', 'LABOUR', 'Labour', NULL, NULL, 20, 'Y'),
  ('ENQUIRY_STATUS_TRANSITION', 'QUOTED', 'Quoted', NULL, NULL, 10, 'Y'),
  ('ENQUIRY_STATUS_TRANSITION', 'ORDER_RECEIVED', 'Order Received', NULL, NULL, 20, 'Y'),

  -- Payment terms
  ('PAYMENT_TERM', 'ADVANCE', 'Advance Payment', NULL, NULL, 10, 'Y'),
  ('PAYMENT_TERM', 'NET_30', 'Net 30 Days', NULL, NULL, 20, 'Y'),
  ('PAYMENT_TERM', 'NET_45', 'Net 45 Days', NULL, NULL, 30, 'Y'),
  ('PAYMENT_TERM', 'NET_60', 'Net 60 Days', NULL, NULL, 40, 'Y'),
  ('PAYMENT_TERM', 'LC', 'Letter of Credit', NULL, NULL, 50, 'Y'),
  ('PAYMENT_TERM', 'OTHER', 'Other', NULL, NULL, 60, 'Y'),

  -- Delivery terms
  ('DELIVERY_TERM', 'ATECH_STORES_FREIGHT_PAID', 'Delivery to Atech Stores - freight paid', NULL, NULL, 10, 'Y'),
  ('DELIVERY_TERM', 'ATECH_STORES_FREIGHT_TO_PAY', 'Delivery to Atech Stores - freight to pay', NULL, NULL, 20, 'Y'),
  ('DELIVERY_TERM', 'PROJECT_OR_CUSTOMER_SITE', 'Delivery to project / customer site', NULL, NULL, 30, 'Y'),
  ('DELIVERY_TERM', 'EX_WORKS', 'Ex Works - collect from supplier', NULL, NULL, 40, 'Y'),
  ('DELIVERY_TERM', 'DOOR_DELIVERY', 'Door delivery - supplier responsibility', NULL, NULL, 50, 'Y'),
  ('DELIVERY_TERM', 'FOB', 'FOB', NULL, NULL, 60, 'Y'),
  ('DELIVERY_TERM', 'CIF', 'CIF', NULL, NULL, 70, 'Y'),
  ('DELIVERY_TERM', 'DAP', 'DAP', NULL, NULL, 80, 'Y'),
  ('DELIVERY_TERM', 'DDP', 'DDP', NULL, NULL, 90, 'Y'),
  ('DELIVERY_TERM', 'PARTIAL_DELIVERY_ALLOWED', 'Partial delivery permitted', NULL, NULL, 100, 'Y'),
  ('DELIVERY_TERM', 'AS_PER_PO_SCHEDULE', 'Delivery as per PO schedule', NULL, NULL, 110, 'Y'),
  ('DELIVERY_TERM', 'OTHER', 'Other', NULL, NULL, 120, 'Y'),

  -- Invoice types
  ('INVOICE_TYPE', 'TAX_INVOICE', 'Tax Invoice', NULL, NULL, 10, 'Y'),
  ('INVOICE_TYPE', 'LABOUR_INVOICE', 'Labour Invoice', NULL, NULL, 20, 'Y'),
  ('INVOICE_TYPE', 'EXPORT_INVOICE', 'Export Invoice', NULL, NULL, 30, 'Y'),

  -- Transport modes
  ('TRANSPORT_MODE', 'ROAD', 'Road', NULL, NULL, 10, 'Y'),
  ('TRANSPORT_MODE', 'AIR', 'Air', NULL, NULL, 20, 'Y'),
  ('TRANSPORT_MODE', 'SEA', 'Sea', NULL, NULL, 30, 'Y'),
  ('TRANSPORT_MODE', 'COURIER', 'Courier', NULL, NULL, 40, 'Y'),
  ('TRANSPORT_MODE', 'OTHER', 'Other', NULL, NULL, 50, 'Y'),

  -- Currencies. INR is always 1.00 against itself. Foreign-currency rates
  -- are left NULL until finance enters the approved rate; existing rates are
  -- not replaced by this script.
  ('CURRENCY', 'INR', 'Indian Rupee', 1.000000, NULL, 10, 'Y'),
  ('CURRENCY', 'EUR', 'Euro', NULL, NULL, 20, 'Y'),
  ('CURRENCY', 'USD', 'US Dollar', NULL, NULL, 30, 'Y'),
  ('CURRENCY', 'GBP', 'British Pound', NULL, NULL, 40, 'Y'),

  -- Workout / quotation lists
  ('PROFIT_CALCULATION_TYPE', 'FIXED_AMOUNT', 'Fixed Amount', NULL, NULL, 10, 'Y'),
  ('PROFIT_CALCULATION_TYPE', 'PERCENTAGE', 'Percentage', NULL, NULL, 20, 'Y'),
  ('SUBPART_MATERIAL_TYPE', 'PURCHASE', 'Purchase', NULL, NULL, 10, 'Y'),
  ('SUBPART_MATERIAL_TYPE', 'MANUFACTURING', 'Manufacturing', NULL, NULL, 20, 'Y'),
  ('MACHINING_PROCESS', 'TURNING', 'Turning', 300.000000, NULL, 10, 'Y'),
  ('MACHINING_PROCESS', 'VMC', 'VMC', 500.000000, NULL, 20, 'Y'),
  ('MACHINING_PROCESS', 'HMC', 'HMC', 1000.000000, NULL, 30, 'Y'),
  ('MACHINING_PROCESS', 'KEYWAY_SPLINE', 'Keyway / Spline', NULL, NULL, 40, 'Y'),
  ('MACHINING_PROCESS', 'HEAT_TREATMENT', 'Heat Treatment', NULL, NULL, 50, 'Y'),
  ('MACHINING_PROCESS', 'SHAPING_GEAR', 'Shaping / Gear', NULL, NULL, 60, 'Y'),
  ('MACHINING_PROCESS', 'OTHER', 'Other Process', NULL, NULL, 70, 'Y')
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  numeric_value = COALESCE(numeric_value, VALUES(numeric_value)),
  effective_date = COALESCE(effective_date, VALUES(effective_date)),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';

COMMIT;

-- Verification: this returns the 74 seeded/re-activated rows plus any
-- pre-existing active records for the same reference types.
SELECT
  reference_type,
  value_code,
  display_label,
  numeric_value,
  effective_date,
  sort_order,
  active_flag
FROM marketing_reference_values
WHERE reference_type IN (
  'RECORD_STATUS',
  'CUSTOMER_ATTACHMENT_TYPE',
  'CUSTOMER_PARTY_TYPE',
  'PART_CATEGORY',
  'DRAWING_CODE_MODE',
  'PART_ATTACHMENT_TYPE',
  'YES_NO',
  'DOCUMENT_TYPE',
  'ENQUIRY_MODE',
  'ORDER_TYPE',
  'ENQUIRY_STATUS_TRANSITION',
  'DELIVERY_TERM',
  'PAYMENT_TERM',
  'INVOICE_TYPE',
  'TRANSPORT_MODE',
  'CURRENCY',
  'PROFIT_CALCULATION_TYPE',
  'SUBPART_MATERIAL_TYPE',
  'MACHINING_PROCESS'
)
ORDER BY reference_type, sort_order, display_label;
