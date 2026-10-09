-- Segregated inventory for quantities rejected during GRN inspection.
-- These quantities are physically traceable but never form part of available stock.

CREATE TABLE IF NOT EXISTS inventory_rejection_balance (
  rejection_inventory_balance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  grn_rejection_id BIGINT UNSIGNED NOT NULL,
  grn_id BIGINT UNSIGNED NOT NULL,
  grn_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_description_snapshot VARCHAR(250) NOT NULL,
  uom_code_snapshot VARCHAR(30) NOT NULL,
  warehouse_code VARCHAR(80) NOT NULL DEFAULT 'REJECTION INVENTORY',
  bin_location VARCHAR(80) NOT NULL DEFAULT 'QUARANTINE',
  batch_serial_number VARCHAR(120) NOT NULL DEFAULT '',
  stock_owner_type ENUM('COMPANY','CUSTOMER') NOT NULL DEFAULT 'COMPANY',
  stock_owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  quantity_on_hand DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  status ENUM('OPEN','RESOLVED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rejection_inventory_balance_id),
  UNIQUE KEY uq_rejection_inventory_record (grn_rejection_id),
  KEY ix_rejection_inventory_queue (tenant_id, status, warehouse_code, bin_location),
  KEY ix_rejection_inventory_item (tenant_id, item_id),
  CONSTRAINT fk_rejection_inventory_record FOREIGN KEY (grn_rejection_id)
    REFERENCES grn_rejection_records(grn_rejection_id) ON DELETE CASCADE,
  CONSTRAINT fk_rejection_inventory_grn FOREIGN KEY (grn_id)
    REFERENCES goods_receipt_notes(grn_id) ON DELETE CASCADE,
  CONSTRAINT fk_rejection_inventory_grn_item FOREIGN KEY (grn_item_id)
    REFERENCES goods_receipt_note_items(grn_item_id) ON DELETE CASCADE,
  CONSTRAINT fk_rejection_inventory_item FOREIGN KEY (item_id)
    REFERENCES item_master(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_rejection_transaction (
  rejection_inventory_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL,
  rejection_inventory_balance_id BIGINT UNSIGNED NOT NULL,
  grn_rejection_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('GRN_REJECTION','RETURN_TO_VENDOR','RETURN_TO_CUSTOMER','REWORK','SCRAP','DEVIATION_RELEASE','ADJUSTMENT') NOT NULL,
  transaction_date DATE NOT NULL,
  quantity_in DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  quantity_out DECIMAL(18,3) NOT NULL DEFAULT 0.000,
  balance_after_quantity DECIMAL(18,3) NOT NULL,
  remarks VARCHAR(1000) NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rejection_inventory_transaction_id),
  KEY ix_rejection_inventory_transaction (tenant_id, grn_rejection_id, transaction_date),
  CONSTRAINT fk_rejection_inventory_transaction_balance FOREIGN KEY (rejection_inventory_balance_id)
    REFERENCES inventory_rejection_balance(rejection_inventory_balance_id) ON DELETE CASCADE,
  CONSTRAINT fk_rejection_inventory_transaction_record FOREIGN KEY (grn_rejection_id)
    REFERENCES grn_rejection_records(grn_rejection_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_stock_transaction
  MODIFY COLUMN transaction_type ENUM('GRN_RECEIPT','REJECTION_RELEASE') NOT NULL;

-- Bring open rejection records created before this migration into the segregated balance.
INSERT IGNORE INTO inventory_rejection_balance
  (tenant_id,grn_rejection_id,grn_id,grn_item_id,item_id,item_description_snapshot,uom_code_snapshot,
   warehouse_code,bin_location,batch_serial_number,stock_owner_type,stock_owner_id,quantity_on_hand,
   status,created_by,updated_by)
SELECT R.tenant_id,R.grn_rejection_id,R.grn_id,R.grn_item_id,GI.item_id,
  GI.item_description_snapshot,GI.uom_code_snapshot,'REJECTION INVENTORY','QUARANTINE',
  COALESCE(GI.batch_serial_number,''),CASE WHEN R.responsible_party='CUSTOMER' THEN 'CUSTOMER' ELSE 'COMPANY' END,
  CASE WHEN R.responsible_party='CUSTOMER' THEN COALESCE(G.customer_id,0) ELSE 0 END,
  R.rejected_quantity,'OPEN',R.created_by,R.updated_by
FROM grn_rejection_records R
JOIN goods_receipt_notes G ON G.grn_id=R.grn_id AND G.tenant_id=R.tenant_id
JOIN goods_receipt_note_items GI ON GI.grn_item_id=R.grn_item_id AND GI.tenant_id=R.tenant_id
WHERE R.status='OPEN' AND R.rejected_quantity > 0;

INSERT INTO inventory_rejection_transaction
  (tenant_id,rejection_inventory_balance_id,grn_rejection_id,transaction_type,transaction_date,
   quantity_in,quantity_out,balance_after_quantity,remarks,created_by)
SELECT B.tenant_id,B.rejection_inventory_balance_id,B.grn_rejection_id,'GRN_REJECTION',CURRENT_DATE,
  B.quantity_on_hand,0,B.quantity_on_hand,'Migrated from GRN rejection record',B.created_by
FROM inventory_rejection_balance B
LEFT JOIN inventory_rejection_transaction T ON T.rejection_inventory_balance_id=B.rejection_inventory_balance_id
  AND T.transaction_type='GRN_REJECTION'
WHERE T.rejection_inventory_transaction_id IS NULL;
