#!/usr/bin/env python3
"""
Migration script to create customer_rewards_settings table
"""

import sqlite3
from database import get_connection, DB_NAME

def migrate_customer_rewards():
    """Create customer_rewards_settings table if it doesn't exist"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='customer_rewards_settings'
        """)
        
        if cursor.fetchone():
            print("customer_rewards_settings table already exists")
            conn.close()
            return
        
        # Create customer_rewards_settings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_rewards_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                enabled INTEGER DEFAULT 0 CHECK(enabled IN (0, 1)),
                require_email INTEGER DEFAULT 0 CHECK(require_email IN (0, 1)),
                require_phone INTEGER DEFAULT 0 CHECK(require_phone IN (0, 1)),
                require_both INTEGER DEFAULT 0 CHECK(require_both IN (0, 1)),
                reward_type TEXT DEFAULT 'points' CHECK(reward_type IN ('points', 'percentage', 'fixed')),
                points_per_dollar REAL DEFAULT 1.0 CHECK(points_per_dollar >= 0),
                percentage_discount REAL DEFAULT 0.0 CHECK(percentage_discount >= 0 AND percentage_discount <= 100),
                fixed_discount REAL DEFAULT 0.0 CHECK(fixed_discount >= 0),
                minimum_spend REAL DEFAULT 0.0 CHECK(minimum_spend >= 0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default settings
        cursor.execute("""
            INSERT INTO customer_rewards_settings 
            (enabled, require_email, require_phone, require_both, reward_type, points_per_dollar)
            VALUES (0, 0, 0, 0, 'points', 1.0)
        """)
        
        # Add total_spent column to customers table if it doesn't exist
        try:
            cursor.execute("ALTER TABLE customers ADD COLUMN total_spent REAL DEFAULT 0.0 CHECK(total_spent >= 0)")
            print("✓ Added total_spent column to customers table")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print("total_spent column already exists in customers table")
            else:
                raise
        
        conn.commit()
        print("✓ Created customer_rewards_settings table with default settings")
        
    except Exception as e:
        print(f"Error creating customer_rewards_settings table: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_customer_rewards()
