// src/modules/supplier/supplier.queries.js

export const LIST_SUPPLIERS = `
  SELECT
    supplier_id AS supplierId,
    supplier_type AS supplierType,
    supplier_code AS supplierCode,
    supplier_name AS supplierName,
    supplier_short_name AS supplierShortName,
    plant_code AS plantCode,
    city,
    state_name AS stateName,
    country_name AS countryName,
    mobile_number AS mobileNumber,
    email_address AS emailAddress,
    currency_code AS currencyCode,
    transport_mode,
    allowed_transport_modes,
    supplier_status AS supplierStatus,
    active_flag AS activeFlag,
    COALESCE(updated_on, created_on) AS lastUpdated
  FROM supplier_master
  WHERE (
      ? = ''
      OR supplier_code LIKE CONCAT('%', ?, '%')
      OR supplier_name LIKE CONCAT('%', ?, '%')
      OR supplier_short_name LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = ''
      OR active_flag = ?
    )
  ORDER BY
    COALESCE(updated_on, created_on) DESC,
    supplier_id DESC
`;

export const COUNT_SUPPLIERS = `
  SELECT
    COUNT(*) AS total
  FROM supplier_master
  WHERE (
      ? = ''
      OR supplier_code LIKE CONCAT('%', ?, '%')
      OR supplier_name LIKE CONCAT('%', ?, '%')
      OR supplier_short_name LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = ''
      OR active_flag = ?
    )
`;

export const GET_SUPPLIER_BY_ID = `
  SELECT *, COALESCE(NULLIF(delivery_address, ''), billing_address) AS address
  FROM supplier_master
  WHERE supplier_id = ?
`;

export const INSERT_SUPPLIER = `
  INSERT INTO supplier_master
  (
    supplier_type,
    supplier_code,
    supplier_name,
    supplier_short_name,
    plant_code,
    billing_address,
    delivery_address,
    delivery_terms,
    pin_code,
    city,
    state_name,
    country_name,
    gst_number,
    pan_number,
    mobile_number,
    phone_number,
    fax_number,
    email_address,
    website_url,
    invoice_type,
    contact_person_name,
    contact_person_mobile,
    contact_person_designation,
    contact_person_department,
    currency_code,
    account_number,
    account_name,
    bank_name,
    branch_name,
    ifsc_code,
    pan_tan_number,
    supplier_status,
    active_flag,
    deactivation_remarks,
    other_legal_requirements,
    payment_terms,
    transport_mode,
    allowed_transport_modes,
    created_by
  )
  VALUES
  (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`;

export const UPDATE_SUPPLIER = `
  UPDATE supplier_master
  SET
    supplier_type = ?,
    supplier_name = ?,
    supplier_short_name = ?,
    plant_code = ?,
    billing_address = ?,
    delivery_address = ?,
    delivery_terms = ?,
    pin_code = ?,
    city = ?,
    state_name = ?,
    country_name = ?,
    gst_number = ?,
    pan_number = ?,
    mobile_number = ?,
    phone_number = ?,
    fax_number = ?,
    email_address = ?,
    website_url = ?,
    invoice_type = ?,
    contact_person_name = ?,
    contact_person_mobile = ?,
    contact_person_designation = ?,
    contact_person_department = ?,
    currency_code = ?,
    account_number = ?,
    account_name = ?,
    bank_name = ?,
    branch_name = ?,
    ifsc_code = ?,
    pan_tan_number = ?,
    other_legal_requirements = ?,
    payment_terms = ?,
    transport_mode = ?,
    allowed_transport_modes = ?,
    updated_by = ?
  WHERE supplier_id = ?
`;

export const UPDATE_SUPPLIER_STATUS = `
  UPDATE supplier_master
  SET
    supplier_status = ?,
    active_flag = ?,
    deactivation_remarks = ?,
    updated_by = ?
  WHERE supplier_id = ?
`;
