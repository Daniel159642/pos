-- Update get_trial_balance to return balance_type and include all active accounts (including zero balance).
-- Enables Trial Balance template: A/C. Code, Account Title, Debit, Credit with correct column placement.

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
