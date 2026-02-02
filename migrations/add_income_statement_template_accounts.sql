-- Income Statement Template Accounts: add accounts so the Income Statement
-- matches the standard template (Revenue/Net Sales, COGS, Operating Expenses,
-- Other Income, Tax Expense, Net Profit). Safe to run multiple times (ON CONFLICT DO NOTHING).

-- CONTRA REVENUE (Less: Sales Return, Less: Discounts and Allowances)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('4010', 'Sales Return', 'Contra Revenue', 'Contra Revenue', 'debit', 'Sales returns and refunds', FALSE),
  ('4020', 'Discounts and Allowances', 'Contra Revenue', 'Contra Revenue', 'debit', 'Discounts and allowances', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- OTHER INCOME (Interest Income)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('4110', 'Interest Income', 'Other Income', 'Other Income', 'credit', 'Interest income', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- COGS (Labor, Overhead; 5000 Cost of Goods Sold / Materials already exists)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('5010', 'Labor', 'COGS', 'Cost of Sales', 'debit', 'Labor cost of goods sold', FALSE),
  ('5020', 'Overhead', 'COGS', 'Cost of Sales', 'debit', 'Overhead cost of goods sold', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- OPERATING EXPENSES (template order: Wages, Advertising, Repairs, Travel, Rent, Delivery, Utilities, Insurance, Mileage, Office Supplies, Depreciation, Interest, Other Expenses)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('5110', 'Wages', 'Expense', 'Operating Expense', 'debit', 'Wages and salaries', FALSE),
  ('5120', 'Advertising', 'Expense', 'Operating Expense', 'debit', 'Advertising expense', FALSE),
  ('5130', 'Repairs & Maintenance', 'Expense', 'Operating Expense', 'debit', 'Repairs and maintenance', FALSE),
  ('5140', 'Travel', 'Expense', 'Operating Expense', 'debit', 'Travel expense', FALSE),
  ('5150', 'Rent/Lease', 'Expense', 'Operating Expense', 'debit', 'Rent and lease expense', FALSE),
  ('5160', 'Delivery/Freight Expense', 'Expense', 'Operating Expense', 'debit', 'Delivery and freight', FALSE),
  ('5170', 'Utilities/Telephone Expenses', 'Expense', 'Operating Expense', 'debit', 'Utilities and telephone', FALSE),
  ('5180', 'Insurance', 'Expense', 'Operating Expense', 'debit', 'Insurance expense', FALSE),
  ('5190', 'Mileage', 'Expense', 'Operating Expense', 'debit', 'Vehicle mileage expense', FALSE),
  ('5200', 'Office Supplies', 'Expense', 'Operating Expense', 'debit', 'Office supplies', FALSE),
  ('5210', 'Depreciation', 'Expense', 'Operating Expense', 'debit', 'Depreciation expense', FALSE),
  ('5220', 'Interest', 'Expense', 'Operating Expense', 'debit', 'Interest expense', FALSE),
  ('5290', 'Other Expenses', 'Expense', 'Operating Expense', 'debit', 'Other operating expenses', FALSE)
ON CONFLICT (account_number) DO NOTHING;

-- TAX EXPENSE
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('6000', 'Tax Expense', 'Expense', 'Tax', 'debit', 'Income tax expense', FALSE)
ON CONFLICT (account_number) DO NOTHING;
