import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';

try {
  await db.query(`CREATE TABLE IF NOT EXISTS inventory_locations (
    location_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    warehouse_code VARCHAR(80) NOT NULL,
    bin_location VARCHAR(80) NOT NULL,
    active_flag ENUM('Y','N') NOT NULL DEFAULT 'Y',
    UNIQUE KEY uq_inventory_location (tenant_id,warehouse_code,bin_location),
    UNIQUE KEY uq_inventory_location_tenant (tenant_id,location_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [columns] = await db.query("SHOW COLUMNS FROM gauge_master LIKE 'storage_location_id'");
  if (!columns.length) await db.query(`ALTER TABLE gauge_master
    ADD storage_location_id BIGINT UNSIGNED NULL,
    ADD CONSTRAINT fk_gauge_storage_location FOREIGN KEY (tenant_id,storage_location_id)
      REFERENCES inventory_locations(tenant_id,location_id)`);
  await db.execute(`INSERT INTO inventory_locations (tenant_id,warehouse_code,bin_location,active_flag)
    VALUES (?,'Main Stores','Gauge Rack','Y'),(?,'Calibration Hold','Dispatch Rack','Y')
    ON DUPLICATE KEY UPDATE active_flag='Y'`, [env.defaultTenantId,env.defaultTenantId]);
  const [rows] = await db.execute('SELECT * FROM inventory_locations WHERE tenant_id=?', [env.defaultTenantId]);
  console.log(JSON.stringify(rows));
} finally { await db.end(); }
