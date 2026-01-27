-- ============================================================================
-- DATABASE FUNCTIONS FOR ACCOUNTING SYSTEM
-- ============================================================================

-- ============================================================================
-- 1. CALCULATE ACCOUNT BALANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_account_balance(
    p_account_id INTEGER,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(19,4) AS $$
DECLARE
    account_record RECORD;
    total_debits DECIMAL(19,4);
    total_credits DECIMAL(19,4);
    account_balance DECIMAL(19,4);
BEGIN
    -- Get account information
    SELECT balance_type, opening_balance, opening_balance_date
    INTO account_record
    FROM accounts
    WHERE id = p_account_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % not found', p_account_id;
    END IF;
    
    -- Calculate debits and credits from posted transactions
    SELECT 
        COALESCE(SUM(tl.debit_amount), 0),
        COALESCE(SUM(tl.credit_amount), 0)
    INTO total_debits, total_credits
    FROM transaction_lines tl
    JOIN transactions t ON tl.transaction_id = t.id
    WHERE tl.account_id = p_account_id
        AND t.is_posted = TRUE
        AND t.is_void = FALSE
        AND t.transaction_date <= p_as_of_date;
    
    -- Calculate balance based on normal balance type
    IF account_record.balance_type = 'debit' THEN
        account_balance := account_record.opening_balance + total_debits - total_credits;
    ELSE
        account_balance := account_record.opening_balance + total_credits - total_debits;
    END IF;
    
    RETURN account_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. GET ACCOUNT BALANCE BY PERIOD
-- ============================================================================

CREATE OR REPLACE FUNCTION get_account_balance_by_period(
    p_account_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    period_start_balance DECIMAL(19,4),
    period_debits DECIMAL(19,4),
    period_credits DECIMAL(19,4),
    period_end_balance DECIMAL(19,4)
) AS $$
DECLARE
    account_record RECORD;
    start_balance DECIMAL(19,4);
    period_debits DECIMAL(19,4);
    period_credits DECIMAL(19,4);
    end_balance DECIMAL(19,4);
BEGIN
    -- Get account information
    SELECT balance_type, opening_balance
    INTO account_record
    FROM accounts
    WHERE id = p_account_id;
    
    -- Calculate balance at start of period
    start_balance := calculate_account_balance(p_account_id, p_start_date - INTERVAL '1 day');
    
    -- Calculate period activity
    SELECT 
        COALESCE(SUM(tl.debit_amount), 0),
        COALESCE(SUM(tl.credit_amount), 0)
    INTO period_debits, period_credits
    FROM transaction_lines tl
    JOIN transactions t ON tl.transaction_id = t.id
    WHERE tl.account_id = p_account_id
        AND t.is_posted = TRUE
        AND t.is_void = FALSE
        AND t.transaction_date >= p_start_date
        AND t.transaction_date <= p_end_date;
    
    -- Calculate end balance
    IF account_record.balance_type = 'debit' THEN
        end_balance := start_balance + period_debits - period_credits;
    ELSE
        end_balance := start_balance + period_credits - period_debits;
    END IF;
    
    RETURN QUERY SELECT start_balance, period_debits, period_credits, end_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. GET AGING REPORT DATA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_aging_report(
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
    days_over_90 DECIMAL(19,4),
    total_balance DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.display_name AS customer_name,
        COALESCE(SUM(CASE 
            WHEN i.due_date >= p_as_of_date THEN i.balance_due 
            ELSE 0 
        END), 0) AS current_balance,
        COALESCE(SUM(CASE 
            WHEN i.due_date < p_as_of_date 
                AND i.due_date >= p_as_of_date - INTERVAL '30 days' 
            THEN i.balance_due 
            ELSE 0 
        END), 0) AS days_0_30,
        COALESCE(SUM(CASE 
            WHEN i.due_date < p_as_of_date - INTERVAL '30 days'
                AND i.due_date >= p_as_of_date - INTERVAL '60 days' 
            THEN i.balance_due 
            ELSE 0 
        END), 0) AS days_31_60,
        COALESCE(SUM(CASE 
            WHEN i.due_date < p_as_of_date - INTERVAL '60 days'
                AND i.due_date >= p_as_of_date - INTERVAL '90 days' 
            THEN i.balance_due 
            ELSE 0 
        END), 0) AS days_61_90,
        COALESCE(SUM(CASE 
            WHEN i.due_date < p_as_of_date - INTERVAL '90 days' 
            THEN i.balance_due 
            ELSE 0 
        END), 0) AS days_over_90,
        COALESCE(SUM(i.balance_due), 0) AS total_balance
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id
        AND i.status NOT IN ('paid', 'void')
        AND i.balance_due > 0
    WHERE (p_customer_id IS NULL OR c.id = p_customer_id)
        AND c.is_active = TRUE
    GROUP BY c.id, c.display_name
    HAVING COALESCE(SUM(i.balance_due), 0) > 0
    ORDER BY total_balance DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. GET TRIAL BALANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trial_balance(
    p_as_of_date DATE DEFAULT CURRENT_DATE,
    p_account_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    account_id INTEGER,
    account_number VARCHAR(20),
    account_name VARCHAR(255),
    account_type VARCHAR(50),
    debit_balance DECIMAL(19,4),
    credit_balance DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id AS account_id,
        a.account_number,
        a.account_name,
        a.account_type,
        CASE 
            WHEN a.balance_type = 'debit' THEN 
                COALESCE(calculate_account_balance(a.id, p_as_of_date), 0)
            ELSE 0
        END AS debit_balance,
        CASE 
            WHEN a.balance_type = 'credit' THEN 
                ABS(COALESCE(calculate_account_balance(a.id, p_as_of_date), 0))
            ELSE 0
        END AS credit_balance
    FROM accounts a
    WHERE a.is_active = TRUE
        AND (p_account_type IS NULL OR a.account_type = p_account_type)
    ORDER BY a.account_type, a.account_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. GET PROFIT & LOSS (Income Statement)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profit_and_loss(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    account_type VARCHAR(50),
    account_name VARCHAR(255),
    amount DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    WITH revenue_expense AS (
        SELECT 
            a.account_type,
            a.account_name,
            CASE 
                WHEN a.account_type IN ('Revenue', 'Other Income') THEN
                    COALESCE(SUM(tl.credit_amount) - SUM(tl.debit_amount), 0)
                WHEN a.account_type IN ('Expense', 'COGS', 'Other Expense') THEN
                    COALESCE(SUM(tl.debit_amount) - SUM(tl.credit_amount), 0)
                ELSE 0
            END AS amount
        FROM accounts a
        LEFT JOIN transaction_lines tl ON a.id = tl.account_id
        LEFT JOIN transactions t ON tl.transaction_id = t.id
        WHERE a.account_type IN ('Revenue', 'Expense', 'COGS', 'Other Income', 'Other Expense')
            AND a.is_active = TRUE
            AND (t.id IS NULL OR (t.is_posted = TRUE AND t.is_void = FALSE 
                AND t.transaction_date >= p_start_date 
                AND t.transaction_date <= p_end_date))
        GROUP BY a.account_type, a.account_name
    )
    SELECT * FROM revenue_expense
    WHERE amount != 0
    ORDER BY 
        CASE account_type
            WHEN 'Revenue' THEN 1
            WHEN 'Other Income' THEN 2
            WHEN 'COGS' THEN 3
            WHEN 'Expense' THEN 4
            WHEN 'Other Expense' THEN 5
        END,
        account_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. GET BALANCE SHEET
-- ============================================================================

CREATE OR REPLACE FUNCTION get_balance_sheet(
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    account_type VARCHAR(50),
    account_name VARCHAR(255),
    amount DECIMAL(19,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.account_type,
        a.account_name,
        calculate_account_balance(a.id, p_as_of_date) AS amount
    FROM accounts a
    WHERE a.account_type IN ('Asset', 'Liability', 'Equity')
        AND a.is_active = TRUE
    ORDER BY 
        CASE a.account_type
            WHEN 'Asset' THEN 1
            WHEN 'Liability' THEN 2
            WHEN 'Equity' THEN 3
        END,
        a.account_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VALIDATE TRANSACTION BEFORE POSTING
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_transaction_for_posting(
    p_transaction_id INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    total_debits DECIMAL(19,4);
    total_credits DECIMAL(19,4);
    line_count INTEGER;
BEGIN
    -- Check if transaction exists
    IF NOT EXISTS (SELECT 1 FROM transactions WHERE id = p_transaction_id) THEN
        RAISE EXCEPTION 'Transaction % does not exist', p_transaction_id;
    END IF;
    
    -- Check if transaction has lines
    SELECT COUNT(*)
    INTO line_count
    FROM transaction_lines
    WHERE transaction_id = p_transaction_id;
    
    IF line_count = 0 THEN
        RAISE EXCEPTION 'Transaction % has no lines', p_transaction_id;
    END IF;
    
    -- Check balance
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM transaction_lines
    WHERE transaction_id = p_transaction_id;
    
    IF ABS(total_debits - total_credits) > 0.01 THEN
        RAISE EXCEPTION 'Transaction % is not balanced. Debits: %, Credits: %', 
            p_transaction_id, total_debits, total_credits;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. POST TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION post_transaction(
    p_transaction_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate transaction
    PERFORM validate_transaction_for_posting(p_transaction_id);
    
    -- Mark as posted
    UPDATE transactions
    SET is_posted = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_transaction_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. VOID TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION void_transaction(
    p_transaction_id INTEGER,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if transaction exists and is not already void
    IF NOT EXISTS (SELECT 1 FROM transactions WHERE id = p_transaction_id) THEN
        RAISE EXCEPTION 'Transaction % does not exist', p_transaction_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM transactions WHERE id = p_transaction_id AND is_void = TRUE) THEN
        RAISE EXCEPTION 'Transaction % is already void', p_transaction_id;
    END IF;
    
    -- Mark as void
    UPDATE transactions
    SET is_void = TRUE,
        void_date = CURRENT_DATE,
        void_reason = p_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_transaction_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. GET CUSTOMER BALANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_customer_balance(
    p_customer_id INTEGER,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(19,4) AS $$
DECLARE
    customer_balance DECIMAL(19,4);
BEGIN
    SELECT COALESCE(SUM(balance_due), 0)
    INTO customer_balance
    FROM invoices
    WHERE customer_id = p_customer_id
        AND status NOT IN ('paid', 'void')
        AND invoice_date <= p_as_of_date;
    
    RETURN customer_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. GET VENDOR BALANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_vendor_balance(
    p_vendor_id INTEGER,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(19,4) AS $$
DECLARE
    vendor_balance DECIMAL(19,4);
BEGIN
    SELECT COALESCE(SUM(balance_due), 0)
    INTO vendor_balance
    FROM bills
    WHERE vendor_id = p_vendor_id
        AND status NOT IN ('paid', 'void')
        AND bill_date <= p_as_of_date;
    
    RETURN vendor_balance;
END;
$$ LANGUAGE plpgsql;
