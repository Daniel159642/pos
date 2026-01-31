-- Add updated_at to customers and vendors so update_updated_at_column() trigger does not fail
-- (trigger is applied by accounting_triggers.sql; these tables may not have had the column)

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
