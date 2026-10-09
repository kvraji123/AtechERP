import assert from 'node:assert/strict';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { listLocations, validateStorageLocation } from '../src/modules/inventory/inventory-location.repository.js';
import * as gauges from '../src/modules/gauge/gauge.repository.js';

const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  const tenantId = env.defaultTenantId;
  const locations = await listLocations(tenantId, connection);
  const rack = locations.find((row) => row.warehouseCode === 'Main Stores' && row.binLocation === 'Gauge Rack');
  assert.ok(rack, 'Gauge Rack must exist');
  assert.equal(await validateStorageLocation(connection,tenantId,rack.locationId),rack.locationId);
  await assert.rejects(validateStorageLocation(connection,'__OTHER_TENANT__',rack.locationId));
  await assert.rejects(validateStorageLocation(connection,tenantId,'invalid'));
  await connection.execute("UPDATE inventory_locations SET active_flag='N' WHERE location_id=?",[rack.locationId]);
  await assert.rejects(validateStorageLocation(connection,tenantId,rack.locationId));
  await connection.execute("UPDATE inventory_locations SET active_flag='Y' WHERE location_id=?",[rack.locationId]);
  const [existing] = await connection.execute('SELECT gauge_master_id AS id FROM gauge_master WHERE tenant_id=? LIMIT 1',[tenantId]);
  assert.ok(existing.length, 'Requires one existing gauge for rollback-only verification');
  const gauge = await gauges.getGaugeById(existing[0].id,tenantId,connection,true);
  const createdId = await gauges.insertGauge(connection,{
    ...gauge, gaugeId:`LOCATION-TEST-${Date.now()}`, storageLocationId:rack.locationId,
  },'LOCATION_TEST');
  const created = await gauges.getGaugeById(createdId,tenantId,connection);
  assert.equal(created.storageLocationId,rack.locationId);
  assert.equal(created.storageLocation,'Main Stores / Gauge Rack');
  await gauges.updateGaugeDetails(connection,gauge.gaugeMasterId,{...gauge,storageLocationId:rack.locationId},'LOCATION_TEST');
  await gauges.updateLifecycle(connection,gauge.gaugeMasterId,{operationalStatus:'ISSUED',currentLocation:'Test Production',assignedTo:'TEST'},'LOCATION_TEST');
  const issued = await gauges.getGaugeById(gauge.gaugeMasterId,tenantId,connection);
  assert.equal(issued.storageLocation,'Main Stores / Gauge Rack');
  assert.equal(issued.currentLocation,'Test Production');
  await gauges.updateLifecycle(connection,gauge.gaugeMasterId,{operationalStatus:'AVAILABLE',currentLocation:issued.storageLocation,assignedTo:null},'LOCATION_TEST');
  const returned = await gauges.getGaugeById(gauge.gaugeMasterId,tenantId,connection);
  assert.equal(returned.storageLocationId,rack.locationId);
  assert.equal(returned.currentLocation,returned.storageLocation);
  assert.equal(returned.assignedTo,null);
  console.log('PASS: rack lookup, tenant isolation, inactive/invalid location rejection, storage link persistence through issue and return. All test changes rolled back.');
} finally {
  await connection.rollback();
  connection.release();
  await db.end();
}
