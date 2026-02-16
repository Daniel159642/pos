-- Remove all existing email templates. New templates created via Settings will use La Maison style.
-- Run this migration to clear old templates (Default, Marketing, etc.) and start fresh.

DELETE FROM email_templates;
