#!/usr/bin/env python3
"""
Migration script to add Clerk integration fields to employees table
"""

import sqlite3
from database import get_connection, DB_NAME
import secrets
import hashlib

def migrate_clerk_integration():
    """Add clerk_user_id and ensure pin_code column exists in employees table"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check current columns
        cursor.execute("PRAGMA table_info(employees)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add clerk_user_id column if it doesn't exist
        if 'clerk_user_id' not in columns:
            try:
                # SQLite doesn't support UNIQUE constraint in ALTER TABLE ADD COLUMN
                # Add column first, then create index for uniqueness enforcement
                cursor.execute("ALTER TABLE employees ADD COLUMN clerk_user_id TEXT")
                print("✓ Added clerk_user_id column to employees table")
                # Create unique index to enforce uniqueness
                cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_clerk_user_id_unique ON employees(clerk_user_id)")
                print("✓ Created unique index on clerk_user_id")
            except sqlite3.OperationalError as e:
                if "duplicate column" not in str(e).lower():
                    raise
        
        # Add pin_code column if it doesn't exist
        if 'pin_code' not in columns:
            try:
                cursor.execute("ALTER TABLE employees ADD COLUMN pin_code TEXT")
                print("✓ Added pin_code column to employees table")
            except sqlite3.OperationalError as e:
                if "duplicate column" not in str(e).lower():
                    raise
        
        # Create index on clerk_user_id for faster lookups
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_employees_clerk_user_id ON employees(clerk_user_id)")
            print("✓ Created index on clerk_user_id")
        except sqlite3.OperationalError:
            pass  # Index might already exist
        
        conn.commit()
        print("✓ Clerk integration migration completed successfully")
        
    except Exception as e:
        print(f"Error during Clerk integration migration: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

def generate_pin() -> str:
    """Generate a random 6-digit PIN"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

if __name__ == '__main__':
    migrate_clerk_integration()
