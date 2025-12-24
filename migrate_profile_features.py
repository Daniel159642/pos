#!/usr/bin/env python3
"""
Migration script to add profile features:
- Add confirmed column to employee_schedule
- Create employee_availability table
"""

import sqlite3
import json

DB_NAME = 'inventory.db'

def migrate():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if confirmed column exists
        cursor.execute("PRAGMA table_info(employee_schedule)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'confirmed' not in columns:
            print("Adding 'confirmed' and 'confirmed_at' columns to employee_schedule...")
            cursor.execute("""
                ALTER TABLE employee_schedule
                ADD COLUMN confirmed INTEGER DEFAULT 0 CHECK(confirmed IN (0, 1))
            """)
            cursor.execute("""
                ALTER TABLE employee_schedule
                ADD COLUMN confirmed_at TIMESTAMP
            """)
            print("✓ Added confirmed columns")
        else:
            print("✓ confirmed columns already exist")
        
        # Create employee_availability table
        print("Creating employee_availability table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_availability (
                availability_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL UNIQUE,
                monday TEXT,
                tuesday TEXT,
                wednesday TEXT,
                thursday TEXT,
                friday TEXT,
                saturday TEXT,
                sunday TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
            )
        """)
        print("✓ Created employee_availability table")
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()

