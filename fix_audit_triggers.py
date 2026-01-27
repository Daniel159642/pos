#!/usr/bin/env python3
"""
Fix audit triggers on database - ensures trigger function matches current code
Run this on the other computer to fix any trigger mismatches
"""

import os
import sys
import subprocess

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed")

def get_db_connection_string():
    """Get database connection string from environment"""
    db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('DB_URL')
    if db_url:
        return db_url
    
    # Build from individual components
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'pos_db')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'postgres')
    
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

def main():
    print("=" * 70)
    print("Fixing Audit Triggers - Ensuring Database Matches Code")
    print("=" * 70)
    print()
    
    # Check .env file
    if not os.path.exists('.env'):
        print("❌ .env file not found!")
        print("Please create .env file with your database connection details.")
        sys.exit(1)
    
    db_url = get_db_connection_string()
    
    print("Step 1: Dropping existing audit triggers (if any)...")
    try:
        # Drop all audit triggers
        drop_triggers_sql = """
        DO $$ 
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT trigger_name, event_object_table 
                     FROM information_schema.triggers 
                     WHERE trigger_name LIKE 'audit_%') 
            LOOP
                EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', 
                              r.trigger_name, r.event_object_table);
            END LOOP;
        END $$;
        """
        
        result = subprocess.run(
            ['psql', db_url, '-c', drop_triggers_sql],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print("  ✓ Dropped existing audit triggers")
        else:
            print(f"  ⚠ Warning: {result.stderr[:200]}")
    except Exception as e:
        print(f"  ⚠ Warning: {e}")
    
    print()
    print("Step 2: Dropping existing audit_trigger_function...")
    try:
        result = subprocess.run(
            ['psql', db_url, '-c', 'DROP FUNCTION IF EXISTS audit_trigger_function() CASCADE;'],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print("  ✓ Dropped existing function")
        else:
            print(f"  ⚠ Warning: {result.stderr[:200]}")
    except Exception as e:
        print(f"  ⚠ Warning: {e}")
    
    print()
    print("Step 3: Running accounting_triggers.sql to create correct function and triggers...")
    if not os.path.exists('accounting_triggers.sql'):
        print("  ❌ accounting_triggers.sql not found!")
        print("  Make sure you're in the project root directory.")
        sys.exit(1)
    
    try:
        result = subprocess.run(
            ['psql', db_url, '-f', 'accounting_triggers.sql'],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("  ✓ Trigger function and triggers created successfully")
        else:
            print(f"  ⚠ Some errors (may be OK if triggers already exist):")
            if result.stderr:
                print(f"    {result.stderr[:500]}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        sys.exit(1)
    
    print()
    print("Step 4: Verifying trigger function exists...")
    try:
        result = subprocess.run(
            ['psql', db_url, '-c', 
             "SELECT proname FROM pg_proc WHERE proname = 'audit_trigger_function';"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if 'audit_trigger_function' in result.stdout:
            print("  ✓ Trigger function verified")
        else:
            print("  ⚠ Warning: Function may not exist")
    except Exception as e:
        print(f"  ⚠ Warning: {e}")
    
    print()
    print("=" * 70)
    print("✓ Audit triggers fix complete!")
    print("=" * 70)
    print()
    print("The database should now match your code. Try creating a vendor again.")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nFix cancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
