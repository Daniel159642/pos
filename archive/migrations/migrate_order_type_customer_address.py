#!/usr/bin/env python3
"""
Migration script to add order_type to orders and address to customers
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate():
    """Add order_type column to orders table and address column to customers table"""
    if not os.path.exists(DB_NAME):
        print(f"Database {DB_NAME} not found. Skipping migration.")
        return
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Add address column to customers table
        try:
            cursor.execute("""
                ALTER TABLE customers
                ADD COLUMN address TEXT
            """)
            print("  ✓ Added address column to customers table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("  - address column already exists in customers table")
            else:
                raise
        
        # Add order_type column to orders table
        try:
            cursor.execute("""
                ALTER TABLE orders
                ADD COLUMN order_type TEXT CHECK(order_type IN ('pickup', 'delivery'))
            """)
            print("  ✓ Added order_type column to orders table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("  - order_type column already exists in orders table")
            else:
                raise
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    print("Running migration: Add order_type and customer address...")
    migrate()
