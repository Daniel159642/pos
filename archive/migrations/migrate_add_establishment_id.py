#!/usr/bin/env python3
"""
Add establishment_id column to existing tables in Supabase
Run this if you already have tables created and need to add multi-tenant support
"""

import psycopg2
import os
import sys

# Tables that need establishment_id (excluding establishments itself)
TABLES_WITH_ESTABLISHMENT = [
    'inventory',
    'vendors',
    'shipments',
    'shipment_items',
    'sales',
    'pending_shipments',
    'pending_shipment_items',
    'employees',
    'customers',
    'orders',
    'order_items',
    'payment_transactions',
    'employee_schedule',
    'employee_availability',
    'employee_sessions',
    'time_clock',
    'audit_log',
    'master_calendar',
    'chart_of_accounts',
    'fiscal_periods',
    'journal_entries',
    'journal_entry_lines',
    'retained_earnings',
    'shipment_discrepancies',
    'image_identifications',
    'roles',
    'permissions',
    'role_permissions',
    'employee_permission_overrides',
    'activity_log',
    'cash_register_sessions',
    'cash_transactions',
    'register_cash_settings',
    'daily_cash_counts'
]

def migrate_schema():
    """Add establishment_id to all tables"""
    db_url = os.getenv('SUPABASE_DB_URL')
    if not db_url:
        print("Error: SUPABASE_DB_URL environment variable not set")
        print("Set it with: export SUPABASE_DB_URL='postgresql://...'")
        return False
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        print("Adding establishment_id to tables...")
        print("=" * 60)
        
        for table in TABLES_WITH_ESTABLISHMENT:
            # Check if column already exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s AND column_name = 'establishment_id'
            """, (table,))
            
            if cursor.fetchone():
                print(f"✓ {table} already has establishment_id")
                continue
            
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = %s
                )
            """, (table,))
            
            if not cursor.fetchone()[0]:
                print(f"⚠ {table} does not exist, skipping")
                continue
            
            # Add establishment_id column (nullable first)
            try:
                cursor.execute(f"""
                    ALTER TABLE {table}
                    ADD COLUMN establishment_id INTEGER REFERENCES establishments(establishment_id) ON DELETE CASCADE
                """)
                
                # Check if table has data
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                
                if count == 0:
                    # Table is empty, make NOT NULL
                    cursor.execute(f"""
                        ALTER TABLE {table}
                        ALTER COLUMN establishment_id SET NOT NULL
                    """)
                    print(f"✓ Added establishment_id to {table} (NOT NULL)")
                else:
                    print(f"⚠ Added establishment_id to {table} (NULLABLE - has {count} rows)")
                    print(f"  ⚠ You need to set establishment_id for existing rows before making it NOT NULL")
                
                # Add index for performance
                try:
                    cursor.execute(f"""
                        CREATE INDEX IF NOT EXISTS idx_{table}_establishment 
                        ON {table}(establishment_id)
                    """)
                except Exception as idx_error:
                    print(f"  ⚠ Could not create index: {idx_error}")
                
                conn.commit()
                
            except Exception as e:
                conn.rollback()
                print(f"✗ Error adding to {table}: {e}")
                continue
        
        print("=" * 60)
        print("\n✓ Migration complete!")
        print("\n⚠ IMPORTANT: If any tables had existing data, you need to:")
        print("   1. Set establishment_id for all existing rows")
        print("   2. Then make the column NOT NULL:")
        print("      ALTER TABLE table_name ALTER COLUMN establishment_id SET NOT NULL;")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = migrate_schema()
    sys.exit(0 if success else 1)
