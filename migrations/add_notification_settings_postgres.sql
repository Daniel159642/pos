-- Email & SMS notification preferences and email provider
-- Run after add_sms_tables_postgres.sql. Adds email config and per-category toggles.

-- Add email provider and preferences to sms_settings (reuse for unified notifications)
ALTER TABLE sms_settings
  ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'gmail' CHECK (email_provider IN ('gmail', 'aws_ses')),
  ADD COLUMN IF NOT EXISTS email_from_address TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';

-- notification_preferences structure:
-- {
--   "orders": { "email": true, "sms": false },
--   "reports": { "email": true, "sms": false },
--   "scheduling": { "email": true, "sms": true },
--   "clockins": { "email": true, "sms": false },
--   "receipts": { "email": true, "sms": false }
-- }

COMMENT ON COLUMN sms_settings.email_provider IS 'gmail = SMTP (testing), aws_ses = AWS SES (production)';
COMMENT ON COLUMN sms_settings.notification_preferences IS 'JSON: per-category email/sms toggles';
