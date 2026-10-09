// src/modules/customer/customer.queries.js

export const LIST_CUSTOMERS = `
  SELECT
    customer_id AS customerId,
    customer_type AS customerType,
    customer_code AS customerCode,
    customer_name AS customerName,
    customer_short_name AS customerShortName,
    plant_code AS plantCode,
    city,
    state_name AS stateName,
    country_name AS countryName,
    gst_number AS gstNumber,
    mobile_number AS mobileNumber,
    email_address AS emailAddress,
    currency_code AS currencyCode,
    transport_mode,
    allowed_transport_modes,
    customer_status AS customerStatus,
    active_flag AS activeFlag,
    COALESCE(updated_on, created_on) AS lastUpdated
  FROM customer_master
  WHERE party_type IN ('CUSTOMER', 'BOTH') AND (
      ? = ''
      OR customer_code LIKE CONCAT('%', ?, '%')
      OR customer_name LIKE CONCAT('%', ?, '%')
      OR customer_short_name LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = ''
      OR active_flag = ?
    )
  ORDER BY
    COALESCE(updated_on, created_on) DESC,
    customer_id DESC
`;

export const COUNT_CUSTOMERS = `
  SELECT
    COUNT(*) AS total
  FROM customer_master
  WHERE party_type IN ('CUSTOMER', 'BOTH') AND (
      ? = ''
      OR customer_code LIKE CONCAT('%', ?, '%')
      OR customer_name LIKE CONCAT('%', ?, '%')
      OR customer_short_name LIKE CONCAT('%', ?, '%')
    )
    AND (
      ? = ''
      OR active_flag = ?
    )
`;

export const GET_CUSTOMER_BY_ID = `
  SELECT *
  FROM customer_master
  WHERE customer_id = ? AND party_type IN ('CUSTOMER', 'BOTH')
`;

export const INSERT_CUSTOMER = `
  INSERT INTO customer_master
  (
    customer_type,
    customer_code,
    customer_name,
    customer_short_name,
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
    customer_status,
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

export const UPDATE_CUSTOMER = `
  UPDATE customer_master
  SET
    customer_type = ?,
    customer_name = ?,
    customer_short_name = ?,
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
  WHERE customer_id = ?
`;

export const UPDATE_CUSTOMER_STATUS = `
  UPDATE customer_master
  SET
    customer_status = ?,
    active_flag = ?,
    deactivation_remarks = ?,
    updated_by = ?
  WHERE customer_id = ?
`;
