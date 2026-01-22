-- ============================================================================
-- SEED DATA FOR ACCOUNTING SYSTEM
-- Default Chart of Accounts and Sample Data
-- ============================================================================

-- ============================================================================
-- DEFAULT CHART OF ACCOUNTS
-- ============================================================================

-- ASSETS
INSERT INTO accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account) VALUES
('1000', 'Cash', 'Asset', 'Current Asset', 'debit', 'Cash on hand and in bank accounts', TRUE),
('1010', 'Petty Cash', 'Asset', 'Current Asset', 'debit', 'Small cash fund for minor expenses', FALSE),
('1020', 'Checking Account', 'Asset', 'Current Asset', 'debit', 'Primary business checking account', TRUE),
('1030', 'Savings Account', 'Asset', 'Current Asset', 'debit', 'Business savings account', FALSE),
('1100', 'Accounts Receivable', 'Asset', 'Current Asset', 'debit', 'Amounts owed by customers', TRUE),
('1110', 'Allowance for Doubtful Accounts', 'Asset', 'Current Asset', 'credit', 'Reserve for uncollectible receivables', FALSE),
('1200', 'Inventory', 'Asset', 'Current Asset', 'debit', 'Merchandise and products for sale', TRUE),
('1210', 'Raw Materials', 'Asset', 'Current Asset', 'debit', 'Raw materials inventory', FALSE),
('1220', 'Work in Progress', 'Asset', 'Current Asset', 'debit', 'Goods in production', FALSE),
('1230', 'Finished Goods', 'Asset', 'Current Asset', 'debit', 'Completed products ready for sale', FALSE),
('1300', 'Prepaid Expenses', 'Asset', 'Current Asset', 'debit', 'Prepaid insurance, rent, etc.', FALSE),
('1310', 'Prepaid Insurance', 'Asset', 'Current Asset', 'debit', 'Prepaid insurance premiums', FALSE),
('1320', 'Prepaid Rent', 'Asset', 'Current Asset', 'debit', 'Prepaid rent payments', FALSE),
('1400', 'Other Current Assets', 'Asset', 'Current Asset', 'debit', 'Other short-term assets', FALSE),
('1500', 'Fixed Assets', 'Asset', 'Fixed Asset', 'debit', 'Long-term tangible assets', FALSE),
('1510', 'Equipment', 'Asset', 'Fixed Asset', 'debit', 'Office and business equipment', FALSE),
('1520', 'Accumulated Depreciation - Equipment', 'Asset', 'Fixed Asset', 'credit', 'Depreciation on equipment', FALSE),
('1530', 'Vehicles', 'Asset', 'Fixed Asset', 'debit', 'Company vehicles', FALSE),
('1540', 'Accumulated Depreciation - Vehicles', 'Asset', 'Fixed Asset', 'credit', 'Depreciation on vehicles', FALSE),
('1550', 'Furniture and Fixtures', 'Asset', 'Fixed Asset', 'debit', 'Office furniture and fixtures', FALSE),
('1560', 'Accumulated Depreciation - Furniture', 'Asset', 'Fixed Asset', 'credit', 'Depreciation on furniture', FALSE),
('1600', 'Intangible Assets', 'Asset', 'Intangible Asset', 'debit', 'Non-physical assets', FALSE),
('1610', 'Goodwill', 'Asset', 'Intangible Asset', 'debit', 'Business goodwill', FALSE),
('1620', 'Patents', 'Asset', 'Intangible Asset', 'debit', 'Patents and intellectual property', FALSE);

-- LIABILITIES
INSERT INTO accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account) VALUES
('2000', 'Accounts Payable', 'Liability', 'Current Liability', 'credit', 'Amounts owed to vendors', TRUE),
('2010', 'Accrued Expenses', 'Liability', 'Current Liability', 'credit', 'Accrued but unpaid expenses', FALSE),
('2020', 'Accrued Wages', 'Liability', 'Current Liability', 'credit', 'Unpaid employee wages', FALSE),
('2030', 'Accrued Payroll Taxes', 'Liability', 'Current Liability', 'credit', 'Unpaid payroll taxes', FALSE),
('2040', 'Sales Tax Payable', 'Liability', 'Current Liability', 'credit', 'Sales tax collected and owed', TRUE),
('2050', 'Income Tax Payable', 'Liability', 'Current Liability', 'credit', 'Income taxes owed', FALSE),
('2100', 'Short-term Loans', 'Liability', 'Current Liability', 'credit', 'Short-term loans and notes', FALSE),
('2200', 'Credit Cards Payable', 'Liability', 'Current Liability', 'credit', 'Credit card balances', FALSE),
('2300', 'Customer Deposits', 'Liability', 'Current Liability', 'credit', 'Customer prepayments and deposits', FALSE),
('2500', 'Long-term Debt', 'Liability', 'Long-term Liability', 'credit', 'Long-term loans and mortgages', FALSE),
('2510', 'Notes Payable', 'Liability', 'Long-term Liability', 'credit', 'Long-term notes payable', FALSE),
('2520', 'Mortgage Payable', 'Liability', 'Long-term Liability', 'credit', 'Mortgage on property', FALSE);

-- EQUITY
INSERT INTO accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account) VALUES
('3000', 'Owner''s Equity', 'Equity', 'Equity', 'credit', 'Owner capital investment', TRUE),
('3100', 'Owner''s Capital', 'Equity', 'Equity', 'credit', 'Initial and additional capital contributions', FALSE),
('3200', 'Owner''s Draw', 'Equity', 'Equity', 'debit', 'Owner withdrawals', FALSE),
('3300', 'Retained Earnings', 'Equity', 'Equity', 'credit', 'Accumulated profits', TRUE),
('3400', 'Current Year Earnings', 'Equity', 'Equity', 'credit', 'Current year net income', FALSE),
('3500', 'Common Stock', 'Equity', 'Equity', 'credit', 'Common stock issued', FALSE),
('3600', 'Preferred Stock', 'Equity', 'Equity', 'credit', 'Preferred stock issued', FALSE);

-- REVENUE
INSERT INTO accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account) VALUES
('4000', 'Sales Revenue', 'Revenue', 'Operating Revenue', 'credit', 'Revenue from product sales', TRUE),
('4010', 'Product Sales', 'Revenue', 'Operating Revenue', 'credit', 'Revenue from product sales', FALSE),
('4020', 'Service Revenue', 'Revenue', 'Operating Revenue', 'credit', 'Revenue from services', FALSE),
('4030', 'Sales Discounts', 'Revenue', 'Operating Revenue', 'debit', 'Discounts given on sales', FALSE),
('4040', 'Sales Returns', 'Revenue', 'Operating Revenue', 'debit', 'Returns and refunds', FALSE),
('4100', 'Other Income', 'Other Income', 'Other Income', 'credit', 'Miscellaneous income', FALSE),
('4110', 'Interest Income', 'Other Income', 'Other Income', 'credit', 'Interest earned on investments', FALSE),
('4120', 'Gain on Sale of Assets', 'Other Income', 'Other Income', 'credit', 'Profit from asset sales', FALSE);

-- EXPENSES
INSERT INTO accounts (account_number, account_name, account_type, sub_type, balance_type, description, is_system_account) VALUES
('5000', 'Cost of Goods Sold', 'COGS', 'Cost of Sales', 'debit', 'Direct costs of products sold', TRUE),
('5010', 'Materials', 'COGS', 'Cost of Sales', 'debit', 'Raw materials used in production', FALSE),
('5020', 'Labor', 'COGS', 'Cost of Sales', 'debit', 'Direct labor costs', FALSE),
('5030', 'Overhead', 'COGS', 'Cost of Sales', 'debit', 'Manufacturing overhead', FALSE),
('5100', 'Operating Expenses', 'Expense', 'Operating Expense', 'debit', 'General operating expenses', FALSE),
('5110', 'Advertising', 'Expense', 'Operating Expense', 'debit', 'Advertising and marketing expenses', FALSE),
('5120', 'Bank Fees', 'Expense', 'Operating Expense', 'debit', 'Bank service charges and fees', FALSE),
('5130', 'Depreciation Expense', 'Expense', 'Operating Expense', 'debit', 'Depreciation of fixed assets', FALSE),
('5140', 'Insurance Expense', 'Expense', 'Operating Expense', 'debit', 'Insurance premiums', FALSE),
('5150', 'Interest Expense', 'Expense', 'Operating Expense', 'debit', 'Interest on loans and debt', FALSE),
('5160', 'Office Supplies', 'Expense', 'Operating Expense', 'debit', 'Office supplies and materials', FALSE),
('5170', 'Payroll Expense', 'Expense', 'Operating Expense', 'debit', 'Employee wages and salaries', TRUE),
('5180', 'Payroll Taxes', 'Expense', 'Operating Expense', 'debit', 'Employer payroll taxes', FALSE),
('5190', 'Professional Fees', 'Expense', 'Operating Expense', 'debit', 'Legal, accounting, consulting fees', FALSE),
('5200', 'Rent Expense', 'Expense', 'Operating Expense', 'debit', 'Office and facility rent', FALSE),
('5210', 'Repairs and Maintenance', 'Expense', 'Operating Expense', 'debit', 'Equipment and facility maintenance', FALSE),
('5220', 'Supplies', 'Expense', 'Operating Expense', 'debit', 'General supplies', FALSE),
('5230', 'Telephone', 'Expense', 'Operating Expense', 'debit', 'Phone and communication expenses', FALSE),
('5240', 'Travel Expense', 'Expense', 'Operating Expense', 'debit', 'Business travel expenses', FALSE),
('5250', 'Utilities', 'Expense', 'Operating Expense', 'debit', 'Electric, water, gas, etc.', FALSE),
('5300', 'Other Expenses', 'Other Expense', 'Other Expense', 'debit', 'Miscellaneous expenses', FALSE),
('5310', 'Bad Debt Expense', 'Other Expense', 'Other Expense', 'debit', 'Uncollectible accounts', FALSE),
('5320', 'Loss on Sale of Assets', 'Other Expense', 'Other Expense', 'debit', 'Loss from asset sales', FALSE),
('5400', 'Income Tax Expense', 'Expense', 'Tax Expense', 'debit', 'Federal and state income taxes', FALSE);

-- ============================================================================
-- SAMPLE TAX RATES
-- ============================================================================

INSERT INTO tax_rates (tax_name, tax_rate, tax_type, description, is_active) VALUES
('CA Sales Tax', 7.25, 'sales_tax', 'California State Sales Tax', TRUE),
('NY Sales Tax', 8.0, 'sales_tax', 'New York State Sales Tax', TRUE),
('TX Sales Tax', 6.25, 'sales_tax', 'Texas State Sales Tax', TRUE),
('No Tax', 0.0, 'sales_tax', 'Tax-exempt items', TRUE);

-- ============================================================================
-- SAMPLE CUSTOMERS
-- ============================================================================

INSERT INTO customers (customer_number, customer_type, company_name, display_name, email, phone, 
    billing_city, billing_state, billing_postal_code, payment_terms, payment_terms_days, is_active) VALUES
('CUST001', 'business', 'Acme Corporation', 'Acme Corporation', 'contact@acme.com', '555-0101',
    'Los Angeles', 'CA', '90001', 'Net 30', 30, TRUE),
('CUST002', 'business', 'Tech Solutions Inc', 'Tech Solutions Inc', 'info@techsolutions.com', '555-0102',
    'San Francisco', 'CA', '94102', 'Net 15', 15, TRUE),
('CUST003', 'individual', NULL, 'John Smith', 'john.smith@email.com', '555-0103',
    'New York', 'NY', '10001', 'Due on Receipt', 0, TRUE),
('CUST004', 'business', 'Global Industries', 'Global Industries', 'sales@global.com', '555-0104',
    'Chicago', 'IL', '60601', 'Net 30', 30, TRUE),
('CUST005', 'individual', NULL, 'Jane Doe', 'jane.doe@email.com', '555-0105',
    'Miami', 'FL', '33101', 'Net 15', 15, TRUE);

-- ============================================================================
-- SAMPLE VENDORS
-- ============================================================================

INSERT INTO vendors (vendor_number, vendor_name, contact_name, email, phone, city, state, postal_code,
    payment_terms, payment_terms_days, is_1099_vendor, is_active) VALUES
('VEND001', 'Supply Co', 'Bob Supplier', 'bob@supplyco.com', '555-0201', 'Los Angeles', 'CA', '90001',
    'Net 30', 30, FALSE, TRUE),
('VEND002', 'Equipment Rentals', 'Alice Manager', 'alice@equipment.com', '555-0202', 'San Diego', 'CA', '92101',
    'Net 15', 15, TRUE, TRUE),
('VEND003', 'Office Supplies Plus', 'Charlie Sales', 'charlie@officesupplies.com', '555-0203', 'Phoenix', 'AZ', '85001',
    'Net 30', 30, FALSE, TRUE),
('VEND004', 'Shipping Services', 'Diana Logistics', 'diana@shipping.com', '555-0204', 'Dallas', 'TX', '75201',
    'Net 30', 30, FALSE, TRUE),
('VEND005', 'Marketing Agency', 'Eve Creative', 'eve@marketing.com', '555-0205', 'Seattle', 'WA', '98101',
    'Net 15', 15, TRUE, TRUE);

-- ============================================================================
-- SAMPLE CLASSES (DEPARTMENTS)
-- ============================================================================

INSERT INTO classes (class_name, description, is_active) VALUES
('Sales', 'Sales department', TRUE),
('Operations', 'Operations department', TRUE),
('Administration', 'Administrative department', TRUE),
('Marketing', 'Marketing department', TRUE),
('IT', 'Information Technology department', TRUE);

-- ============================================================================
-- SAMPLE LOCATIONS
-- ============================================================================

INSERT INTO locations (location_name, address_line1, city, state, postal_code, country, is_active) VALUES
('Main Store', '123 Main Street', 'Los Angeles', 'CA', '90001', 'US', TRUE),
('Downtown Branch', '456 Commerce Ave', 'San Francisco', 'CA', '94102', 'US', TRUE),
('Warehouse', '789 Industrial Blvd', 'Oakland', 'CA', '94601', 'US', TRUE);

-- ============================================================================
-- SAMPLE ITEMS
-- ============================================================================

-- Get account IDs for items (assuming they exist from chart of accounts)
-- In production, you'd query these dynamically
DO $$
DECLARE
    sales_account_id INTEGER;
    cogs_account_id INTEGER;
    inventory_account_id INTEGER;
BEGIN
    -- Get account IDs
    SELECT id INTO sales_account_id FROM accounts WHERE account_number = '4010' LIMIT 1;
    SELECT id INTO cogs_account_id FROM accounts WHERE account_number = '5000' LIMIT 1;
    SELECT id INTO inventory_account_id FROM accounts WHERE account_number = '1200' LIMIT 1;
    
    -- Insert sample items
    INSERT INTO items (item_number, item_name, item_type, description, unit_of_measure,
        income_account_id, expense_account_id, asset_account_id, sales_price, purchase_cost,
        quantity_on_hand, is_taxable, is_active) VALUES
    ('ITEM001', 'Widget A', 'inventory', 'Standard widget product', 'ea',
        sales_account_id, cogs_account_id, inventory_account_id, 29.99, 15.00, 100, TRUE, TRUE),
    ('ITEM002', 'Widget B', 'inventory', 'Premium widget product', 'ea',
        sales_account_id, cogs_account_id, inventory_account_id, 49.99, 25.00, 50, TRUE, TRUE),
    ('ITEM003', 'Consulting Service', 'service', 'Hourly consulting services', 'hr',
        sales_account_id, cogs_account_id, NULL, 150.00, 0, 0, TRUE, TRUE),
    ('ITEM004', 'Setup Fee', 'service', 'One-time setup fee', 'ea',
        sales_account_id, cogs_account_id, NULL, 199.99, 0, 0, TRUE, TRUE),
    ('ITEM005', 'Shipping', 'service', 'Shipping and handling', 'ea',
        sales_account_id, cogs_account_id, NULL, 9.99, 0, 0, TRUE, TRUE);
END $$;

-- ============================================================================
-- SAMPLE USER (for testing)
-- ============================================================================

-- Note: Password hash is for 'admin123' - change in production!
INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active) VALUES
('admin', 'admin@pos.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJqZqZqZq', 
    'Admin', 'User', 'admin', TRUE);
