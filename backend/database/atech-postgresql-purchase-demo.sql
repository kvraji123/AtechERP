-- A TECH AUTOMATION ERP - PostgreSQL Purchase/RFQ demo database
-- Separate reference database. Does not modify the current MySQL database.
-- PostgreSQL 14+

BEGIN;

CREATE TABLE IF NOT EXISTS customer_master (
  customer_id BIGSERIAL PRIMARY KEY,
  party_type VARCHAR(10) NOT NULL DEFAULT 'CUSTOMER',
  customer_code VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(200) NOT NULL,
  customer_short_name VARCHAR(100),
  email_address VARCHAR(200),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
  customer_status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
  active_flag CHAR(1) NOT NULL DEFAULT 'Y',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_master (
  item_id BIGSERIAL PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL UNIQUE,
  item_group_name VARCHAR(120) NOT NULL,
  item_type_name VARCHAR(120) NOT NULL,
  item_description VARCHAR(250) NOT NULL,
  item_specification VARCHAR(1000),
  uom_code VARCHAR(30) NOT NULL,
  item_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  purchase_request_id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT', company_id VARCHAR(64),
  pr_number VARCHAR(50) NOT NULL UNIQUE, financial_year VARCHAR(10) NOT NULL,
  plant_code VARCHAR(50) NOT NULL, floor_department VARCHAR(120) NOT NULL,
  requested_by VARCHAR(100) NOT NULL, request_date DATE NOT NULL,
  required_date DATE NOT NULL, requisition_type VARCHAR(20) NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM', remarks VARCHAR(1000),
  estimated_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  estimated_tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  estimated_total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  pr_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', submitted_on TIMESTAMPTZ,
  approved_by VARCHAR(100), approved_on TIMESTAMPTZ, created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  purchase_request_item_id BIGSERIAL PRIMARY KEY,
  purchase_request_id BIGINT NOT NULL REFERENCES purchase_requests(purchase_request_id) ON DELETE CASCADE,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT', company_id VARCHAR(64),
  line_number INTEGER NOT NULL, item_id BIGINT NOT NULL REFERENCES item_master(item_id),
  item_group_name VARCHAR(120) NOT NULL, item_type_name VARCHAR(120) NOT NULL,
  item_description VARCHAR(250) NOT NULL, item_specification VARCHAR(1000),
  requested_quantity NUMERIC(18,3) NOT NULL, approved_quantity NUMERIC(18,3), uom_code VARCHAR(30) NOT NULL,
  estimated_rate_per_qty NUMERIC(18,2) NOT NULL DEFAULT 0, tax_percent NUMERIC(7,4) NOT NULL DEFAULT 0,
  estimated_tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0, estimated_total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  purpose VARCHAR(1000) NOT NULL, approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  approved_by VARCHAR(50), approved_on TIMESTAMPTZ, created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  UNIQUE(purchase_request_id,line_number)
);

CREATE TABLE IF NOT EXISTS purchase_enquiries (
  purchase_enquiry_id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT', company_id VARCHAR(64),
  enquiry_number VARCHAR(50) NOT NULL UNIQUE, financial_year VARCHAR(10) NOT NULL,
  enquiry_date DATE NOT NULL, quote_due_date DATE NOT NULL, subject VARCHAR(500),
  delivery_required_by DATE, delivery_location VARCHAR(500), commercial_terms VARCHAR(2000), notes VARCHAR(2000),
  enquiry_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'
);

CREATE TABLE IF NOT EXISTS purchase_enquiry_requests (
  id BIGSERIAL PRIMARY KEY, purchase_enquiry_id BIGINT NOT NULL REFERENCES purchase_enquiries ON DELETE CASCADE,
  purchase_request_id BIGINT NOT NULL REFERENCES purchase_requests ON DELETE RESTRICT,
  UNIQUE(purchase_enquiry_id,purchase_request_id)
);

CREATE TABLE IF NOT EXISTS purchase_enquiry_items (
  purchase_enquiry_item_id BIGSERIAL PRIMARY KEY, purchase_enquiry_id BIGINT NOT NULL REFERENCES purchase_enquiries ON DELETE CASCADE,
  purchase_request_item_id BIGINT NOT NULL REFERENCES purchase_request_items ON DELETE RESTRICT,
  line_number INTEGER NOT NULL, enquiry_quantity NUMERIC(18,3) NOT NULL, uom_code VARCHAR(30) NOT NULL,
  line_status VARCHAR(30) NOT NULL DEFAULT 'READY', UNIQUE(purchase_enquiry_id,line_number)
);

CREATE TABLE IF NOT EXISTS purchase_enquiry_item_suppliers (
  id BIGSERIAL PRIMARY KEY, purchase_enquiry_item_id BIGINT NOT NULL REFERENCES purchase_enquiry_items ON DELETE CASCADE,
  supplier_id BIGINT NOT NULL REFERENCES customer_master, assignment_status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
  supplier_email VARCHAR(320), UNIQUE(purchase_enquiry_item_id,supplier_id)
);

CREATE TABLE IF NOT EXISTS supplier_quotations (
  supplier_quotation_id BIGSERIAL PRIMARY KEY, purchase_enquiry_id BIGINT NOT NULL REFERENCES purchase_enquiries ON DELETE CASCADE,
  supplier_id BIGINT NOT NULL REFERENCES customer_master, supplier_quotation_number VARCHAR(100),
  supplier_quotation_date DATE, quotation_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED', currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_terms VARCHAR(500), delivery_terms VARCHAR(500), subtotal_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0, grand_total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  attachment_file_name VARCHAR(255), attachment_file_url VARCHAR(1000), entered_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  UNIQUE(purchase_enquiry_id,supplier_id,supplier_quotation_number)
);

CREATE TABLE IF NOT EXISTS supplier_quotation_items (
  supplier_quotation_item_id BIGSERIAL PRIMARY KEY, supplier_quotation_id BIGINT NOT NULL REFERENCES supplier_quotations ON DELETE CASCADE,
  purchase_enquiry_item_id BIGINT NOT NULL REFERENCES purchase_enquiry_items ON DELETE RESTRICT,
  quoted_quantity NUMERIC(18,3), unit_price NUMERIC(18,4), tax_percent NUMERIC(7,4), tax_amount NUMERIC(18,2), total_amount NUMERIC(18,2),
  delivery_date DATE, delivery_lead_days INTEGER, recommended_flag CHAR(1) NOT NULL DEFAULT 'N', comparison_score NUMERIC(8,4),
  UNIQUE(supplier_quotation_id,purchase_enquiry_item_id)
);

CREATE TABLE IF NOT EXISTS purchase_supplier_selections (
  purchase_supplier_selection_id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  purchase_enquiry_item_id BIGINT NOT NULL REFERENCES purchase_enquiry_items ON DELETE CASCADE,
  supplier_quotation_item_id BIGINT NOT NULL REFERENCES supplier_quotation_items ON DELETE RESTRICT,
  supplier_id BIGINT NOT NULL REFERENCES customer_master, selected_quantity NUMERIC(18,3) NOT NULL,
  manager_decision VARCHAR(20) NOT NULL DEFAULT 'SELECTED', selected_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  UNIQUE(purchase_enquiry_item_id,supplier_quotation_item_id)
);

CREATE TABLE IF NOT EXISTS purchase_rfq_documents (
  rfq_document_id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  purchase_enquiry_id BIGINT NOT NULL REFERENCES purchase_enquiries ON DELETE CASCADE, supplier_id BIGINT NOT NULL REFERENCES customer_master,
  file_name VARCHAR(255) NOT NULL, file_url VARCHAR(1000) NOT NULL, generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id,purchase_enquiry_id,supplier_id)
);

CREATE TABLE IF NOT EXISTS purchase_rfq_email_outbox (
  email_outbox_id BIGSERIAL PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  purchase_enquiry_id BIGINT NOT NULL REFERENCES purchase_enquiries ON DELETE CASCADE, supplier_id BIGINT NOT NULL REFERENCES customer_master,
  recipient_email VARCHAR(320) NOT NULL, recipient_name VARCHAR(200), subject VARCHAR(500) NOT NULL,
  text_body TEXT NOT NULL, html_body TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMPTZ, created_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  UNIQUE(tenant_id,purchase_enquiry_id,supplier_id)
);

-- Demo master records
INSERT INTO customer_master (party_type,customer_code,customer_name,customer_short_name,email_address)
VALUES ('SUPPLIER','SUP-DEMO-0001','Demo Metals Supplier','DEMO METALS','sales.demo@example.com'),
       ('SUPPLIER','SUP-DEMO-0002','Demo Precision Components','DEMO PRECISION','sales.precision.demo@example.com')
ON CONFLICT (customer_code) DO UPDATE SET customer_name=EXCLUDED.customer_name,email_address=EXCLUDED.email_address;
INSERT INTO item_master (item_code,item_group_name,item_type_name,item_description,item_specification,uom_code)
VALUES ('RM-DEMO-0001','Raw Material','Rod','EN8 round rod for demo drive shaft','Diameter 50 mm','NOS')
ON CONFLICT (item_code) DO UPDATE SET item_description=EXCLUDED.item_description;

-- Demo transaction
INSERT INTO purchase_requests (pr_number,financial_year,plant_code,floor_department,requested_by,request_date,required_date,requisition_type,priority,remarks,estimated_subtotal,estimated_tax_amount,estimated_total_amount,pr_status,submitted_on,approved_by,approved_on)
VALUES ('PR-DEMO-0001','2026-27','CHN-01','Production - Assembly','System Administrator',CURRENT_DATE,CURRENT_DATE+30,'NEW_ITEM','MEDIUM','Demo PR',1200,216,1416,'APPROVED',CURRENT_TIMESTAMP,'System Administrator',CURRENT_TIMESTAMP)
ON CONFLICT (pr_number) DO UPDATE SET pr_status='APPROVED';
INSERT INTO purchase_request_items (purchase_request_id,line_number,item_id,item_group_name,item_type_name,item_description,item_specification,requested_quantity,approved_quantity,uom_code,estimated_rate_per_qty,tax_percent,estimated_tax_amount,estimated_total_amount,purpose,approval_status,approved_by,approved_on)
SELECT purchase_request_id,1,item_id,'Raw Material','Rod','EN8 round rod for demo drive shaft','Diameter 50 mm',10,10,'NOS',120,18,216,1416,'Demo flow validation','APPROVED','System Administrator',CURRENT_TIMESTAMP FROM purchase_requests, item_master WHERE pr_number='PR-DEMO-0001' AND item_code='RM-DEMO-0001' ON CONFLICT (purchase_request_id,line_number) DO UPDATE SET approval_status='APPROVED';
INSERT INTO purchase_enquiries (enquiry_number,financial_year,enquiry_date,quote_due_date,subject,delivery_required_by,delivery_location,commercial_terms,enquiry_status)
VALUES ('PE-DEMO-0001','2026-27',CURRENT_DATE,CURRENT_DATE+14,'Request for Quotation - PE-DEMO-0001',CURRENT_DATE+30,'Atech Automation - Chennai','Prices in INR; taxes and delivery stated separately.','SENT')
ON CONFLICT (enquiry_number) DO UPDATE SET enquiry_status='SENT';
INSERT INTO purchase_enquiry_requests (purchase_enquiry_id,purchase_request_id) SELECT e.purchase_enquiry_id,r.purchase_request_id FROM purchase_enquiries e,purchase_requests r WHERE e.enquiry_number='PE-DEMO-0001' AND r.pr_number='PR-DEMO-0001' ON CONFLICT DO NOTHING;
INSERT INTO purchase_enquiry_items (purchase_enquiry_id,purchase_request_item_id,line_number,enquiry_quantity,uom_code,line_status) SELECT e.purchase_enquiry_id,i.purchase_request_item_id,1,10,'NOS','SENT' FROM purchase_enquiries e,purchase_request_items i,purchase_requests r WHERE e.enquiry_number='PE-DEMO-0001' AND r.pr_number='PR-DEMO-0001' AND i.purchase_request_id=r.purchase_request_id ON CONFLICT DO NOTHING;
INSERT INTO purchase_enquiry_item_suppliers (purchase_enquiry_item_id,supplier_id,assignment_status,supplier_email) SELECT ei.purchase_enquiry_item_id,c.customer_id,'SENT',c.email_address FROM purchase_enquiry_items ei, purchase_enquiries e, customer_master c WHERE e.enquiry_number='PE-DEMO-0001' AND ei.purchase_enquiry_id=e.purchase_enquiry_id AND c.customer_code IN ('SUP-DEMO-0001','SUP-DEMO-0002') ON CONFLICT DO NOTHING;
INSERT INTO supplier_quotations (purchase_enquiry_id,supplier_id,supplier_quotation_number,supplier_quotation_date,subtotal_amount,tax_amount,grand_total_amount,attachment_file_name,attachment_file_url) SELECT e.purchase_enquiry_id,c.customer_id,'QTN-DEMO-'||RIGHT(c.customer_code,4),CURRENT_DATE,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 1200 ELSE 1150 END,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 216 ELSE 207 END,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 1416 ELSE 1357 END,'demo-quotation.pdf','/uploads/quotations/demo-quotation.pdf' FROM purchase_enquiries e,customer_master c WHERE e.enquiry_number='PE-DEMO-0001' AND c.customer_code IN ('SUP-DEMO-0001','SUP-DEMO-0002') ON CONFLICT DO NOTHING;
INSERT INTO supplier_quotation_items (supplier_quotation_id,purchase_enquiry_item_id,quoted_quantity,unit_price,tax_percent,tax_amount,total_amount,delivery_lead_days,recommended_flag,comparison_score) SELECT q.supplier_quotation_id,ei.purchase_enquiry_item_id,10,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 120 ELSE 115 END,18,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 216 ELSE 207 END,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 1416 ELSE 1357 END,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 7 ELSE 10 END,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 'N' ELSE 'Y' END,CASE WHEN c.customer_code='SUP-DEMO-0001' THEN 82 ELSE 91 END FROM supplier_quotations q,customer_master c,purchase_enquiries e,purchase_enquiry_items ei WHERE q.supplier_id=c.customer_id AND q.purchase_enquiry_id=e.purchase_enquiry_id AND ei.purchase_enquiry_id=e.purchase_enquiry_id AND e.enquiry_number='PE-DEMO-0001' ON CONFLICT DO NOTHING;
INSERT INTO purchase_supplier_selections (purchase_enquiry_item_id,supplier_quotation_item_id,supplier_id,selected_quantity,selected_by) SELECT qi.purchase_enquiry_item_id,qi.supplier_quotation_item_id,q.supplier_id,10,'System Administrator' FROM supplier_quotation_items qi,supplier_quotations q,customer_master c WHERE qi.supplier_quotation_id=q.supplier_quotation_id AND q.supplier_id=c.customer_id AND c.customer_code='SUP-DEMO-0002' ON CONFLICT DO NOTHING;
INSERT INTO purchase_rfq_documents (purchase_enquiry_id,supplier_id,file_name,file_url) SELECT e.purchase_enquiry_id,c.customer_id,'PE-DEMO-0001-'||c.customer_code||'.pdf','/uploads/rfq/PE-DEMO-0001-'||c.customer_code||'.pdf' FROM purchase_enquiries e,customer_master c WHERE e.enquiry_number='PE-DEMO-0001' AND c.customer_code IN ('SUP-DEMO-0001','SUP-DEMO-0002') ON CONFLICT DO NOTHING;
INSERT INTO purchase_rfq_email_outbox (purchase_enquiry_id,supplier_id,recipient_email,recipient_name,subject,text_body,html_body) SELECT e.purchase_enquiry_id,c.customer_id,c.email_address,c.customer_name,'Request for Quotation - PE-DEMO-0001','Please review the attached RFQ.','<p>Please review the attached RFQ.</p>' FROM purchase_enquiries e,customer_master c WHERE e.enquiry_number='PE-DEMO-0001' AND c.customer_code IN ('SUP-DEMO-0001','SUP-DEMO-0002') ON CONFLICT DO NOTHING;

COMMIT;

-- Verification:
SELECT pr_number, pr_status FROM purchase_requests WHERE pr_number='PR-DEMO-0001';
SELECT enquiry_number, enquiry_status FROM purchase_enquiries WHERE enquiry_number='PE-DEMO-0001';
SELECT recipient_email, subject, status FROM purchase_rfq_email_outbox ORDER BY email_outbox_id;
