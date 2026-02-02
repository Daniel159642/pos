-- Trial Balance Template Accounts: add accounts so the Trial Balance matches
-- the standard template (Office Equipment, Furniture & Fixture, Computer, Company Vehicle).
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES
  ('1510', 'Office Equipment', 'Asset', 'Fixed Asset', 'debit', 'Office equipment', FALSE),
  ('1530', 'Furniture & Fixture', 'Asset', 'Fixed Asset', 'debit', 'Furniture and fixtures', FALSE),
  ('1540', 'Computer', 'Asset', 'Fixed Asset', 'debit', 'Computer equipment', FALSE),
  ('1550', 'Company Vehicle', 'Asset', 'Fixed Asset', 'debit', 'Company vehicles', FALSE)
ON CONFLICT (account_number) DO NOTHING;
