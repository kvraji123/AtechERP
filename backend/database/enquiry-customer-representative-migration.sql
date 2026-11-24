ALTER TABLE marketing_enquiries
  ADD COLUMN customer_representative_name VARCHAR(150) NULL AFTER customer_short_name_snapshot;
