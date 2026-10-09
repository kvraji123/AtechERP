-- Add the common "Once per Lot" inspection frequency for Process Plan and Item Master.
INSERT INTO inspection_frequency_master
  (frequency_code,frequency_label,display_order)
VALUES
  ('ONCE_PER_LOT','Once per Lot',55)
ON DUPLICATE KEY UPDATE
  frequency_label=VALUES(frequency_label),
  display_order=VALUES(display_order),
  active_flag='Y';
