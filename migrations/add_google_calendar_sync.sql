-- Google Calendar sync: token storage and link from master_calendar to Google events
-- Run once: psql $DATABASE_URL -f migrations/add_google_calendar_sync.sql

-- Tokens per employee (who connected their Google account)
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_employee ON google_calendar_tokens(employee_id);

-- Link POS calendar events to Google Calendar event IDs (for updates/de-duplication)
ALTER TABLE master_calendar ADD COLUMN IF NOT EXISTS google_event_id TEXT;
COMMENT ON COLUMN master_calendar.google_event_id IS 'Google Calendar event id when synced (for PATCH/delete)';
