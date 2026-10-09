-- Repeatable Purchase module end-to-end demo seed (MySQL 8+).
-- Demo flow: PR -> approval -> supplier assignment -> RFQ -> outbox/PDF -> quote
-- -> supplier selection -> PO approval -> GRN receipt.
USE `atech_erp`;
START TRANSACTION;
SET FOREIGN_KEY_CHECKS=0;

DELETE FROM goods_receipt_notes WHERE grn_number='GRN/2026-27/9001';
DELETE POI FROM purchase_order_items POI JOIN purchase_orders PO ON PO.purchase_order_id=POI.purchase_order_id WHERE PO.po_number='PO/2026-27/9001';
DELETE FROM purchase_order_sources WHERE purchase_order_id IN (SELECT purchase_order_id FROM purchase_orders WHERE po_number='PO/2026-27/9001');
DELETE FROM purchase_order_approval_history WHERE purchase_order_id IN (SELECT purchase_order_id FROM purchase_orders WHERE po_number='PO/2026-27/9001');
DELETE FROM purchase_orders WHERE po_number='PO/2026-27/9001';
DELETE FROM purchase_rfq_email_outbox WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001');
DELETE FROM purchase_rfq_documents WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001');
DELETE FROM purchase_supplier_selections WHERE purchase_enquiry_item_id IN (SELECT purchase_enquiry_item_id FROM purchase_enquiry_items WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001'));
DELETE SQI FROM supplier_quotation_items SQI JOIN supplier_quotations SQ ON SQ.supplier_quotation_id=SQI.supplier_quotation_id WHERE SQ.purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001');
DELETE FROM supplier_quotations WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001');
DELETE FROM purchase_enquiry_item_suppliers WHERE purchase_enquiry_item_id IN (SELECT purchase_enquiry_item_id FROM purchase_enquiry_items WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001'));
DELETE FROM purchase_enquiry_items WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001');
DELETE FROM purchase_enquiry_requests WHERE purchase_enquiry_id IN (SELECT purchase_enquiry_id FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001');
DELETE FROM purchase_enquiries WHERE enquiry_number='PE/2026-27/9001';
DELETE FROM purchase_request_item_approval_history WHERE purchase_request_id IN (SELECT purchase_request_id FROM purchase_requests WHERE pr_number='PR/2026-27/9001');
DELETE FROM purchase_request_supplier_assignments WHERE purchase_request_item_id IN (SELECT purchase_request_item_id FROM purchase_request_items WHERE purchase_request_id IN (SELECT purchase_request_id FROM purchase_requests WHERE pr_number='PR/2026-27/9001'));
DELETE FROM purchase_request_items WHERE purchase_request_id IN (SELECT purchase_request_id FROM purchase_requests WHERE pr_number='PR/2026-27/9001');
DELETE FROM purchase_requests WHERE pr_number='PR/2026-27/9001';

SET @demo_supplier=(SELECT supplier_id FROM supplier_master WHERE active_flag='Y' ORDER BY supplier_id LIMIT 1);
SET @demo_item=(SELECT item_id FROM item_master WHERE active_flag='Y' ORDER BY item_id LIMIT 1);
SET @demo_supplier_code=(SELECT supplier_code FROM supplier_master WHERE supplier_id=@demo_supplier);
SET @demo_supplier_name=(SELECT supplier_name FROM supplier_master WHERE supplier_id=@demo_supplier);
SET @demo_supplier_email=COALESCE((SELECT email_address FROM supplier_master WHERE supplier_id=@demo_supplier),'supplier.demo@example.com');
SET @demo_item_code=(SELECT item_code FROM item_master WHERE item_id=@demo_item);
SET @demo_item_desc=(SELECT item_description FROM item_master WHERE item_id=@demo_item);
SET @demo_item_spec=(SELECT item_specification FROM item_master WHERE item_id=@demo_item);
SET @demo_uom=(SELECT U.uom_code FROM item_master I JOIN uom_master U ON U.uom_id=I.uom_id WHERE I.item_id=@demo_item);

INSERT INTO purchase_requests (tenant_id,company_id,pr_number,financial_year,plant_code,plant_id,floor_department,department_id,requested_by,request_date,required_date,requisition_type,priority,remarks,estimated_subtotal,estimated_tax_amount,estimated_total_amount,pr_status,submitted_on,approved_by,approved_on,created_by)
VALUES ('DEFAULT','DEMO-COMPANY','PR/2026-27/9001','2026-27','CHN-01','CHN-01','Production - Assembly','PRODUCTION','System Administrator',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY),'EXISTING_ITEM','MEDIUM','End-to-end Purchase workflow demo',1000,180,1180,'APPROVED',CURRENT_TIMESTAMP,'System Administrator',CURRENT_TIMESTAMP,'SYSTEM');
SET @pr_id=LAST_INSERT_ID();
INSERT INTO purchase_request_items (tenant_id,company_id,purchase_request_id,line_number,item_id,item_group_name,item_type_name,item_description,item_specification,requested_quantity,approved_quantity,approval_status,approved_by,approved_on,uom_code,estimated_rate_per_qty,tax_percent,estimated_tax_amount,estimated_total_amount,purpose,line_status,created_by)
VALUES ('DEFAULT','DEMO-COMPANY',@pr_id,1,@demo_item,'Demo Group','Demo Type',@demo_item_desc,@demo_item_spec,10,10,'APPROVED','System Administrator',CURRENT_TIMESTAMP,@demo_uom,100,18,180,1180,'End-to-end workflow test','ACTIVE','SYSTEM');
SET @pr_item_id=LAST_INSERT_ID();
INSERT INTO purchase_request_item_approval_history (tenant_id,purchase_request_id,purchase_request_item_id,decision,approved_quantity,reason,from_status,to_status,performed_by) VALUES ('DEFAULT',@pr_id,@pr_item_id,'APPROVED',10,'Approved for demo procurement','PENDING_APPROVAL','APPROVED','System Administrator');
INSERT INTO purchase_request_supplier_assignments (tenant_id,purchase_request_item_id,supplier_id,assigned_quantity,assignment_status,assigned_by) VALUES ('DEFAULT',@pr_item_id,@demo_supplier,10,'ASSIGNED','System Administrator');

INSERT INTO purchase_enquiries (tenant_id,company_id,enquiry_number,financial_year,enquiry_date,quote_due_date,subject,delivery_required_by,delivery_location,commercial_terms,notes,enquiry_status,remarks,created_by)
VALUES ('DEFAULT','DEMO-COMPANY','PE/2026-27/9001','2026-27',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 14 DAY),'Request for Quotation - PE/2026-27/9001',DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY),'Atech Automation - Main Stores','Taxes, freight and delivery to be stated separately.','End-to-end RFQ demo','SENT','Demo RFQ','SYSTEM');
SET @enquiry_id=LAST_INSERT_ID();
INSERT INTO purchase_enquiry_requests (tenant_id,purchase_enquiry_id,purchase_request_id,created_by) VALUES ('DEFAULT',@enquiry_id,@pr_id,'SYSTEM');
INSERT INTO purchase_enquiry_items (tenant_id,purchase_enquiry_id,purchase_request_item_id,line_number,enquiry_quantity,uom_code,enquiry_required,line_status,created_by) VALUES ('DEFAULT',@enquiry_id,@pr_item_id,1,10,@demo_uom,'Y','SENT','SYSTEM');
SET @enquiry_item_id=LAST_INSERT_ID();
INSERT INTO purchase_enquiry_item_suppliers (tenant_id,purchase_enquiry_item_id,supplier_id,assignment_status,assigned_by,assigned_on,sent_on,supplier_email) VALUES ('DEFAULT',@enquiry_item_id,@demo_supplier,'SENT','SYSTEM',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,@demo_supplier_email);
INSERT INTO supplier_quotations (tenant_id,purchase_enquiry_id,supplier_id,supplier_quotation_number,supplier_quotation_date,quotation_status,currency_code,payment_terms,delivery_terms,quotation_valid_until,subtotal_amount,tax_amount,grand_total_amount,attachment_file_name,attachment_file_url,entered_by) VALUES ('DEFAULT',@enquiry_id,@demo_supplier,'QTN/2026-27/9001',CURRENT_DATE,'RECEIVED','INR','30 days','7 days',DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY),1000,180,1180,'QTN-2026-27-9001.pdf','/uploads/quotations/QTN-2026-27-9001.pdf','SYSTEM');
SET @quote_id=LAST_INSERT_ID();
INSERT INTO supplier_quotation_items (tenant_id,supplier_quotation_id,purchase_enquiry_item_id,quote_response,quoted_quantity,unit_price,tax_percent,tax_amount,total_amount,delivery_date,delivery_lead_days,recommended_flag,comparison_score) VALUES ('DEFAULT',@quote_id,@enquiry_item_id,'QUOTED',10,100,18,180,1180,DATE_ADD(CURRENT_DATE,INTERVAL 7 DAY),7,'Y',92);
SET @quote_item_id=LAST_INSERT_ID();
INSERT INTO purchase_supplier_selections (tenant_id,purchase_enquiry_item_id,supplier_quotation_item_id,supplier_id,selected_quantity,selection_reason,manager_decision,selected_by) VALUES ('DEFAULT',@enquiry_item_id,@quote_item_id,@demo_supplier,10,'Best evaluated quote','SELECTED','System Administrator');
INSERT INTO purchase_rfq_documents (tenant_id,purchase_enquiry_id,supplier_id,file_name,file_url,file_size_bytes,generated_by) VALUES ('DEFAULT',@enquiry_id,@demo_supplier,'PE-2026-27-9001-RFQ.pdf','/uploads/rfq/PE-2026-27-9001-RFQ.pdf',0,'SYSTEM');
INSERT INTO purchase_rfq_email_outbox (tenant_id,purchase_enquiry_id,supplier_id,recipient_email,recipient_name,subject,text_body,html_body,status,created_by) VALUES ('DEFAULT',@enquiry_id,@demo_supplier,@demo_supplier_email,@demo_supplier_name,'Request for Quotation - PE/2026-27/9001','Please review the attached RFQ.','<p>Please review the attached RFQ.</p>','SENT','SYSTEM');

INSERT INTO purchase_orders (tenant_id,company_id,plant_id,po_number,financial_year,po_date,supplier_id,supplier_code_snapshot,supplier_name_snapshot,supplier_address_snapshot,source_reference,billing_address_snapshot,delivery_address_snapshot,payment_terms,delivery_terms,expected_delivery_date,remarks,special_instructions,subtotal_amount,tax_amount,grand_total_amount,status,submitted_by,submitted_at,approved_by,approved_at,created_by)
VALUES ('DEFAULT','DEMO-COMPANY','CHN-01','PO/2026-27/9001','2026-27',CURRENT_DATE,@demo_supplier,@demo_supplier_code,@demo_supplier_name,'Demo supplier address','PR/2026-27/9001','Atech Automation billing address','Atech Automation main stores','30 days','7 days',DATE_ADD(CURRENT_DATE,INTERVAL 7 DAY),'Generated from approved supplier selection','Mention PO number on invoice',1000,180,1180,'APPROVED','System Administrator',CURRENT_TIMESTAMP,'System Administrator',CURRENT_TIMESTAMP,'SYSTEM');
SET @po_id=LAST_INSERT_ID();
INSERT INTO purchase_order_items (tenant_id,purchase_order_id,purchase_request_item_id,line_number,item_id,item_code_snapshot,item_type_snapshot,item_description_snapshot,item_specification_snapshot,uom_code_snapshot,ordered_quantity,received_quantity,unit_price,tax_percent,tax_amount,line_total_amount,required_date,line_status) VALUES ('DEFAULT',@po_id,@pr_item_id,1,@demo_item,@demo_item_code,'Demo Type',@demo_item_desc,@demo_item_spec,@demo_uom,10,0,100,18,180,1180,DATE_ADD(CURRENT_DATE,INTERVAL 7 DAY),'OPEN');
SET @po_item_id=LAST_INSERT_ID();
INSERT INTO purchase_order_sources (tenant_id,purchase_order_id,purchase_order_item_id,purchase_request_id,purchase_request_item_id,source_quantity) VALUES ('DEFAULT',@po_id,@po_item_id,@pr_id,@pr_item_id,10);
INSERT INTO purchase_order_approval_history (tenant_id,purchase_order_id,decision,reason,from_status,to_status,performed_by) VALUES ('DEFAULT',@po_id,'APPROVED','Approved for receipt','SUBMITTED','APPROVED','System Administrator');

INSERT INTO goods_receipt_notes (tenant_id,company_id,plant_id,grn_number,grn_date,purchase_order_id,gate_entry_number,supplier_id,supplier_name_snapshot,inspection_status,status,remarks,created_by) VALUES ('DEFAULT','DEMO-COMPANY','CHN-01','GRN/2026-27/9001',CURRENT_DATE,@po_id,'GE/2026-27/9001',@demo_supplier,@demo_supplier_name,'PASSED','POSTED','Demo receipt posted','SYSTEM');
SET @grn_id=LAST_INSERT_ID();
INSERT INTO goods_receipt_note_items (tenant_id,grn_id,purchase_order_item_id,item_id,item_description_snapshot,uom_code_snapshot,ordered_quantity,previously_received_quantity,received_quantity,accepted_quantity,rejected_quantity,replacement_required) VALUES ('DEFAULT',@grn_id,@po_item_id,@demo_item,@demo_item_desc,@demo_uom,10,0,10,10,0,'N');
UPDATE purchase_order_items SET received_quantity=10,line_status='RECEIVED' WHERE purchase_order_item_id=@po_item_id;
UPDATE purchase_orders SET status='COMPLETED' WHERE purchase_order_id=@po_id;

COMMIT;
SET FOREIGN_KEY_CHECKS=1;

SELECT @pr_id AS purchase_request_id,@enquiry_id AS purchase_enquiry_id,@po_id AS purchase_order_id,@grn_id AS grn_id;
