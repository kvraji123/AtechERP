-- Part Master: permanent, unique running Drawing Codes
--
-- Run this once in Adminer before deploying the matching backend code.
-- Generated codes are plain serials: 1, 2, 3, ... and never reset by year.
-- Existing numeric Drawing Codes are used to seed the next serial.

-- Empty values are legacy placeholders, not Drawing Codes. Converting them to
-- NULL allows the unique index to accept any number of legacy blank records.
UPDATE part_master
SET drawing_code = NULL
WHERE part_id > 0
  AND TRIM(COALESCE(drawing_code, '')) = '';

SET @drawing_code_duplicate_count := (
  SELECT COUNT(*)
  FROM (
    SELECT UPPER(TRIM(drawing_code)) AS drawing_code_key
    FROM part_master
    WHERE TRIM(COALESCE(drawing_code, '')) <> ''
    GROUP BY UPPER(TRIM(drawing_code))
    HAVING COUNT(*) > 1
  ) AS duplicate_drawing_codes
);

SET @has_drawing_code_unique_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'part_master'
    AND INDEX_NAME = 'uq_part_master_drawing_code'
);

-- Add the database-level uniqueness guarantee only when old data has no
-- duplicate non-empty values. NULL remains permitted for legacy rows.
SET @add_drawing_code_unique_index_sql := IF(
  @has_drawing_code_unique_index = 0 AND @drawing_code_duplicate_count = 0,
  'ALTER TABLE part_master ADD UNIQUE KEY uq_part_master_drawing_code (drawing_code)',
  'SELECT 1'
);
PREPARE add_drawing_code_unique_index_statement FROM @add_drawing_code_unique_index_sql;
EXECUTE add_drawing_code_unique_index_statement;
DEALLOCATE PREPARE add_drawing_code_unique_index_statement;

-- Use the shared sequence table with a fixed scope so this serial does not
-- restart at the next financial year.
INSERT INTO app_document_sequences
  (sequence_key, financial_year, prefix, current_number, number_padding)
SELECT
  'DRAWING_CODE',
  'GLOBAL',
  '',
  COALESCE(MAX(CAST(TRIM(drawing_code) AS UNSIGNED)), 0),
  1
FROM part_master
WHERE TRIM(COALESCE(drawing_code, '')) REGEXP '^[0-9]+$'
ON DUPLICATE KEY UPDATE
  prefix = VALUES(prefix),
  current_number = GREATEST(current_number, VALUES(current_number)),
  number_padding = VALUES(number_padding);

SELECT
  CASE
    WHEN @drawing_code_duplicate_count > 0 THEN
      'Drawing Code sequence seeded, but the unique index was not added. Correct the duplicate codes listed below and run this migration again.'
    WHEN @has_drawing_code_unique_index > 0 THEN
      'Drawing Code sequence seeded; the unique index already exists.'
    ELSE
      'Drawing Code sequence seeded and the unique index was added.'
  END AS result;

SELECT
  UPPER(TRIM(drawing_code)) AS duplicate_drawing_code,
  GROUP_CONCAT(part_id ORDER BY part_id) AS part_ids,
  COUNT(*) AS occurrences
FROM part_master
WHERE TRIM(COALESCE(drawing_code, '')) <> ''
GROUP BY UPPER(TRIM(drawing_code))
HAVING COUNT(*) > 1;
