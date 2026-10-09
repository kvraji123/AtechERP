-- ATECH ERP - Item Master consumables import
-- Source: D:/Atech/document/Item Master.xlsx and supplied consumables list
-- Target: MySQL database containing item_group_master, item_type_master,
--         uom_master and item_master.
--
-- Notes:
--   * The source contains 14 lines but two products are repeated.
--     This script imports 12 unique Item Master records.
--   * Quantities shown in the source are BOM/usage quantities, not minimum stock,
--     so minimum_stock is intentionally left NULL.
--   * The script is safe to run again: an existing item with the same Consumables
--     group and description is not inserted a second time.

SET NAMES utf8mb4;
START TRANSACTION;

-- Ensure the reference master rows required by this import are available.
INSERT INTO item_group_master
  (group_code, group_name, active_flag, created_by)
VALUES
  ('CM', 'Consumables', 'Y', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  group_name = VALUES(group_name),
  active_flag = 'Y',
  updated_by = 'SYSTEM';

SET @cm_group_id = (
  SELECT item_group_id
  FROM item_group_master
  WHERE group_code = 'CM'
  LIMIT 1
);

INSERT INTO item_type_master
  (item_group_id, type_name, description_prefix, item_code_prefix, active_flag, created_by)
SELECT
  @cm_group_id, 'Purchased Items', 'PUR', 'PUR', 'Y', 'SYSTEM'
WHERE NOT EXISTS (
  SELECT 1
  FROM item_type_master
  WHERE item_group_id = @cm_group_id
    AND type_name = 'Purchased Items'
);

UPDATE item_type_master
SET description_prefix = 'PUR',
    item_code_prefix = 'PUR',
    active_flag = 'Y',
    updated_by = 'SYSTEM'
WHERE item_group_id = @cm_group_id
  AND type_name = 'Purchased Items';

SET @purchase_item_type_id = (
  SELECT item_type_id
  FROM item_type_master
  WHERE item_group_id = @cm_group_id
    AND type_name = 'Purchased Items'
  LIMIT 1
);

INSERT INTO uom_master
  (uom_code, uom_name, active_flag, created_by)
VALUES
  ('NOS', 'Nos', 'Y', 'SYSTEM'),
  ('LTR', 'Litre', 'Y', 'SYSTEM')
ON DUPLICATE KEY UPDATE
  uom_name = VALUES(uom_name),
  active_flag = 'Y',
  updated_by = 'SYSTEM';

DROP TEMPORARY TABLE IF EXISTS tmp_item_master_consumables;
CREATE TEMPORARY TABLE tmp_item_master_consumables (
  source_order INT UNSIGNED NOT NULL,
  item_description VARCHAR(250) NOT NULL,
  item_specification VARCHAR(1000) NULL,
  uom_code VARCHAR(20) NOT NULL,
  PRIMARY KEY (source_order),
  UNIQUE KEY uq_tmp_item_description (item_description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_item_master_consumables
  (source_order, item_description, item_specification, uom_code)
VALUES
  (1,  'Groove Dowel - Dia 6x25',
       'Source reference: Dia 6x25; Groove Dowel', 'NOS'),
  (2,  'Bearing - 6202-2RS',
       'Source reference: 6202-2RS; Bearing', 'NOS'),
  (3,  'CirClip 35x1.5 DIN472',
       'Source reference: 5020003500; Size: 35x1.5; Standard: DIN472', 'NOS'),
  (4,  'Shim 25x35x1.5 DIN988',
       'Source reference: 5902503515; Size: 25x35x1.5; Standard: DIN988', 'NOS'),
  (5,  'Shim 25x35x1.0 DIN988',
       'Source reference: 5902503510; Size: 25x35x1.0; Standard: DIN988', 'NOS'),
  (6,  'Shim 25x35x0.3 DIN988',
       'Source reference: 5902503503; Size: 25x35x0.3; Standard: DIN988', 'NOS'),
  (7,  'Shim 25x35x0.1 DIN988',
       'Source reference: 5902503501; Size: 25x35x0.1; Standard: DIN988', 'NOS'),
  (8,  'Shaft Seal 15x35x7 BA Viton',
       'Source reference: 5701503537; Size: 15x35x7; Type: BA; Material: Viton', 'NOS'),
  (9,  'Cap 35x7 Viton - 35GENO33524',
       'Source reference: 5280003502; Size: 35x7; Material: Viton; Code: 35GENO33524', 'NOS'),
  (10, 'Mosil FGL 460 Food Grade Oil',
       'Specification: NSF H1 food-grade oil; Grade: Mosil FGL 460', 'LTR'),
  (11, '773 Gear Assembly Carton Box',
       'Size: 155x135x55; 3 ply; 150 GSM; Natural brown; Without laminate', 'NOS'),
  (12, 'Shaft Seal A17x35x7 DIN3760 Viton',
       'Source reference: 5701703537; Size: A17x35x7; Standard: DIN3760; Material: Viton', 'NOS');

-- Reactivate matching items without overwriting their existing business data.
UPDATE item_master I
JOIN tmp_item_master_consumables T
  ON T.item_description = I.item_description
SET I.item_status = 'ACTIVE',
    I.active_flag = 'Y',
    I.updated_by = 'SYSTEM'
WHERE I.item_group_id = @cm_group_id;

-- Begin after both the saved group sequence and any already-generated CM codes.
SET @item_sequence = (
  SELECT GREATEST(
    COALESCE(G.current_number, 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING_INDEX(I.item_code, '-', -1) AS UNSIGNED))
      FROM item_master I
      WHERE I.item_type_id = @purchase_item_type_id
    ), 0)
  )
  FROM item_group_master G
  WHERE G.item_group_id = @cm_group_id
);

INSERT INTO item_master
  (item_code, item_group_id, item_type_id, item_description,
   item_specification, uom_id, material_id, inspection_required,
   hsn_code, purchase_rate, minimum_stock, make_name, model_name,
   item_status, active_flag, created_by)
SELECT
  CONCAT('CM-PUR-', LPAD((@item_sequence := @item_sequence + 1), 6, '0')),
  @cm_group_id,
  @purchase_item_type_id,
  T.item_description,
  T.item_specification,
  U.uom_id,
  NULL,
  'N',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'ACTIVE',
  'Y',
  'SYSTEM'
FROM tmp_item_master_consumables T
JOIN uom_master U
  ON U.uom_code = T.uom_code
 AND U.active_flag = 'Y'
WHERE NOT EXISTS (
  SELECT 1
  FROM item_master I
  WHERE I.item_group_id = @cm_group_id
    AND I.item_description = T.item_description
)
ORDER BY T.source_order;

UPDATE item_group_master
SET current_number = @item_sequence,
    updated_by = 'SYSTEM'
WHERE item_group_id = @cm_group_id;

UPDATE item_type_master
SET current_number = @item_sequence,
    updated_by = 'SYSTEM'
WHERE item_type_id = @purchase_item_type_id;

DROP TEMPORARY TABLE IF EXISTS tmp_item_master_consumables;
COMMIT;

-- Verification result: should show the 12 unique imported records.
SELECT
  I.item_id,
  I.item_code,
  G.group_name AS item_group,
  T.type_name AS item_type,
  I.item_description,
  I.item_specification,
  U.uom_code,
  I.item_status
FROM item_master I
JOIN item_group_master G ON G.item_group_id = I.item_group_id
JOIN item_type_master T ON T.item_type_id = I.item_type_id
JOIN uom_master U ON U.uom_id = I.uom_id
WHERE G.group_code = 'CM'
  AND I.item_description IN (
    'Groove Dowel - Dia 6x25',
    'Bearing - 6202-2RS',
    'CirClip 35x1.5 DIN472',
    'Shim 25x35x1.5 DIN988',
    'Shim 25x35x1.0 DIN988',
    'Shim 25x35x0.3 DIN988',
    'Shim 25x35x0.1 DIN988',
    'Shaft Seal 15x35x7 BA Viton',
    'Cap 35x7 Viton - 35GENO33524',
    'Mosil FGL 460 Food Grade Oil',
    '773 Gear Assembly Carton Box',
    'Shaft Seal A17x35x7 DIN3760 Viton'
  )
ORDER BY I.item_id;
