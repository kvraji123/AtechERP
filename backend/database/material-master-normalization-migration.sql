-- Separates base materials from grades for Part and Item Master dropdowns.
-- Existing Item and Part records are remapped before grade-only legacy materials
-- are deactivated, so foreign-key history remains intact.

INSERT INTO material_master (material_name, active_flag) VALUES
  ('Aluminium', 'Y'), ('Alloy Steel', 'Y'), ('Carbon Steel', 'Y'),
  ('Mild Steel', 'Y'), ('Stainless Steel', 'Y'), ('Cast Iron', 'Y'),
  ('Brass', 'Y'), ('Bronze', 'Y'), ('Gun Metal', 'Y'), ('Carbide', 'Y'),
  ('High-Speed Steel', 'Y'), ('Nylon', 'Y'), ('Delrin', 'Y'), ('Teflon', 'Y'),
  ('Plastic', 'Y'), ('Granite', 'Y'), ('Spring Steel', 'Y'), ('Iron', 'Y'),
  ('Steel', 'Y')
ON DUPLICATE KEY UPDATE active_flag = 'Y';

INSERT INTO material_grade_master (material_id, grade_code, grade_name, active_flag)
SELECT M.material_id, X.grade_code, X.grade_name, 'Y'
FROM (
  SELECT 'Aluminium' AS material_name, 'GENERAL' AS grade_code, 'General' AS grade_name UNION ALL
  SELECT 'Aluminium', '6061', '6061' UNION ALL
  SELECT 'Aluminium', '6063', '6063' UNION ALL
  SELECT 'Alloy Steel', '16MNCR5', '16MnCr5' UNION ALL
  SELECT 'Alloy Steel', 'EN19', 'EN19' UNION ALL
  SELECT 'Alloy Steel', 'EN24', 'EN24' UNION ALL
  SELECT 'Alloy Steel', 'EN353', 'EN353' UNION ALL
  SELECT 'Alloy Steel', 'EN47', 'EN47' UNION ALL
  SELECT 'Carbon Steel', 'C45', 'C45' UNION ALL
  SELECT 'Carbon Steel', 'EN8', 'EN8' UNION ALL
  SELECT 'Carbon Steel', 'EN8/45', 'EN8/45' UNION ALL
  SELECT 'Mild Steel', 'GENERAL', 'General' UNION ALL
  SELECT 'Mild Steel', 'LOW-CARBON', 'Low Carbon Steel' UNION ALL
  SELECT 'Mild Steel', 'CR-SHEET', 'CR Sheet' UNION ALL
  SELECT 'Stainless Steel', 'SS303', 'SS303' UNION ALL
  SELECT 'Stainless Steel', 'SS304', 'SS304' UNION ALL
  SELECT 'Stainless Steel', 'SS316', 'SS316' UNION ALL
  SELECT 'Stainless Steel', 'SS402', 'SS402' UNION ALL
  SELECT 'Stainless Steel', 'SS410', 'SS410' UNION ALL
  SELECT 'Stainless Steel', 'SS416', 'SS416' UNION ALL
  SELECT 'Stainless Steel', 'SS420', 'SS420' UNION ALL
  SELECT 'Stainless Steel', 'SS431', 'SS431' UNION ALL
  SELECT 'Cast Iron', 'GENERAL', 'General' UNION ALL
  SELECT 'Brass', 'GENERAL', 'General' UNION ALL
  SELECT 'Bronze', 'GENERAL', 'General' UNION ALL
  SELECT 'Gun Metal', 'GENERAL', 'General' UNION ALL
  SELECT 'Carbide', 'GENERAL', 'General' UNION ALL
  SELECT 'High-Speed Steel', 'HSS', 'HSS' UNION ALL
  SELECT 'Nylon', 'GENERAL', 'General' UNION ALL
  SELECT 'Delrin', 'GENERAL', 'General' UNION ALL
  SELECT 'Teflon', 'GENERAL', 'General' UNION ALL
  SELECT 'Plastic', 'GENERAL', 'General' UNION ALL
  SELECT 'Granite', 'GENERAL', 'General' UNION ALL
  SELECT 'Spring Steel', 'GENERAL', 'General' UNION ALL
  SELECT 'Iron', 'GENERAL', 'General' UNION ALL
  SELECT 'Steel', 'GENERAL', 'General'
) X
JOIN material_master M ON M.material_name = X.material_name
ON DUPLICATE KEY UPDATE grade_name = VALUES(grade_name), active_flag = 'Y';

-- A record with a valid grade must always point to that grade's base material.
UPDATE part_master P
JOIN material_grade_master MG ON MG.material_grade_id = P.material_grade_id
SET P.material_id = MG.material_id
WHERE P.material_grade_id IS NOT NULL AND P.material_id <> MG.material_id;

UPDATE item_master I
JOIN material_grade_master MG ON MG.material_grade_id = I.material_grade_id
SET I.material_id = MG.material_id
WHERE I.material_grade_id IS NOT NULL AND I.material_id <> MG.material_id;

-- Map old Material-only grade selections to their new parent material and grade.
UPDATE part_master P
JOIN material_master L ON L.material_id = P.material_id
JOIN (
  SELECT '6061' AS legacy_name, 'Aluminium' AS material_name, '6061' AS grade_code UNION ALL
  SELECT '6063', 'Aluminium', '6063' UNION ALL
  SELECT '16MnCr5', 'Alloy Steel', '16MNCR5' UNION ALL
  SELECT 'C45', 'Carbon Steel', 'C45' UNION ALL
  SELECT 'CR Sheet (MS)', 'Mild Steel', 'CR-SHEET' UNION ALL
  SELECT 'EN 24', 'Alloy Steel', 'EN24' UNION ALL
  SELECT 'EN 353', 'Alloy Steel', 'EN353' UNION ALL
  SELECT 'EN 47', 'Alloy Steel', 'EN47' UNION ALL
  SELECT 'EN 8', 'Carbon Steel', 'EN8' UNION ALL
  SELECT 'EN 8/45', 'Carbon Steel', 'EN8/45' UNION ALL
  SELECT 'EN19', 'Alloy Steel', 'EN19' UNION ALL
  SELECT 'HSS', 'High-Speed Steel', 'HSS' UNION ALL
  SELECT 'Low Carbon Steel', 'Mild Steel', 'LOW-CARBON' UNION ALL
  SELECT 'SS 303', 'Stainless Steel', 'SS303' UNION ALL
  SELECT 'SS 304', 'Stainless Steel', 'SS304' UNION ALL
  SELECT 'SS 316', 'Stainless Steel', 'SS316' UNION ALL
  SELECT 'SS 402', 'Stainless Steel', 'SS402' UNION ALL
  SELECT 'SS 410', 'Stainless Steel', 'SS410' UNION ALL
  SELECT 'SS 416', 'Stainless Steel', 'SS416' UNION ALL
  SELECT 'SS 420', 'Stainless Steel', 'SS420' UNION ALL
  SELECT 'SS 431', 'Stainless Steel', 'SS431'
) X ON X.legacy_name = L.material_name
JOIN material_master M ON M.material_name = X.material_name
JOIN material_grade_master MG ON MG.material_id = M.material_id AND MG.grade_code = X.grade_code
SET P.material_id = M.material_id, P.material_grade_id = MG.material_grade_id
WHERE P.material_grade_id IS NULL;

UPDATE item_master I
JOIN material_master L ON L.material_id = I.material_id
JOIN (
  SELECT '6061' AS legacy_name, 'Aluminium' AS material_name, '6061' AS grade_code UNION ALL
  SELECT '6063', 'Aluminium', '6063' UNION ALL
  SELECT '16MnCr5', 'Alloy Steel', '16MNCR5' UNION ALL
  SELECT 'C45', 'Carbon Steel', 'C45' UNION ALL
  SELECT 'CR Sheet (MS)', 'Mild Steel', 'CR-SHEET' UNION ALL
  SELECT 'EN 24', 'Alloy Steel', 'EN24' UNION ALL
  SELECT 'EN 353', 'Alloy Steel', 'EN353' UNION ALL
  SELECT 'EN 47', 'Alloy Steel', 'EN47' UNION ALL
  SELECT 'EN 8', 'Carbon Steel', 'EN8' UNION ALL
  SELECT 'EN 8/45', 'Carbon Steel', 'EN8/45' UNION ALL
  SELECT 'EN19', 'Alloy Steel', 'EN19' UNION ALL
  SELECT 'HSS', 'High-Speed Steel', 'HSS' UNION ALL
  SELECT 'Low Carbon Steel', 'Mild Steel', 'LOW-CARBON' UNION ALL
  SELECT 'SS 303', 'Stainless Steel', 'SS303' UNION ALL
  SELECT 'SS 304', 'Stainless Steel', 'SS304' UNION ALL
  SELECT 'SS 316', 'Stainless Steel', 'SS316' UNION ALL
  SELECT 'SS 402', 'Stainless Steel', 'SS402' UNION ALL
  SELECT 'SS 410', 'Stainless Steel', 'SS410' UNION ALL
  SELECT 'SS 416', 'Stainless Steel', 'SS416' UNION ALL
  SELECT 'SS 420', 'Stainless Steel', 'SS420' UNION ALL
  SELECT 'SS 431', 'Stainless Steel', 'SS431'
) X ON X.legacy_name = L.material_name
JOIN material_master M ON M.material_name = X.material_name
JOIN material_grade_master MG ON MG.material_id = M.material_id AND MG.grade_code = X.grade_code
SET I.material_id = M.material_id, I.material_grade_id = MG.material_grade_id
WHERE I.material_grade_id IS NULL;

-- Retain the legacy rows for audit and foreign keys, but exclude them from selectors.
UPDATE material_master
SET active_flag = 'N'
WHERE material_name IN (
  '6061', '6063', '16MnCr5', 'C45', 'CR Sheet (MS)', 'EN 24', 'EN 353',
  'EN 47', 'EN 8', 'EN 8/45', 'EN19', 'HSS', 'Low Carbon Steel',
  'SS 303', 'SS 304', 'SS 316', 'SS 402', 'SS 410', 'SS 416', 'SS 420', 'SS 431'
);
