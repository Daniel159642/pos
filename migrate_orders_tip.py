#!/usr/bin/env python3
"""
Migration script to add tip column to orders table
"""

import sqlite3
import sys

DB_NAME = 'inventory.db'

def migrate():
    """Add tip column to orders table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if tip column already exists
        cursor.execute("PRAGMA table_info(orders)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'tip' not in columns:
            print("Adding 'tip' column to orders table...")
            cursor.execute("""
                ALTER TABLE orders
                ADD COLUMN tip REAL DEFAULT 0 CHECK(tip >= 0)
            """)
            print("✓ Added 'tip' column to orders table")
            
            # Update existing orders with tip from payment_transactions if available
            print("Updating existing orders with tips from payment_transactions...")
            cursor.execute("""
                UPDATE orders
                SET tip = (
                    SELECT COALESCE(SUM(pt.tip), 0)
                    FROM payment_transactions pt
                    WHERE pt.order_id = orders.order_id
                )
            """)
            print(f"✓ Updated {cursor.rowcount} existing orders")
        else:
            print("'tip' column already exists in orders table")
        
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








