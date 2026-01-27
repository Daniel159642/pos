-- Schedule notifications and change log (PostgreSQL)
-- Required for /api/schedule/<id>/publish and shift edit logging.
-- Python uses Schedule_Notifications, Schedule_Changes (Postgres lowercases to snake_case).

-- 1. Schedule Changes (audit log for schedule edits and publish)
CREATE TABLE IF NOT EXISTS schedule_changes (
    change_id SERIAL PRIMARY KEY,
    period_id INTEGER REFERENCES schedule_periods(period_id),
    scheduled_shift_id INTEGER REFERENCES scheduled_shifts(scheduled_shift_id),
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'modified', 'deleted', 'published')),
    changed_by INTEGER REFERENCES employees(employee_id),
    changed_at TIMESTAMP DEFAULT NOW(),
    old_values TEXT,
    new_values TEXT,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedule_changes_period ON schedule_changes(period_id);

-- 2. Schedule Notifications (notify employees when schedule published)
CREATE TABLE IF NOT EXISTS schedule_notifications (
    notification_id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES schedule_periods(period_id),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    notification_type TEXT CHECK (notification_type IN ('new_schedule', 'schedule_change', 'shift_reminder')),
    sent_via TEXT CHECK (sent_via IN ('email', 'sms', 'push', 'all')),
    sent_at TIMESTAMP DEFAULT NOW(),
    viewed INTEGER DEFAULT 0 CHECK (viewed IN (0, 1)),
    viewed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_notifications_period ON schedule_notifications(period_id);
CREATE INDEX IF NOT EXISTS idx_schedule_notifications_employee ON schedule_notifications(employee_id);
