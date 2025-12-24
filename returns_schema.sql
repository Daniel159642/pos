-- Pending Returns Table
CREATE TABLE IF NOT EXISTS pending_returns (
    return_id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT UNIQUE,
    order_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    customer_id INTEGER,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_refund_amount REAL DEFAULT 0 CHECK(total_refund_amount >= 0),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by INTEGER,
    approved_date TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (approved_by) REFERENCES employees(employee_id)
);

-- Pending Return Items Table
CREATE TABLE IF NOT EXISTS pending_return_items (
    return_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    order_item_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    discount REAL DEFAULT 0 CHECK(discount >= 0),
    refund_amount REAL NOT NULL CHECK(refund_amount >= 0),
    condition TEXT CHECK(condition IN ('new', 'opened', 'damaged', 'defective')),
    notes TEXT,
    FOREIGN KEY (return_id) REFERENCES pending_returns(return_id) ON DELETE CASCADE,
    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),
    FOREIGN KEY (product_id) REFERENCES inventory(product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_returns_order ON pending_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_returns_status ON pending_returns(status);
CREATE INDEX IF NOT EXISTS idx_pending_returns_date ON pending_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_pending_return_items_return ON pending_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_pending_return_items_product ON pending_return_items(product_id);

