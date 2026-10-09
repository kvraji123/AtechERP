-- Retire these options only within Consumables; preserve records and PU categories.
UPDATE item_type_master T
JOIN item_group_master G ON G.item_group_id=T.item_group_id
SET T.active_flag='N', T.updated_by='SYSTEM'
WHERE T.item_type_id > 0 AND G.group_code='CM'
  AND T.type_name IN ('Fasteners','Plug','Plugs','Purchase Items','Purchased Item','Purchased Items','Spring','Springs');
