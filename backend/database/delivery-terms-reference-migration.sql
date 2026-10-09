-- Delivery Terms reference values for Customer and Supplier commercial details.
-- Safe to run more than once.
INSERT INTO marketing_reference_values
  (reference_type, value_code, display_label, sort_order)
VALUES
  ('DELIVERY_TERM', 'ATECH_STORES_FREIGHT_PAID', 'Delivery to Atech Stores - freight paid', 10),
  ('DELIVERY_TERM', 'ATECH_STORES_FREIGHT_TO_PAY', 'Delivery to Atech Stores - freight to pay', 20),
  ('DELIVERY_TERM', 'PROJECT_OR_CUSTOMER_SITE', 'Delivery to project / customer site', 30),
  ('DELIVERY_TERM', 'EX_WORKS', 'Ex Works - collect from supplier', 40),
  ('DELIVERY_TERM', 'DOOR_DELIVERY', 'Door delivery - supplier responsibility', 50),
  ('DELIVERY_TERM', 'FOB', 'FOB', 60),
  ('DELIVERY_TERM', 'CIF', 'CIF', 70),
  ('DELIVERY_TERM', 'DAP', 'DAP', 80),
  ('DELIVERY_TERM', 'DDP', 'DDP', 90),
  ('DELIVERY_TERM', 'PARTIAL_DELIVERY_ALLOWED', 'Partial delivery permitted', 100),
  ('DELIVERY_TERM', 'AS_PER_PO_SCHEDULE', 'Delivery as per PO schedule', 110),
  ('DELIVERY_TERM', 'OTHER', 'Other', 120)
ON DUPLICATE KEY UPDATE
  display_label = VALUES(display_label),
  sort_order = VALUES(sort_order),
  active_flag = 'Y';
