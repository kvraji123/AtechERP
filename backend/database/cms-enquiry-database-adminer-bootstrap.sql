-- Run this one time as a MySQL server administrator (for example root), not
-- as atech_user. It creates the CMS schema and grants the application/Adminer
-- user the permissions required by the CMS enquiry migration and application.
--
-- The host below matches the Adminer error: atech_user@localhost.
-- If that account has not yet been created on the new server, create it first
-- as the MySQL administrator, using a strong password that is also set in the
-- backend .env file:
-- CREATE USER 'atech_user'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';

CREATE DATABASE IF NOT EXISTS `cms_erp`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- The same application account needs the current ERP database privileges on a
-- new server as well as the CMS privileges below.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `atech_erp`.*
  TO 'atech_user'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `cms_erp`.*
  TO 'atech_user'@'localhost';

-- CMS foreign keys reference these shared ATECH master tables.
-- REFERENCES is included in the grant above.

FLUSH PRIVILEGES;

