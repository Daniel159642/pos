#!/usr/bin/env python3
"""
Quick script to wipe all data from Supabase database
"""

import os
from dotenv import load_dotenv
load_dotenv()

from database_supabase import get_connection

def wipe_all_data():
    """Wipe all data from the database"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        print("Wiping database...")
        
        # Disable triggers temporarily
        cursor.execute("SET session_replication_role = 'replica';")
        
        # Tables to delete in order (respecting foreign keys)
        tables = [
            'onboarding_progress',
            'store_setup',
            'payment_settings',
            'payment_transactions',
            'order_items',
            'orders',
            'sales',
            'shipment_items',
            'pending_shipment_items',
            'pending_shipments',
            'shipments',
            'time_clock',
            'employee_sessions',
            'employee_availability',
            'employee_schedule',
            'audit_log',
            'master_calendar',
            'customers',
            'inventory',
            'vendors',
            'employees',
            'establishments'
        ]
        
        total_deleted = 0
        
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                
                if count > 0:
                    cursor.execute(f"DELETE FROM {table}")
                    deleted = cursor.rowcount
                    print(f"  ✓ Deleted {deleted} rows from {table}")
                    total_deleted += deleted
                else:
                    print(f"  - {table}: Already empty")
            except Exception as e:
                print(f"  ⚠️  {table}: {str(e)[:80]}")
        
        # Re-enable triggers
        cursor.execute("SET session_replication_role = 'origin';")
        
        # Commit
        conn.commit()
        
        print(f"\n✅ Successfully deleted {total_deleted} total rows")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    wipe_all_data()
