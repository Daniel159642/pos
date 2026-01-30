-- Store Credit Liability for exchange returns (credit normal balance)
INSERT INTO accounting.accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account)
VALUES ('2110', 'Store Credit Liability', 'Liability', 'Current Liability', 'credit', 'Store credit owed to customers (exchange credits)', FALSE)
ON CONFLICT (account_number) DO NOTHING;
