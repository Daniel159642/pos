#!/usr/bin/env python3
"""
Migration script to create receipt_settings table
"""

import sqlite3
from database import get_connection, DB_NAME

def migrate_receipt_settings():
    """Create receipt_settings table if it doesn't exist"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='receipt_settings'
        """)
        
        if cursor.fetchone():
            print("receipt_settings table already exists")
            conn.close()
            return
        
        # Create receipt_settings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS receipt_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_type TEXT DEFAULT 'traditional' CHECK(receipt_type IN ('traditional', 'custom')),
                store_name TEXT DEFAULT 'Store',
                store_address TEXT DEFAULT '',
                store_city TEXT DEFAULT '',
                store_state TEXT DEFAULT '',
                store_zip TEXT DEFAULT '',
                store_phone TEXT DEFAULT '',
                store_email TEXT DEFAULT '',
                store_website TEXT DEFAULT '',
                footer_message TEXT DEFAULT 'Thank you for your business!',
                return_policy TEXT DEFAULT '',
                show_tax_breakdown INTEGER DEFAULT 1 CHECK(show_tax_breakdown IN (0, 1)),
                show_payment_method INTEGER DEFAULT 1 CHECK(show_payment_method IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default settings
        cursor.execute("""
            INSERT INTO receipt_settings 
            (receipt_type, store_name, footer_message, show_tax_breakdown, show_payment_method)
            VALUES ('traditional', 'Store', 'Thank you for your business!', 1, 1)
        """)
        
        conn.commit()
        print("✓ Created receipt_settings table with default settings")
        
    except Exception as e:
        print(f"Error creating receipt_settings table: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_receipt_settings()
