#!/usr/bin/env python3
"""
Clear all test data from the database while preserving schema
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def clear_all_data():
    """Clear all data from all tables"""
    if not os.path.exists(DB_NAME):
        print(f"Database {DB_NAME} does not exist. Nothing to clear.")
        return
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Disable foreign key constraints temporarily
    cursor.execute("PRAGMA foreign_keys = OFF")
    
    # List of tables to clear (in order to respect foreign keys)
    # Tables with foreign keys should be cleared first
    tables = [
        'sales',
        'shipment_items',
        'shipments',
        'pending_shipment_items',
        'pending_shipments',
        'inventory',
        'vendors'
    ]
    
    print("Clearing all test data...")
    print("-" * 50)
    
    total_deleted = 0
    for table in tables:
        try:
            # Get count before deletion
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            
            if count > 0:
                # Delete all rows
                cursor.execute(f"DELETE FROM {table}")
                print(f"✓ Cleared {count} rows from {table}")
                total_deleted += count
            else:
                print(f"  {table}: (already empty)")
        except sqlite3.OperationalError as e:
            print(f"⚠ {table}: {e}")
    
    # Re-enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")
    
    # Reset auto-increment counters
    cursor.execute("DELETE FROM sqlite_sequence")
    
    conn.commit()
    conn.close()
    
    print("-" * 50)
    print(f"✓ Cleared {total_deleted} total rows")
    print("✓ Database schema preserved")
    print("✓ All test data removed")

if __name__ == '__main__':
    clear_all_data()












