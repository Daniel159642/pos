-- ============================================================================
-- CONSOLIDATED DATABASE SCHEMA
-- This schema represents the optimized, consolidated structure after migration
-- ============================================================================

-- ============================================================================
-- INVENTORY SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT,
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

CREATE TABLE IF NOT EXISTS vendors (
    vendor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consolidated Shipments Table (includes pending, received, approved statuses)
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
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_transit', 'received', 'approved', 'rejected', 'cancelled')),
    pending_shipment_id INTEGER,  -- Link to original pending_shipment if migrated
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (received_by) REFERENCES employees(employee_id),
    FOREIGN KEY (verified_by) REFERENCES employees(employee_id)
);

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

-- Pending_Shipments Table (staging area for document uploads - will convert to shipments)
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
    product_id INTEGER,
    FOREIGN KEY (pending_shipment_id) REFERENCES pending_shipments(pending_shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

-- ============================================================================
-- ORDER SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
    employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT,
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

CREATE TABLE IF NOT EXISTS customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    email TEXT,
    phone TEXT,
    loyalty_points INTEGER DEFAULT 0,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER,
    employee_id INTEGER NOT NULL,
    subtotal REAL DEFAULT 0 CHECK(subtotal >= 0),
    tax_rate REAL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 1),
    tax_amount REAL DEFAULT 0 CHECK(tax_amount >= 0),
    discount REAL DEFAULT 0 CHECK(discount >= 0),
    transaction_fee REAL DEFAULT 0 CHECK(transaction_fee >= 0),
    total REAL DEFAULT 0 CHECK(total >= 0),
    payment_method TEXT,  -- Legacy field, use payment_method_id
    payment_method_id INTEGER,  -- Foreign key to payment_methods
    payment_status TEXT DEFAULT 'completed' CHECK(payment_status IN ('pending', 'completed', 'refunded', 'partially_refunded')),
    order_status TEXT DEFAULT 'completed' CHECK(order_status IN ('completed', 'voided', 'returned')),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    discount REAL DEFAULT 0 CHECK(discount >= 0),
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    tax_rate REAL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 1),
    tax_amount REAL DEFAULT 0 CHECK(tax_amount >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    payment_method TEXT,  -- Legacy field
    payment_method_id INTEGER,  -- Foreign key to payment_methods
    amount REAL NOT NULL,
    transaction_fee REAL DEFAULT 0 CHECK(transaction_fee >= 0),
    transaction_fee_rate REAL DEFAULT 0 CHECK(transaction_fee_rate >= 0 AND transaction_fee_rate <= 1),
    net_amount REAL NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    card_last_four TEXT,
    authorization_code TEXT,
    processor_name TEXT,
    status TEXT DEFAULT 'approved' CHECK(status IN ('approved', 'declined', 'pending', 'refunded')),
    employee_id INTEGER,  -- Employee who processed the payment
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Payment Methods Table (consolidated reference)
CREATE TABLE IF NOT EXISTS payment_methods (
    payment_method_id INTEGER PRIMARY KEY AUTOINCREMENT,
    method_name TEXT NOT NULL,
    method_type TEXT NOT NULL CHECK(method_type IN ('card', 'cash', 'mobile_wallet', 'gift_card', 'check', 'store_credit')),
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    requires_terminal INTEGER DEFAULT 0 CHECK(requires_terminal IN (0, 1)),
    icon_path TEXT,
    display_order INTEGER DEFAULT 0
);

-- Employee Tips Table (consolidated tip tracking)
CREATE TABLE IF NOT EXISTS employee_tips (
    tip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    transaction_id INTEGER,
    tip_amount REAL NOT NULL DEFAULT 0 CHECK(tip_amount >= 0),
    tip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method TEXT,
    notes TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id) ON DELETE SET NULL
);

-- ============================================================================
-- SCHEDULING SYSTEM TABLES (CONSOLIDATED)
-- ============================================================================

-- Unified Employee Availability (normalized, one row per day)
CREATE TABLE IF NOT EXISTS employee_availability_unified (
    availability_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL CHECK(day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    start_time TIME,
    end_time TIME,
    availability_type TEXT DEFAULT 'available' CHECK(availability_type IN ('available', 'preferred', 'unavailable')),
    is_recurring INTEGER DEFAULT 1 CHECK(is_recurring IN (0, 1)),
    effective_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    UNIQUE(employee_id, day_of_week, effective_date)
);

-- Unified Scheduled Shifts (consolidates employee_schedule, Scheduled_Shifts, Employee_Shifts)
CREATE TABLE IF NOT EXISTS scheduled_shifts_unified (
    shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTEGER DEFAULT 30,
    position TEXT,
    notes TEXT,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'clocked_in', 'clocked_out', 'completed', 'no_show', 'cancelled')),
    clock_in_time TIMESTAMP,
    clock_out_time TIMESTAMP,
    hours_worked REAL,
    overtime_hours REAL DEFAULT 0,
    confirmed INTEGER DEFAULT 0 CHECK(confirmed IN (0, 1)),
    confirmed_at TIMESTAMP,
    period_id INTEGER,  -- Link to schedule period if using period-based scheduling
    is_draft INTEGER DEFAULT 0 CHECK(is_draft IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- Time Clock Table (actual clock in/out records)
CREATE TABLE IF NOT EXISTS time_clock (
    time_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_start TIMESTAMP,
    break_end TIMESTAMP,
    total_hours REAL,
    notes TEXT,
    status TEXT DEFAULT 'clocked_in' CHECK(status IN ('clocked_in', 'on_break', 'clocked_out')),
    shift_id INTEGER,  -- Link to scheduled shift if applicable
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES scheduled_shifts_unified(shift_id)
);

-- Unified Calendar Events (consolidates master_calendar and Calendar_Events)
CREATE TABLE IF NOT EXISTS calendar_events_unified (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK(event_type IN ('schedule', 'shipment', 'holiday', 'event', 'meeting', 'maintenance', 'deadline', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    start_datetime TIMESTAMP,  -- For datetime-based events
    end_datetime TIMESTAMP,
    all_day INTEGER DEFAULT 0 CHECK(all_day IN (0, 1)),
    color TEXT,
    related_id INTEGER,  -- ID of related record
    related_table TEXT,  -- Table name of related record
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);

-- ============================================================================
-- AUDIT & LOGGING TABLES (CONSOLIDATED)
-- ============================================================================

-- Unified Audit Log (consolidates audit_log and activity_log)
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'VOID', 'RETURN', 'LOGIN', 'LOGOUT', 'CLOCK_IN', 'CLOCK_OUT', 'PERMISSION_GRANT', 'PERMISSION_REVOKE')),
    employee_id INTEGER NOT NULL,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_values TEXT,  -- JSON string of previous data
    new_values TEXT,  -- JSON string of new data
    ip_address TEXT,
    notes TEXT,
    log_category TEXT DEFAULT 'general' CHECK(log_category IN ('general', 'rbac', 'inventory', 'sales', 'shipment', 'schedule', 'other')),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- ============================================================================
-- RBAC TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system_role INTEGER DEFAULT 0 CHECK(is_system_role IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_name TEXT UNIQUE NOT NULL,
    permission_category TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted INTEGER DEFAULT 1 CHECK(granted IN (0, 1)),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS employee_permission_overrides (
    override_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted INTEGER CHECK(granted IN (0, 1)),
    reason TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES employees(employee_id),
    UNIQUE(employee_id, permission_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_barcode ON inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_vendor_id ON inventory(vendor_id);

-- Shipment indexes
CREATE INDEX IF NOT EXISTS idx_shipment_vendor ON shipments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_product ON shipment_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_product ON shipment_items(shipment_id, product_id);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_order_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_employee_tips_employee ON employee_tips(employee_id, tip_date);
CREATE INDEX IF NOT EXISTS idx_employee_tips_date_amount ON employee_tips(tip_date, tip_amount);

-- Scheduling indexes
CREATE INDEX IF NOT EXISTS idx_availability_employee_day ON employee_availability_unified(employee_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON scheduled_shifts_unified(employee_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_date_status ON scheduled_shifts_unified(shift_date, status);
CREATE INDEX IF NOT EXISTS idx_time_clock_employee_date ON time_clock(employee_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_calendar_date_type ON calendar_events_unified(event_date, event_type);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_employee ON audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(action_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_category_timestamp ON audit_log(log_category, action_timestamp);

-- Employee indexes
CREATE INDEX IF NOT EXISTS idx_employee_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employee_position ON employees(position);
CREATE INDEX IF NOT EXISTS idx_employee_active ON employees(active);

-- RBAC indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_employee_overrides_employee ON employee_permission_overrides(employee_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

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








