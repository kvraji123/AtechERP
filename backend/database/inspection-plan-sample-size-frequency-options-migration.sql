-- Use only the approved Sample Size and Inspection Frequency dropdown values.
INSERT INTO inspection_sample_size_master
  (sample_size_code,sample_size_label,display_order)
VALUES
  ('100_PERCENT','100%',10),
  ('1','1',20),
  ('2','2',30),
  ('3','3',40),
  ('5','5',50)
ON DUPLICATE KEY UPDATE
  sample_size_label=VALUES(sample_size_label),
  display_order=VALUES(display_order),
  active_flag='Y';

UPDATE inspection_sample_size_master
SET active_flag='N'
WHERE sample_size_code NOT IN ('100_PERCENT','1','2','3','5');

INSERT INTO inspection_frequency_master
  (frequency_code,frequency_label,display_order)
VALUES
  ('100_PERCENT','100%',10),
  ('5','5',20),
  ('10','10',30),
  ('15','15',40),
  ('20','20',50),
  ('25','25',60),
  ('50','50',70),
  ('SHIFT','Shift',80),
  ('LOT','Lot',90),
  ('DAY','Day',100),
  ('WEEK','Week',110)
ON DUPLICATE KEY UPDATE
  frequency_label=VALUES(frequency_label),
  display_order=VALUES(display_order),
  active_flag='Y';

UPDATE inspection_frequency_master
SET active_flag='N'
WHERE frequency_code NOT IN ('100_PERCENT','5','10','15','20','25','50','SHIFT','LOT','DAY','WEEK');
