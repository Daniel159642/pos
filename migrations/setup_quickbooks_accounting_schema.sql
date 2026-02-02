-- ============================================================================
-- QuickBooks-Style Accounting in "accounting" schema (avoids conflict with
-- public.transactions, public.payments)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS accounting;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

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
CREATE INDEX IF NOT EXISTS idx_acc_account_type ON accounting.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_acc_parent ON accounting.accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_acc_active ON accounting.accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_acc_number ON accounting.accounts(account_number);

CREATE TABLE IF NOT EXISTS accounting.transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_acc_txn_date ON accounting.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_acc_txn_type ON accounting.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_acc_txn_posted ON accounting.transactions(is_posted);
CREATE INDEX IF NOT EXISTS idx_acc_txn_number ON accounting.transactions(transaction_number);

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
    CONSTRAINT chk_debit_credit_excl CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR (debit_amount = 0 AND credit_amount > 0)
    )
);
CREATE INDEX IF NOT EXISTS idx_acc_txl_txn ON accounting.transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_acc_txl_account ON accounting.transaction_lines(account_id);

-- ============================================================================
-- SEQUENCES (in accounting schema)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS accounting.transaction_number_seq;

-- ============================================================================
-- TRIGGERS: transaction number (balance validated on post, not per-line)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_validate_txn_balance ON accounting.transaction_lines;

CREATE OR REPLACE FUNCTION accounting.gen_txn_number()
RETURNS TRIGGER AS $$
DECLARE
    pr VARCHAR(8);
    sn INTEGER;
    nn VARCHAR(50);
BEGIN
    IF NEW.transaction_number IS NOT NULL AND NEW.transaction_number <> '' THEN
        RETURN NEW;
    END IF;
    pr := TO_CHAR(NEW.transaction_date, 'YYYYMMDD');
    sn := nextval('accounting.transaction_number_seq');
    nn := 'TRX-' || pr || '-' || LPAD(sn::TEXT, 4, '0');
    WHILE EXISTS (SELECT 1 FROM accounting.transactions WHERE transaction_number = nn) LOOP
        sn := nextval('accounting.transaction_number_seq');
        nn := 'TRX-' || pr || '-' || LPAD(sn::TEXT, 4, '0');
    END LOOP;
    NEW.transaction_number := nn;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gen_txn_number ON accounting.transactions;
CREATE TRIGGER trigger_gen_txn_number
    BEFORE INSERT ON accounting.transactions
    FOR EACH ROW
    WHEN (NEW.transaction_number IS NULL OR NEW.transaction_number = '')
    EXECUTE FUNCTION accounting.gen_txn_number();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION accounting.calculate_account_balance(
    p_account_id INTEGER,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(19,4) AS $$
DECLARE
    rec RECORD;
    td DECIMAL(19,4);
    tc DECIMAL(19,4);
    bal DECIMAL(19,4);
BEGIN
    SELECT balance_type, opening_balance INTO rec
    FROM accounting.accounts WHERE id = p_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % not found', p_account_id;
    END IF;
    SELECT COALESCE(SUM(tl.debit_amount), 0), COALESCE(SUM(tl.credit_amount), 0)
    INTO td, tc
    FROM accounting.transaction_lines tl
    JOIN accounting.transactions t ON tl.transaction_id = t.id
    WHERE tl.account_id = p_account_id
      AND t.is_posted = TRUE AND t.is_void = FALSE
      AND t.transaction_date <= p_as_of_date;
    IF rec.balance_type = 'debit' THEN
        bal := COALESCE(rec.opening_balance, 0) + td - tc;
    ELSE
        bal := COALESCE(rec.opening_balance, 0) + tc - td;
    END IF;
    RETURN bal;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION accounting.get_trial_balance(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    account_number VARCHAR(20),
    account_name VARCHAR(255),
    account_type VARCHAR(50),
    balance_type VARCHAR(10),
    total_debits DECIMAL(19,4),
    total_credits DECIMAL(19,4),
    balance DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.account_number,
        a.account_name,
        a.account_type,
        a.balance_type,
        COALESCE(SUM(tl.debit_amount), 0)::DECIMAL(19,4),
        COALESCE(SUM(tl.credit_amount), 0)::DECIMAL(19,4),
        (CASE WHEN a.balance_type = 'debit' THEN
            COALESCE(a.opening_balance, 0) + COALESCE(SUM(tl.debit_amount), 0) - COALESCE(SUM(tl.credit_amount), 0)
         ELSE
            COALESCE(a.opening_balance, 0) + COALESCE(SUM(tl.credit_amount), 0) - COALESCE(SUM(tl.debit_amount), 0)
         END)::DECIMAL(19,4)
    FROM accounting.accounts a
    LEFT JOIN accounting.transaction_lines tl ON a.id = tl.account_id
    LEFT JOIN accounting.transactions t ON tl.transaction_id = t.id AND t.is_posted = TRUE AND t.is_void = FALSE AND t.transaction_date <= p_as_of_date
    WHERE a.is_active = TRUE
    GROUP BY a.id, a.account_number, a.account_name, a.account_type, a.balance_type, a.opening_balance
    ORDER BY a.account_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION accounting.get_profit_and_loss(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    account_type VARCHAR(50),
    account_number VARCHAR(20),
    account_name VARCHAR(255),
    balance DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.account_type,
        a.account_number,
        a.account_name,
        (CASE WHEN a.balance_type = 'debit' THEN
            COALESCE(SUM(tl.debit_amount), 0) - COALESCE(SUM(tl.credit_amount), 0)
         ELSE
            COALESCE(SUM(tl.credit_amount), 0) - COALESCE(SUM(tl.debit_amount), 0)
         END)::DECIMAL(19,4)
    FROM accounting.accounts a
    LEFT JOIN accounting.transaction_lines tl ON a.id = tl.account_id
    LEFT JOIN accounting.transactions t ON tl.transaction_id = t.id
        AND t.is_posted = TRUE AND t.is_void = FALSE
        AND t.transaction_date >= p_start_date AND t.transaction_date <= p_end_date
    WHERE a.is_active = TRUE
      AND a.account_type IN ('Revenue', 'Expense', 'COGS', 'Cost of Goods Sold', 'Other Income', 'Other Expense')
    GROUP BY a.id, a.account_type, a.account_number, a.account_name, a.balance_type
    HAVING (CASE WHEN a.balance_type = 'debit' THEN
            COALESCE(SUM(tl.debit_amount), 0) - COALESCE(SUM(tl.credit_amount), 0)
         ELSE
            COALESCE(SUM(tl.credit_amount), 0) - COALESCE(SUM(tl.debit_amount), 0)
         END) <> 0
    ORDER BY a.account_type, a.account_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION accounting.get_balance_sheet(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    account_type VARCHAR(50),
    account_number VARCHAR(20),
    account_name VARCHAR(255),
    balance DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.account_type,
        a.account_number,
        a.account_name,
        (accounting.calculate_account_balance(a.id, p_as_of_date))::DECIMAL(19,4)
    FROM accounting.accounts a
    WHERE a.is_active = TRUE
      AND a.account_type IN ('Asset', 'Liability', 'Equity')
    ORDER BY a.account_type, a.account_number;
END;
$$ LANGUAGE plpgsql;

-- Stub: aging report (no accounting_customers/invoices yet; returns empty)
CREATE OR REPLACE FUNCTION accounting.get_aging_report(
    p_as_of_date DATE DEFAULT CURRENT_DATE,
    p_customer_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    customer_id INTEGER,
    customer_name VARCHAR(255),
    current_balance DECIMAL(19,4),
    days_0_30 DECIMAL(19,4),
    days_31_60 DECIMAL(19,4),
    days_61_90 DECIMAL(19,4),
    days_over_90 DECIMAL(19,4)
) AS $$
BEGIN
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED CHART OF ACCOUNTS (skip if already populated)
-- ============================================================================

INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
    ('1000', 'Cash', 'Asset', 'Current Asset', 'debit', 'Cash on hand and in bank accounts', TRUE),
    ('1010', 'Petty Cash', 'Asset', 'Current Asset', 'debit', 'Small cash fund for minor expenses', FALSE),
    ('1020', 'Checking Account', 'Asset', 'Current Asset', 'debit', 'Primary business checking account', TRUE),
    ('1030', 'Savings Account', 'Asset', 'Current Asset', 'debit', 'Business savings account', FALSE),
    ('1100', 'Accounts Receivable', 'Asset', 'Current Asset', 'debit', 'Amounts owed by customers', TRUE),
    ('1110', 'Allowance for Doubtful Accounts', 'Asset', 'Current Asset', 'credit', 'Reserve for uncollectible receivables', FALSE),
    ('1200', 'Inventory', 'Asset', 'Current Asset', 'debit', 'Merchandise and products for sale', TRUE),
    ('1300', 'Prepaid Expenses', 'Asset', 'Current Asset', 'debit', 'Prepaid insurance, rent, etc.', FALSE),
    ('1500', 'Fixed Assets', 'Asset', 'Fixed Asset', 'debit', 'Long-term tangible assets', FALSE),
    ('1510', 'Equipment', 'Asset', 'Fixed Asset', 'debit', 'Office and business equipment', FALSE),
    ('1520', 'Accumulated Depreciation - Equipment', 'Asset', 'Fixed Asset', 'credit', 'Depreciation on equipment', FALSE),
    ('2000', 'Accounts Payable', 'Liability', 'Current Liability', 'credit', 'Amounts owed to vendors', TRUE),
    ('2040', 'Sales Tax Payable', 'Liability', 'Current Liability', 'credit', 'Sales tax collected and owed', TRUE),
    ('2100', 'Short-term Loans', 'Liability', 'Current Liability', 'credit', 'Short-term loans and notes', FALSE),
    ('3000', 'Owner''s Equity', 'Equity', 'Equity', 'credit', 'Owner capital investment', TRUE),
    ('3300', 'Retained Earnings', 'Equity', 'Equity', 'credit', 'Accumulated profits', TRUE),
    ('4000', 'Sales Revenue', 'Revenue', 'Operating Revenue', 'credit', 'Revenue from product sales', TRUE),
    ('4010', 'Product Sales', 'Revenue', 'Operating Revenue', 'credit', 'Revenue from product sales', FALSE),
    ('4020', 'Service Revenue', 'Revenue', 'Operating Revenue', 'credit', 'Revenue from services', FALSE),
    ('4100', 'Other Income', 'Other Income', 'Other Income', 'credit', 'Miscellaneous income', FALSE),
    ('5000', 'Cost of Goods Sold', 'COGS', 'Cost of Sales', 'debit', 'Direct costs of products sold', TRUE),
    ('5100', 'Operating Expenses', 'Expense', 'Operating Expense', 'debit', 'General operating expenses', FALSE),
    ('5170', 'Payroll Expense', 'Expense', 'Operating Expense', 'debit', 'Employee wages and salaries', TRUE),
    ('5200', 'Rent Expense', 'Expense', 'Operating Expense', 'debit', 'Office and facility rent', FALSE),
    ('5250', 'Utilities', 'Expense', 'Operating Expense', 'debit', 'Electric, water, gas, etc.', FALSE)
ON CONFLICT (account_number) DO NOTHING;
