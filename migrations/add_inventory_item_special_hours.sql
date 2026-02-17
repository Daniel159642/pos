-- DoorDash item-level hours: when an item is available (e.g. breakfast 5am–11am, LTO dates).
-- Store as JSONB array; when absent, DoorDash uses store-level open_hours for the item.

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS item_special_hours JSONB;

COMMENT ON COLUMN inventory.item_special_hours IS 'DoorDash item-level availability: array of { day_index?, start_time?, end_time?, start_date?, end_date? }. Example: [{"day_index":"MON","start_time":"05:00:00","end_time":"17:00:00"}]';
