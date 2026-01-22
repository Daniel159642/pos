-- ============================================================================
-- MASTER SETUP SCRIPT FOR POS ACCOUNTING SYSTEM
-- Run this script to set up the complete accounting database
-- ============================================================================

-- This script should be run in order:
-- 1. accounting_schema.sql (tables, constraints, indexes)
-- 2. accounting_triggers.sql (triggers for validation and audit)
-- 3. accounting_functions.sql (functions for calculations and reporting)
-- 4. accounting_seed_data.sql (default chart of accounts and sample data)

-- Note: Run each file separately or combine them in this order

\echo 'Setting up POS Accounting System...'
\echo 'Step 1: Creating tables and constraints...'
\i accounting_schema.sql

\echo 'Step 2: Creating triggers...'
\i accounting_triggers.sql

\echo 'Step 3: Creating functions...'
\i accounting_functions.sql

\echo 'Step 4: Loading seed data...'
\i accounting_seed_data.sql

\echo 'Accounting system setup complete!'
