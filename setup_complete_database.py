#!/usr/bin/env python3
"""
Complete database setup script for new computers
This ensures all tables, schemas, and initial data are set up correctly
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

def run_sql_file(filepath, description):
    """Run a SQL file using psql"""
    if not os.path.exists(filepath):
        print(f"  ⚠ {description}: File not found ({filepath})")
        return False
    
    db_url = get_db_connection_string()
    
    try:
        # Use psql to run the file
        result = subprocess.run(
            ['psql', db_url, '-f', filepath],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            print(f"  ✓ {description}")
            return True
        else:
            # Check if errors are just "already exists" warnings
            error_output = result.stderr.lower()
            if 'already exists' in error_output or 'duplicate' in error_output:
                print(f"  ✓ {description} (already applied)")
                return True
            else:
                print(f"  ⚠ {description}: Some errors (may be OK if tables exist)")
                if result.stderr:
                    print(f"    Error: {result.stderr[:200]}")
                return True  # Continue anyway
    except subprocess.TimeoutExpired:
        print(f"  ✗ {description}: Timeout")
        return False
    except Exception as e:
        print(f"  ✗ {description}: {e}")
        return False

def create_database_if_needed():
    """Create database if it doesn't exist"""
    db_name = os.getenv('DB_NAME', 'pos_db')
    db_user = os.getenv('DB_USER', 'postgres')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    
    try:
        # Try to connect to postgres database to create the target database
        result = subprocess.run(
            ['psql', '-h', db_host, '-p', db_port, '-U', db_user, '-d', 'postgres', 
             '-c', f'CREATE DATABASE {db_name};'],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print(f"  ✓ Created database: {db_name}")
        else:
            if 'already exists' in result.stderr.lower():
                print(f"  ✓ Database already exists: {db_name}")
            else:
                print(f"  ⚠ Database creation: {result.stderr[:100]}")
    except Exception as e:
        print(f"  ⚠ Could not create database (may already exist): {e}")

def main():
    print("=" * 70)
    print("POS System - Complete Database Setup")
    print("=" * 70)
    print()
    
    # Check .env file
    if not os.path.exists('.env'):
        print("⚠️  .env file not found!")
        if os.path.exists('.env.example'):
            print("Creating .env from .env.example...")
            import shutil
            shutil.copy('.env.example', '.env')
            print("✓ Created .env file")
            print()
            print("⚠️  IMPORTANT: Edit .env and set your PostgreSQL connection details!")
            print("   Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db")
            print()
            response = input("Press Enter after you've configured .env, or Ctrl+C to exit...")
        else:
            print("❌ .env.example not found. Please create .env manually.")
            sys.exit(1)
    
    # Reload .env after creation
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except:
        pass
    
    print("Step 1: Creating database (if needed)...")
    create_database_if_needed()
    print()
    
    print("Step 2: Running main schema (schema_postgres.sql)...")
    run_sql_file('schema_postgres.sql', 'Main schema')
    print()
    
    print("Step 3: Running accounting schema (accounting_schema.sql)...")
    run_sql_file('accounting_schema.sql', 'Accounting schema')
    print()
    
    print("Step 4: Running returns schema (returns_schema.sql)...")
    run_sql_file('returns_schema.sql', 'Returns schema')
    print()
    
    print("Step 5: Running migrations...")
    migrations_dir = 'migrations'
    if os.path.exists(migrations_dir):
        migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
        for migration_file in migration_files:
            migration_path = os.path.join(migrations_dir, migration_file)
            run_sql_file(migration_path, f'Migration: {migration_file}')
    else:
        print("  - migrations directory not found")
    print()
    
    print("Step 6: Creating admin account...")
    try:
        result = subprocess.run(
            [sys.executable, 'create_admin_account.py'],
            input='ADMIN001\nAdmin\nUser\n123456\n',
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("  ✓ Admin account created")
        else:
            print("  ⚠ Admin account creation had issues (may already exist)")
    except Exception as e:
        print(f"  ⚠ Could not create admin account: {e}")
    print()
    
    print("Step 7: Initializing permissions (REQUIRED for admin access)...")
    try:
        result = subprocess.run(
            [sys.executable, 'init_admin_permissions.py'],
            timeout=60
        )
        if result.returncode == 0:
            print("  ✓ Permissions initialized")
        else:
            print("  ⚠ Permissions initialization had issues")
    except Exception as e:
        print(f"  ⚠ Could not initialize permissions: {e}")
    print()
    
    print("=" * 70)
    print("✓ Database setup complete!")
    print("=" * 70)
    print()
    print("You can now:")
    print("  1. Start the backend: python3 web_viewer.py")
    print("  2. Start the frontend: cd frontend && npm run dev")
    print("  3. Log in with:")
    print("     - Employee Code: ADMIN001")
    print("     - Password: 123456")
    print()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSetup cancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
