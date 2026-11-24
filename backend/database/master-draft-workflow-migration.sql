-- Run this migration before deploying the master/enquiry draft workflow.
-- MySQL 8.0+

ALTER TABLE customer_master
  ADD COLUMN IF NOT EXISTS save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER customer_status,
  MODIFY COLUMN customer_name VARCHAR(200) NULL;

ALTER TABLE supplier_master
  ADD COLUMN IF NOT EXISTS save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER supplier_status,
  MODIFY COLUMN supplier_name VARCHAR(200) NULL;

ALTER TABLE part_master
  ADD COLUMN IF NOT EXISTS save_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER part_status,
  MODIFY COLUMN customer_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN part_category ENUM('MACHINING', 'ASSEMBLY') NULL,
  MODIFY COLUMN part_name VARCHAR(200) NULL;

ALTER TABLE marketing_enquiries
  MODIFY COLUMN customer_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN customer_code_snapshot VARCHAR(50) NULL,
  MODIFY COLUMN customer_name_snapshot VARCHAR(200) NULL;
