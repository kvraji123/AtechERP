-- Prefix-search indexes for Customer Master lookup fields.
-- Safe to re-run in MySQL 5.7+ / MySQL 8.0+.

SET @atech_customer_lookup_code_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_master' AND INDEX_NAME = 'ix_customer_lookup_code'),
  'SELECT 1',
  'ALTER TABLE customer_master ADD KEY ix_customer_lookup_code (active_flag, party_type, customer_code)'
);
PREPARE atech_customer_lookup_code_statement FROM @atech_customer_lookup_code_sql;
EXECUTE atech_customer_lookup_code_statement;
DEALLOCATE PREPARE atech_customer_lookup_code_statement;

SET @atech_customer_lookup_name_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_master' AND INDEX_NAME = 'ix_customer_lookup_name'),
  'SELECT 1',
  'ALTER TABLE customer_master ADD KEY ix_customer_lookup_name (active_flag, party_type, customer_name)'
);
PREPARE atech_customer_lookup_name_statement FROM @atech_customer_lookup_name_sql;
EXECUTE atech_customer_lookup_name_statement;
DEALLOCATE PREPARE atech_customer_lookup_name_statement;

SET @atech_customer_lookup_short_name_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_master' AND INDEX_NAME = 'ix_customer_lookup_short_name'),
  'SELECT 1',
  'ALTER TABLE customer_master ADD KEY ix_customer_lookup_short_name (active_flag, party_type, customer_short_name)'
);
PREPARE atech_customer_lookup_short_name_statement FROM @atech_customer_lookup_short_name_sql;
EXECUTE atech_customer_lookup_short_name_statement;
DEALLOCATE PREPARE atech_customer_lookup_short_name_statement;
