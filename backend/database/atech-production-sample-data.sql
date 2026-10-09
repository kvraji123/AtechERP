-- ============================================================================
-- A TECH AUTOMATION ERP - SAMPLE DATA
-- Run only AFTER atech-production-complete.sql in a non-production validation database.
-- Repeatable: records are matched by their DEMO codes and updated if present.
-- Remove or deactivate these records before entering real production data.
-- ============================================================================

USE `atech_erp`;
START TRANSACTION;

-- Demo customer
INSERT INTO customer_master
  (party_type, customer_code, customer_name, customer_short_name, plant_code,
   billing_address, delivery_address, city, state_name, country_name,
   mobile_number, email_address, invoice_type, currency_code,
   customer_status, active_flag, created_by)
VALUES
  ('CUSTOMER', 'CUS-DEMO-0001', 'Demo Automotive Components Pvt. Ltd.',
   'DEMO AUTO', 'CHN-01', '12 Industrial Estate, Chennai - 600058',
   '12 Industrial Estate, Chennai - 600058', 'Chennai', 'Tamil Nadu', 'India',
   '9000000001', 'purchase.demo@example.com', 'TAX_INVOICE', 'INR',
   'ACTIVE', 'Y', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  customer_name=VALUES(customer_name), billing_address=VALUES(billing_address),
  delivery_address=VALUES(delivery_address), active_flag='Y', updated_by='SYSTEM';

SET @demo_customer_id = (
  SELECT customer_id FROM customer_master WHERE customer_code='CUS-DEMO-0001'
);

-- Demo supplier
INSERT INTO supplier_master
  (supplier_code, supplier_name, supplier_short_name, plant_code,
   billing_address, city, state_name, country_name, mobile_number, email_address,
   currency_code, supplier_status, active_flag, created_by)
VALUES
  ('SUP-DEMO-0001', 'Demo Metals Supplier', 'DEMO METALS', 'CHN-S01',
   '25 SIDCO Industrial Estate, Chennai - 600098', 'Chennai', 'Tamil Nadu',
   'India', '9000000002', 'sales.demo@example.com', 'INR', 'ACTIVE', 'Y', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  supplier_name=VALUES(supplier_name), active_flag='Y', updated_by='SYSTEM';

SET @demo_supplier_id = (
  SELECT supplier_id FROM supplier_master WHERE supplier_code='SUP-DEMO-0001'
);
SET @mild_steel_id = (
  SELECT material_id FROM material_master WHERE material_name='Mild Steel' LIMIT 1
);
SET @en8_grade_id = (
  SELECT material_grade_id FROM material_grade_master
  WHERE material_id=@mild_steel_id AND grade_code='EN8' LIMIT 1
);
SET @nos_uom_id = (
  SELECT uom_id FROM uom_master WHERE uom_code='NOS' LIMIT 1
);

-- Demo Part Master record
INSERT INTO part_master
  (customer_id, part_category, part_name, part_number, drawing_number,
   drawing_revision_number, drawing_code_mode, drawing_code,
   material_specification, material_id, material_grade_id, part_weight,
   unit_of_measurement, uom_id, part_status, active_flag, project_name, created_by)
VALUES
  (@demo_customer_id, 'MACHINING', 'Demo Drive Shaft', 'PRT-DEMO-0001',
   'DWG-DEMO-1001', 'A', 'MANUAL', 'ITEM-DEMO-1001', 'Mild Steel / EN8',
   @mild_steel_id, @en8_grade_id, 2.750, 'NOS', @nos_uom_id,
   'ACTIVE', 'Y', 'Demo Production Trial', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  part_name=VALUES(part_name), material_id=VALUES(material_id),
  material_grade_id=VALUES(material_grade_id), uom_id=VALUES(uom_id),
  active_flag='Y', updated_by='SYSTEM';

SET @demo_part_id = (
  SELECT part_id FROM part_master WHERE part_number='PRT-DEMO-0001'
);

-- Demo Raw Material item and preferred supplier
SET @raw_material_group_id = (
  SELECT item_group_id FROM item_group_master WHERE group_code='RM' LIMIT 1
);
SET @rod_type_id = (
  SELECT item_type_id FROM item_type_master
  WHERE item_group_id=@raw_material_group_id AND type_name='Rod' LIMIT 1
);

INSERT INTO item_master
  (item_code, item_group_id, item_type_id, item_description, item_specification,
   uom_id, material_id, inspection_required, hsn_code, purchase_rate,
   minimum_stock, item_status, active_flag, created_by)
VALUES
  ('RM-DEMO-0001', @raw_material_group_id, @rod_type_id,
   'EN8 round rod for demo drive shaft', 'Diameter 50 mm', @nos_uom_id,
   @mild_steel_id, 'Y', '7214', 120.00, 10.000, 'ACTIVE', 'Y', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  item_description=VALUES(item_description), material_id=VALUES(material_id),
  active_flag='Y', updated_by='SYSTEM';

SET @demo_item_id = (
  SELECT item_id FROM item_master WHERE item_code='RM-DEMO-0001'
);

INSERT INTO item_supplier
  (item_id, supplier_id, purchase_rate, lead_time_days,
   preferred_supplier, remarks, created_by)
VALUES
  (@demo_item_id, @demo_supplier_id, 120.00, 7, 'Y',
   'Sample preferred supplier mapping', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  purchase_rate=VALUES(purchase_rate), lead_time_days=VALUES(lead_time_days),
  preferred_supplier='Y', updated_by='SYSTEM';

-- Approved regular-purchase PO with one open item. It supports the Regular
-- Purchase Gate Entry and GRN Inward path in the demo database.
INSERT INTO purchase_orders
  (tenant_id,company_id,plant_id,po_number,financial_year,po_date,supplier_id,
   supplier_code_snapshot,supplier_name_snapshot,supplier_address_snapshot,supplier_gst_snapshot,
   source_reference,billing_address_snapshot,delivery_address_snapshot,payment_terms,delivery_terms,
   expected_delivery_date,remarks,special_instructions,subtotal_amount,discount_amount,tax_amount,
   packing_amount,freight_amount,other_charges_amount,grand_total_amount,status,
   submitted_by,submitted_at,approved_by,approved_at,created_by)
VALUES
  ('DEFAULT','DEMO','CHN-01','PO-DEMO-REGULAR-001','2026-27',CURRENT_DATE,@demo_supplier_id,
   'SUP-DEMO-0001','Demo Metals Supplier','25 SIDCO Industrial Estate, Chennai - 600098',NULL,
   'Demo approved PO for GRN verification','A TECH Automation, Chennai','A TECH Automation, Chennai',
   '30 days credit','Deliver to stores',DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY),
   'Demo regular-purchase order with an open quantity.','Inspect before stock receipt.',
   1200.00,0.00,216.00,0.00,0.00,0.00,1416.00,'APPROVED',
   'SYSTEM',CURRENT_TIMESTAMP,'SYSTEM',CURRENT_TIMESTAMP,'SYSTEM')
ON DUPLICATE KEY UPDATE
  po_date=VALUES(po_date), supplier_id=VALUES(supplier_id),
  supplier_code_snapshot=VALUES(supplier_code_snapshot), supplier_name_snapshot=VALUES(supplier_name_snapshot),
  supplier_address_snapshot=VALUES(supplier_address_snapshot), source_reference=VALUES(source_reference),
  billing_address_snapshot=VALUES(billing_address_snapshot), delivery_address_snapshot=VALUES(delivery_address_snapshot),
  expected_delivery_date=VALUES(expected_delivery_date), remarks=VALUES(remarks),
  special_instructions=VALUES(special_instructions), subtotal_amount=VALUES(subtotal_amount),
  tax_amount=VALUES(tax_amount), grand_total_amount=VALUES(grand_total_amount),
  status='APPROVED', approved_by='SYSTEM', approved_at=CURRENT_TIMESTAMP, updated_by='SYSTEM';

SET @demo_regular_po_id = (
  SELECT purchase_order_id FROM purchase_orders
  WHERE tenant_id='DEFAULT' AND po_number='PO-DEMO-REGULAR-001'
);

INSERT INTO purchase_order_items
  (tenant_id,purchase_order_id,purchase_request_item_id,line_number,item_id,item_code_snapshot,
   item_type_snapshot,item_description_snapshot,item_specification_snapshot,uom_code_snapshot,
   hsn_code_snapshot,ordered_quantity,received_quantity,unit_price,discount_amount,tax_percent,
   tax_amount,packing_amount,freight_amount,other_charges_amount,line_total_amount,required_date,line_status)
VALUES
  ('DEFAULT',@demo_regular_po_id,NULL,1,@demo_item_id,'RM-DEMO-0001',
   'Rod','EN8 round rod for demo drive shaft','Diameter 50 mm','NOS',
   '7214',10.000,0.000,120.0000,0.00,18.0000,
   216.00,0.00,0.00,0.00,1416.00,DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY),'OPEN')
ON DUPLICATE KEY UPDATE
  item_id=VALUES(item_id), item_code_snapshot=VALUES(item_code_snapshot),
  item_type_snapshot=VALUES(item_type_snapshot), item_description_snapshot=VALUES(item_description_snapshot),
  item_specification_snapshot=VALUES(item_specification_snapshot), uom_code_snapshot=VALUES(uom_code_snapshot),
  hsn_code_snapshot=VALUES(hsn_code_snapshot), ordered_quantity=VALUES(ordered_quantity),
  unit_price=VALUES(unit_price), tax_percent=VALUES(tax_percent), tax_amount=VALUES(tax_amount),
  line_total_amount=VALUES(line_total_amount), required_date=VALUES(required_date),
  line_status='OPEN';

-- Demo submitted Enquiry ready for Feasibility
INSERT INTO marketing_enquiries
  (doc_no, customer_id, customer_code_snapshot, customer_name_snapshot,
   customer_short_name_snapshot, enquiry_mode, order_type, required_date,
   enquiry_status, enquiry_conversion, current_stage, revision_number,
   revision_date, save_status, remarks, active_flag, submitted_by,
   submitted_on, created_by)
VALUES
  ('ENQ-DEMO-0001', @demo_customer_id, 'CUS-DEMO-0001',
   'Demo Automotive Components Pvt. Ltd.', 'DEMO AUTO', 'MAIL', 'SALES',
   DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY), 'IN_PROGRESS', 'YET_TO_RECEIVE',
   'FEASIBILITY', 'REV00', CURRENT_DATE, 'SUBMITTED',
   'Sample enquiry for production verification', 'Y', 'SYSTEM',
   CURRENT_TIMESTAMP, 'SYSTEM')
ON DUPLICATE KEY UPDATE
  customer_id=VALUES(customer_id), current_stage='FEASIBILITY',
  save_status='SUBMITTED', active_flag='Y', updated_by='SYSTEM';

SET @demo_enquiry_id = (
  SELECT enquiry_id FROM marketing_enquiries WHERE doc_no='ENQ-DEMO-0001'
);

INSERT INTO marketing_enquiry_parts
  (enquiry_id, part_id, line_number, part_number, item_code, drawing_number,
   drawing_revision_number, product_description, material_and_grade,
   is_assembled_part, required_quantity, annual_quantity, moq, required_date,
   unit_of_measurement, part_status, save_status, active_flag, created_by)
VALUES
  (@demo_enquiry_id, @demo_part_id, 1, 'PRT-DEMO-0001', 'ITEM-DEMO-1001',
   'DWG-DEMO-1001', 'A', 'Demo Drive Shaft', 'Mild Steel / EN8', 0,
   100.000, 1200.000, 25.000, DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY),
   'NOS', 'PENDING_FEASIBILITY', 'SUBMITTED', 'Y', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  part_id=VALUES(part_id), product_description=VALUES(product_description),
  material_and_grade=VALUES(material_and_grade), active_flag='Y', updated_by='SYSTEM';

-- ============================================================================
-- GRN inward and rejection-inventory verification flow
-- ============================================================================
-- These records use the DEFAULT tenant, which is the tenant created by a clean
-- installation. They let testers verify the Gate Entry to GRN workflow without
-- changing document sequences used for normal transactions.

SET @demo_bore_characteristic_id = (
  SELECT characteristic_master_id FROM inspection_characteristic_master
  WHERE characteristic_code='BORE_DIA' LIMIT 1
);
SET @demo_micrometer_id = (
  SELECT instrument_master_id FROM inspection_instrument_master
  WHERE instrument_code='MICROMETER' LIMIT 1
);

-- A reusable incoming-inspection plan for the demo item.
INSERT INTO item_incoming_inspection_characteristic
  (item_id,sequence_number,balloon_number,characteristic_master_id,
   specified_dimension,tolerance_mode,tolerance_minus,tolerance_plus,
   lsl,usl,drawing_grid,instrument_master_id,sample_size,inspection_frequency,created_by)
VALUES
  (@demo_item_id,1,'D1',@demo_bore_characteristic_id,
   50.0000,'MANUAL',-0.0500,0.0500,49.9500,50.0500,
   'D1',@demo_micrometer_id,'100%','Each lot','SYSTEM')
ON DUPLICATE KEY UPDATE
  characteristic_master_id=VALUES(characteristic_master_id),
  specified_dimension=VALUES(specified_dimension),
  tolerance_mode=VALUES(tolerance_mode),
  tolerance_minus=VALUES(tolerance_minus), tolerance_plus=VALUES(tolerance_plus),
  lsl=VALUES(lsl), usl=VALUES(usl), instrument_master_id=VALUES(instrument_master_id),
  sample_size=VALUES(sample_size), inspection_frequency=VALUES(inspection_frequency),
  updated_by='SYSTEM';

-- Ready Gate Entries: select one from GRN Inward to test each direct receipt type.
INSERT INTO purchase_gate_entries
  (tenant_id,company_id,plant_id,gate_entry_number,entry_datetime,entry_type,
   reference_number,purchase_order_id,supplier_id,customer_id,
   supplier_code_snapshot,supplier_name_snapshot,customer_name_snapshot,
   vehicle_number,driver_name,driving_licence_number,status,created_by)
VALUES
  ('DEFAULT','DEMO','CHN-01','GE-DEMO-REGULAR-READY',CURRENT_TIMESTAMP,
   'REGULAR_PURCHASE','PO-DEMO-REGULAR-001',@demo_regular_po_id,@demo_supplier_id,NULL,
   'SUP-DEMO-0001','Demo Metals Supplier',NULL,
   'TN01DEMO0','Demo Driver','DL-DEMO-000','GATE_ENTERED','SYSTEM'),
  ('DEFAULT','DEMO','CHN-01','GE-DEMO-OPEN-READY',CURRENT_TIMESTAMP,
   'OPEN_PURCHASE','OP-DEMO-READY-001',NULL,@demo_supplier_id,NULL,
   'SUP-DEMO-0001','Demo Metals Supplier',NULL,
   'TN01DEMO1','Demo Driver','DL-DEMO-001','GATE_ENTERED','SYSTEM'),
  ('DEFAULT','DEMO','CHN-01','GE-DEMO-CUSTOMER-READY',CURRENT_TIMESTAMP,
   'CUSTOMER_PURCHASE','ENQ-DEMO-0001',NULL,NULL,@demo_customer_id,
   NULL,NULL,'Demo Automotive Components Pvt. Ltd.',
   'TN01DEMO2','Demo Driver','DL-DEMO-002','GATE_ENTERED','SYSTEM'),
  ('DEFAULT','DEMO','CHN-01','GE-DEMO-OUTSOURCE-READY',CURRENT_TIMESTAMP,
   'OUTSOURCING_PARTS','PRT-DEMO-0001',NULL,@demo_supplier_id,NULL,
   'SUP-DEMO-0001','Demo Metals Supplier',NULL,
   'TN01DEMO3','Demo Driver','DL-DEMO-003','GATE_ENTERED','SYSTEM'),
  ('DEFAULT','DEMO','CHN-01','GE-DEMO-OPEN-PENDING',DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 DAY),
   'OPEN_PURCHASE','OP-DEMO-PENDING-001',NULL,@demo_supplier_id,NULL,
   'SUP-DEMO-0001','Demo Metals Supplier',NULL,
   'TN01DEMO4','Demo Driver','DL-DEMO-004','GRN_CREATED','SYSTEM'),
  ('DEFAULT','DEMO','CHN-01','GE-DEMO-OPEN-REJECTED',DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 3 DAY),
   'OPEN_PURCHASE','OP-DEMO-REJECT-001',NULL,@demo_supplier_id,NULL,
   'SUP-DEMO-0001','Demo Metals Supplier',NULL,
   'TN01DEMO5','Demo Driver','DL-DEMO-005','GRN_CREATED','SYSTEM')
ON DUPLICATE KEY UPDATE
  entry_datetime=VALUES(entry_datetime), entry_type=VALUES(entry_type),
  reference_number=VALUES(reference_number), supplier_id=VALUES(supplier_id),
  customer_id=VALUES(customer_id), supplier_code_snapshot=VALUES(supplier_code_snapshot),
  supplier_name_snapshot=VALUES(supplier_name_snapshot), customer_name_snapshot=VALUES(customer_name_snapshot),
  vehicle_number=VALUES(vehicle_number), driver_name=VALUES(driver_name),
  driving_licence_number=VALUES(driving_licence_number), status=VALUES(status), updated_by='SYSTEM';

SET @demo_pending_gate_id = (
  SELECT gate_entry_id FROM purchase_gate_entries
  WHERE tenant_id='DEFAULT' AND gate_entry_number='GE-DEMO-OPEN-PENDING'
);
SET @demo_rejected_gate_id = (
  SELECT gate_entry_id FROM purchase_gate_entries
  WHERE tenant_id='DEFAULT' AND gate_entry_number='GE-DEMO-OPEN-REJECTED'
);

-- GRN awaiting inspection. It appears in the GRN list and Inspection queue.
INSERT INTO goods_receipt_notes
  (tenant_id,company_id,plant_id,grn_number,grn_date,receipt_type,purchase_order_id,
   gate_entry_number,gate_entry_id,supplier_id,customer_id,customer_name_snapshot,
   customer_plant_code,supplier_name_snapshot,supplier_invoice_number,supplier_invoice_date,
   delivery_challan_number,received_by,inspection_status,status,remarks,created_by)
VALUES
  ('DEFAULT','DEMO','CHN-01','GRN-DEMO-PENDING-001',CURRENT_DATE,'OPEN_PURCHASE',NULL,
   'GE-DEMO-OPEN-PENDING',@demo_pending_gate_id,@demo_supplier_id,NULL,NULL,NULL,
   'Demo Metals Supplier','INV-DEMO-PENDING-001',CURRENT_DATE,
   'DC-DEMO-PENDING-001','Demo Receiver','PENDING','INSPECTION_PENDING',
   'Demo open-purchase receipt awaiting Quality inspection.','SYSTEM')
ON DUPLICATE KEY UPDATE
  grn_date=VALUES(grn_date), gate_entry_id=VALUES(gate_entry_id), supplier_id=VALUES(supplier_id),
  supplier_name_snapshot=VALUES(supplier_name_snapshot), supplier_invoice_number=VALUES(supplier_invoice_number),
  supplier_invoice_date=VALUES(supplier_invoice_date), delivery_challan_number=VALUES(delivery_challan_number),
  received_by=VALUES(received_by), inspection_status='PENDING', status='INSPECTION_PENDING',
  remarks=VALUES(remarks), updated_by='SYSTEM';

SET @demo_pending_grn_id = (
  SELECT grn_id FROM goods_receipt_notes
  WHERE tenant_id='DEFAULT' AND grn_number='GRN-DEMO-PENDING-001'
);

INSERT INTO goods_receipt_note_items
  (tenant_id,grn_id,purchase_order_item_id,item_id,item_description_snapshot,uom_code_snapshot,
   ordered_quantity,previously_received_quantity,received_quantity,direct_rate_per_qty,tax_percent,
   accepted_quantity,rejected_quantity,on_hold_quantity,rejection_reason,replacement_required,
   inspection_disposition,quality_remarks,warehouse_code,bin_location,batch_serial_number)
SELECT
  'DEFAULT',@demo_pending_grn_id,NULL,@demo_item_id,'EN8 round rod for demo drive shaft','NOS',
  10.000,0.000,10.000,120.00,18.000,
  0.000,0.000,0.000,NULL,'N','PENDING',NULL,NULL,NULL,'BATCH-DEMO-PENDING-001'
WHERE NOT EXISTS (
  SELECT 1 FROM goods_receipt_note_items
  WHERE tenant_id='DEFAULT' AND grn_id=@demo_pending_grn_id AND item_id=@demo_item_id
);

SET @demo_pending_grn_item_id = (
  SELECT grn_item_id FROM goods_receipt_note_items
  WHERE tenant_id='DEFAULT' AND grn_id=@demo_pending_grn_id AND item_id=@demo_item_id
  ORDER BY grn_item_id LIMIT 1
);

INSERT INTO grn_inspection_characteristics
  (tenant_id,grn_item_id,sequence_number,source_item_inspection_characteristic_id,
   characteristic_code_snapshot,characteristic_name_snapshot,characteristic_type_snapshot,
   specified_dimension,tolerance_minus,tolerance_plus,lsl,usl,drawing_grid,
   instrument_name_snapshot,sample_size_snapshot,inspection_frequency_snapshot,
   actual_value,inspection_result,remarks,created_by)
SELECT
  'DEFAULT',@demo_pending_grn_item_id,1,IIC.item_inspection_characteristic_id,
  'BORE_DIA','Bore Diameter','VARIABLE',50.0000,-0.0500,0.0500,49.9500,50.0500,'D1',
  'Micrometer','100%','Each lot',NULL,'PENDING',NULL,'SYSTEM'
FROM item_incoming_inspection_characteristic IIC
WHERE IIC.item_id=@demo_item_id AND IIC.sequence_number=1
  AND NOT EXISTS (
    SELECT 1 FROM grn_inspection_characteristics
    WHERE grn_item_id=@demo_pending_grn_item_id AND sequence_number=1
  );

-- Fully rejected GRN. It is already routed to Rejection Inventory / Quarantine.
INSERT INTO goods_receipt_notes
  (tenant_id,company_id,plant_id,grn_number,grn_date,receipt_type,purchase_order_id,
   gate_entry_number,gate_entry_id,supplier_id,customer_id,customer_name_snapshot,
   customer_plant_code,supplier_name_snapshot,supplier_invoice_number,supplier_invoice_date,
   delivery_challan_number,received_by,inspection_status,status,remarks,created_by)
VALUES
  ('DEFAULT','DEMO','CHN-01','GRN-DEMO-REJECTED-001',DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),'OPEN_PURCHASE',NULL,
   'GE-DEMO-OPEN-REJECTED',@demo_rejected_gate_id,@demo_supplier_id,NULL,NULL,NULL,
   'Demo Metals Supplier','INV-DEMO-REJECTED-001',DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),
   'DC-DEMO-REJECTED-001','Demo Receiver','FAILED','REJECTED',
   'Demo open-purchase receipt rejected by Quality for rework.','SYSTEM')
ON DUPLICATE KEY UPDATE
  grn_date=VALUES(grn_date), gate_entry_id=VALUES(gate_entry_id), supplier_id=VALUES(supplier_id),
  supplier_name_snapshot=VALUES(supplier_name_snapshot), supplier_invoice_number=VALUES(supplier_invoice_number),
  supplier_invoice_date=VALUES(supplier_invoice_date), delivery_challan_number=VALUES(delivery_challan_number),
  received_by=VALUES(received_by), inspection_status='FAILED', status='REJECTED',
  remarks=VALUES(remarks), updated_by='SYSTEM';

SET @demo_rejected_grn_id = (
  SELECT grn_id FROM goods_receipt_notes
  WHERE tenant_id='DEFAULT' AND grn_number='GRN-DEMO-REJECTED-001'
);

INSERT INTO goods_receipt_note_items
  (tenant_id,grn_id,purchase_order_item_id,item_id,item_description_snapshot,uom_code_snapshot,
   ordered_quantity,previously_received_quantity,received_quantity,direct_rate_per_qty,tax_percent,
   accepted_quantity,rejected_quantity,on_hold_quantity,rejection_reason,replacement_required,
   inspection_disposition,quality_remarks,warehouse_code,bin_location,batch_serial_number)
SELECT
  'DEFAULT',@demo_rejected_grn_id,NULL,@demo_item_id,'EN8 round rod for demo drive shaft','NOS',
  8.000,0.000,8.000,120.00,18.000,
  0.000,8.000,0.000,'Diameter out of tolerance.','N','REJECT_LOT',
  'Measured diameter is outside the approved tolerance.','REJECTION INVENTORY','QUARANTINE','BATCH-DEMO-REJECTED-001'
WHERE NOT EXISTS (
  SELECT 1 FROM goods_receipt_note_items
  WHERE tenant_id='DEFAULT' AND grn_id=@demo_rejected_grn_id AND item_id=@demo_item_id
);

SET @demo_rejected_grn_item_id = (
  SELECT grn_item_id FROM goods_receipt_note_items
  WHERE tenant_id='DEFAULT' AND grn_id=@demo_rejected_grn_id AND item_id=@demo_item_id
  ORDER BY grn_item_id LIMIT 1
);

INSERT INTO grn_inspection_characteristics
  (tenant_id,grn_item_id,sequence_number,source_item_inspection_characteristic_id,
   characteristic_code_snapshot,characteristic_name_snapshot,characteristic_type_snapshot,
   specified_dimension,tolerance_minus,tolerance_plus,lsl,usl,drawing_grid,
   instrument_name_snapshot,sample_size_snapshot,inspection_frequency_snapshot,
   actual_value,inspection_result,remarks,created_by)
SELECT
  'DEFAULT',@demo_rejected_grn_item_id,1,IIC.item_inspection_characteristic_id,
  'BORE_DIA','Bore Diameter','VARIABLE',50.0000,-0.0500,0.0500,49.9500,50.0500,'D1',
  'Micrometer','100%','Each lot','50.14','FAIL','Outside upper tolerance of 50.05.','SYSTEM'
FROM item_incoming_inspection_characteristic IIC
WHERE IIC.item_id=@demo_item_id AND IIC.sequence_number=1
  AND NOT EXISTS (
    SELECT 1 FROM grn_inspection_characteristics
    WHERE grn_item_id=@demo_rejected_grn_item_id AND sequence_number=1
  );

SET @demo_rejection_reason_id = (
  SELECT rejection_reason_id FROM rejection_reason_master
  WHERE reason_code='DIMENSION_OUT' LIMIT 1
);
SET @demo_rework_disposition_id = (
  SELECT rejection_disposition_id FROM rejection_disposition_master
  WHERE disposition_code='REWORK' LIMIT 1
);

INSERT INTO grn_rejection_records
  (tenant_id,grn_id,grn_item_id,receipt_type,responsible_party,supplier_id,customer_id,
   rejection_reason_id,rejection_reason_code_snapshot,rejection_reason_name_snapshot,
   rejection_disposition_id,rejection_disposition_code_snapshot,rejection_disposition_name_snapshot,
   rejected_quantity,uom_code_snapshot,quality_remarks,attachment_reference,status,created_by)
SELECT
  'DEFAULT',@demo_rejected_grn_id,@demo_rejected_grn_item_id,'OPEN_PURCHASE','SUPPLIER',@demo_supplier_id,NULL,
  @demo_rejection_reason_id,'DIMENSION_OUT','Dimension out of tolerance',
  @demo_rework_disposition_id,'REWORK','Rework',
  8.000,'NOS','Measured diameter is outside the approved tolerance.',NULL,'OPEN','SYSTEM'
WHERE NOT EXISTS (
  SELECT 1 FROM grn_rejection_records WHERE grn_item_id=@demo_rejected_grn_item_id
);

SET @demo_grn_rejection_id = (
  SELECT grn_rejection_id FROM grn_rejection_records
  WHERE tenant_id='DEFAULT' AND grn_item_id=@demo_rejected_grn_item_id
);

INSERT INTO inventory_rejection_balance
  (tenant_id,grn_rejection_id,grn_id,grn_item_id,item_id,item_description_snapshot,uom_code_snapshot,
   warehouse_code,bin_location,batch_serial_number,stock_owner_type,stock_owner_id,
   quantity_on_hand,status,created_by,updated_by)
SELECT
  'DEFAULT',@demo_grn_rejection_id,@demo_rejected_grn_id,@demo_rejected_grn_item_id,@demo_item_id,
  'EN8 round rod for demo drive shaft','NOS',
  'REJECTION INVENTORY','QUARANTINE','BATCH-DEMO-REJECTED-001','COMPANY',0,
  8.000,'OPEN','SYSTEM','SYSTEM'
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_rejection_balance WHERE grn_rejection_id=@demo_grn_rejection_id
);

SET @demo_rejection_balance_id = (
  SELECT rejection_inventory_balance_id FROM inventory_rejection_balance
  WHERE grn_rejection_id=@demo_grn_rejection_id
);

INSERT INTO inventory_rejection_transaction
  (tenant_id,rejection_inventory_balance_id,grn_rejection_id,transaction_type,transaction_date,
   quantity_in,quantity_out,balance_after_quantity,remarks,created_by)
SELECT
  'DEFAULT',@demo_rejection_balance_id,@demo_grn_rejection_id,'GRN_REJECTION',
  DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),8.000,0.000,8.000,
  'Demo quantity rejected during GRN inspection.','SYSTEM'
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_rejection_transaction
  WHERE rejection_inventory_balance_id=@demo_rejection_balance_id AND transaction_type='GRN_REJECTION'
);

COMMIT;

SELECT 'Sample data uploaded successfully.' AS result,
       @demo_customer_id AS customer_id,
       @demo_part_id AS part_id,
       @demo_enquiry_id AS enquiry_id,
       @demo_pending_grn_id AS inspection_pending_grn_id,
       @demo_rejected_grn_id AS rejected_grn_id,
       @demo_rejection_balance_id AS rejection_inventory_balance_id;
