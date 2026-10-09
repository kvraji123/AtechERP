UPDATE marketing_enquiries
SET enquiry_status = CASE
  WHEN enquiry_status IN (
    'IN_PROGRESS',
    'QUOTED',
    'ORDER_RECEIVED'
  ) THEN enquiry_status
  WHEN enquiry_status = 'ENQUIRED'
    THEN 'IN_PROGRESS'
  WHEN enquiry_status = 'CLOSED'
    AND enquiry_conversion = 'QUOTED'
    THEN 'QUOTED'
  WHEN current_stage = 'ENQUIRY'
    THEN 'IN_PROGRESS'
  ELSE 'IN_PROGRESS'
END;

ALTER TABLE marketing_enquiries
  MODIFY enquiry_status VARCHAR(30)
  NOT NULL DEFAULT 'IN_PROGRESS';
