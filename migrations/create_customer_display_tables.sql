-- Customer Display System Tables
-- These tables support the customer display and payment processing features

-- Transactions Table (for customer display system)
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(order_id) ON DELETE SET NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    customer_id INTEGER REFERENCES customers(customer_id),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    tip NUMERIC(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
    payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'partial', 'refunded')),
    amount_paid NUMERIC(10,2),
    change_amount NUMERIC(10,2) DEFAULT 0,
    signature TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transaction Items Table
CREATE TABLE IF NOT EXISTS transaction_items (
    transaction_item_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES inventory(product_id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK(unit_price >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK(subtotal >= 0),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Customer Display Sessions Table
CREATE TABLE IF NOT EXISTS customer_display_sessions (
    session_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
    payment_method_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    method_name TEXT NOT NULL,
    method_type TEXT NOT NULL CHECK(method_type IN ('cash', 'credit_card', 'debit_card', 'mobile_payment', 'check', 'store_credit', 'other')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    display_order INTEGER NOT NULL DEFAULT 0,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Customer Display Settings Table
CREATE TABLE IF NOT EXISTS customer_display_settings (
    setting_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    tip_enabled INTEGER NOT NULL DEFAULT 0 CHECK(tip_enabled IN (0, 1)),
    tip_suggestions TEXT, -- JSON array of tip percentages
    receipt_enabled INTEGER NOT NULL DEFAULT 1 CHECK(receipt_enabled IN (0, 1)),
    signature_required INTEGER NOT NULL DEFAULT 0 CHECK(signature_required IN (0, 1)),
    display_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    establishment_id INTEGER NOT NULL REFERENCES establishments(establishment_id) ON DELETE CASCADE,
    transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    payment_method_id INTEGER REFERENCES payment_methods(payment_method_id),
    amount NUMERIC(10,2) NOT NULL CHECK(amount >= 0),
    card_last_four TEXT,
    card_type TEXT,
    authorization_code TEXT,
    payment_status TEXT NOT NULL DEFAULT 'approved' CHECK(payment_status IN ('pending', 'approved', 'declined', 'refunded')),
    processed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default payment methods
INSERT INTO payment_methods (establishment_id, method_name, method_type, is_active, display_order)
SELECT 
    e.establishment_id,
    'Cash',
    'cash',
    1,
    1
FROM establishments e
WHERE NOT EXISTS (
    SELECT 1 FROM payment_methods pm 
    WHERE pm.establishment_id = e.establishment_id AND pm.method_type = 'cash'
)
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (establishment_id, method_name, method_type, is_active, display_order)
SELECT 
    e.establishment_id,
    'Credit Card',
    'credit_card',
    1,
    2
FROM establishments e
WHERE NOT EXISTS (
    SELECT 1 FROM payment_methods pm 
    WHERE pm.establishment_id = e.establishment_id AND pm.method_type = 'credit_card'
)
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (establishment_id, method_name, method_type, is_active, display_order)
SELECT 
    e.establishment_id,
    'Debit Card',
    'debit_card',
    1,
    3
FROM establishments e
WHERE NOT EXISTS (
    SELECT 1 FROM payment_methods pm 
    WHERE pm.establishment_id = e.establishment_id AND pm.method_type = 'debit_card'
)
ON CONFLICT DO NOTHING;

-- Insert default customer display settings
INSERT INTO customer_display_settings (establishment_id, tip_enabled, tip_suggestions, receipt_enabled)
SELECT 
    e.establishment_id,
    0,
    '[15, 18, 20, 25]',
    1
FROM establishments e
WHERE NOT EXISTS (
    SELECT 1 FROM customer_display_settings cds 
    WHERE cds.establishment_id = e.establishment_id
)
ON CONFLICT DO NOTHING;

-- Receipt Preferences Table
CREATE TABLE IF NOT EXISTS receipt_preferences (
    preference_id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    receipt_type TEXT NOT NULL CHECK(receipt_type IN ('email', 'sms', 'print', 'none')),
    email_address TEXT,
    phone_number TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_establishment ON transactions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_employee ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_display_sessions_transaction ON customer_display_sessions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_establishment ON payment_methods(establishment_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_display_settings_establishment ON customer_display_settings(establishment_id);
CREATE INDEX IF NOT EXISTS idx_receipt_preferences_transaction ON receipt_preferences(transaction_id);
