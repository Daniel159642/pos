-- ============================================================================
-- POS ACCOUNTING SYSTEM - COMPLETE DATABASE SCHEMA
-- Double-Entry Bookkeeping with QuickBooks-Style Features
-- Database: PostgreSQL
-- ============================================================================

-- Enable UUID extension if using UUIDs
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE ACCOUNTING TABLES
-- ============================================================================

-- 1. Accounts Table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(20) UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN (
        'Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'COGS', 
        'Other Income', 'Other Expense', 'Cost of Goods Sold'
    )),
    sub_type VARCHAR(100),
    parent_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
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

CREATE INDEX idx_accounts_account_type ON accounts(account_type);
CREATE INDEX idx_accounts_parent_account_id ON accounts(parent_account_id);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);

-- 2. Transactions Table (Journal Entries)
CREATE TABLE IF NOT EXISTS transactions (
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

CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_source_document ON transactions(source_document_type, source_document_id);
CREATE INDEX idx_transactions_is_posted ON transactions(is_posted);
CREATE INDEX idx_transactions_reconciliation_status ON transactions(reconciliation_status);
CREATE INDEX idx_transactions_transaction_number ON transactions(transaction_number);

-- 3. Transaction_Lines Table (Journal Entry Lines)
CREATE TABLE IF NOT EXISTS transaction_lines (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
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

CREATE INDEX idx_transaction_lines_transaction_id ON transaction_lines(transaction_id);
CREATE INDEX idx_transaction_lines_account_id ON transaction_lines(account_id);
CREATE INDEX idx_transaction_lines_entity ON transaction_lines(entity_type, entity_id);
CREATE INDEX idx_transaction_lines_transaction_line ON transaction_lines(transaction_id, line_number);

-- ============================================================================
-- CUSTOMER & VENDOR MANAGEMENT TABLES
-- ============================================================================

-- 4. Accounting_Customers Table (extends existing customers table)
-- Note: If you have an existing customers table, this creates accounting-specific fields
-- You can link via customer_id or create a view to join them
CREATE TABLE IF NOT EXISTS accounting_customers (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER, -- Link to existing customers.customer_id if exists
    customer_number VARCHAR(50) UNIQUE NOT NULL,
    customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('individual', 'business')),
    company_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    website VARCHAR(255),
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(50),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(50) DEFAULT 'US',
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(50),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(50) DEFAULT 'US',
    payment_terms VARCHAR(50),
    payment_terms_days INTEGER DEFAULT 30,
    credit_limit DECIMAL(19,4) DEFAULT 0,
    tax_exempt BOOLEAN DEFAULT FALSE,
    tax_exempt_id VARCHAR(100),
    tax_rate_id INTEGER,
    account_balance DECIMAL(19,4) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_accounting_customers_customer_number ON accounting_customers(customer_number);
CREATE INDEX idx_accounting_customers_email ON accounting_customers(email);
CREATE INDEX idx_accounting_customers_company_name ON accounting_customers(company_name);
CREATE INDEX idx_accounting_customers_name ON accounting_customers(last_name, first_name);
CREATE INDEX idx_accounting_customers_is_active ON accounting_customers(is_active);
CREATE INDEX idx_accounting_customers_customer_id ON accounting_customers(customer_id);

-- 5. Accounting_Vendors Table (extends existing vendors table)
CREATE TABLE IF NOT EXISTS accounting_vendors (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER, -- Link to existing vendors.vendor_id if exists
    vendor_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    payment_terms VARCHAR(50),
    payment_terms_days INTEGER DEFAULT 30,
    account_number VARCHAR(100),
    tax_id VARCHAR(50),
    is_1099_vendor BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50),
    account_balance DECIMAL(19,4) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_accounting_vendors_vendor_number ON accounting_vendors(vendor_number);
CREATE INDEX idx_accounting_vendors_vendor_name ON accounting_vendors(vendor_name);
CREATE INDEX idx_accounting_vendors_is_1099 ON accounting_vendors(is_1099_vendor);
CREATE INDEX idx_accounting_vendors_is_active ON accounting_vendors(is_active);
CREATE INDEX idx_accounting_vendors_vendor_id ON accounting_vendors(vendor_id);

-- ============================================================================
-- INVOICE & BILLING TABLES
-- ============================================================================

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES accounting_customers(id),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    terms VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void'
    )),
    subtotal DECIMAL(19,4) DEFAULT 0,
    tax_amount DECIMAL(19,4) DEFAULT 0,
    discount_amount DECIMAL(19,4) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(19,4) NOT NULL,
    amount_paid DECIMAL(19,4) DEFAULT 0,
    balance_due DECIMAL(19,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,6) DEFAULT 1.0,
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(50),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(50),
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(50),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(50),
    memo TEXT,
    internal_notes TEXT,
    transaction_id INTEGER REFERENCES transactions(id),
    sent_date TIMESTAMP,
    viewed_date TIMESTAMP,
    paid_date DATE,
    void_date DATE,
    void_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    CONSTRAINT check_invoice_balance CHECK (amount_paid + balance_due = total_amount),
    CONSTRAINT check_due_date CHECK (due_date >= invoice_date)
);

CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_transaction_id ON invoices(transaction_id);

-- 7. Invoice_Lines Table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_id INTEGER,
    description TEXT NOT NULL,
    quantity DECIMAL(19,4) NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(19,4) NOT NULL CHECK (unit_price >= 0),
    line_total DECIMAL(19,4) NOT NULL,
    discount_amount DECIMAL(19,4) DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    tax_rate_id INTEGER,
    tax_amount DECIMAL(19,4) DEFAULT 0,
    line_total_with_tax DECIMAL(19,4) NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    item_type VARCHAR(50) DEFAULT 'product' CHECK (item_type IN (
        'product', 'service', 'discount', 'subtotal', 'tax'
    )),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_item_id ON invoice_lines(item_id);
CREATE INDEX idx_invoice_lines_invoice_line ON invoice_lines(invoice_id, line_number);

-- 8. Bills Table
CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_id INTEGER NOT NULL REFERENCES accounting_vendors(id),
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    terms VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'open', 'partial', 'paid', 'void'
    )),
    subtotal DECIMAL(19,4) DEFAULT 0,
    tax_amount DECIMAL(19,4) DEFAULT 0,
    total_amount DECIMAL(19,4) NOT NULL,
    amount_paid DECIMAL(19,4) DEFAULT 0,
    balance_due DECIMAL(19,4) NOT NULL,
    vendor_reference VARCHAR(100),
    memo TEXT,
    transaction_id INTEGER REFERENCES transactions(id),
    paid_date DATE,
    void_date DATE,
    void_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    CONSTRAINT check_bill_balance CHECK (amount_paid + balance_due = total_amount),
    CONSTRAINT check_bill_due_date CHECK (due_date >= bill_date)
);

CREATE INDEX idx_bills_bill_number ON bills(bill_number);
CREATE INDEX idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX idx_bills_bill_date ON bills(bill_date);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_status ON bills(status);

-- 9. Bill_Lines Table
CREATE TABLE IF NOT EXISTS bill_lines (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_id INTEGER,
    description TEXT NOT NULL,
    quantity DECIMAL(19,4) NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(19,4) NOT NULL CHECK (unit_cost >= 0),
    line_total DECIMAL(19,4) NOT NULL,
    tax_rate_id INTEGER,
    tax_amount DECIMAL(19,4) DEFAULT 0,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    class_id INTEGER,
    billable BOOLEAN DEFAULT FALSE,
    customer_id INTEGER REFERENCES accounting_customers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bill_lines_bill_id ON bill_lines(bill_id);
CREATE INDEX idx_bill_lines_item_id ON bill_lines(item_id);

-- ============================================================================
-- PAYMENT TABLES
-- ============================================================================

-- 10. Payments Table (Customer Payments)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES accounting_customers(id),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN (
        'cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'ach', 'other'
    )),
    reference_number VARCHAR(100),
    payment_amount DECIMAL(19,4) NOT NULL CHECK (payment_amount > 0),
    unapplied_amount DECIMAL(19,4) DEFAULT 0,
    deposit_to_account_id INTEGER NOT NULL REFERENCES accounts(id),
    transaction_id INTEGER REFERENCES transactions(id),
    memo TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'cleared', 'deposited', 'void'
    )),
    void_date DATE,
    void_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_payments_payment_number ON payments(payment_number);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_deposit_account ON payments(deposit_to_account_id);

-- 11. Payment_Applications Table
CREATE TABLE IF NOT EXISTS payment_applications (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    amount_applied DECIMAL(19,4) NOT NULL CHECK (amount_applied > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_payment_invoice UNIQUE (payment_id, invoice_id)
);

CREATE INDEX idx_payment_applications_payment_id ON payment_applications(payment_id);
CREATE INDEX idx_payment_applications_invoice_id ON payment_applications(invoice_id);

-- 12. Bill_Payments Table
CREATE TABLE IF NOT EXISTS bill_payments (
    id SERIAL PRIMARY KEY,
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_id INTEGER NOT NULL REFERENCES accounting_vendors(id),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN (
        'check', 'ach', 'wire', 'credit_card', 'other'
    )),
    reference_number VARCHAR(100),
    payment_amount DECIMAL(19,4) NOT NULL CHECK (payment_amount > 0),
    unapplied_amount DECIMAL(19,4) DEFAULT 0,
    paid_from_account_id INTEGER NOT NULL REFERENCES accounts(id),
    transaction_id INTEGER REFERENCES transactions(id),
    memo TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'cleared', 'void'
    )),
    void_date DATE,
    void_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_bill_payments_payment_number ON bill_payments(payment_number);
CREATE INDEX idx_bill_payments_vendor_id ON bill_payments(vendor_id);
CREATE INDEX idx_bill_payments_payment_date ON bill_payments(payment_date);
CREATE INDEX idx_bill_payments_paid_from_account ON bill_payments(paid_from_account_id);

-- 13. Bill_Payment_Applications Table
CREATE TABLE IF NOT EXISTS bill_payment_applications (
    id SERIAL PRIMARY KEY,
    bill_payment_id INTEGER NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    amount_applied DECIMAL(19,4) NOT NULL CHECK (amount_applied > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_bill_payment_bill UNIQUE (bill_payment_id, bill_id)
);

CREATE INDEX idx_bill_payment_applications_bill_payment_id ON bill_payment_applications(bill_payment_id);
CREATE INDEX idx_bill_payment_applications_bill_id ON bill_payment_applications(bill_id);

-- ============================================================================
-- INVENTORY TABLES
-- ============================================================================

-- 14. Items Table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    item_number VARCHAR(100) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN (
        'inventory', 'non_inventory', 'service', 'bundle'
    )),
    description TEXT,
    barcode VARCHAR(100),
    unit_of_measure VARCHAR(20) DEFAULT 'ea',
    category_id INTEGER,
    income_account_id INTEGER NOT NULL REFERENCES accounts(id),
    expense_account_id INTEGER NOT NULL REFERENCES accounts(id),
    asset_account_id INTEGER REFERENCES accounts(id),
    quantity_on_hand DECIMAL(19,4) DEFAULT 0,
    reorder_point DECIMAL(19,4) DEFAULT 0,
    reorder_quantity DECIMAL(19,4) DEFAULT 0,
    purchase_cost DECIMAL(19,4) DEFAULT 0,
    average_cost DECIMAL(19,4) DEFAULT 0,
    sales_price DECIMAL(19,4) DEFAULT 0,
    is_taxable BOOLEAN DEFAULT TRUE,
    tax_rate_id INTEGER,
    cost_method VARCHAR(20) DEFAULT 'Average' CHECK (cost_method IN (
        'FIFO', 'LIFO', 'Average', 'Specific'
    )),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

CREATE INDEX idx_items_item_number ON items(item_number);
CREATE INDEX idx_items_item_name ON items(item_name);
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_item_type ON items(item_type);
CREATE INDEX idx_items_is_active ON items(is_active);

-- 15. Inventory_Transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'sale', 'purchase', 'adjustment', 'return', 'transfer', 'assembly', 'disassembly'
    )),
    quantity_change DECIMAL(19,4) NOT NULL,
    unit_cost DECIMAL(19,4) NOT NULL,
    total_cost DECIMAL(19,4) NOT NULL,
    source_document_type VARCHAR(50),
    source_document_id INTEGER,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

CREATE INDEX idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_transactions_transaction_date ON inventory_transactions(transaction_date);
CREATE INDEX idx_inventory_transactions_transaction_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_source ON inventory_transactions(source_document_type, source_document_id);

-- ============================================================================
-- TAX TABLES
-- ============================================================================

-- 16. Tax_Rates Table
CREATE TABLE IF NOT EXISTS tax_rates (
    id SERIAL PRIMARY KEY,
    tax_name VARCHAR(100) NOT NULL,
    tax_rate DECIMAL(5,4) NOT NULL CHECK (tax_rate >= 0),
    tax_type VARCHAR(50) DEFAULT 'sales_tax' CHECK (tax_type IN (
        'sales_tax', 'vat', 'gst', 'other'
    )),
    description TEXT,
    tax_agency_id INTEGER REFERENCES accounting_vendors(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tax_rates_is_active ON tax_rates(is_active);

-- ============================================================================
-- SUPPORTING TABLES
-- ============================================================================

-- 17. Classes Table (Departments/Divisions)
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Locations Table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL UNIQUE,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'admin', 'manager', 'accountant', 'employee', 'viewer'
    )),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- 20. Audit_Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    establishment_id INTEGER,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);

-- ============================================================================
-- FOREIGN KEY REFERENCES (for classes and locations)
-- ============================================================================

-- Add foreign key constraints for class_id and location_id in transaction_lines
ALTER TABLE transaction_lines 
    ADD CONSTRAINT fk_transaction_lines_class 
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

ALTER TABLE transaction_lines 
    ADD CONSTRAINT fk_transaction_lines_location 
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

-- Add foreign key constraints for tax_rate_id
ALTER TABLE customers 
    ADD CONSTRAINT fk_customers_tax_rate 
    FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL;

ALTER TABLE invoice_lines 
    ADD CONSTRAINT fk_invoice_lines_tax_rate 
    FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL;

ALTER TABLE bill_lines 
    ADD CONSTRAINT fk_bill_lines_tax_rate 
    FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL;

ALTER TABLE items 
    ADD CONSTRAINT fk_items_tax_rate 
    FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL;

-- Add foreign key constraints for item_id
ALTER TABLE invoice_lines 
    ADD CONSTRAINT fk_invoice_lines_item 
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;

ALTER TABLE bill_lines 
    ADD CONSTRAINT fk_bill_lines_item 
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;

-- Add foreign key constraints for class_id in bill_lines
ALTER TABLE bill_lines 
    ADD CONSTRAINT fk_bill_lines_class 
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- Add foreign key constraints for customer_id in bill_lines
ALTER TABLE bill_lines 
    ADD CONSTRAINT fk_bill_lines_customer 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- ============================================================================
-- SEQUENCES FOR AUTO-NUMBERING
-- ============================================================================

-- Create sequences for auto-generating numbers
CREATE SEQUENCE IF NOT EXISTS transaction_number_seq;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS bill_number_seq;
CREATE SEQUENCE IF NOT EXISTS payment_number_seq;
CREATE SEQUENCE IF NOT EXISTS bill_payment_number_seq;
