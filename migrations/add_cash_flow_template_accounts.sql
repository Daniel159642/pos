-- Cash Flow Template Accounts: add accounts so the Cash Flow Statement
-- matches the standard template (Operations, Investing, Financing with
-- receipts/paid line items). Safe to run multiple times (ON CONFLICT DO NOTHING).

-- Investing: Loans Receivable (for "Collection of principal on loans" / "Making loans to other entities")
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('1400', 'Loans Receivable', 'Asset', 'Other Asset', 'debit', 'Loans made to other entities', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- Financing: Treasury Stock, Dividends
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('3200', 'Treasury Stock', 'Equity', 'Contra Equity', 'debit', 'Repurchase of stock (treasury stock)', FALSE),
  ('3310', 'Dividends', 'Equity', 'Equity', 'debit', 'Dividends declared and paid', FALSE)
ON CONFLICT (account_number) DO NOTHING;
