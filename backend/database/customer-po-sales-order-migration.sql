-- ============================================================================
-- Customer Purchase Order -> Sales Order workflow
-- Run after the Marketing quotation workflow schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_purchase_orders (
  customer_purchase_order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  cpo_number VARCHAR(50) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  customer_po_number VARCHAR(100) NULL,
  customer_po_date DATE NULL,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  enquiry_doc_no_snapshot VARCHAR(50) NOT NULL,
  quotation_id BIGINT UNSIGNED NOT NULL,
  quotation_no_snapshot VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_code_snapshot VARCHAR(50) NULL,
  customer_name_snapshot VARCHAR(200) NOT NULL,
  order_type_snapshot VARCHAR(20) NOT NULL,
  currency_code VARCHAR(10) NOT NULL,
  required_delivery_date DATE NULL,
  payment_terms VARCHAR(500) NULL,
  delivery_terms VARCHAR(500) NULL,
  attachment_reference VARCHAR(500) NULL,
  remarks TEXT NULL,
  subtotal_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  development_cost_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  grand_total_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  status ENUM('DRAFT','CONFIRMED','PARTIALLY_CONVERTED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  confirmed_by VARCHAR(50) NULL,
  confirmed_on TIMESTAMP NULL,
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_purchase_order_id),
  UNIQUE KEY uq_customer_purchase_order_number (tenant_id, cpo_number),
  UNIQUE KEY uq_customer_purchase_order_customer_reference (tenant_id, customer_id, customer_po_number),
  KEY ix_customer_purchase_order_enquiry (enquiry_id, status),
  KEY ix_customer_purchase_order_customer (tenant_id, customer_id, status),
  KEY ix_customer_purchase_order_quotation (quotation_id),
  CONSTRAINT fk_customer_purchase_order_enquiry FOREIGN KEY (enquiry_id)
    REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_customer_purchase_order_quotation FOREIGN KEY (quotation_id)
    REFERENCES marketing_quotations (quotation_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_customer_purchase_order_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master (customer_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_purchase_order_items (
  customer_purchase_order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  customer_purchase_order_id BIGINT UNSIGNED NOT NULL,
  quotation_item_id BIGINT UNSIGNED NOT NULL,
  enquiry_part_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(100) NULL,
  drawing_number_snapshot VARCHAR(100) NOT NULL,
  revision_number_snapshot VARCHAR(50) NULL,
  description_snapshot VARCHAR(500) NOT NULL,
  material_snapshot VARCHAR(300) NULL,
  uom_snapshot VARCHAR(30) NULL,
  required_quantity_snapshot DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  ordered_quantity DECIMAL(14,3) NOT NULL,
  converted_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  unit_price DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  development_cost_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  line_total_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  line_status ENUM('OPEN','PARTIALLY_CONVERTED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50) NULL,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_purchase_order_item_id),
  UNIQUE KEY uq_customer_purchase_order_item_line (customer_purchase_order_id, line_number),
  UNIQUE KEY uq_customer_purchase_order_item_source (customer_purchase_order_id, quotation_item_id),
  KEY ix_customer_purchase_order_item_quotation (quotation_item_id),
  KEY ix_customer_purchase_order_item_part (enquiry_part_id),
  CONSTRAINT fk_customer_purchase_order_item_header FOREIGN KEY (customer_purchase_order_id)
    REFERENCES customer_purchase_orders (customer_purchase_order_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_customer_purchase_order_item_quotation FOREIGN KEY (quotation_item_id)
    REFERENCES marketing_quotation_items (quotation_item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_customer_purchase_order_item_part FOREIGN KEY (enquiry_part_id)
    REFERENCES marketing_enquiry_parts (enquiry_part_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_customer_purchase_order_item_quantities CHECK (
    ordered_quantity > 0 AND converted_quantity >= 0 AND converted_quantity <= ordered_quantity
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_orders (
  sales_order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  sales_order_number VARCHAR(50) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  sales_order_date DATE NOT NULL,
  customer_purchase_order_id BIGINT UNSIGNED NOT NULL,
  customer_purchase_order_number_snapshot VARCHAR(50) NOT NULL,
  customer_po_number_snapshot VARCHAR(100) NULL,
  enquiry_id BIGINT UNSIGNED NOT NULL,
  enquiry_doc_no_snapshot VARCHAR(50) NOT NULL,
  quotation_id BIGINT UNSIGNED NOT NULL,
  quotation_no_snapshot VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_code_snapshot VARCHAR(50) NULL,
  customer_name_snapshot VARCHAR(200) NOT NULL,
  order_type_snapshot VARCHAR(20) NOT NULL,
  currency_code VARCHAR(10) NOT NULL,
  required_delivery_date DATE NULL,
  payment_terms VARCHAR(500) NULL,
  delivery_terms VARCHAR(500) NULL,
  remarks TEXT NULL,
  grand_total_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  status ENUM('OPEN','PARTIALLY_FULFILLED','FULFILLED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sales_order_id),
  UNIQUE KEY uq_sales_order_number (tenant_id, sales_order_number),
  KEY ix_sales_order_customer_po (tenant_id, customer_purchase_order_id),
  KEY ix_sales_order_customer (tenant_id, customer_id, status),
  CONSTRAINT fk_sales_order_customer_purchase_order FOREIGN KEY (customer_purchase_order_id)
    REFERENCES customer_purchase_orders (customer_purchase_order_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sales_order_enquiry FOREIGN KEY (enquiry_id)
    REFERENCES marketing_enquiries (enquiry_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sales_order_quotation FOREIGN KEY (quotation_id)
    REFERENCES marketing_quotations (quotation_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sales_order_customer FOREIGN KEY (customer_id)
    REFERENCES customer_master (customer_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_order_items (
  sales_order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  sales_order_id BIGINT UNSIGNED NOT NULL,
  customer_purchase_order_item_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  item_code_snapshot VARCHAR(100) NULL,
  drawing_number_snapshot VARCHAR(100) NOT NULL,
  revision_number_snapshot VARCHAR(50) NULL,
  description_snapshot VARCHAR(500) NOT NULL,
  material_snapshot VARCHAR(300) NULL,
  uom_snapshot VARCHAR(30) NULL,
  ordered_quantity DECIMAL(14,3) NOT NULL,
  unit_price DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  development_cost_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  line_total_amount DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  line_status ENUM('OPEN','PARTIALLY_FULFILLED','FULFILLED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(50) NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sales_order_item_id),
  UNIQUE KEY uq_sales_order_item_line (sales_order_id, line_number),
  KEY ix_sales_order_item_customer_po_line (customer_purchase_order_item_id),
  CONSTRAINT fk_sales_order_item_header FOREIGN KEY (sales_order_id)
    REFERENCES sales_orders (sales_order_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sales_order_item_customer_po_line FOREIGN KEY (customer_purchase_order_item_id)
    REFERENCES customer_purchase_order_items (customer_purchase_order_item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sales_order_item_quantity CHECK (ordered_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_document_sequences
  (sequence_key, financial_year, prefix, current_number, number_padding)
VALUES
  ('CUSTOMER_PURCHASE_ORDER',
   CONCAT(IF(MONTH(CURRENT_DATE) >= 4, YEAR(CURRENT_DATE), YEAR(CURRENT_DATE) - 1), '-',
          RIGHT(IF(MONTH(CURRENT_DATE) >= 4, YEAR(CURRENT_DATE) + 1, YEAR(CURRENT_DATE)), 2)),
   'CPO', 0, 4),
  ('SALES_ORDER',
   CONCAT(IF(MONTH(CURRENT_DATE) >= 4, YEAR(CURRENT_DATE), YEAR(CURRENT_DATE) - 1), '-',
          RIGHT(IF(MONTH(CURRENT_DATE) >= 4, YEAR(CURRENT_DATE) + 1, YEAR(CURRENT_DATE)), 2)),
   'SO', 0, 4)
ON DUPLICATE KEY UPDATE current_number = current_number;
