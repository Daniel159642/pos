-- DoorDash "Store Temporarily Deactivated" webhook: store events for display in POS
CREATE TABLE IF NOT EXISTS doordash_store_deactivation_events (
    id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL,
    doordash_store_id INTEGER,
    merchant_supplied_id TEXT,
    reason_id INTEGER,
    reason TEXT,
    notes TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doordash_store_deactivation_events_establishment_created
    ON doordash_store_deactivation_events(establishment_id, created_at DESC);
