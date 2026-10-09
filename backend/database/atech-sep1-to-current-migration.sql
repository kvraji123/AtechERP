-- ============================================================================
-- A TECH AUTOMATION ERP — Sep1 database to current purchase-module migration
-- Target: MySQL 8.0+
--
-- Run this ONLY when a database was already created from
-- atech-production-complete_sep1.  It is safe to run more than once.
-- Do NOT re-run the full clean-install SQL on an existing database.
-- Prerequisite: run apply-separate-party-masters.js first so supplier_master
-- and every supplier_id relationship have been separated from customer_master.
-- ============================================================================

USE `atech_erp`;
SET NAMES utf8mb4;
SET time_zone = '+05:30';

-- Supplier-specific RFQ email outbox. One record is created per supplier.
CREATE TABLE IF NOT EXISTS purchase_rfq_email_outbox (
  email_outbox_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  recipient_name VARCHAR(200) NULL,
  subject VARCHAR(500) NOT NULL,
  text_body TEXT NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  status ENUM('PENDING','PROCESSING','SENT','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  sent_at DATETIME NULL,
  message_id VARCHAR(500) NULL,
  last_error VARCHAR(2000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email_outbox_id),
  UNIQUE KEY uq_rfq_email_outbox_supplier (tenant_id, purchase_enquiry_id, supplier_id),
  KEY ix_rfq_email_outbox_claim (status, available_at),
  KEY ix_rfq_email_outbox_enquiry (tenant_id, purchase_enquiry_id),
  CONSTRAINT fk_rfq_email_outbox_enquiry FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id) ON DELETE CASCADE,
  CONSTRAINT fk_rfq_email_outbox_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stores the RFQ PDF generated for each supplier before email delivery.
CREATE TABLE IF NOT EXISTS purchase_rfq_documents (
  rfq_document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  purchase_enquiry_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(1000) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rfq_document_id),
  UNIQUE KEY uq_rfq_document_supplier (tenant_id, purchase_enquiry_id, supplier_id),
  KEY ix_rfq_document_enquiry (tenant_id, purchase_enquiry_id),
  CONSTRAINT fk_rfq_document_enquiry FOREIGN KEY (purchase_enquiry_id)
    REFERENCES purchase_enquiries (purchase_enquiry_id) ON DELETE CASCADE,
  CONSTRAINT fk_rfq_document_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep the email subject concise; item names remain in the body and RFQ PDF.
UPDATE purchase_rfq_email_outbox O
JOIN purchase_enquiries PE ON PE.purchase_enquiry_id = O.purchase_enquiry_id
SET O.subject = CONCAT('Request for Quotation - ', PE.enquiry_number)
WHERE O.status = 'PENDING';
