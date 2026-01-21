#!/usr/bin/env python3
"""
Migration script to add register cash settings and daily cash counts
Allows configuration of base cash amounts and tracking daily cash drops
"""

import sqlite3
import sys
import json

DB_NAME = 'inventory.db'

def migrate():
    """Add register cash settings and daily counts tables"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if register_cash_settings table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='register_cash_settings'
        """)
        if cursor.fetchone():
            print("register_cash_settings table already exists")
        else:
            print("Creating register_cash_settings table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS register_cash_settings (
                    setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    register_id INTEGER NOT NULL DEFAULT 1,
                    cash_mode TEXT NOT NULL DEFAULT 'total' CHECK(cash_mode IN ('total', 'denominations')),
                    total_amount REAL,
                    denominations TEXT,
                    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(register_id)
                )
            """)
            print("✓ Created register_cash_settings table")
        
        # Check if daily_cash_counts table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='daily_cash_counts'
        """)
        if cursor.fetchone():
            print("daily_cash_counts table already exists")
        else:
            print("Creating daily_cash_counts table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS daily_cash_counts (
                    count_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    register_id INTEGER NOT NULL DEFAULT 1,
                    count_date DATE NOT NULL,
                    count_type TEXT NOT NULL DEFAULT 'drop' CHECK(count_type IN ('drop', 'opening', 'closing')),
                    total_amount REAL NOT NULL,
                    denominations TEXT,
                    counted_by INTEGER NOT NULL,
                    counted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notes TEXT,
                    FOREIGN KEY (counted_by) REFERENCES employees(employee_id),
                    UNIQUE(register_id, count_date, count_type)
                )
            """)
            print("✓ Created daily_cash_counts table")
        
        # Create indexes
        print("Creating indexes...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_cash_settings_register 
            ON register_cash_settings(register_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_cash_settings_active 
            ON register_cash_settings(is_active)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_daily_counts_register_date 
            ON daily_cash_counts(register_id, count_date)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_daily_counts_type 
            ON daily_cash_counts(count_type)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_daily_counts_date 
            ON daily_cash_counts(count_date)
        """)
        print("✓ Created indexes")
        
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
