-- Balance Sheet Template Accounts: add any missing accounts so the balance sheet
-- matches the standard template (Current Assets, Fixed Assets, Other Assets,
-- Current Liabilities, Long-Term Liabilities, Owner's Equity).
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

-- CURRENT ASSETS (template order: Cash, AR, Inventory, Prepaid, Short-Term Investments)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('1350', 'Short-Term Investments', 'Asset', 'Current Asset', 'debit', 'Short-term investments', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- FIXED (LONG TERM) ASSETS
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('1450', 'Long-Term Investments', 'Asset', 'Fixed Asset', 'debit', 'Long-term investments', FALSE),
  ('1500', 'Property, Plant and Equipment', 'Asset', 'Fixed Asset', 'debit', 'Property, plant and equipment', FALSE),
  ('1520', 'Accumulated Depreciation', 'Asset', 'Fixed Asset', 'credit', 'Less accumulated depreciation', FALSE),
  ('1600', 'Intangible Assets', 'Asset', 'Fixed Asset', 'debit', 'Intangible assets', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- OTHER ASSETS
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('1700', 'Deferred Income Tax', 'Asset', 'Other Asset', 'debit', 'Deferred income tax asset', FALSE),
  ('1800', 'Other Assets', 'Asset', 'Other Asset', 'debit', 'Other non-current assets', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- CURRENT LIABILITIES (template: AP, Short-Term Loans, Income Taxes Payable, Accrued Salaries and Wages, Unearned Revenue, Current Portion of Long-Term Debt)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('2020', 'Accrued Salaries and Wages', 'Liability', 'Current Liability', 'credit', 'Accrued salaries and wages', FALSE),
  ('2050', 'Income Taxes Payable', 'Liability', 'Current Liability', 'credit', 'Income taxes payable', FALSE),
  ('2120', 'Current Portion of Long-Term Debt', 'Liability', 'Current Liability', 'credit', 'Current portion of long-term debt', FALSE),
  ('2300', 'Unearned Revenue', 'Liability', 'Current Liability', 'credit', 'Unearned revenue / customer deposits', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- LONG TERM LIABILITIES
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('2500', 'Long-Term Debt', 'Liability', 'Long-term Liability', 'credit', 'Long-term debt', FALSE),
  ('2590', 'Other Long-Term Liabilities', 'Liability', 'Long-term Liability', 'credit', 'Other long-term liabilities', FALSE),
  ('2600', 'Deferred Income Tax', 'Liability', 'Long-term Liability', 'credit', 'Deferred income tax liability', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- OWNER'S EQUITY (template: Owner's Investment, Retained Earnings, Other)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('3100', 'Owner''s Investment', 'Equity', 'Equity', 'credit', 'Owner''s capital investment', FALSE),
  ('3700', 'Other Equity', 'Equity', 'Equity', 'credit', 'Other equity', FALSE)
ON CONFLICT (account_number) DO NOTHING;
