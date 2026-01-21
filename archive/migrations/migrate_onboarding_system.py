#!/usr/bin/env python3
"""
Migration script to create onboarding system tables
Tracks onboarding progress and setup completion
"""

import sqlite3
from database import get_connection, DB_NAME

def migrate_onboarding_system():
    """Create onboarding system tables"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if store_setup table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='store_setup'
        """)
        
        if cursor.fetchone():
            print("store_setup table already exists")
        else:
            # Create store_setup table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS store_setup (
                    setup_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    setup_completed INTEGER DEFAULT 0 CHECK(setup_completed IN (0, 1)),
                    setup_step INTEGER DEFAULT 1,  -- Current step in onboarding (1-6)
                    completed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✓ Created store_setup table")
            
            # Insert default record (not completed)
            cursor.execute("""
                INSERT INTO store_setup (setup_completed, setup_step)
                VALUES (0, 1)
            """)
            print("✓ Created default store_setup record")
        
        # Check if onboarding_progress table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='onboarding_progress'
        """)
        
        if cursor.fetchone():
            print("onboarding_progress table already exists")
        else:
            # Create onboarding_progress table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS onboarding_progress (
                    progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    step_name TEXT NOT NULL,  -- e.g., 'store_info', 'tax_settings', 'inventory', 'employees', 'preferences'
                    completed INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
                    completed_at TIMESTAMP,
                    data TEXT,  -- JSON string of step-specific data
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✓ Created onboarding_progress table")
        
        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_onboarding_step_name 
            ON onboarding_progress(step_name)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_onboarding_completed 
            ON onboarding_progress(completed)
        """)
        
        conn.commit()
        print("✓ Onboarding system migration complete!")
        
    except Exception as e:
        print(f"Error creating onboarding system tables: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_onboarding_system()
