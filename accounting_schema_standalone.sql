-- ============================================================================
-- POS ACCOUNTING SYSTEM - STANDALONE SCHEMA
-- Use this if you want accounting tables in a separate schema
-- or if you want to avoid conflicts with existing POS tables
-- ============================================================================

-- Create separate schema for accounting
CREATE SCHEMA IF NOT EXISTS accounting;

-- Set search path
SET search_path TO accounting, public;

-- ============================================================================
-- CORE ACCOUNTING TABLES (in accounting schema)
-- ============================================================================

-- 1. Accounts Table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounting.accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(20) UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN (
        'Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'COGS', 
        'Other Income', 'Other Expense', 'Cost of Goods Sold'
    )),
    sub_type VARCHAR(100),
    parent_account_id INTEGER REFERENCES accounting.accounts(id) ON DELETE SET NULL,
    balance_type VARCHAR(10) NOT NULL CHECK (balance_type IN ('debit', 'credit')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_system_account BOOLEAN DEFAULT FALSE,
    tax_line_id INTEGER,
    opening_balance DECIMAL(19,4) DEFAULT 0,
    opening_balance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_accounts_account_type ON accounting.accounts(account_type);
CREATE INDEX idx_accounts_parent_account_id ON accounting.accounts(parent_account_id);
CREATE INDEX idx_accounts_is_active ON accounting.accounts(is_active);
CREATE INDEX idx_accounts_account_number ON accounting.accounts(account_number);

-- 2. Transactions Table (Journal Entries)
CREATE TABLE IF NOT EXISTS accounting.transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'journal_entry', 'invoice', 'bill', 'payment', 'sales_receipt',
        'purchase', 'refund', 'adjustment', 'transfer', 'deposit', 'withdrawal'
    )),
    reference_number VARCHAR(100),
    description TEXT,
    source_document_id INTEGER,
    source_document_type VARCHAR(50),
    is_posted BOOLEAN DEFAULT FALSE,
    is_void BOOLEAN DEFAULT FALSE,
    void_date DATE,
    void_reason TEXT,
    reconciliation_status VARCHAR(20) DEFAULT 'unreconciled' CHECK (reconciliation_status IN (
        'unreconciled', 'reconciled', 'cleared'
    )),
    reconciled_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_transactions_transaction_date ON accounting.transactions(transaction_date);
CREATE INDEX idx_transactions_transaction_type ON accounting.transactions(transaction_type);
CREATE INDEX idx_transactions_source_document ON accounting.transactions(source_document_type, source_document_id);
CREATE INDEX idx_transactions_is_posted ON accounting.transactions(is_posted);
CREATE INDEX idx_transactions_reconciliation_status ON accounting.transactions(reconciliation_status);
CREATE INDEX idx_transactions_transaction_number ON accounting.transactions(transaction_number);

-- 3. Transaction_Lines Table (Journal Entry Lines)
CREATE TABLE IF NOT EXISTS accounting.transaction_lines (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES accounting.transactions(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounting.accounts(id),
    line_number INTEGER NOT NULL,
    debit_amount DECIMAL(19,4) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount DECIMAL(19,4) DEFAULT 0 CHECK (credit_amount >= 0),
    description TEXT,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    class_id INTEGER,
    location_id INTEGER,
    billable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_debit_credit_exclusive CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (debit_amount = 0 AND credit_amount > 0)
    )
);

CREATE INDEX idx_transaction_lines_transaction_id ON accounting.transaction_lines(transaction_id);
CREATE INDEX idx_transaction_lines_account_id ON accounting.transaction_lines(account_id);
CREATE INDEX idx_transaction_lines_entity ON accounting.transaction_lines(entity_type, entity_id);
CREATE INDEX idx_transaction_lines_transaction_line ON accounting.transaction_lines(transaction_id, line_number);

-- Continue with remaining tables in accounting schema...
-- (For brevity, showing pattern - all tables would use accounting. prefix)
