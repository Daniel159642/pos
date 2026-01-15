#!/usr/bin/env python3
"""
Create pending returns tables in the database
"""

import sqlite3

DB_NAME = 'inventory.db'

def create_returns_tables():
    """Create pending returns tables"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Create pending_returns table
        cursor.execute("""
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
            )
        """)
        
        # Create pending_return_items table
        cursor.execute("""
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
            )
        """)
        
        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_returns_order ON pending_returns(order_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_returns_status ON pending_returns(status)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_returns_date ON pending_returns(return_date)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_return_items_return ON pending_return_items(return_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_return_items_product ON pending_return_items(product_id)
        """)
        
        conn.commit()
        print("✓ Returns tables created successfully!")
        
        # Verify tables exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('pending_returns', 'pending_return_items')
        """)
        tables = cursor.fetchall()
        print(f"✓ Verified {len(tables)} tables exist: {[t[0] for t in tables]}")
        
    except sqlite3.Error as e:
        print(f"Error creating tables: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    create_returns_tables()










