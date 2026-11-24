-- CMS Labour Enquiry database provisioning for Adminer / MySQL 8.0+
--
-- Prerequisite: import cms-enquiry-database-adminer-bootstrap.sql once as a
-- MySQL administrator. Then import this file as atech_user in Adminer.
-- The atech_user login needs CREATE, ALTER, INDEX and REFERENCES privileges
-- for cms_erp, and REFERENCES privilege for atech_erp.
--
-- Sales enquiry workflow records remain in atech_erp.
-- Labour enquiry workflow records are created in cms_erp.
-- customer_master, supplier_master, part_master and process plans remain in
-- atech_erp; they are deliberately not copied into cms_erp.
--
-- This script is safe to import again: existing tables, indexes and foreign
-- keys are retained. It does not copy Sales enquiries into CMS.

-- CREATE TABLE ... LIKE copies the table definition and every index from the
-- current atech_erp marketing schema. MySQL does not copy foreign keys with
-- LIKE, so they are restored below.
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_enquiries` LIKE `atech_erp`.`marketing_enquiries`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_enquiry_parts` LIKE `atech_erp`.`marketing_enquiry_parts`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_enquiry_revisions` LIKE `atech_erp`.`marketing_enquiry_revisions`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_feasibilities` LIKE `atech_erp`.`marketing_feasibilities`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_quotation_emails` LIKE `atech_erp`.`marketing_quotation_emails`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_quotation_item_optional_costs` LIKE `atech_erp`.`marketing_quotation_item_optional_costs`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_quotation_items` LIKE `atech_erp`.`marketing_quotation_items`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_quotation_notes` LIKE `atech_erp`.`marketing_quotation_notes`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_quotations` LIKE `atech_erp`.`marketing_quotations`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_reference_values` LIKE `atech_erp`.`marketing_reference_values`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_regret_letter_emails` LIKE `atech_erp`.`marketing_regret_letter_emails`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_regret_letters` LIKE `atech_erp`.`marketing_regret_letters`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_workout_notes` LIKE `atech_erp`.`marketing_workout_notes`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_workout_process_costs` LIKE `atech_erp`.`marketing_workout_process_costs`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_workout_subpart_process_costs` LIKE `atech_erp`.`marketing_workout_subpart_process_costs`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_workout_subparts` LIKE `atech_erp`.`marketing_workout_subparts`;
CREATE TABLE IF NOT EXISTS `cms_erp`.`marketing_workouts` LIKE `atech_erp`.`marketing_workouts`;

-- Start CMS workflow identifiers at a separate range. This lets the API find
-- the correct database from an enquiry or enquiry-part ID without collisions.
ALTER TABLE `cms_erp`.`marketing_enquiries` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_enquiry_parts` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_enquiry_revisions` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_feasibilities` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_quotation_emails` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_quotation_item_optional_costs` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_quotation_items` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_quotation_notes` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_quotations` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_reference_values` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_regret_letter_emails` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_regret_letters` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_workout_notes` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_workout_process_costs` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_workout_subpart_process_costs` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_workout_subparts` AUTO_INCREMENT=1000000000;
ALTER TABLE `cms_erp`.`marketing_workouts` AUTO_INCREMENT=1000000000;

-- Keep the CMS lookup copy aligned with the primary marketing reference data.
INSERT IGNORE INTO `cms_erp`.`marketing_reference_values`
SELECT * FROM `atech_erp`.`marketing_reference_values`;

-- Each block conditionally restores one foreign key. Prepared statements make
-- this repeatable on MySQL 8.0 without relying on unsupported ADD FK IF NOT EXISTS syntax.

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_enquiries` ADD CONSTRAINT `fk_marketing_enquiry_customer` FOREIGN KEY (`customer_id`) REFERENCES `atech_erp`.`customer_master` (`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_enquiries' AND constraint_name='fk_marketing_enquiry_customer');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_enquiry_parts` ADD CONSTRAINT `fk_marketing_enquiry_part_header` FOREIGN KEY (`enquiry_id`) REFERENCES `cms_erp`.`marketing_enquiries` (`enquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_enquiry_parts' AND constraint_name='fk_marketing_enquiry_part_header');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_enquiry_parts` ADD CONSTRAINT `fk_marketing_enquiry_part_master` FOREIGN KEY (`part_id`) REFERENCES `atech_erp`.`part_master` (`part_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_enquiry_parts' AND constraint_name='fk_marketing_enquiry_part_master');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_enquiry_revisions` ADD CONSTRAINT `fk_enquiry_revision_enquiry` FOREIGN KEY (`enquiry_id`) REFERENCES `cms_erp`.`marketing_enquiries` (`enquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_enquiry_revisions' AND constraint_name='fk_enquiry_revision_enquiry');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_feasibilities` ADD CONSTRAINT `fk_feasibility_enquiry` FOREIGN KEY (`enquiry_id`) REFERENCES `cms_erp`.`marketing_enquiries` (`enquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_feasibilities' AND constraint_name='fk_feasibility_enquiry');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_feasibilities` ADD CONSTRAINT `fk_feasibility_enquiry_part` FOREIGN KEY (`enquiry_part_id`) REFERENCES `cms_erp`.`marketing_enquiry_parts` (`enquiry_part_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_feasibilities' AND constraint_name='fk_feasibility_enquiry_part');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_emails` ADD CONSTRAINT `fk_quotation_email_header` FOREIGN KEY (`quotation_id`) REFERENCES `cms_erp`.`marketing_quotations` (`quotation_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_emails' AND constraint_name='fk_quotation_email_header');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_item_optional_costs` ADD CONSTRAINT `fk_quotation_item_optional_cost_item` FOREIGN KEY (`quotation_item_id`) REFERENCES `cms_erp`.`marketing_quotation_items` (`quotation_item_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_item_optional_costs' AND constraint_name='fk_quotation_item_optional_cost_item');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_items` ADD CONSTRAINT `fk_quotation_item_header` FOREIGN KEY (`quotation_id`) REFERENCES `cms_erp`.`marketing_quotations` (`quotation_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_items' AND constraint_name='fk_quotation_item_header');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_items` ADD CONSTRAINT `fk_quotation_item_part` FOREIGN KEY (`enquiry_part_id`) REFERENCES `cms_erp`.`marketing_enquiry_parts` (`enquiry_part_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_items' AND constraint_name='fk_quotation_item_part');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_items` ADD CONSTRAINT `fk_quotation_item_process_plan` FOREIGN KEY (`process_plan_id`) REFERENCES `atech_erp`.`part_process_plan` (`process_plan_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_items' AND constraint_name='fk_quotation_item_process_plan');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_items` ADD CONSTRAINT `fk_quotation_item_workout` FOREIGN KEY (`workout_id`) REFERENCES `cms_erp`.`marketing_workouts` (`workout_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_items' AND constraint_name='fk_quotation_item_workout');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotation_notes` ADD CONSTRAINT `fk_quotation_note_header` FOREIGN KEY (`quotation_id`) REFERENCES `cms_erp`.`marketing_quotations` (`quotation_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotation_notes' AND constraint_name='fk_quotation_note_header');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotations` ADD CONSTRAINT `fk_marketing_quotation_customer` FOREIGN KEY (`customer_id`) REFERENCES `atech_erp`.`customer_master` (`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotations' AND constraint_name='fk_marketing_quotation_customer');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_quotations` ADD CONSTRAINT `fk_marketing_quotation_enquiry` FOREIGN KEY (`enquiry_id`) REFERENCES `cms_erp`.`marketing_enquiries` (`enquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_quotations' AND constraint_name='fk_marketing_quotation_enquiry');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_regret_letter_emails` ADD CONSTRAINT `fk_regret_email_letter` FOREIGN KEY (`regret_letter_id`) REFERENCES `cms_erp`.`marketing_regret_letters` (`regret_letter_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_regret_letter_emails' AND constraint_name='fk_regret_email_letter');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_regret_letter_emails` ADD CONSTRAINT `fk_regret_email_part` FOREIGN KEY (`enquiry_part_id`) REFERENCES `cms_erp`.`marketing_enquiry_parts` (`enquiry_part_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_regret_letter_emails' AND constraint_name='fk_regret_email_part');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_regret_letters` ADD CONSTRAINT `fk_regret_letter_enquiry` FOREIGN KEY (`enquiry_id`) REFERENCES `cms_erp`.`marketing_enquiries` (`enquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_regret_letters' AND constraint_name='fk_regret_letter_enquiry');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_regret_letters` ADD CONSTRAINT `fk_regret_letter_enquiry_part` FOREIGN KEY (`enquiry_part_id`) REFERENCES `cms_erp`.`marketing_enquiry_parts` (`enquiry_part_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_regret_letters' AND constraint_name='fk_regret_letter_enquiry_part');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_regret_letters` ADD CONSTRAINT `fk_regret_letter_feasibility` FOREIGN KEY (`feasibility_id`) REFERENCES `cms_erp`.`marketing_feasibilities` (`feasibility_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_regret_letters' AND constraint_name='fk_regret_letter_feasibility');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workout_notes` ADD CONSTRAINT `fk_marketing_workout_note` FOREIGN KEY (`workout_id`) REFERENCES `cms_erp`.`marketing_workouts` (`workout_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workout_notes' AND constraint_name='fk_marketing_workout_note');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workout_process_costs` ADD CONSTRAINT `fk_marketing_workout_process` FOREIGN KEY (`workout_id`) REFERENCES `cms_erp`.`marketing_workouts` (`workout_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workout_process_costs' AND constraint_name='fk_marketing_workout_process');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workout_subpart_process_costs` ADD CONSTRAINT `fk_workout_subpart_process_subpart` FOREIGN KEY (`workout_subpart_id`) REFERENCES `cms_erp`.`marketing_workout_subparts` (`workout_subpart_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workout_subpart_process_costs' AND constraint_name='fk_workout_subpart_process_subpart');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workout_subparts` ADD CONSTRAINT `fk_workout_subpart_workout` FOREIGN KEY (`workout_id`) REFERENCES `cms_erp`.`marketing_workouts` (`workout_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workout_subparts' AND constraint_name='fk_workout_subpart_workout');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workouts` ADD CONSTRAINT `fk_marketing_workout_enquiry` FOREIGN KEY (`enquiry_id`) REFERENCES `cms_erp`.`marketing_enquiries` (`enquiry_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workouts' AND constraint_name='fk_marketing_workout_enquiry');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workouts` ADD CONSTRAINT `fk_marketing_workout_part` FOREIGN KEY (`enquiry_part_id`) REFERENCES `cms_erp`.`marketing_enquiry_parts` (`enquiry_part_id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workouts' AND constraint_name='fk_marketing_workout_part');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

SET @cms_fk_statement = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE `cms_erp`.`marketing_workouts` ADD CONSTRAINT `fk_workout_process_plan` FOREIGN KEY (`process_plan_id`) REFERENCES `atech_erp`.`part_process_plan` (`process_plan_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1') FROM information_schema.table_constraints WHERE constraint_schema='cms_erp' AND table_name='marketing_workouts' AND constraint_name='fk_workout_process_plan');
PREPARE cms_fk FROM @cms_fk_statement; EXECUTE cms_fk; DEALLOCATE PREPARE cms_fk;

