-- Draft enquiries remain in the Enquiry stage with an In Progress status.
-- Submitted enquiries already advance to Feasibility with the same status.
UPDATE marketing_enquiries
SET enquiry_status = 'IN_PROGRESS'
WHERE enquiry_status = 'ENQUIRED';

ALTER TABLE marketing_enquiries
  MODIFY enquiry_status VARCHAR(30)
  NOT NULL DEFAULT 'IN_PROGRESS';
