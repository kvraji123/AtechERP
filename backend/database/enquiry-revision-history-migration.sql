CREATE TABLE IF NOT EXISTS marketing_enquiry_revisions (
  enquiry_revision_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  revision_sequence INT UNSIGNED NOT NULL,
  revision_number VARCHAR(50) NOT NULL,
  revision_date DATE NOT NULL,
  revision_action ENUM('CREATED', 'UPDATED', 'SUBMITTED', 'MIGRATED')
    NOT NULL DEFAULT 'UPDATED',
  save_status ENUM('DRAFT', 'SUBMITTED') NOT NULL,
  snapshot_json JSON NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enquiry_revision_id),
  UNIQUE KEY uq_enquiry_revision (enquiry_id, revision_sequence),
  KEY ix_enquiry_revision_date (enquiry_id, revision_date),
  CONSTRAINT fk_enquiry_revision_enquiry
    FOREIGN KEY (enquiry_id) REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
