#!/usr/bin/env python3
"""
Migrate data from SQLite to Supabase with establishment_id
Usage: python migrate_sqlite_to_supabase.py <sqlite_db_path> <establishment_id>
"""

import sqlite3
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor
import os
import sys
from datetime import datetime

def migrate_establishment(sqlite_path: str, establishment_id: int, supabase_db_url: str):
    """Migrate one establishment's data from SQLite to Supabase"""
    print(f"\n{'='*60}")
    print(f"Migrating Establishment {establishment_id}")
    print(f"From: {sqlite_path}")
    print(f"{'='*60}\n")
    
    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database not found: {sqlite_path}")
        return False
    
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    
    # Connect to Supabase
    try:
        pg_conn = psycopg2.connect(supabase_db_url)
        pg_cursor = pg_conn.cursor(cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        sqlite_conn.close()
        return False
    
    # Verify establishment exists
    pg_cursor.execute("SELECT establishment_id FROM establishments WHERE establishment_id = %s", (establishment_id,))
    if not pg_cursor.fetchone():
        print(f"Error: Establishment {establishment_id} does not exist in Supabase")
        print("Create it first with:")
        print(f"  INSERT INTO establishments (establishment_id, establishment_name, establishment_code)")
        print(f"  VALUES ({establishment_id}, 'Store {establishment_id}', 'store{establishment_id}');")
        sqlite_conn.close()
        pg_conn.close()
        return False
    
    # Get all tables from SQLite
    sqlite_cursor = sqlite_conn.cursor()
    sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in sqlite_cursor.fetchall()]
    
    # Tables to skip
    skip_tables = ['sqlite_sequence', 'establishments']
    
    migrated_count = 0
    error_count = 0
    
    for table in tables:
        if table in skip_tables:
            continue
        
        try:
            # Get data from SQLite
            sqlite_cursor.execute(f"SELECT * FROM {table}")
            rows = sqlite_cursor.fetchall()
            
            if not rows:
                print(f"  {table}: No data to migrate")
                continue
            
            # Get column names
            columns = [desc[0] for desc in sqlite_cursor.description]
            
            # Check if table exists in PostgreSQL
            pg_cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = %s
                )
            """, (table,))
            
            if not pg_cursor.fetchone()[0]:
                print(f"  ⚠ {table}: Table does not exist in Supabase, skipping")
                continue
            
            # Check if establishment_id column exists
            pg_cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s AND column_name = 'establishment_id'
            """, (table,))
            
            has_establishment_id = pg_cursor.fetchone() is not None
            
            # Prepare data
            data = []
            for row in rows:
                row_data = list(row)
                
                # Convert None to None (SQLite uses None, PostgreSQL uses None)
                row_data = [None if x is None else x for x in row_data]
                
                # Add establishment_id if column exists in target
                if has_establishment_id and 'establishment_id' not in columns:
                    row_data.append(establishment_id)
                
                # Convert SQLite types to PostgreSQL compatible types
                processed_row = []
                for i, val in enumerate(row_data):
                    if val is None:
                        processed_row.append(None)
                    elif isinstance(val, str) and val == '':
                        processed_row.append(None)
                    else:
                        processed_row.append(val)
                
                data.append(tuple(processed_row))
            
            if not data:
                continue
            
            # Get target columns
            if has_establishment_id and 'establishment_id' not in columns:
                target_columns = columns + ['establishment_id']
            else:
                target_columns = columns
            
            # Insert into PostgreSQL
            cols_str = ', '.join([f'"{col}"' for col in target_columns])
            placeholders = ', '.join(['%s'] * len(target_columns))
            query = f'INSERT INTO {table} ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
            
            try:
                execute_values(pg_cursor, query, data, page_size=100)
                pg_conn.commit()
                print(f"  ✓ {table}: {len(rows)} rows migrated")
                migrated_count += 1
            except Exception as insert_error:
                pg_conn.rollback()
                print(f"  ✗ {table}: Error inserting - {insert_error}")
                error_count += 1
                # Try to insert row by row for debugging
                if len(rows) <= 5:
                    print(f"    Attempting row-by-row insert...")
                    for i, row_data in enumerate(data):
                        try:
                            pg_cursor.execute(query, row_data)
                            pg_conn.commit()
                        except Exception as row_error:
                            print(f"    Row {i+1} error: {row_error}")
                            pg_conn.rollback()
            
        except Exception as e:
            print(f"  ✗ {table}: Error - {e}")
            error_count += 1
            import traceback
            traceback.print_exc()
            continue
    
    sqlite_conn.close()
    pg_conn.close()
    
    print(f"\n{'='*60}")
    print(f"Migration Summary:")
    print(f"  ✓ Successfully migrated: {migrated_count} tables")
    if error_count > 0:
        print(f"  ✗ Errors: {error_count} tables")
    print(f"{'='*60}\n")
    
    return error_count == 0

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python migrate_sqlite_to_supabase.py <sqlite_db_path> <establishment_id>")
        print("\nExample:")
        print("  python migrate_sqlite_to_supabase.py inventory.db 1")
        sys.exit(1)
    
    sqlite_path = sys.argv[1]
    establishment_id = int(sys.argv[2])
    supabase_db_url = os.getenv('SUPABASE_DB_URL')
    
    if not supabase_db_url:
        print("Error: SUPABASE_DB_URL environment variable not set")
        print("Set it with: export SUPABASE_DB_URL='postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres'")
        sys.exit(1)
    
    success = migrate_establishment(sqlite_path, establishment_id, supabase_db_url)
    sys.exit(0 if success else 1)
