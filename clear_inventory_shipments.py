#!/usr/bin/env python3
"""
Clear all data from shipment-related tables including verification data and approved shipments
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def clear_all_shipment_data():
    """Clear all data from all shipment-related tables"""
    if not os.path.exists(DB_NAME):
        print(f"Database {DB_NAME} does not exist. Nothing to clear.")
        return
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Disable foreign key constraints temporarily
    cursor.execute("PRAGMA foreign_keys = OFF")
    
    # Tables to clear (in order to respect foreign keys - child tables first)
    # Clear child tables before parent tables to avoid foreign key issues
    tables = [
        # Approved shipment items (references approved_shipments)
        'approved_shipment_items',
        # Approved shipments (references pending_shipments)
        'approved_shipments',
        # Shipment verification tables (reference pending_shipments)
        'shipment_issues',
        'shipment_scan_log',
        'verification_sessions',
        # Shipment discrepancies (references shipments and pending_shipments)
        'shipment_discrepancies',
        # Shipment items (references shipments)
        'shipment_items',
        # Pending shipment items (references pending_shipments)
        'pending_shipment_items',
        # Pending shipments (including approved ones)
        'pending_shipments',
        # Shipments
        'shipments'
    ]
    
    print("Clearing all shipment data including verification and approved shipments...")
    print("-" * 70)
    
    total_deleted = 0
    for table in tables:
        try:
            # Check if table exists and get count before deletion
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone():
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                
                if count > 0:
                    # Delete all rows
                    cursor.execute(f"DELETE FROM {table}")
                    print(f"✓ Cleared {count} rows from {table}")
                    total_deleted += count
                else:
                    print(f"  {table}: (already empty)")
            else:
                print(f"  {table}: (table does not exist, skipping)")
        except sqlite3.OperationalError as e:
            print(f"⚠ {table}: {e}")
    
    # Re-enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")
    
    # Reset auto-increment counters for cleared tables
    for table in tables:
        try:
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name = '{table}'")
        except sqlite3.OperationalError:
            pass  # Table might not have auto-increment or sequence might not exist
    
    conn.commit()
    conn.close()
    
    print("-" * 70)
    print(f"✓ Cleared {total_deleted} total rows from shipment-related tables")
    print("✓ Database schema preserved")
    print("✓ All shipment data, verification data, and approved shipments removed")

if __name__ == '__main__':
    clear_all_shipment_data()

