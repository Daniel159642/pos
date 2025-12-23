-- Inventory Database Schema
-- POS System Inventory Table

CREATE TABLE IF NOT EXISTS inventory (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    product_price REAL NOT NULL CHECK(product_price >= 0),
    product_cost REAL NOT NULL CHECK(product_cost >= 0),
    vendor TEXT,
    vendor_id INTEGER,
    photo TEXT,
    current_quantity INTEGER NOT NULL DEFAULT 0 CHECK(current_quantity >= 0),
    category TEXT,
    last_restocked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id)
);

-- Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER,
    shipment_date TEXT,
    received_date TEXT,
    purchase_order_number TEXT,
    tracking_number TEXT,
    total_cost REAL,
    received_by INTEGER,
    verified_by INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (received_by) REFERENCES employees(employee_id),
    FOREIGN KEY (verified_by) REFERENCES employees(employee_id)
);

-- Shipment_Items Table (linking table)
CREATE TABLE IF NOT EXISTS shipment_items (
    shipment_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity_received INTEGER NOT NULL CHECK(quantity_received > 0),
    unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
    lot_number TEXT,
    expiration_date TEXT,
    received_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

-- Sales/Transactions Table (tracks inventory usage/sales)
CREATE TABLE IF NOT EXISTS sales (
    sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity_sold INTEGER NOT NULL CHECK(quantity_sold > 0),
    sale_price REAL NOT NULL CHECK(sale_price >= 0),
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

-- Pending_Shipments Table (staging area for document uploads)
CREATE TABLE IF NOT EXISTS pending_shipments (
    pending_shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    expected_date TEXT,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    purchase_order_number TEXT,
    tracking_number TEXT,
    status TEXT DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'approved', 'rejected')),
    uploaded_by INTEGER,
    approved_by INTEGER,
    approved_date TIMESTAMP,
    reviewed_by TEXT,
    reviewed_date TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (uploaded_by) REFERENCES employees(employee_id),
    FOREIGN KEY (approved_by) REFERENCES employees(employee_id)
);

-- Pending_Shipment_Items Table
CREATE TABLE IF NOT EXISTS pending_shipment_items (
    pending_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pending_shipment_id INTEGER NOT NULL,
    product_sku TEXT,
    product_name TEXT,
    quantity_expected INTEGER NOT NULL CHECK(quantity_expected > 0),
    quantity_verified INTEGER,
    unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
    lot_number TEXT,
    expiration_date TEXT,
    discrepancy_notes TEXT,
    product_id INTEGER,  -- Matched product_id after verification
    FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_vendor ON inventory(vendor);
CREATE INDEX IF NOT EXISTS idx_vendor_id ON inventory(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_vendor ON shipments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_product ON shipment_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pending_shipments_vendor ON pending_shipments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pending_shipments_status ON pending_shipments(status);
CREATE INDEX IF NOT EXISTS idx_pending_items_shipment ON pending_shipment_items(pending_shipment_id);
CREATE INDEX IF NOT EXISTS idx_pending_items_sku ON pending_shipment_items(product_sku);

-- Trigger to update inventory when shipment items are received
CREATE TRIGGER IF NOT EXISTS update_inventory_on_shipment
AFTER INSERT ON shipment_items
FOR EACH ROW
BEGIN
    UPDATE inventory
    SET current_quantity = current_quantity + NEW.quantity_received,
        last_restocked = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE product_id = NEW.product_id;
END;

-- Trigger to update inventory when sales occur
CREATE TRIGGER IF NOT EXISTS update_inventory_on_sale
AFTER INSERT ON sales
FOR EACH ROW
BEGIN
    UPDATE inventory
    SET current_quantity = current_quantity - NEW.quantity_sold,
        updated_at = CURRENT_TIMESTAMP
    WHERE product_id = NEW.product_id;
END;

-- ============================================================================
-- ORDER SYSTEM TABLES
-- ============================================================================

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT UNIQUE NOT NULL,  -- Employee ID/Code for login
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT,  -- Hashed password for authentication
    position TEXT NOT NULL CHECK(position IN ('cashier', 'stock_clerk', 'manager', 'admin', 'supervisor', 'assistant_manager')),
    department TEXT,
    date_started DATE NOT NULL,
    date_terminated DATE,
    hourly_rate REAL,
    salary REAL,
    employment_type TEXT CHECK(employment_type IN ('full_time', 'part_time', 'contract', 'temporary')) DEFAULT 'part_time',
    active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table (Optional - for loyalty/tracking)
CREATE TABLE IF NOT EXISTS customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    email TEXT,
    phone TEXT,
    loyalty_points INTEGER DEFAULT 0,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,  -- Human-readable order number
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER,
    employee_id INTEGER NOT NULL,
    subtotal REAL DEFAULT 0 CHECK(subtotal >= 0),
    tax_rate REAL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 1),  -- Tax rate as decimal (e.g., 0.08 for 8%)
    tax_amount REAL DEFAULT 0 CHECK(tax_amount >= 0),  -- Calculated tax amount
    discount REAL DEFAULT 0 CHECK(discount >= 0),
    transaction_fee REAL DEFAULT 0 CHECK(transaction_fee >= 0),  -- Payment processing fee
    total REAL DEFAULT 0 CHECK(total >= 0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit')),
    payment_status TEXT DEFAULT 'completed' CHECK(payment_status IN ('pending', 'completed', 'refunded', 'partially_refunded')),
    order_status TEXT DEFAULT 'completed' CHECK(order_status IN ('completed', 'voided', 'returned')),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Order_Items Table (Line items for each order)
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),  -- Price at time of sale
    discount REAL DEFAULT 0 CHECK(discount >= 0),
    subtotal REAL NOT NULL CHECK(subtotal >= 0),  -- quantity * unit_price - discount
    tax_rate REAL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 1),  -- Tax rate for this item
    tax_amount REAL DEFAULT 0 CHECK(tax_amount >= 0),  -- Tax amount for this item
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

-- Payment_Transactions Table (For detailed payment tracking)
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    payment_method TEXT CHECK(payment_method IN ('cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit', 'refund')),
    amount REAL NOT NULL,  -- Gross transaction amount
    transaction_fee REAL DEFAULT 0 CHECK(transaction_fee >= 0),  -- Processing fee (for credit cards, etc.)
    transaction_fee_rate REAL DEFAULT 0 CHECK(transaction_fee_rate >= 0 AND transaction_fee_rate <= 1),  -- Fee rate as decimal
    net_amount REAL NOT NULL,  -- Amount after fees (amount - transaction_fee)
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    card_last_four TEXT,  -- Last 4 digits of card
    authorization_code TEXT,
    processor_name TEXT,  -- Payment processor (e.g., 'Stripe', 'Square', 'PayPal')
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'declined', 'pending', 'refunded')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Employee Schedule Table (for scheduled shifts)
CREATE TABLE IF NOT EXISTS employee_schedule (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    schedule_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_duration INTEGER DEFAULT 0,  -- Break duration in minutes
    clock_in_time TIMESTAMP,
    clock_out_time TIMESTAMP,
    hours_worked REAL,  -- Calculated hours worked
    overtime_hours REAL DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'clocked_in', 'clocked_out', 'no_show', 'cancelled')),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- Employee Sessions Table (Track who's logged in)
CREATE TABLE IF NOT EXISTS employee_sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    session_token TEXT UNIQUE,
    ip_address TEXT,
    device_info TEXT,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- Time Clock Table (Clock in/out tracking)
CREATE TABLE IF NOT EXISTS time_clock (
    time_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_start TIMESTAMP,
    break_end TIMESTAMP,
    total_hours REAL,  -- Calculated on clock out
    notes TEXT,
    status TEXT DEFAULT 'clocked_in' CHECK(status IN ('clocked_in', 'on_break', 'clocked_out')),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- Audit Log Table (Track all changes)
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'VOID', 'RETURN', 'LOGIN', 'LOGOUT', 'CLOCK_IN', 'CLOCK_OUT')),
    employee_id INTEGER NOT NULL,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_values TEXT,  -- JSON string of previous data
    new_values TEXT,  -- JSON string of new data
    ip_address TEXT,
    notes TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Master Calendar Table (for schedules, shipments, events, etc.)
CREATE TABLE IF NOT EXISTS master_calendar (
    calendar_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('schedule', 'shipment', 'holiday', 'event', 'meeting', 'maintenance', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIME,
    end_time TIME,
    related_id INTEGER,  -- ID of related record (e.g., shipment_id, employee_id, etc.)
    related_table TEXT,  -- Table name of related record
    created_by INTEGER,  -- Employee who created the event
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);

-- Create indexes for order system
CREATE INDEX IF NOT EXISTS idx_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_order_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_employee_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employee_position ON employees(position);
CREATE INDEX IF NOT EXISTS idx_employee_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_schedule_employee ON employee_schedule(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON employee_schedule(schedule_date);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON master_calendar(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_type ON master_calendar(event_type);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_token ON employee_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_active ON employee_sessions(is_active, employee_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_employee_date ON time_clock(employee_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_employee ON audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(action_timestamp);

-- ============================================================================
-- ACCOUNTING SYSTEM TABLES
-- ============================================================================

-- Chart of Accounts Table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'contra_asset', 'contra_revenue')),
    account_subtype TEXT,
    normal_balance TEXT NOT NULL CHECK(normal_balance IN ('debit', 'credit')),
    parent_account_id INTEGER,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    description TEXT,
    FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(account_id)
);

-- Fiscal Periods Table
CREATE TABLE IF NOT EXISTS fiscal_periods (
    period_id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed INTEGER DEFAULT 0 CHECK(is_closed IN (0, 1)),
    closed_by INTEGER,
    closed_date TIMESTAMP,
    FOREIGN KEY (closed_by) REFERENCES employees(employee_id)
);

-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    journal_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_number TEXT UNIQUE,
    entry_date DATE NOT NULL,
    entry_type TEXT DEFAULT 'standard' CHECK(entry_type IN ('standard', 'adjusting', 'closing', 'reversing')),
    transaction_source TEXT NOT NULL CHECK(transaction_source IN ('sale', 'purchase', 'shipment', 'return', 'adjustment', 'payroll', 'other')),
    source_id INTEGER,
    description TEXT NOT NULL,
    employee_id INTEGER NOT NULL,
    posted INTEGER DEFAULT 0 CHECK(posted IN (0, 1)),
    posted_date TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Journal Entry Lines Table (Double-entry bookkeeping)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    line_id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL,
    line_number INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    debit_amount REAL DEFAULT 0 CHECK(debit_amount >= 0),
    credit_amount REAL DEFAULT 0 CHECK(credit_amount >= 0),
    description TEXT,
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(journal_entry_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(account_id)
);

-- Retained Earnings Table
CREATE TABLE IF NOT EXISTS retained_earnings (
    retained_earnings_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_period_id INTEGER NOT NULL,
    beginning_balance REAL NOT NULL,
    net_income REAL NOT NULL,
    dividends REAL DEFAULT 0,
    ending_balance REAL NOT NULL,
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(period_id)
);

-- Shipment Discrepancies Table
CREATE TABLE IF NOT EXISTS shipment_discrepancies (
    discrepancy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER,
    pending_shipment_id INTEGER,
    product_id INTEGER NOT NULL,
    discrepancy_type TEXT NOT NULL CHECK(discrepancy_type IN ('missing', 'extra', 'damaged', 'wrong_product', 'quantity_short', 'quantity_over', 'expired', 'wrong_lot')),
    expected_quantity INTEGER,
    actual_quantity INTEGER,
    discrepancy_quantity INTEGER,
    expected_product_sku TEXT,
    actual_product_sku TEXT,
    financial_impact REAL,
    reported_by INTEGER NOT NULL,
    reported_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolution_status TEXT DEFAULT 'reported' CHECK(resolution_status IN ('reported', 'investigating', 'resolved', 'written_off')),
    resolved_by INTEGER,
    resolved_date TIMESTAMP,
    resolution_notes TEXT,
    vendor_notified INTEGER DEFAULT 0 CHECK(vendor_notified IN (0, 1)),
    vendor_response TEXT,
    claim_number TEXT,
    photos TEXT,  -- JSON string of photo URLs
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id),
    FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id),
    FOREIGN KEY (product_id) REFERENCES inventory(product_id),
    FOREIGN KEY (reported_by) REFERENCES employees(employee_id),
    FOREIGN KEY (resolved_by) REFERENCES employees(employee_id)
);

-- Update Pending_Shipment_Items to track discrepancies
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with constraints easily
-- We'll add these in a migration or handle in application code

-- Create indexes for accounting system
CREATE INDEX IF NOT EXISTS idx_chart_account_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_account_number ON chart_of_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entry_source ON journal_entries(transaction_source, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_discrepancies_shipment ON shipment_discrepancies(shipment_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON shipment_discrepancies(resolution_status);
CREATE INDEX IF NOT EXISTS idx_discrepancies_type ON shipment_discrepancies(discrepancy_type);

-- Trigger to update inventory when order items are added
CREATE TRIGGER IF NOT EXISTS update_inventory_on_order_item
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE inventory
    SET current_quantity = current_quantity - NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE product_id = NEW.product_id;
END;

