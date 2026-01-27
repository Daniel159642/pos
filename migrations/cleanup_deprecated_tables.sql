-- ============================================================================
-- CLEANUP MIGRATION - DROP DEPRECATED TABLES AND COLUMNS
-- ============================================================================
-- WARNING: Only run this after updating all application code to use the new structure
-- This migration removes deprecated tables and columns that were kept for backward compatibility
--
-- Run this migration AFTER:
-- 1. All code has been updated to use orders/order_items instead of sales table
-- 2. All code has been updated to use payment_transactions.payment_method
-- 3. All code has been updated to use inventory.vendor_id instead of vendor
-- 4. All code has been updated to use time_clock instead of employee_schedule clock fields
-- 5. All code has been updated to use audit_log instead of activity_log

BEGIN;

-- ============================================================================
-- 1. DROP SALES VIEW AND OLD TABLE (replaced by orders/order_items)
-- ============================================================================
-- Drop the view first (if it exists)
DROP VIEW IF EXISTS sales CASCADE;
-- Drop the old backup table (if it exists)
DROP TABLE IF EXISTS sales_old CASCADE;

-- ============================================================================
-- 2. DROP PENDING_SHIPMENTS TABLES (unified into shipments)
-- ============================================================================
DROP TABLE IF EXISTS pending_shipment_items CASCADE;
DROP TABLE IF EXISTS pending_shipments CASCADE;

-- ============================================================================
-- 3. DROP ACTIVITY_LOG TABLE (consolidated into audit_log)
-- ============================================================================
DROP TABLE IF EXISTS activity_log CASCADE;

-- ============================================================================
-- 4. REMOVE DEPRECATED COLUMNS
-- ============================================================================

-- Remove payment_method from orders
ALTER TABLE orders DROP COLUMN IF EXISTS payment_method;

-- Remove vendor TEXT field from inventory
ALTER TABLE inventory DROP COLUMN IF EXISTS vendor;

-- Remove clock tracking fields from employee_schedule
ALTER TABLE employee_schedule DROP COLUMN IF EXISTS clock_in_time;
ALTER TABLE employee_schedule DROP COLUMN IF EXISTS clock_out_time;
ALTER TABLE employee_schedule DROP COLUMN IF EXISTS hours_worked;
ALTER TABLE employee_schedule DROP COLUMN IF EXISTS overtime_hours;

COMMIT;

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
