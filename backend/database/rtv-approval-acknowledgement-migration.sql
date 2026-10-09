-- RTVs reserve rejected stock until their approval, supplier acknowledgement and physical dispatch.

ALTER TABLE inventory_rejection_balance
  ADD COLUMN IF NOT EXISTS quantity_reserved DECIMAL(18,3) NOT NULL DEFAULT 0.000 AFTER quantity_on_hand;

ALTER TABLE inventory_rejection_transaction
  MODIFY COLUMN transaction_type ENUM(
    'GRN_REJECTION','RETURN_TO_VENDOR','RETURN_TO_CUSTOMER','REWORK','SCRAP','DEVIATION_RELEASE',
    'ADJUSTMENT','RTV_SUBMITTED'
  ) NOT NULL;

ALTER TABLE return_to_vendor_documents
  MODIFY COLUMN document_status ENUM('PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','DISPATCHED','CANCELLED')
    NOT NULL DEFAULT 'PENDING_APPROVAL';

ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS approval_remarks VARCHAR(1000) NULL AFTER remarks;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS approved_by VARCHAR(50) NULL AFTER approval_remarks;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER approved_by;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(160) NULL AFTER approved_at;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS supplier_acknowledgement_reference VARCHAR(250) NULL AFTER supplier_contact;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS supplier_acknowledged_by VARCHAR(50) NULL AFTER supplier_acknowledgement_reference;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS supplier_acknowledged_at DATETIME NULL AFTER supplier_acknowledged_by;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS dispatched_by VARCHAR(50) NULL AFTER supplier_acknowledged_at;
ALTER TABLE return_to_vendor_documents ADD COLUMN IF NOT EXISTS dispatched_at DATETIME NULL AFTER dispatched_by;
ALTER TABLE return_to_vendor_documents ADD KEY IF NOT EXISTS ix_rtv_workflow (tenant_id, document_status, created_at);
