-- Email templates for customizable notification designs (receipt, order, report, schedule, clockin)
-- Run after add_sms_tables_postgres.sql and add_notification_settings_postgres.sql

CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('receipt', 'order', 'report', 'schedule', 'clockin', 'generic')),
    name TEXT NOT NULL,
    subject_template TEXT NOT NULL,
    body_html_template TEXT NOT NULL,
    body_text_template TEXT,
    variables JSONB,
    is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_store_category ON email_templates(store_id, category);

-- Seed default templates for store 1 (create store if missing)
DO $$
DECLARE
    sid INTEGER;
BEGIN
    SELECT store_id INTO sid FROM stores WHERE store_id = 1 LIMIT 1;
    IF sid IS NULL THEN
        INSERT INTO stores (store_id, store_name, is_active) VALUES (1, 'Default Store', 1) ON CONFLICT DO NOTHING;
        sid := 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE store_id = sid AND category = 'receipt') THEN
        INSERT INTO email_templates (store_id, category, name, subject_template, body_html_template, body_text_template, is_default) VALUES
        (sid, 'receipt', 'Default Receipt',
         'Receipt for Order {{order_number}}',
         '<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;"><h2 style="text-align: center;">{{store_name}}</h2><p style="text-align: center; color: #666;">Order #{{order_number}} · {{order_date}}</p><hr><div>{{items_html}}</div><hr><p style="text-align: right;">Subtotal: ${{subtotal}}<br>Tax: ${{tax}}<br><strong>Total: ${{total}}</strong></p><p style="text-align: center; font-size: 12px; color: #999;">{{footer_message}}</p></div>',
         'Receipt for Order {{order_number}}\n{{store_name}}\nOrder #{{order_number}} {{order_date}}\n{{items_text}}\nSubtotal: ${{subtotal}} Tax: ${{tax}} Total: ${{total}}\n{{footer_message}}',
         1);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE store_id = sid AND category = 'order') THEN
        INSERT INTO email_templates (store_id, category, name, subject_template, body_html_template, body_text_template, is_default) VALUES
        (sid, 'order', 'Default Order Alert',
         'New Order #{{order_number}}',
         '<div style="font-family: sans-serif;"><h2>New Order Received</h2><p><strong>Order #{{order_number}}</strong></p><p>Total: ${{total}}</p><p>{{store_name}}</p></div>',
         'New Order #{{order_number}}\nTotal: ${{total}}\n{{store_name}}',
         1);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE store_id = sid AND category = 'schedule') THEN
        INSERT INTO email_templates (store_id, category, name, subject_template, body_html_template, body_text_template, is_default) VALUES
        (sid, 'schedule', 'Default Schedule',
         'Your Schedule Has Been Updated',
         '<div style="font-family: sans-serif;"><h2>Schedule Update</h2><p>{{message}}</p><p>{{store_name}}</p></div>',
         'Schedule Update\n{{message}}\n{{store_name}}',
         1);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE store_id = sid AND category = 'clockin') THEN
        INSERT INTO email_templates (store_id, category, name, subject_template, body_html_template, body_text_template, is_default) VALUES
        (sid, 'clockin', 'Default Clock-in',
         'Clock {{action}} Confirmation',
         '<div style="font-family: sans-serif;"><p>{{employee_name}} {{action}}.</p><p>{{store_name}}</p></div>',
         '{{employee_name}} {{action}}.\n{{store_name}}',
         1);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE store_id = sid AND category = 'report') THEN
        INSERT INTO email_templates (store_id, category, name, subject_template, body_html_template, body_text_template, is_default) VALUES
        (sid, 'report', 'Default Report',
         '{{report_name}} - {{report_date}}',
         '<div style="font-family: sans-serif;"><h2>{{report_name}}</h2><p>Report date: {{report_date}}</p><p>{{store_name}}</p></div>',
         '{{report_name}}\nReport date: {{report_date}}\n{{store_name}}',
         1);
    END IF;
END $$;
