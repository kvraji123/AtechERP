-- Create the Purchased Item group. Specific categories are added separately.
START TRANSACTION;
INSERT INTO item_group_master (group_code, group_name)
VALUES ('PU', 'Purchased Item')
ON DUPLICATE KEY UPDATE group_name=VALUES(group_name), active_flag='Y';

COMMIT;
