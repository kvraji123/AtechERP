CREATE TABLE IF NOT EXISTS department_master (
  department_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_code VARCHAR(50) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
  created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (department_id),
  UNIQUE KEY uq_department_master_code (department_code),
  UNIQUE KEY uq_department_master_name (department_name),
  KEY ix_department_master_active_order (active_flag, display_order, department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO department_master (department_code,department_name,display_order,active_flag) VALUES
  ('PRODUCTION','Production',10,'Y'),
  ('ASSEMBLY','Assembly',15,'Y'),
  ('QUALITY','Quality',20,'Y'),
  ('MACHINE_SHOP','Machine Shop',25,'Y'),
  ('TOOLING','Tooling',30,'Y'),
  ('STORES','Stores',35,'Y'),
  ('MAINTENANCE','Maintenance',40,'Y'),
  ('PLANNING','Planning',45,'Y'),
  ('FIXTURE','Fixture',50,'Y'),
  ('PURCHASE','Purchase',55,'Y'),
  ('HR','HR',60,'Y'),
  ('MARKETING','Marketing',65,'Y'),
  ('ERP','ERP',70,'Y'),
  ('DESIGN_DEVELOPMENT','Design & Development',75,'Y'),
  ('ACCOUNTS','Accounts',80,'Y'),
  ('DISPATCH','Dispatch',85,'Y'),
  ('ADMINISTRATION','Administration',90,'Y')
ON DUPLICATE KEY UPDATE
  department_name=VALUES(department_name),
  display_order=VALUES(display_order);
