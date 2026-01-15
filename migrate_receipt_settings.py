#!/usr/bin/env python3
"""
Migration script to add receipt settings table
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate():
    """Create receipt_settings table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Create receipt_settings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS receipt_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_name TEXT DEFAULT 'Store',
                store_address TEXT DEFAULT '',
                store_city TEXT DEFAULT '',
                store_state TEXT DEFAULT '',
                store_zip TEXT DEFAULT '',
                store_phone TEXT DEFAULT '',
                store_email TEXT DEFAULT '',
                store_website TEXT DEFAULT '',
                footer_message TEXT DEFAULT 'Thank you for your business!',
                show_tax_breakdown INTEGER DEFAULT 1,
                show_payment_method INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default settings if none exist
        cursor.execute("SELECT COUNT(*) FROM receipt_settings")
        count = cursor.fetchone()[0]
        
        if count == 0:
            cursor.execute("""
                INSERT INTO receipt_settings (
                    store_name, footer_message
                ) VALUES (?, ?)
            """, ('Store', 'Thank you for your business!'))
        
        conn.commit()
        print("✓ Created receipt_settings table")
        print("✓ Inserted default settings")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
    print("\nMigration complete!")
