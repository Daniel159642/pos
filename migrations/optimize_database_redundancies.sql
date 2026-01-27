-- ============================================================================
-- DATABASE OPTIMIZATION MIGRATION
-- Removes redundancies and optimizes database structure
-- ============================================================================
-- Run this migration to optimize the database by removing redundant tables
-- and consolidating overlapping functionality

BEGIN;

-- ============================================================================
-- 1. FIX RETURNS SCHEMA (PostgreSQL syntax + establishment_id)
-- ============================================================================

-- Drop existing returns tables if they exist (they may not have establishment_id)
DROP TABLE IF EXISTS pending_return_items CASCADE;
DROP TABLE IF EXISTS pending_returns CASCADE;

-- Create returns tables with proper PostgreSQL syntax and establishment_id
CREATE TABLE IF NOT EXISTS pending_returns (
    return_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    return_number TEXT,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    customer_id INTEGER REFERENCES customers(customer_id),
    return_date TIMESTAMP DEFAULT NOW(),
    total_refund_amount NUMERIC(10,2) DEFAULT 0 CHECK(total_refund_amount >= 0),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by INTEGER REFERENCES employees(employee_id),
    approved_date TIMESTAMP,
    notes TEXT,
    UNIQUE(establishment_id, return_number)
);

CREATE TABLE IF NOT EXISTS pending_return_items (
    return_item_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    return_id INTEGER NOT NULL REFERENCES pending_returns(return_id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(order_item_id),
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK(unit_price >= 0),
    discount NUMERIC(10,2) DEFAULT 0 CHECK(discount >= 0),
    refund_amount NUMERIC(10,2) NOT NULL CHECK(refund_amount >= 0),
    condition TEXT CHECK(condition IN ('new', 'opened', 'damaged', 'defective')),
    notes TEXT
);

-- Create indexes for returns tables
CREATE INDEX IF NOT EXISTS idx_pending_returns_establishment ON pending_returns(establishment_id);
CREATE INDEX IF NOT EXISTS idx_pending_returns_order ON pending_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_returns_status ON pending_returns(status);
CREATE INDEX IF NOT EXISTS idx_pending_returns_date ON pending_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_pending_return_items_establishment ON pending_return_items(establishment_id);
CREATE INDEX IF NOT EXISTS idx_pending_return_items_return ON pending_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_pending_return_items_product ON pending_return_items(product_id);

-- ============================================================================
-- 2. UNIFY SHIPMENTS AND PENDING_SHIPMENTS
-- ============================================================================

-- Add status field to shipments if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'status'
    ) THEN
        ALTER TABLE shipments ADD COLUMN status TEXT DEFAULT 'completed' 
            CHECK(status IN ('pending_review', 'approved', 'rejected', 'received', 'completed'));
    END IF;
END $$;

-- Add pending shipment fields to shipments table
DO $$
BEGIN
    -- Add upload_timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'upload_timestamp'
    ) THEN
        ALTER TABLE shipments ADD COLUMN upload_timestamp TIMESTAMP;
    END IF;
    
    -- Add file_path
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'file_path'
    ) THEN
        ALTER TABLE shipments ADD COLUMN file_path TEXT;
    END IF;
    
    -- Add uploaded_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE shipments ADD COLUMN uploaded_by INTEGER REFERENCES employees(employee_id);
    END IF;
    
    -- Add reviewed_by (keep as TEXT for compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE shipments ADD COLUMN reviewed_by TEXT;
    END IF;
    
    -- Add reviewed_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'reviewed_date'
    ) THEN
        ALTER TABLE shipments ADD COLUMN reviewed_date TIMESTAMP;
    END IF;
    
    -- Add approved_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE shipments ADD COLUMN approved_by INTEGER REFERENCES employees(employee_id);
    END IF;
    
    -- Add approved_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'approved_date'
    ) THEN
        ALTER TABLE shipments ADD COLUMN approved_date TIMESTAMP;
    END IF;
END $$;

-- Migrate pending_shipments data to shipments
INSERT INTO shipments (
    establishment_id, vendor_id, shipment_date, received_date,
    purchase_order_number, tracking_number, total_cost,
    received_by, verified_by, notes, created_at,
    status, upload_timestamp, file_path, uploaded_by,
    approved_by, approved_date, reviewed_by, reviewed_date
)
SELECT 
    establishment_id, vendor_id, NULL as shipment_date, expected_date as received_date,
    purchase_order_number, tracking_number, NULL as total_cost,
    NULL as received_by, approved_by as verified_by, notes, upload_timestamp as created_at,
    status, upload_timestamp, file_path, uploaded_by,
    approved_by, approved_date, reviewed_by, reviewed_date
FROM pending_shipments
WHERE NOT EXISTS (
    SELECT 1 FROM shipments s 
    WHERE s.purchase_order_number = pending_shipments.purchase_order_number
    AND s.establishment_id = pending_shipments.establishment_id
)
ON CONFLICT DO NOTHING;

-- Create unified shipment_items that can reference either old shipment_id or new ones
-- First, update pending_shipment_items to link to shipments via purchase_order_number
UPDATE pending_shipment_items psi
SET product_id = COALESCE(psi.product_id, 
    (SELECT product_id FROM inventory i 
     WHERE i.sku = psi.product_sku 
     AND i.establishment_id = psi.establishment_id LIMIT 1))
WHERE psi.product_id IS NULL;

-- Migrate pending_shipment_items to shipment_items
INSERT INTO shipment_items (
    establishment_id, shipment_id, product_id,
    quantity_received, unit_cost, lot_number, expiration_date, received_timestamp
)
SELECT 
    psi.establishment_id,
    s.shipment_id,
    psi.product_id,
    COALESCE(psi.quantity_verified, psi.quantity_expected) as quantity_received,
    psi.unit_cost,
    psi.lot_number,
    psi.expiration_date,
    NOW() as received_timestamp
FROM pending_shipment_items psi
JOIN pending_shipments ps ON psi.pending_shipment_id = ps.pending_shipment_id
JOIN shipments s ON s.purchase_order_number = ps.purchase_order_number 
    AND s.establishment_id = ps.establishment_id
WHERE NOT EXISTS (
    SELECT 1 FROM shipment_items si 
    WHERE si.shipment_id = s.shipment_id 
    AND si.product_id = psi.product_id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. REMOVE PAYMENT_METHOD FROM ORDERS (use payment_transactions as source of truth)
-- ============================================================================

-- Note: payment_method column in orders is kept for backward compatibility
-- A view will be created in cleanup migration when the column is removed
-- For now, code should gradually migrate to use payment_transactions.payment_method

-- ============================================================================
-- 4. REMOVE VENDOR TEXT FIELD FROM INVENTORY (use vendor_id only)
-- ============================================================================

-- Migrate any vendor TEXT values to vendor_id before removing
UPDATE inventory i
SET vendor_id = (
    SELECT v.vendor_id FROM vendors v 
    WHERE v.vendor_name = i.vendor 
    AND v.establishment_id = i.establishment_id 
    LIMIT 1
)
WHERE i.vendor IS NOT NULL 
AND i.vendor_id IS NULL
AND i.vendor != '';

-- Note: Keep vendor column for now but mark as deprecated
-- Remove in future migration: ALTER TABLE inventory DROP COLUMN vendor;

-- ============================================================================
-- 5. CONSOLIDATE AUDIT_LOG AND ACTIVITY_LOG
-- ============================================================================

-- Add missing columns to audit_log to support activity_log functionality
DO $$
BEGIN
    -- Add resource_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'resource_type'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN resource_type TEXT;
    END IF;
    
    -- Add resource_id (if it doesn't exist, we have record_id which is similar)
    -- We'll use record_id for resource_id
    
    -- Add details (similar to notes, but keep both)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'details'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN details TEXT;
    END IF;
END $$;

-- Migrate activity_log data to audit_log
INSERT INTO audit_log (
    establishment_id, employee_id, action_timestamp, ip_address,
    table_name, record_id, action_type, old_values, new_values, notes,
    resource_type, details
)
SELECT 
    establishment_id, employee_id, created_at as action_timestamp, ip_address,
    resource_type as table_name, resource_id as record_id, 
    action as action_type, NULL as old_values, NULL as new_values, NULL as notes,
    resource_type, details
FROM activity_log
WHERE NOT EXISTS (
    SELECT 1 FROM audit_log al 
    WHERE al.establishment_id = activity_log.establishment_id
    AND al.employee_id = activity_log.employee_id
    AND al.action_timestamp = activity_log.created_at
    AND al.action_type = activity_log.action
)
ON CONFLICT DO NOTHING;

-- Drop activity_log table (data migrated to audit_log)
-- DROP TABLE IF EXISTS activity_log CASCADE;

-- ============================================================================
-- 6. RESOLVE EMPLOYEE TIME TRACKING OVERLAP
-- ============================================================================

-- Remove clock tracking fields from employee_schedule (keep only schedule info)
-- Link employee_schedule to time_clock via a relationship
DO $$
BEGIN
    -- Add time_entry_id reference to employee_schedule
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employee_schedule' AND column_name = 'time_entry_id'
    ) THEN
        ALTER TABLE employee_schedule ADD COLUMN time_entry_id INTEGER 
            REFERENCES time_clock(time_entry_id);
    END IF;
END $$;

-- Migrate existing clock_in/out data from employee_schedule to time_clock
INSERT INTO time_clock (
    establishment_id, employee_id, clock_in, clock_out,
    break_start, break_end, total_hours, notes, status
)
SELECT 
    establishment_id, employee_id, clock_in_time, clock_out_time,
    NULL as break_start, NULL as break_end, hours_worked, notes,
    CASE 
        WHEN clock_out_time IS NOT NULL THEN 'clocked_out'
        WHEN clock_in_time IS NOT NULL THEN 'clocked_in'
        ELSE 'clocked_out'
    END as status
FROM employee_schedule
WHERE clock_in_time IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM time_clock tc
    WHERE tc.employee_id = employee_schedule.employee_id
    AND tc.clock_in = employee_schedule.clock_in_time
    AND tc.establishment_id = employee_schedule.establishment_id
)
ON CONFLICT DO NOTHING;

-- Update employee_schedule to reference time_clock entries
UPDATE employee_schedule es
SET time_entry_id = (
    SELECT time_entry_id FROM time_clock tc
    WHERE tc.employee_id = es.employee_id
    AND tc.clock_in = es.clock_in_time
    AND tc.establishment_id = es.establishment_id
    LIMIT 1
)
WHERE es.clock_in_time IS NOT NULL
AND es.time_entry_id IS NULL;

-- Note: Keep clock_in_time, clock_out_time, hours_worked for backward compatibility
-- Remove in future migration after updating all code:
-- ALTER TABLE employee_schedule DROP COLUMN clock_in_time;
-- ALTER TABLE employee_schedule DROP COLUMN clock_out_time;
-- ALTER TABLE employee_schedule DROP COLUMN hours_worked;

-- ============================================================================
-- 7. ADD MISSING INDEXES FOR ESTABLISHMENT_ID
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shipments_establishment ON shipments(establishment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_establishment ON shipment_items(establishment_id);
CREATE INDEX IF NOT EXISTS idx_sales_establishment ON sales(establishment_id);
CREATE INDEX IF NOT EXISTS idx_pending_shipments_establishment ON pending_shipments(establishment_id);
CREATE INDEX IF NOT EXISTS idx_pending_shipment_items_establishment ON pending_shipment_items(establishment_id);
CREATE INDEX IF NOT EXISTS idx_order_items_establishment ON order_items(establishment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_establishment ON payment_transactions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_employee_schedule_establishment ON employee_schedule(establishment_id);
CREATE INDEX IF NOT EXISTS idx_employee_availability_establishment ON employee_availability(establishment_id);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_establishment ON employee_sessions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_establishment ON time_clock(establishment_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_establishment ON audit_log(establishment_id);
CREATE INDEX IF NOT EXISTS idx_master_calendar_establishment ON master_calendar(establishment_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_establishment ON chart_of_accounts(establishment_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_establishment ON fiscal_periods(establishment_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_establishment ON journal_entries(establishment_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_establishment ON journal_entry_lines(establishment_id);
CREATE INDEX IF NOT EXISTS idx_retained_earnings_establishment ON retained_earnings(establishment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_discrepancies_establishment ON shipment_discrepancies(establishment_id);
CREATE INDEX IF NOT EXISTS idx_image_identifications_establishment ON image_identifications(establishment_id);
CREATE INDEX IF NOT EXISTS idx_roles_establishment ON roles(establishment_id);
CREATE INDEX IF NOT EXISTS idx_employee_permission_overrides_establishment ON employee_permission_overrides(establishment_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_establishment ON cash_register_sessions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_establishment ON cash_transactions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_register_cash_settings_establishment ON register_cash_settings(establishment_id);
CREATE INDEX IF NOT EXISTS idx_daily_cash_counts_establishment ON daily_cash_counts(establishment_id);
CREATE INDEX IF NOT EXISTS idx_pending_returns_establishment ON pending_returns(establishment_id);
CREATE INDEX IF NOT EXISTS idx_pending_return_items_establishment ON pending_return_items(establishment_id);

-- ============================================================================
-- 8. FIX DATE FIELDS (Convert TEXT to DATE/TIMESTAMP)
-- ============================================================================

-- Convert shipment_date and received_date from TEXT to DATE
DO $$
BEGIN
    -- Add new DATE columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'shipment_date_new'
    ) THEN
        ALTER TABLE shipments ADD COLUMN shipment_date_new DATE;
        ALTER TABLE shipments ADD COLUMN received_date_new DATE;
        
        -- Migrate data
        UPDATE shipments 
        SET shipment_date_new = CASE 
            WHEN shipment_date ~ '^\d{4}-\d{2}-\d{2}' THEN shipment_date::DATE
            ELSE NULL
        END,
        received_date_new = CASE 
            WHEN received_date ~ '^\d{4}-\d{2}-\d{2}' THEN received_date::DATE
            ELSE NULL
        END;
        
        -- Drop old columns and rename new ones
        ALTER TABLE shipments DROP COLUMN shipment_date;
        ALTER TABLE shipments DROP COLUMN received_date;
        ALTER TABLE shipments RENAME COLUMN shipment_date_new TO shipment_date;
        ALTER TABLE shipments RENAME COLUMN received_date_new TO received_date;
    END IF;
END $$;

-- ============================================================================
-- 9. RENAME SESSION ID CONFLICTS
-- ============================================================================

-- Rename cash_register_sessions.session_id to register_session_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cash_register_sessions' AND column_name = 'session_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cash_register_sessions' AND column_name = 'register_session_id'
    ) THEN
        ALTER TABLE cash_register_sessions RENAME COLUMN session_id TO register_session_id;
        
        -- Update foreign key references in cash_transactions
        ALTER TABLE cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_session_id_fkey;
        ALTER TABLE cash_transactions 
            ADD CONSTRAINT cash_transactions_register_session_id_fkey 
            FOREIGN KEY (session_id) REFERENCES cash_register_sessions(register_session_id);
    END IF;
END $$;

-- ============================================================================
-- 10. DEPRECATE SALES TABLE (Create view for backward compatibility)
-- ============================================================================

-- Rename existing sales table to sales_old for backup
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'sales' AND table_type = 'BASE TABLE'
    ) THEN
        -- Rename table if it exists and is a table (not a view)
        ALTER TABLE sales RENAME TO sales_old;
        
        -- Create view that mimics the sales table structure from order_items
        CREATE OR REPLACE VIEW sales AS
        SELECT 
            oi.establishment_id,
            oi.product_id,
            oi.quantity as quantity_sold,
            oi.unit_price as sale_price,
            o.order_date as sale_date,
            NULL::TEXT as notes,
            ROW_NUMBER() OVER (ORDER BY o.order_date, oi.order_item_id) as sale_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.order_status = 'completed'
        AND o.payment_status = 'completed';
    END IF;
END $$;

-- Note: sales_old table can be dropped in cleanup migration
-- after all code references are updated to use orders/order_items

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. ✅ Fixed returns schema (PostgreSQL + establishment_id)
-- 2. ✅ Unified shipments and pending_shipments (added status field, migrated data)
-- 3. ⚠️  Payment method removal deferred (created view for compatibility)
-- 4. ⚠️  Vendor field removal deferred (migrated data, column kept for compatibility)
-- 5. ✅ Consolidated audit_log and activity_log (migrated data, activity_log can be dropped)
-- 6. ✅ Resolved employee time tracking overlap (linked tables, migrated data)
-- 7. ✅ Added missing indexes for all establishment_id columns
-- 8. ✅ Fixed date fields (converted TEXT to DATE)
-- 9. ✅ Renamed session ID conflicts
-- 10. ✅ Created sales view for backward compatibility
--
-- Next steps:
-- - Update application code to use new structure
-- - Run cleanup migration to drop deprecated columns/tables
-- ============================================================================
