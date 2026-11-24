import assert from 'node:assert/strict';
import { db } from '../src/config/db.js';
import * as customers from '../src/modules/customer/customer.service.js';
import * as suppliers from '../src/modules/supplier/supplier.service.js';
import * as supplierLookup from '../src/modules/supplier-assignment/supplier-assignment.repository.js';

const tag = `MASTER-TEST-${Date.now()}`;
const administrator = { userCode: 'SYSTEM', role: 'ADMINISTRATOR' };
const createdCustomers = [];
const createdSuppliers = [];
try {
  const [keys] = await db.query(`SELECT TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='customer_master'
      AND COLUMN_NAME LIKE '%supplier_id'`);
  assert.equal(keys.length, 0, 'Purchase foreign keys must reference supplier_master');
  const customer = await customers.createCustomer({customerName:tag, customerType:'OEM', customerCode:'MANUAL-IGNORED'}, administrator);
  createdCustomers.push(customer.customerId);
  assert.match(customer.customerCode, /^CUS\//);
  const first = await suppliers.createSupplier({supplierName:tag, supplierType:'Manufacturer', supplierCode:'MANUAL-IGNORED'}, administrator);
  createdSuppliers.push(first.supplierId);
  const second = await suppliers.createSupplier({supplierName:tag+'-2', supplierType:'Dealer'}, administrator);
  createdSuppliers.push(second.supplierId);
  assert.match(first.supplierCode, /^SUP\//);
  assert.notEqual(first.supplierCode, second.supplierCode);
  await customers.updateCustomer(customer.customerId, {customerName:tag,customerType:'Others',city:'Chennai',paymentTerms:'30 days',transportMode:'Road'}, administrator);
  await suppliers.updateSupplier(first.supplierId, {supplierName:tag,supplierType:'Dealer',city:'Coimbatore',address:'Supplier warehouse',paymentTerms:'Advance',transportMode:'Air'}, administrator);
  const updatedCustomer = await customers.getCustomer(customer.customerId);
  const updatedSupplier = await suppliers.getSupplier(first.supplierId);
  assert.equal(updatedCustomer.customer_type,'OTHERS');
  assert.equal(updatedCustomer.payment_terms,'30 days');
  assert.equal(updatedCustomer.transport_mode,'Road');
  assert.equal(updatedCustomer.city,'Chennai');
  assert.equal(updatedSupplier.supplier_type,'DEALER');
  assert.equal(updatedSupplier.payment_terms,'Advance');
  assert.equal(updatedSupplier.transport_mode,'Air');
  assert.equal(updatedSupplier.address,'Supplier warehouse');
  assert.equal((await supplierLookup.getSupplier(db,first.supplierId)).billingAddress,'Supplier warehouse');
  assert.equal(updatedSupplier.city,'Coimbatore');
  assert.equal(updatedSupplier.supplier_code,first.supplierCode);
  assert.equal((await supplierLookup.getSupplier(db,first.supplierId)).supplierCode,first.supplierCode);
  assert.equal((await customers.listCustomers({search:tag})).total,1);
  assert.equal((await suppliers.listSuppliers({search:tag})).total,2);
  await suppliers.changeSupplierStatus(first.supplierId,{supplierStatus:'INACTIVE'},'SYSTEM');
  assert.equal(await supplierLookup.getSupplier(db,first.supplierId),null);
  assert.equal((await customers.getCustomer(customer.customerId)).active_flag,'Y');
  assert.equal((await suppliers.listSuppliers({search:tag,activeFlag:'Y'})).total,1);
  await assert.rejects(suppliers.createSupplier({supplierName:tag}, administrator),/Supplier Type/);
  await assert.rejects(customers.createCustomer({customerName:tag}, administrator),/Customer Type/);
  await assert.rejects(customers.createCustomer({customerName:tag,customerType:'Dealer'}, administrator),/Customer Type/);
  await assert.rejects(suppliers.createSupplier({supplierName:tag,supplierType:'OEM'}, administrator),/Supplier Type/);
  const [legacy] = await db.query("SELECT customer_id FROM customer_master WHERE party_type='SUPPLIER' LIMIT 1");
  if (legacy.length) await assert.rejects(customers.getCustomer(legacy[0].customer_id),/not found/);
  const [views] = await db.query("SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'vw_purchase%'");
  for (const view of views) await db.query('SELECT * FROM `'+view.TABLE_NAME.replaceAll('`','``')+'` LIMIT 0');
  console.log('PASS: independent masters, generated codes, type updates, status isolation, customer role filtering, migrated FKs and purchase views.');
} finally {
  for (const id of createdSuppliers) await db.execute('DELETE FROM supplier_master WHERE supplier_id=? AND supplier_name LIKE ?', [id,tag+'%']);
  for (const id of createdCustomers) await db.execute('DELETE FROM customer_master WHERE customer_id=? AND customer_name=?', [id,tag]);
  await db.end();
}
