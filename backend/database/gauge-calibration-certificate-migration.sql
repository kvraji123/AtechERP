-- Each calibration-completion history row can retain the issued certificate PDF.
ALTER TABLE gauge_history
  ADD COLUMN certificate_file_name VARCHAR(255) NULL AFTER certificate_number;

ALTER TABLE gauge_history
  ADD COLUMN certificate_file_path VARCHAR(500) NULL AFTER certificate_file_name;

ALTER TABLE gauge_history
  ADD COLUMN certificate_file_size_bytes BIGINT UNSIGNED NULL AFTER certificate_file_path;
