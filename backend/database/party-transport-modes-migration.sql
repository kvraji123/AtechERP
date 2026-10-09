-- Allowed modes are controlled by the active TRANSPORT_MODE reference master.
-- Legacy single values are retained and migrated where they match a current code or label.

ALTER TABLE customer_master
  ADD COLUMN IF NOT EXISTS allowed_transport_modes JSON NULL AFTER transport_mode;

ALTER TABLE supplier_master
  ADD COLUMN IF NOT EXISTS allowed_transport_modes JSON NULL AFTER transport_mode;

UPDATE customer_master C
JOIN marketing_reference_values R
  ON R.reference_type = 'TRANSPORT_MODE'
  AND R.active_flag = 'Y'
  AND (UPPER(TRIM(C.transport_mode)) = R.value_code OR UPPER(TRIM(C.transport_mode)) = UPPER(R.display_label))
SET C.allowed_transport_modes = JSON_ARRAY(R.value_code)
WHERE C.allowed_transport_modes IS NULL
  AND NULLIF(TRIM(C.transport_mode), '') IS NOT NULL;

UPDATE supplier_master S
JOIN marketing_reference_values R
  ON R.reference_type = 'TRANSPORT_MODE'
  AND R.active_flag = 'Y'
  AND (UPPER(TRIM(S.transport_mode)) = R.value_code OR UPPER(TRIM(S.transport_mode)) = UPPER(R.display_label))
SET S.allowed_transport_modes = JSON_ARRAY(R.value_code)
WHERE S.allowed_transport_modes IS NULL
  AND NULLIF(TRIM(S.transport_mode), '') IS NOT NULL;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50) NULL AFTER delivery_terms;

ALTER TABLE purchase_gate_entries
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50) NULL AFTER customer_name_snapshot;

ALTER TABLE return_to_vendor_documents
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50) NULL AFTER dispatch_reference;

ALTER TABLE return_to_customer_documents
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50) NULL AFTER dispatch_reference;
