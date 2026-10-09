ALTER TABLE marketing_enquiry_parts
  ADD COLUMN alternative_material VARCHAR(300) NULL
  AFTER material_and_grade;
