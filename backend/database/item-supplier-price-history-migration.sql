-- Supplier-specific Item Master purchase-rate history.
-- Existing rates are retained as one BASELINE row; future Item Master saves add a row only when the rate or currency changes.

CREATE TABLE IF NOT EXISTS item_supplier_price_history (
  item_supplier_price_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  previous_purchase_rate DECIMAL(18,2) NULL,
  new_purchase_rate DECIMAL(18,2) NULL,
  previous_currency_code VARCHAR(10) NULL,
  new_currency_code VARCHAR(10) NULL,
  change_type VARCHAR(30) NOT NULL,
  effective_from DATE NULL,
  changed_by VARCHAR(50) NOT NULL,
  changed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_supplier_price_history_id),
  KEY ix_item_supplier_price_history_item (item_id, supplier_id, changed_on),
  CONSTRAINT fk_item_supplier_price_history_item FOREIGN KEY (item_id)
    REFERENCES item_master (item_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_item_supplier_price_history_supplier FOREIGN KEY (supplier_id)
    REFERENCES supplier_master (supplier_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO item_supplier_price_history
  (item_id, supplier_id, previous_purchase_rate, new_purchase_rate,
   previous_currency_code, new_currency_code, change_type, effective_from,
   changed_by, changed_on)
SELECT S.item_id, S.supplier_id, NULL, S.purchase_rate,
  NULL, S.currency_code, 'BASELINE', S.effective_from,
  COALESCE(NULLIF(S.updated_by, ''), NULLIF(S.created_by, ''), 'SYSTEM'),
  COALESCE(S.updated_on, S.created_on, CURRENT_TIMESTAMP)
FROM item_supplier S
WHERE S.purchase_rate IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM item_supplier_price_history H
    WHERE H.item_id = S.item_id
      AND H.supplier_id = S.supplier_id
  );
