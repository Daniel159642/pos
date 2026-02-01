-- Calendar subscriptions for iCal/Google Calendar feed (employee calendar links)
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS calendar_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    subscription_token VARCHAR(255) NOT NULL,
    include_shifts SMALLINT DEFAULT 1,
    include_shipments SMALLINT DEFAULT 1,
    include_meetings SMALLINT DEFAULT 1,
    include_deadlines SMALLINT DEFAULT 1,
    calendar_name VARCHAR(255) DEFAULT 'My Work Schedule',
    is_active SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
