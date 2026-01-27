-- Migration to remove transaction_number and use order_number instead
-- This consolidates the system to only use order numbers for identification

-- Step 1: Add order_id column to transactions table (nullable for now)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(order_id) ON DELETE SET NULL;

-- Step 2: Link existing transactions to orders if possible (based on matching dates/employees)
-- This is optional - only if you want to preserve existing data
-- UPDATE transactions t
-- SET order_id = (
--     SELECT o.order_id 
--     FROM orders o 
--     WHERE o.employee_id = t.employee_id 
--     AND DATE(o.order_date) = DATE(t.created_at)
--     AND ABS(EXTRACT(EPOCH FROM (o.order_date - t.created_at))) < 60
--     LIMIT 1
-- )
-- WHERE t.order_id IS NULL;

-- Step 3: Remove transaction_number column
ALTER TABLE transactions DROP COLUMN IF EXISTS transaction_number;

-- Step 4: Remove the unique constraint on transaction_number (if it exists as a separate constraint)
-- This is handled by dropping the column above

-- Step 5: Create index on order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
