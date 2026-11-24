-- A TECH Automation - one-time Enquiry UAT cleanup
--
-- PURPOSE
--   Permanently removes ALL current enquiry-workflow data while retaining
--   customer, supplier, item, part and other master data.
--
-- INCLUDED
--   Enquiries, enquiry parts, revisions, feasibility, workouts, quotations,
--   regret letters, related child rows, customer-material job balances and
--   attachment metadata for enquiry-part drawings.
--
-- NOT INCLUDED
--   Master data, marketing_reference_values, stock/inventory and source
--   documents outside the enquiry workflow.
--
-- BEFORE RUNNING IN PRODUCTION
--   1. Take and verify a full database backup.
--   2. Stop the backend briefly so no user creates an enquiry during cleanup.
--   3. Run with @atech_confirm_enquiry_uat_purge = 0 and review the previews.
--   4. Change it to 1 only if every listed enquiry is UAT data.
--   5. Save the file-path query output; remove only those physical files from
--      the configured upload storage after the database transaction commits.
--
-- This script deliberately does NOT use SET FOREIGN_KEY_CHECKS = 0.

SET @atech_confirm_enquiry_uat_purge := 0;
SET @atech_reset_enquiry_document_numbers := 0;
SET @atech_financial_year := '2026-27';

DROP TEMPORARY TABLE IF EXISTS atech_uat_enquiry_parts;
DROP TEMPORARY TABLE IF EXISTS atech_uat_enquiries;

CREATE TEMPORARY TABLE atech_uat_enquiries (
  enquiry_id BIGINT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

-- All existing enquiries are being treated as UAT data for this one-time run.
INSERT INTO atech_uat_enquiries (enquiry_id)
SELECT enquiry_id
FROM marketing_enquiries;

CREATE TEMPORARY TABLE atech_uat_enquiry_parts (
  enquiry_part_id BIGINT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

INSERT INTO atech_uat_enquiry_parts (enquiry_part_id)
SELECT P.enquiry_part_id
FROM marketing_enquiry_parts P
JOIN atech_uat_enquiries E ON E.enquiry_id = P.enquiry_id;

-- Review these records before enabling the purge.
SELECT
  E.enquiry_id,
  E.doc_no,
  E.customer_name_snapshot,
  E.enquiry_status,
  E.active_flag,
  E.created_by,
  E.created_on
FROM marketing_enquiries E
JOIN atech_uat_enquiries U ON U.enquiry_id = E.enquiry_id
ORDER BY E.enquiry_id;

-- Save this result before purge. SQL deletes file metadata but cannot delete
-- the corresponding files on the server filesystem/object store.
SELECT
  'ENQUIRY_PART_ATTACHMENT' AS document_source,
  A.file_path AS stored_file_path
FROM application_attachments A
JOIN atech_uat_enquiry_parts P ON P.enquiry_part_id = A.entity_id
WHERE A.entity_type = 'ENQUIRY_PART';

SELECT
  'QUOTATION_PDF' AS document_source,
  Q.pdf_file_path AS stored_file_path
FROM marketing_quotations Q
JOIN atech_uat_enquiries E ON E.enquiry_id = Q.enquiry_id
WHERE Q.pdf_file_path IS NOT NULL AND Q.pdf_file_path <> '';

SELECT
  'REGRET_LETTER' AS document_source,
  R.file_path AS stored_file_path
FROM marketing_regret_letters R
JOIN atech_uat_enquiries E ON E.enquiry_id = R.enquiry_id
WHERE R.file_path IS NOT NULL AND R.file_path <> '';

SELECT 'Enquiries' AS data_set, COUNT(*) AS row_count FROM atech_uat_enquiries;
SELECT 'Enquiry parts' AS data_set, COUNT(*) AS row_count FROM atech_uat_enquiry_parts;
SELECT 'Feasibilities' AS data_set, COUNT(*) AS row_count
FROM marketing_feasibilities F JOIN atech_uat_enquiries E ON E.enquiry_id = F.enquiry_id;
SELECT 'Workouts' AS data_set, COUNT(*) AS row_count
FROM marketing_workouts W JOIN atech_uat_enquiries E ON E.enquiry_id = W.enquiry_id;
SELECT 'Quotations' AS data_set, COUNT(*) AS row_count
FROM marketing_quotations Q JOIN atech_uat_enquiries E ON E.enquiry_id = Q.enquiry_id;
SELECT 'Regret letters' AS data_set, COUNT(*) AS row_count
FROM marketing_regret_letters R JOIN atech_uat_enquiries E ON E.enquiry_id = R.enquiry_id;
SELECT 'Enquiry attachments' AS data_set, COUNT(*) AS row_count
FROM application_attachments A
JOIN atech_uat_enquiry_parts P ON P.enquiry_part_id = A.entity_id
WHERE A.entity_type = 'ENQUIRY_PART';

START TRANSACTION;

-- Generic attachments have no database foreign key. Delete their metadata
-- explicitly; their physical files are handled from the preview above.
DELETE A
FROM application_attachments A
JOIN atech_uat_enquiry_parts P ON P.enquiry_part_id = A.entity_id
WHERE A.entity_type = 'ENQUIRY_PART'
  AND @atech_confirm_enquiry_uat_purge = 1;

-- This table has a restrictive FK to marketing_enquiries.
DELETE B
FROM customer_material_job_balance B
JOIN atech_uat_enquiries E ON E.enquiry_id = B.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

-- Delete quotation headers first. Their items, notes, optional costs and
-- email rows are removed through the existing cascade relationships.
DELETE Q
FROM marketing_quotations Q
JOIN atech_uat_enquiries E ON E.enquiry_id = Q.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

-- Delete regret letters before feasibility records; their email rows cascade.
DELETE R
FROM marketing_regret_letters R
JOIN atech_uat_enquiries E ON E.enquiry_id = R.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

-- Workout costs, notes and subpart data cascade from workout headers.
DELETE W
FROM marketing_workouts W
JOIN atech_uat_enquiries E ON E.enquiry_id = W.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

DELETE F
FROM marketing_feasibilities F
JOIN atech_uat_enquiries E ON E.enquiry_id = F.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

DELETE R
FROM marketing_enquiry_revisions R
JOIN atech_uat_enquiries E ON E.enquiry_id = R.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

DELETE P
FROM marketing_enquiry_parts P
JOIN atech_uat_enquiry_parts U ON U.enquiry_part_id = P.enquiry_part_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

DELETE E
FROM marketing_enquiries E
JOIN atech_uat_enquiries U ON U.enquiry_id = E.enquiry_id
WHERE @atech_confirm_enquiry_uat_purge = 1;

-- Optional: set to 1 only when new live document numbers should begin at 0001
-- for the stated financial year. This does not affect other module sequences.
UPDATE app_document_sequences
SET current_number = 0
WHERE @atech_confirm_enquiry_uat_purge = 1
  AND @atech_reset_enquiry_document_numbers = 1
  AND financial_year = @atech_financial_year
  AND sequence_key IN ('ENQUIRY', 'QUOTATION');

COMMIT;

SELECT
  @atech_confirm_enquiry_uat_purge AS purge_executed,
  @atech_reset_enquiry_document_numbers AS document_numbers_reset,
  (SELECT COUNT(*) FROM marketing_enquiries) AS enquiries_remaining,
  (SELECT COUNT(*) FROM marketing_enquiry_parts) AS enquiry_parts_remaining,
  (SELECT COUNT(*) FROM marketing_feasibilities) AS feasibilities_remaining,
  (SELECT COUNT(*) FROM marketing_workouts) AS workouts_remaining,
  (SELECT COUNT(*) FROM marketing_quotations) AS quotations_remaining;

DROP TEMPORARY TABLE IF EXISTS atech_uat_enquiry_parts;
DROP TEMPORARY TABLE IF EXISTS atech_uat_enquiries;
