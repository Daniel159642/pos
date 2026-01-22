#!/usr/bin/env python3
"""
Database Migration Runner
Executes SQL migration files in order to set up the accounting database
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

load_dotenv()

from database_postgres import get_connection

def run_migration():
    """Run all migration files in order"""
    
    # Get database connection
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        print("🚀 Starting database migration...\n")
        
        # Note: psycopg2 uses autocommit=False by default, so we're already in a transaction
        
        # Migration files in order
        migration_files = [
            # Schema files
            ('database/schema/001_create_core_tables.sql', 'Core Tables'),
            ('database/schema/006_create_triggers.sql', 'Triggers'),
            ('database/schema/007_create_functions.sql', 'Functions'),
            # Seed files
            ('database/seeds/009_seed_chart_of_accounts.sql', 'Chart of Accounts'),
        ]
        
        # Also check for existing files in root
        root_migrations = [
            ('accounting_schema.sql', 'Core Tables (Root)'),
            ('accounting_triggers.sql', 'Triggers (Root)'),
            ('accounting_functions.sql', 'Functions (Root)'),
            ('accounting_seed_data.sql', 'Seed Data (Root)'),
        ]
        
        # Use root files if database/schema files don't exist
        for file_path, description in migration_files:
            if not os.path.exists(file_path):
                # Try root directory
                root_file = os.path.basename(file_path)
                if os.path.exists(root_file):
                    file_path = root_file
                else:
                    print(f"⚠️  Skipping {description}: {file_path} not found")
                    continue
            
            print(f"📄 Running migration: {description} ({os.path.basename(file_path)})")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    sql = f.read()
                
                # Execute SQL (split by semicolons for better error reporting)
                # But be careful with functions/triggers that contain semicolons
                if 'FUNCTION' in sql or 'TRIGGER' in sql or 'CREATE OR REPLACE' in sql:
                    # Execute as single block for functions/triggers
                    cursor.execute(sql)
                else:
                    # Split and execute statements, handling errors gracefully
                    statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
                    for statement in statements:
                        if statement:
                            try:
                                cursor.execute(statement)
                            except Exception as e:
                                # Ignore "already exists" errors for CREATE statements
                                error_msg = str(e).lower()
                                if 'already exists' in error_msg or 'duplicate' in error_msg:
                                    print(f"   ⚠️  Skipping (already exists): {statement[:50]}...")
                                else:
                                    raise
                
                conn.commit()
                print(f"✅ {description} completed successfully\n")
                
            except Exception as e:
                conn.rollback()
                print(f"❌ Error in {description}: {e}")
                print(f"   File: {file_path}")
                raise
        
        print("🎉 All migrations completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed. Rolling back changes.")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    run_migration()
