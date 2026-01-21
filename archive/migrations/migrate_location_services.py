#!/usr/bin/env python3
"""
Migration script to add location services for time clock
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate():
    """Add location fields to time_clock and create store_location_settings table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Add location fields to time_clock table
        cursor.execute("PRAGMA table_info(time_clock)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'clock_in_latitude' not in columns:
            cursor.execute("ALTER TABLE time_clock ADD COLUMN clock_in_latitude REAL")
            print("✓ Added clock_in_latitude to time_clock")
        
        if 'clock_in_longitude' not in columns:
            cursor.execute("ALTER TABLE time_clock ADD COLUMN clock_in_longitude REAL")
            print("✓ Added clock_in_longitude to time_clock")
        
        if 'clock_in_address' not in columns:
            cursor.execute("ALTER TABLE time_clock ADD COLUMN clock_in_address TEXT")
            print("✓ Added clock_in_address to time_clock")
        
        if 'clock_out_latitude' not in columns:
            cursor.execute("ALTER TABLE time_clock ADD COLUMN clock_out_latitude REAL")
            print("✓ Added clock_out_latitude to time_clock")
        
        if 'clock_out_longitude' not in columns:
            cursor.execute("ALTER TABLE time_clock ADD COLUMN clock_out_longitude REAL")
            print("✓ Added clock_out_longitude to time_clock")
        
        if 'clock_out_address' not in columns:
            cursor.execute("ALTER TABLE time_clock ADD COLUMN clock_out_address TEXT")
            print("✓ Added clock_out_address to time_clock")
        
        # Add location fields to employee_schedule table (for clock_in/clock_out functions)
        cursor.execute("PRAGMA table_info(employee_schedule)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'clock_in_latitude' not in columns:
            cursor.execute("ALTER TABLE employee_schedule ADD COLUMN clock_in_latitude REAL")
            print("✓ Added clock_in_latitude to employee_schedule")
        
        if 'clock_in_longitude' not in columns:
            cursor.execute("ALTER TABLE employee_schedule ADD COLUMN clock_in_longitude REAL")
            print("✓ Added clock_in_longitude to employee_schedule")
        
        if 'clock_in_address' not in columns:
            cursor.execute("ALTER TABLE employee_schedule ADD COLUMN clock_in_address TEXT")
            print("✓ Added clock_in_address to employee_schedule")
        
        if 'clock_out_latitude' not in columns:
            cursor.execute("ALTER TABLE employee_schedule ADD COLUMN clock_out_latitude REAL")
            print("✓ Added clock_out_latitude to employee_schedule")
        
        if 'clock_out_longitude' not in columns:
            cursor.execute("ALTER TABLE employee_schedule ADD COLUMN clock_out_longitude REAL")
            print("✓ Added clock_out_longitude to employee_schedule")
        
        if 'clock_out_address' not in columns:
            cursor.execute("ALTER TABLE employee_schedule ADD COLUMN clock_out_address TEXT")
            print("✓ Added clock_out_address to employee_schedule")
        
        # Create store_location_settings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS store_location_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_name TEXT DEFAULT 'Store',
                latitude REAL,
                longitude REAL,
                address TEXT,
                allowed_radius_meters REAL DEFAULT 100.0,
                require_location INTEGER DEFAULT 1 CHECK(require_location IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default settings if none exist
        cursor.execute("SELECT COUNT(*) FROM store_location_settings")
        count = cursor.fetchone()[0]
        
        if count == 0:
            cursor.execute("""
                INSERT INTO store_location_settings (
                    store_name, allowed_radius_meters, require_location
                ) VALUES (?, ?, ?)
            """, ('Store', 100.0, 1))
            print("✓ Created default store location settings")
        
        conn.commit()
        print("✓ Migration complete!")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
    print("\nMigration complete!")
