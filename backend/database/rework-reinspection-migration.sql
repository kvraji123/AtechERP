-- Quality re-inspection and stock posting for completed rework.

ALTER TABLE rejection_resolution_requests
  MODIFY COLUMN resolution_status ENUM(
    'PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','IN_PROGRESS','AWAITING_REINSPECTION',
    'READY_FOR_STOCK','REINSPECTED_REJECTED','EXECUTED','POSTED','CANCELLED'
  ) NOT NULL DEFAULT 'PENDING_APPROVAL';

ALTER TABLE inventory_rework_balance
  MODIFY COLUMN status ENUM(
    'IN_PROGRESS','AWAITING_REINSPECTION','READY_FOR_STOCK','REINSPECTED_REJECTED','POSTED','CANCELLED'
  ) NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN accepted_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000 AFTER quantity_in_process,
  ADD COLUMN rejected_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000 AFTER accepted_quantity,
  ADD COLUMN reinspection_remarks VARCHAR(1000) NULL AFTER completion_remarks,
  ADD COLUMN reinspection_rejection_reason VARCHAR(500) NULL AFTER reinspection_remarks,
  ADD COLUMN reinspected_by VARCHAR(50) NULL AFTER reinspection_rejection_reason,
  ADD COLUMN reinspected_at DATETIME NULL AFTER reinspected_by,
  ADD COLUMN stock_posting_date DATE NULL AFTER reinspected_at,
  ADD COLUMN warehouse_code VARCHAR(80) NULL AFTER stock_posting_date,
  ADD COLUMN bin_location VARCHAR(80) NULL AFTER warehouse_code,
  ADD COLUMN batch_serial_number VARCHAR(120) NULL AFTER bin_location,
  ADD COLUMN stock_posted_by VARCHAR(50) NULL AFTER batch_serial_number,
  ADD COLUMN stock_posted_at DATETIME NULL AFTER stock_posted_by;

ALTER TABLE inventory_rejection_transaction
  MODIFY COLUMN transaction_type ENUM(
    'GRN_REJECTION','RETURN_TO_VENDOR','RETURN_TO_CUSTOMER','REWORK','REWORK_RETURN',
    'REWORK_REINSPECTION','REWORK_STOCK_RECEIPT','SCRAP','DEVIATION_RELEASE','ADJUSTMENT',
    'RTV_SUBMITTED','RESOLUTION_SUBMITTED'
  ) NOT NULL;

ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN transaction_type ENUM('GRN_RECEIPT','REJECTION_RELEASE','REWORK_RECEIPT') NOT NULL;

ALTER TABLE inventory_stock_transaction DROP INDEX IF EXISTS uq_inventory_stock_transaction_grn_line;
ALTER TABLE inventory_stock_transaction
  ADD KEY IF NOT EXISTS ix_inventory_stock_transaction_grn_line (tenant_id,grn_item_id);
