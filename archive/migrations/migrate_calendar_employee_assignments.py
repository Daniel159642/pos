#!/usr/bin/env python3
"""
Migration script to add employee assignments to calendar events
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate():
    """Create calendar_event_employees junction table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Create junction table for calendar event employee assignments
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calendar_event_employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                calendar_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (calendar_id) REFERENCES master_calendar(calendar_id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                UNIQUE(calendar_id, employee_id)
            )
        """)
        
        # Create index for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_calendar_event_employees_calendar 
            ON calendar_event_employees(calendar_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_calendar_event_employees_employee 
            ON calendar_event_employees(employee_id)
        """)
        
        conn.commit()
        print("✓ Created calendar_event_employees table")
        print("✓ Created indexes")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
    print("\nMigration complete!")
