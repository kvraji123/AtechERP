-- Restores the active Enquiry Mode and Order Type values required by the Enquiry form.
-- Safe to run in Adminer or through the npm migration more than once.

INSERT INTO marketing_reference_values
  (reference_type,value_code,display_label,sort_order,active_flag)
VALUES
  ('ENQUIRY_MODE','MAIL','Mail',10,'Y'),
  ('ENQUIRY_MODE','ORAL','Oral',20,'Y'),
  ('ENQUIRY_MODE','VISIT','Visit',30,'Y'),
  ('ORDER_TYPE','SALES','Sales',10,'Y'),
  ('ORDER_TYPE','LABOUR','Labour',20,'Y')
ON DUPLICATE KEY UPDATE
  display_label=VALUES(display_label),
  sort_order=VALUES(sort_order),
  active_flag='Y';
