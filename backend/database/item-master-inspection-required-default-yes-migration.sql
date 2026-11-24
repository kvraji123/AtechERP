-- New Item Master records require incoming inspection by default.
-- Existing items retain their current Y/N selection.
ALTER TABLE item_master
  MODIFY COLUMN inspection_required ENUM('Y', 'N') NOT NULL DEFAULT 'Y';
