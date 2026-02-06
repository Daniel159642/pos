-- Add show_tip to receipt_settings so tip can be shown in totals section when a tip is added
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_tip INTEGER DEFAULT 1 CHECK (show_tip IN (0, 1));
