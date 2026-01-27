-- ============================================================================
-- POSTGRESQL SCHEMA FOR POS SYSTEM
-- ============================================================================
-- This schema adds establishment_id to all tables for multi-tenant support
-- Converted from SQLite to PostgreSQL syntax
-- Local PostgreSQL compatible (no Supabase dependencies)

-- ============================================================================
-- ESTABLISHMENTS TABLE (Multi-tenant support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS establishments (
    establishment_id SERIAL PRIMARY KEY,
    establishment_name TEXT NOT NULL,
    establishment_code TEXT UNIQUE NOT NULL,  -- e.g., 'store1', 'store2'
    subdomain TEXT UNIQUE,  -- Optional: for subdomain routing
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::jsonb  -- Store establishment-specific settings
);

CREATE INDEX IF NOT EXISTS idx_establishments_code ON establishments(establishment_code);
CREATE INDEX IF NOT EXISTS idx_establishments_subdomain ON establishments(subdomain);

-- ============================================================================
-- INVENTORY SYSTEM TABLES
-- ============================================================================

-- Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    product_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    product_price NUMERIC(10,2) NOT NULL CHECK(product_price >= 0),
    product_cost NUMERIC(10,2) NOT NULL CHECK(product_cost >= 0),
    vendor TEXT,
    vendor_id INTEGER REFERENCES vendors(vendor_id),
    photo TEXT,
    current_quantity INTEGER NOT NULL DEFAULT 0 CHECK(current_quantity >= 0),
    category TEXT,
    last_restocked TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(establishment_id, sku)  -- SKU unique per establishment
);

-- Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    shipment_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(vendor_id),
    shipment_date TEXT,
    received_date TEXT,
    purchase_order_number TEXT,
    tracking_number TEXT,
    total_cost NUMERIC(10,2),
    received_by INTEGER,
    verified_by INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shipment_Items Table
CREATE TABLE IF NOT EXISTS shipment_items (
    shipment_item_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity_received INTEGER NOT NULL CHECK(quantity_received > 0),
    unit_cost NUMERIC(10,2) NOT NULL CHECK(unit_cost >= 0),
    lot_number TEXT,
    expiration_date TEXT,
    received_timestamp TIMESTAMP DEFAULT NOW()
);

-- Sales/Transactions Table
CREATE TABLE IF NOT EXISTS sales (
    sale_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity_sold INTEGER NOT NULL CHECK(quantity_sold > 0),
    sale_price NUMERIC(10,2) NOT NULL CHECK(sale_price >= 0),
    sale_date TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- Pending_Shipments Table
CREATE TABLE IF NOT EXISTS pending_shipments (
    pending_shipment_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id),
    expected_date TEXT,
    upload_timestamp TIMESTAMP DEFAULT NOW(),
    file_path TEXT,
    purchase_order_number TEXT,
    tracking_number TEXT,
    status TEXT DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'in_progress', 'approved', 'rejected', 'completed_with_issues')),
    uploaded_by INTEGER,
    approved_by INTEGER,
    approved_date TIMESTAMP,
    reviewed_by TEXT,
    reviewed_date TIMESTAMP,
    notes TEXT,
    started_by INTEGER,
    started_at TIMESTAMP,
    completed_by INTEGER,
    completed_at TIMESTAMP,
    verification_mode TEXT DEFAULT 'verify_whole_shipment',
    workflow_step TEXT,
    added_to_inventory INTEGER DEFAULT 0 CHECK(added_to_inventory IN (0, 1))
);

-- Pending_Shipment_Items Table
CREATE TABLE IF NOT EXISTS pending_shipment_items (
    pending_item_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id) ON DELETE CASCADE,
    product_sku TEXT,
    product_name TEXT,
    quantity_expected INTEGER NOT NULL CHECK(quantity_expected > 0),
    quantity_verified INTEGER DEFAULT 0,
    unit_cost NUMERIC(10,2) NOT NULL CHECK(unit_cost >= 0),
    lot_number TEXT,
    expiration_date TEXT,
    discrepancy_notes TEXT,
    product_id INTEGER REFERENCES inventory(product_id),
    barcode TEXT,
    line_number INTEGER,
    status TEXT DEFAULT 'pending',
    verified_by INTEGER,
    verified_at TIMESTAMP
);

-- ============================================================================
-- ORDER SYSTEM TABLES
-- ============================================================================

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    employee_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,  -- Employee ID/Code for login
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT,
    position TEXT NOT NULL CHECK(position IN ('cashier', 'stock_clerk', 'manager', 'admin', 'supervisor', 'assistant_manager')),
    department TEXT,
    date_started DATE NOT NULL,
    date_terminated DATE,
    hourly_rate NUMERIC(10,2),
    salary NUMERIC(10,2),
    employment_type TEXT CHECK(employment_type IN ('full_time', 'part_time', 'contract', 'temporary')) DEFAULT 'part_time',
    active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(establishment_id, employee_code)  -- Employee code unique per establishment
);

-- ============================================================================
-- SHIPMENT VERIFICATION TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipment_verification_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipment_issues (
    issue_id SERIAL PRIMARY KEY,
    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id),
    pending_item_id INTEGER REFERENCES pending_shipment_items(pending_item_id),
    issue_type TEXT NOT NULL CHECK(issue_type IN ('missing', 'damaged', 'wrong_item', 'quantity_mismatch', 'expired', 'quality', 'other')),
    severity TEXT DEFAULT 'minor' CHECK(severity IN ('minor', 'major', 'critical')),
    quantity_affected INTEGER DEFAULT 1,
    reported_by INTEGER NOT NULL REFERENCES employees(employee_id),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    photo_path TEXT,
    resolution_status TEXT DEFAULT 'open' CHECK(resolution_status IN ('open', 'resolved', 'vendor_contacted', 'credit_issued')),
    resolved_by INTEGER REFERENCES employees(employee_id),
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS shipment_scan_log (
    scan_id SERIAL PRIMARY KEY,
    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id),
    pending_item_id INTEGER REFERENCES pending_shipment_items(pending_item_id),
    scanned_barcode TEXT NOT NULL,
    scanned_by INTEGER NOT NULL REFERENCES employees(employee_id),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scan_result TEXT DEFAULT 'match' CHECK(scan_result IN ('match', 'mismatch', 'unknown', 'duplicate')),
    device_id TEXT,
    location TEXT
);

CREATE TABLE IF NOT EXISTS verification_sessions (
    session_id SERIAL PRIMARY KEY,
    pending_shipment_id INTEGER NOT NULL REFERENCES pending_shipments(pending_shipment_id),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    total_scans INTEGER DEFAULT 0,
    items_verified INTEGER DEFAULT 0,
    issues_reported INTEGER DEFAULT 0,
    device_id TEXT
);

CREATE TABLE IF NOT EXISTS approved_shipments (
    shipment_id SERIAL PRIMARY KEY,
    pending_shipment_id INTEGER REFERENCES pending_shipments(pending_shipment_id),
    vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id),
    purchase_order_number TEXT,
    received_date DATE,
    approved_by INTEGER NOT NULL REFERENCES employees(employee_id),
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_items_received INTEGER DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    has_issues INTEGER DEFAULT 0 CHECK(has_issues IN (0, 1)),
    issue_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS approved_shipment_items (
    approved_item_id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES approved_shipments(shipment_id),
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity_received INTEGER NOT NULL CHECK(quantity_received > 0),
    unit_cost NUMERIC NOT NULL CHECK(unit_cost >= 0),
    lot_number TEXT,
    expiration_date DATE,
    received_by INTEGER NOT NULL REFERENCES employees(employee_id),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipment_issues_shipment ON shipment_issues(pending_shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_issues_item ON shipment_issues(pending_item_id);
CREATE INDEX IF NOT EXISTS idx_shipment_scan_log_shipment ON shipment_scan_log(pending_shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_scan_log_item ON shipment_scan_log(pending_item_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_shipment ON verification_sessions(pending_shipment_id);
CREATE INDEX IF NOT EXISTS idx_approved_shipments_pending ON approved_shipments(pending_shipment_id);

-- ============================================================================
-- METADATA EXTRACTION TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(category_id),
    is_auto_generated INTEGER DEFAULT 0 CHECK(is_auto_generated IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Partial uniques: roots unique by name; non-roots unique by (name, parent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_root_name
    ON categories (category_name) WHERE parent_category_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent
    ON categories (category_name, parent_category_id) WHERE parent_category_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_metadata (
    metadata_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL UNIQUE REFERENCES inventory(product_id) ON DELETE CASCADE,
    brand TEXT,
    color TEXT,
    size TEXT,
    tags TEXT,
    keywords TEXT,
    attributes TEXT,
    search_vector TEXT,
    category_id INTEGER REFERENCES categories(category_id),
    category_confidence REAL DEFAULT 0 CHECK(category_confidence >= 0 AND category_confidence <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metadata_extraction_log (
    log_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id) ON DELETE CASCADE,
    extraction_method TEXT NOT NULL,
    data_extracted TEXT,
    execution_time_ms INTEGER,
    success INTEGER DEFAULT 1 CHECK(success IN (0, 1)),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_history (
    search_id SERIAL PRIMARY KEY,
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    filters TEXT,
    user_id INTEGER REFERENCES employees(employee_id),
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_metadata_product ON product_metadata(product_id);
CREATE INDEX IF NOT EXISTS idx_product_metadata_category ON product_metadata(category_id);
CREATE INDEX IF NOT EXISTS idx_product_metadata_brand ON product_metadata(brand);
CREATE INDEX IF NOT EXISTS idx_metadata_log_product ON metadata_extraction_log(product_id);
CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(search_timestamp);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(category_name);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    customer_name TEXT,
    email TEXT,
    phone TEXT,
    loyalty_points INTEGER DEFAULT 0,
    created_date TIMESTAMP DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    order_number TEXT,
    order_date TIMESTAMP DEFAULT NOW(),
    customer_id INTEGER REFERENCES customers(customer_id),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    subtotal NUMERIC(10,2) DEFAULT 0 CHECK(subtotal >= 0),
    tax_rate NUMERIC(5,4) DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 1),
    tax_amount NUMERIC(10,2) DEFAULT 0 CHECK(tax_amount >= 0),
    discount NUMERIC(10,2) DEFAULT 0 CHECK(discount >= 0),
    transaction_fee NUMERIC(10,2) DEFAULT 0 CHECK(transaction_fee >= 0),
    total NUMERIC(10,2) DEFAULT 0 CHECK(total >= 0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit')),
    payment_status TEXT DEFAULT 'completed' CHECK(payment_status IN ('pending', 'completed', 'refunded', 'partially_refunded')),
    order_status TEXT DEFAULT 'completed' CHECK(order_status IN ('completed', 'voided', 'returned')),
    notes TEXT,
    UNIQUE(establishment_id, order_number)  -- Order number unique per establishment
);

-- Order_Items Table
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK(unit_price >= 0),
    discount NUMERIC(10,2) DEFAULT 0 CHECK(discount >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK(subtotal >= 0),
    tax_rate NUMERIC(5,4) DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 1),
    tax_amount NUMERIC(10,2) DEFAULT 0 CHECK(tax_amount >= 0)
);

-- Payment_Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    payment_method TEXT CHECK(payment_method IN ('cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit', 'refund')),
    amount NUMERIC(10,2) NOT NULL,
    transaction_fee NUMERIC(10,2) DEFAULT 0 CHECK(transaction_fee >= 0),
    transaction_fee_rate NUMERIC(5,4) DEFAULT 0 CHECK(transaction_fee_rate >= 0 AND transaction_fee_rate <= 1),
    net_amount NUMERIC(10,2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT NOW(),
    card_last_four TEXT,
    authorization_code TEXT,
    processor_name TEXT,
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'declined', 'pending', 'refunded')),
    tip NUMERIC(10,2) DEFAULT 0,
    employee_id INTEGER REFERENCES employees(employee_id)
);

-- Employee Schedule Table
CREATE TABLE IF NOT EXISTS employee_schedule (
    schedule_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_duration INTEGER DEFAULT 0,
    clock_in_time TIMESTAMP,
    clock_out_time TIMESTAMP,
    hours_worked NUMERIC(5,2),
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'clocked_in', 'clocked_out', 'no_show', 'cancelled')),
    confirmed INTEGER DEFAULT 0 CHECK(confirmed IN (0, 1)),
    confirmed_at TIMESTAMP
);

-- Employee Availability Table
CREATE TABLE IF NOT EXISTS employee_availability (
    availability_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(employee_id) ON DELETE CASCADE,
    monday TEXT,
    tuesday TEXT,
    wednesday TEXT,
    thursday TEXT,
    friday TEXT,
    saturday TEXT,
    sunday TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Employee Sessions Table
CREATE TABLE IF NOT EXISTS employee_sessions (
    session_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    login_time TIMESTAMP DEFAULT NOW(),
    logout_time TIMESTAMP,
    session_token TEXT UNIQUE,
    ip_address TEXT,
    device_info TEXT,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- Time Clock Table
CREATE TABLE IF NOT EXISTS time_clock (
    time_entry_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_start TIMESTAMP,
    break_end TIMESTAMP,
    total_hours NUMERIC(5,2),
    notes TEXT,
    status TEXT DEFAULT 'clocked_in' CHECK(status IN ('clocked_in', 'on_break', 'clocked_out'))
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'VOID', 'RETURN', 'LOGIN', 'LOGOUT', 'CLOCK_IN', 'CLOCK_OUT')),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    action_timestamp TIMESTAMP DEFAULT NOW(),
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    notes TEXT
);

-- Master Calendar Table
CREATE TABLE IF NOT EXISTS master_calendar (
    calendar_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('schedule', 'shipment', 'holiday', 'event', 'meeting', 'maintenance', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIME,
    end_time TIME,
    related_id INTEGER,
    related_table TEXT,
    created_by INTEGER REFERENCES employees(employee_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ACCOUNTING SYSTEM TABLES
-- ============================================================================

-- Chart of Accounts Table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'contra_asset', 'contra_revenue')),
    account_subtype TEXT,
    normal_balance TEXT NOT NULL CHECK(normal_balance IN ('debit', 'credit')),
    parent_account_id INTEGER REFERENCES chart_of_accounts(account_id),
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    description TEXT,
    UNIQUE(establishment_id, account_number)
);

-- Fiscal Periods Table
CREATE TABLE IF NOT EXISTS fiscal_periods (
    period_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed INTEGER DEFAULT 0 CHECK(is_closed IN (0, 1)),
    closed_by INTEGER REFERENCES employees(employee_id),
    closed_date TIMESTAMP
);

-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    journal_entry_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    entry_number TEXT,
    entry_date DATE NOT NULL,
    entry_type TEXT DEFAULT 'standard' CHECK(entry_type IN ('standard', 'adjusting', 'closing', 'reversing')),
    transaction_source TEXT NOT NULL CHECK(transaction_source IN ('sale', 'purchase', 'shipment', 'return', 'adjustment', 'payroll', 'other')),
    source_id INTEGER,
    description TEXT NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    posted INTEGER DEFAULT 0 CHECK(posted IN (0, 1)),
    posted_date TIMESTAMP,
    notes TEXT,
    UNIQUE(establishment_id, entry_number)
);

-- Journal Entry Lines Table
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    line_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(journal_entry_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(account_id),
    debit_amount NUMERIC(10,2) DEFAULT 0 CHECK(debit_amount >= 0),
    credit_amount NUMERIC(10,2) DEFAULT 0 CHECK(credit_amount >= 0),
    description TEXT
);

-- Retained Earnings Table
CREATE TABLE IF NOT EXISTS retained_earnings (
    retained_earnings_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    fiscal_period_id INTEGER NOT NULL REFERENCES fiscal_periods(period_id),
    beginning_balance NUMERIC(10,2) NOT NULL,
    net_income NUMERIC(10,2) NOT NULL,
    dividends NUMERIC(10,2) DEFAULT 0,
    ending_balance NUMERIC(10,2) NOT NULL,
    calculation_date TIMESTAMP DEFAULT NOW()
);

-- Shipment Discrepancies Table
CREATE TABLE IF NOT EXISTS shipment_discrepancies (
    discrepancy_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    shipment_id INTEGER REFERENCES shipments(shipment_id),
    pending_shipment_id INTEGER REFERENCES pending_shipments(pending_shipment_id),
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    discrepancy_type TEXT NOT NULL CHECK(discrepancy_type IN ('missing', 'extra', 'damaged', 'wrong_product', 'quantity_short', 'quantity_over', 'expired', 'wrong_lot')),
    expected_quantity INTEGER,
    actual_quantity INTEGER,
    discrepancy_quantity INTEGER,
    expected_product_sku TEXT,
    actual_product_sku TEXT,
    financial_impact NUMERIC(10,2),
    reported_by INTEGER NOT NULL REFERENCES employees(employee_id),
    reported_date TIMESTAMP DEFAULT NOW(),
    resolution_status TEXT DEFAULT 'reported' CHECK(resolution_status IN ('reported', 'investigating', 'resolved', 'written_off')),
    resolved_by INTEGER REFERENCES employees(employee_id),
    resolved_date TIMESTAMP,
    resolution_notes TEXT,
    vendor_notified INTEGER DEFAULT 0 CHECK(vendor_notified IN (0, 1)),
    vendor_response TEXT,
    claim_number TEXT,
    photos TEXT
);

-- ============================================================================
-- IMAGE MATCHING SYSTEM TABLES
-- ============================================================================

-- Image Identifications Table
CREATE TABLE IF NOT EXISTS image_identifications (
    identification_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    query_image_path TEXT NOT NULL,
    confidence_score NUMERIC(3,2) NOT NULL CHECK(confidence_score >= 0 AND confidence_score <= 1),
    identified_by TEXT,
    identified_at TIMESTAMP DEFAULT NOW(),
    context TEXT DEFAULT 'manual_lookup' CHECK(context IN ('inventory_check', 'shipment_receiving', 'manual_lookup'))
);

-- ============================================================================
-- RBAC TABLES
-- ============================================================================

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    description TEXT,
    is_system_role INTEGER DEFAULT 0 CHECK(is_system_role IN (0, 1)),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(establishment_id, role_name)
);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name TEXT UNIQUE NOT NULL,
    permission_category TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_permission_id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    granted INTEGER DEFAULT 1 CHECK(granted IN (0, 1)),
    UNIQUE(role_id, permission_id)
);

-- Employee-specific permission overrides
CREATE TABLE IF NOT EXISTS employee_permission_overrides (
    override_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    granted INTEGER CHECK(granted IN (0, 1)),
    reason TEXT,
    created_by INTEGER REFERENCES employees(employee_id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, permission_id)
);

-- Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    log_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(employee_id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- CASH REGISTER CONTROL TABLES
-- ============================================================================

-- Cash Register Sessions Table
CREATE TABLE IF NOT EXISTS cash_register_sessions (
    session_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    register_id INTEGER DEFAULT 1,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    opened_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    starting_cash NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(starting_cash >= 0),
    ending_cash NUMERIC(10,2),
    expected_cash NUMERIC(10,2),
    cash_sales NUMERIC(10,2) DEFAULT 0,
    cash_refunds NUMERIC(10,2) DEFAULT 0,
    cash_in NUMERIC(10,2) DEFAULT 0,
    cash_out NUMERIC(10,2) DEFAULT 0,
    discrepancy NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'reconciled')),
    notes TEXT,
    closed_by INTEGER REFERENCES employees(employee_id),
    reconciled_by INTEGER REFERENCES employees(employee_id),
    reconciled_at TIMESTAMP
);

-- Cash Transactions Table
CREATE TABLE IF NOT EXISTS cash_transactions (
    transaction_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES cash_register_sessions(session_id),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('cash_in', 'cash_out', 'deposit', 'withdrawal', 'adjustment')),
    amount NUMERIC(10,2) NOT NULL CHECK(amount > 0),
    reason TEXT,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    transaction_date TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- Register Cash Settings Table
CREATE TABLE IF NOT EXISTS register_cash_settings (
    setting_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    register_id INTEGER NOT NULL DEFAULT 1,
    cash_mode TEXT NOT NULL DEFAULT 'total' CHECK(cash_mode IN ('total', 'denominations')),
    total_amount NUMERIC(10,2),
    denominations TEXT,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(establishment_id, register_id)
);

-- Daily Cash Counts Table
CREATE TABLE IF NOT EXISTS daily_cash_counts (
    count_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    register_id INTEGER NOT NULL DEFAULT 1,
    count_date DATE NOT NULL,
    count_type TEXT NOT NULL DEFAULT 'drop' CHECK(count_type IN ('drop', 'opening', 'closing')),
    total_amount NUMERIC(10,2) NOT NULL,
    denominations TEXT,
    counted_by INTEGER NOT NULL REFERENCES employees(employee_id),
    counted_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    UNIQUE(establishment_id, register_id, count_date, count_type)
);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Establishment indexes (already created above)
-- Add indexes for all establishment_id columns
CREATE INDEX IF NOT EXISTS idx_inventory_establishment ON inventory(establishment_id);
CREATE INDEX IF NOT EXISTS idx_vendors_establishment ON vendors(establishment_id);
CREATE INDEX IF NOT EXISTS idx_employees_establishment ON employees(establishment_id);
CREATE INDEX IF NOT EXISTS idx_orders_establishment ON orders(establishment_id);
CREATE INDEX IF NOT EXISTS idx_customers_establishment ON customers(establishment_id);
-- Add more indexes as needed for other tables...

-- Other important indexes
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(establishment_id, sku);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(establishment_id, order_date);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_token ON employee_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_active ON employee_sessions(establishment_id, is_active, employee_id);
