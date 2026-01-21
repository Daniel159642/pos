#!/usr/bin/env python3
"""
Migration script to create employee_tips table for tracking tips by employee
"""

import sqlite3
import sys

DB_NAME = 'inventory.db'

def migrate():
    """Create employee_tips table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if employee_tips table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='employee_tips'
        """)
        
        if cursor.fetchone():
            print("'employee_tips' table already exists")
        else:
            print("Creating 'employee_tips' table...")
            cursor.execute("""
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
                )
            """)
            print("✓ Created 'employee_tips' table")
            
            # Create index for faster queries
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_employee_tips_employee 
                ON employee_tips(employee_id, tip_date)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_employee_tips_order 
                ON employee_tips(order_id)
            """)
            print("✓ Created indexes")
            
            # Migrate existing tips from payment_transactions and orders
            print("Migrating existing tips...")
            cursor.execute("""
                INSERT INTO employee_tips (
                    employee_id, order_id, transaction_id, tip_amount, tip_date, payment_method
                )
                SELECT 
                    COALESCE(pt.employee_id, o.employee_id) as employee_id,
                    o.order_id,
                    pt.transaction_id,
                    COALESCE(pt.tip, o.tip, 0) as tip_amount,
                    COALESCE(pt.transaction_date, o.order_date) as tip_date,
                    o.payment_method
                FROM orders o
                LEFT JOIN payment_transactions pt ON o.order_id = pt.order_id
                WHERE COALESCE(pt.tip, o.tip, 0) > 0
            """)
            print(f"✓ Migrated {cursor.rowcount} existing tips")
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()









