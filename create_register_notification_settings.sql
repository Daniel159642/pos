CREATE TABLE IF NOT EXISTS register_notification_settings (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL UNIQUE DEFAULT 1,
    notify_admin_on_open BOOLEAN NOT NULL DEFAULT false,
    notify_admin_on_close BOOLEAN NOT NULL DEFAULT false,
    notify_admin_on_drop BOOLEAN NOT NULL DEFAULT false,
    notify_admin_on_withdraw BOOLEAN NOT NULL DEFAULT false,
    admin_email_ids INTEGER[] DEFAULT '{}'::integer[],
    notify_employee_self BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
