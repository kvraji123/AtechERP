CREATE TABLE IF NOT EXISTS marketing_quotation_item_optional_costs (
  quotation_item_optional_cost_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_item_id BIGINT UNSIGNED NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  amount_foreign DECIMAL(18,4) NOT NULL DEFAULT 0,
  charge_basis VARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
  display_order INT UNSIGNED NOT NULL DEFAULT 1,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_item_optional_cost_id),
  UNIQUE KEY uq_quotation_item_optional_cost_type (quotation_item_id, cost_type),
  KEY ix_quotation_item_optional_costs_item (quotation_item_id, display_order),
  CONSTRAINT fk_quotation_item_optional_cost_item FOREIGN KEY (quotation_item_id)
    REFERENCES marketing_quotation_items (quotation_item_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
