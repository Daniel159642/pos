#!/usr/bin/env python3
"""
Migration script to add tip tracking to payment_transactions table
Adds tip and employee_id columns to track tips received by employees
"""

import sqlite3
import sys

DB_NAME = 'inventory.db'

def migrate():
    """Add tip and employee_id columns to payment_transactions table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if tip column already exists
        cursor.execute("PRAGMA table_info(payment_transactions)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'tip' not in columns:
            print("Adding 'tip' column to payment_transactions table...")
            cursor.execute("""
                ALTER TABLE payment_transactions
                ADD COLUMN tip REAL DEFAULT 0 CHECK(tip >= 0)
            """)
            print("✓ Added 'tip' column")
        else:
            print("'tip' column already exists")
        
        if 'employee_id' not in columns:
            print("Adding 'employee_id' column to payment_transactions table...")
            cursor.execute("""
                ALTER TABLE payment_transactions
                ADD COLUMN employee_id INTEGER
            """)
            # Add foreign key constraint if possible (SQLite doesn't support ALTER TABLE ADD CONSTRAINT)
            # We'll handle the relationship in application code
            print("✓ Added 'employee_id' column")
            
            # Update existing records to set employee_id from orders table
            print("Updating existing payment_transactions with employee_id from orders...")
            cursor.execute("""
                UPDATE payment_transactions
                SET employee_id = (
                    SELECT employee_id 
                    FROM orders 
                    WHERE orders.order_id = payment_transactions.order_id
                )
            """)
            print(f"✓ Updated {cursor.rowcount} existing records")
        else:
            print("'employee_id' column already exists")
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()








