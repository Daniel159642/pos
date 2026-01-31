-- Add total_spent to customers for rewards tracking (optional; code handles missing column)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
