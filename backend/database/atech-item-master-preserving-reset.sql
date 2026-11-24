-- ============================================================================
-- A TECH AUTOMATION ERP + CMS - ITEM MASTER PRESERVING RESET
-- Generated from the current schema. Target: MySQL 8.0+ / Adminer.
--
-- PURPOSE
--   Delete all business and workflow data while retaining Item Master, its
--   required catalogue records (group/type/UOM/material/grade/specification),
--   the system enquiry lookup values, document-sequence configuration and
--   application user accounts.
--
-- DELETED
--   Customer, Supplier, Part, BOM, Process Plan, Inspection Plan, Sales and
--   CMS Labour enquiries, feasibility, workout, quotation, purchase, GRN,
--   inventory, tooling, gauge, attachments metadata, audit data and sessions.
--
-- NOT DELETED
--   Item Master and its item-specific data, installed-machine configuration,
--   warehouse/location configuration, app_users, static marketing reference
--   values and document-sequence configuration. Existing users
--   must sign in again because all server-side sessions are removed.
--
-- SAFETY
--   1. Stop the backend and take verified backups of atech_erp and cms_erp.
--   2. The script starts in PREVIEW mode. It changes nothing until the
--      confirmation value below is changed from 0 to 1.
--   3. Uploaded files are not stored in MySQL. This removes only their
--      database metadata; archive physical upload files separately after
--      the reset is verified.
--   4. It resets visible document codes only. Internal AUTO_INCREMENT IDs
--      are deliberately not reset, which avoids foreign-key risk.
-- ============================================================================

-- Use the sequence table's collation so Adminer's session collation cannot conflict.
SET @atech_financial_year := _utf8mb4'2026-27' COLLATE utf8mb4_unicode_ci;
SET @atech_confirm_item_master_preserving_reset := 0; -- CHANGE TO 1 ONLY AFTER BACKUP

SELECT @atech_confirm_item_master_preserving_reset AS confirmation_required,
       @atech_financial_year AS financial_year_to_reset;

SELECT 'Before reset' AS checkpoint,
  (SELECT COUNT(*) FROM `atech_erp`.`customer_master`) AS customers,
  (SELECT COUNT(*) FROM `atech_erp`.`supplier_master`) AS suppliers,
  (SELECT COUNT(*) FROM `atech_erp`.`part_master`) AS parts,
  (SELECT COUNT(*) FROM `atech_erp`.`marketing_enquiries`) AS sales_enquiries,
  (SELECT COUNT(*) FROM `cms_erp`.`marketing_enquiries`) AS labour_enquiries,
  (SELECT COUNT(*) FROM `atech_erp`.`item_master`) AS retained_items;

START TRANSACTION;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- ATECH records removed. Foreign-key checks are disabled only for this
-- transaction because every non-preserved dependent table is cleared.
DELETE FROM `atech_erp`.`app_user_sessions` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`application_attachments` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`approval_level` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`approval_transaction` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`approval_workflow` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`audit_log` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`customer_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`customer_material_job_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`customer_material_job_transaction` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`department_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`gauge_history` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`gauge_id_sequence` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`gauge_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`gauge_movement_batches` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`goods_receipt_note_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`goods_receipt_notes` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`grn_inspection_characteristics` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`grn_rejection_attachments` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`grn_rejection_records` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`in_process_inspection_piece` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`in_process_inspection_requirement` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`in_process_inspection_run` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`in_process_inspection_sample` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_movement_documents` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_movement_lines` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_rejection_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_rejection_case_lines` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_rejection_cases` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_rejection_transaction` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_rework_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_stock_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_stock_status_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_stock_transaction` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`inventory_subinventory_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`item_supplier` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`item_supplier_price_history` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_enquiries` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_enquiry_parts` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_enquiry_revisions` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_feasibilities` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_quotation_emails` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_quotation_item_optional_costs` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_quotation_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_quotation_notes` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_quotations` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_regret_letter_emails` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_regret_letters` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_workout_notes` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_workout_process_costs` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_workout_subpart_process_costs` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_workout_subparts` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`marketing_workouts` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`material_gate_exits` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`material_outward_document_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`material_outward_documents` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`outsourcing_issue_wip_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`outsourcing_wip_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`outsourcing_wip_transaction` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_bill_of_material` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_inspection_characteristic` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_operation_inspection_plan` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_process_definition` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_process_operation` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`part_process_plan` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_enquiries` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_enquiry_item_suppliers` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_enquiry_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_enquiry_requests` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_gate_entries` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_order_approval_history` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_order_attachments` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_order_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_order_sources` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_orders` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_outbox_job` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_request_approval_history` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_request_item_approval_history` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_request_item_attachments` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_request_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_request_supplier_assignments` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_requests` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_rfq_documents` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_rfq_email_outbox` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`purchase_supplier_selections` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`quotation_notes_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`rejection_disposition_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`rejection_reason_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`rejection_resolution_requests` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`return_to_customer_document_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`return_to_customer_documents` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`return_to_vendor_document_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`return_to_vendor_documents` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`supplier_master` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`supplier_quotation_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`supplier_quotation_negotiation_history` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`supplier_quotations` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`tooling_item_metrics` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`tooling_regrind_batch_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`tooling_regrind_batches` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`tooling_regrind_inspection_measurements` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`tooling_stock_balance` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `atech_erp`.`tooling_stock_movements` WHERE @atech_confirm_item_master_preserving_reset = 1;

-- CMS Labour workflow records removed. The lookup copy is re-seeded below.
DELETE FROM `cms_erp`.`marketing_enquiries` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_enquiry_parts` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_enquiry_revisions` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_feasibilities` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_quotation_emails` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_quotation_item_optional_costs` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_quotation_items` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_quotation_notes` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_quotations` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_reference_values` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_regret_letter_emails` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_regret_letters` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_workout_notes` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_workout_process_costs` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_workout_subpart_process_costs` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_workout_subparts` WHERE @atech_confirm_item_master_preserving_reset = 1;
DELETE FROM `cms_erp`.`marketing_workouts` WHERE @atech_confirm_item_master_preserving_reset = 1;

-- CMS needs the shared enquiry dropdown values after its copy is cleared.
INSERT IGNORE INTO `cms_erp`.`marketing_reference_values`
SELECT * FROM `atech_erp`.`marketing_reference_values`
WHERE @atech_confirm_item_master_preserving_reset = 1;

-- Reset every configured visible document-code sequence for the selected FY.
UPDATE `atech_erp`.`app_document_sequences`
SET current_number = 0
WHERE @atech_confirm_item_master_preserving_reset = 1
  AND financial_year = CONVERT(@atech_financial_year USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

SELECT 'After reset' AS checkpoint,
  (SELECT COUNT(*) FROM `atech_erp`.`customer_master`) AS customers,
  (SELECT COUNT(*) FROM `atech_erp`.`supplier_master`) AS suppliers,
  (SELECT COUNT(*) FROM `atech_erp`.`part_master`) AS parts,
  (SELECT COUNT(*) FROM `atech_erp`.`marketing_enquiries`) AS sales_enquiries,
  (SELECT COUNT(*) FROM `cms_erp`.`marketing_enquiries`) AS labour_enquiries,
  (SELECT COUNT(*) FROM `atech_erp`.`item_master`) AS retained_items;

SELECT sequence_key, financial_year, prefix, current_number, number_padding
FROM `atech_erp`.`app_document_sequences`
WHERE financial_year = CONVERT(@atech_financial_year USING utf8mb4) COLLATE utf8mb4_unicode_ci
ORDER BY sequence_key;

SELECT IF(@atech_confirm_item_master_preserving_reset = 1,
  'Item Master preserving reset completed. Restart the backend and sign in again.',
  'PREVIEW ONLY: no data was changed. Set confirmation to 1 and rerun only after backup.') AS result;
