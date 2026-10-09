CREATE TABLE IF NOT EXISTS application_attachments (
  attachment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  attachment_type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  attachment_name VARCHAR(255) NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attachment_id),
  KEY ix_application_attachment_entity (tenant_id, entity_type, entity_id, active_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
