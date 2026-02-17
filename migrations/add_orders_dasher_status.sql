-- DoorDash Dasher Status webhook: store latest dasher status and optional dasher info on the order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dasher_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dasher_status_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dasher_info JSONB;
