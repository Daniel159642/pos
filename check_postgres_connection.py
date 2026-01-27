#!/usr/bin/env python3
"""
Diagnostic script to check local PostgreSQL connection configuration
"""

import os
import sys
from urllib.parse import urlparse

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed")

def check_postgres_config():
    """Check PostgreSQL configuration and connection"""
    print("=" * 60)
    print("PostgreSQL Connection Diagnostic")
    print("=" * 60)
    print()
    
    # Check environment variables
    db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('DB_URL')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'pos_db')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'postgres')
    
    print("1. Environment Variables:")
    print(f"   DATABASE_URL: {'✓ Set' if db_url else '✗ Not set (using individual components)'}")
    if db_url:
        try:
            parsed = urlparse(db_url)
            print(f"      Hostname: {parsed.hostname}")
            print(f"      Port: {parsed.port or 5432}")
            print(f"      Database: {parsed.path.lstrip('/')}")
            print(f"      User: {parsed.username}")
        except Exception as e:
            print(f"      Error parsing URL: {e}")
    else:
        print(f"   DB_HOST: {db_host}")
        print(f"   DB_PORT: {db_port}")
        print(f"   DB_NAME: {db_name}")
        print(f"   DB_USER: {db_user}")
        print(f"   DB_PASSWORD: {'✓ Set' if db_password else '✗ Not set'}")
    print()
    
    # Check if PostgreSQL is running
    print("2. PostgreSQL Service:")
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((db_host, int(db_port)))
        sock.close()
        if result == 0:
            print(f"   ✓ PostgreSQL is running on {db_host}:{db_port}")
        else:
            print(f"   ✗ Cannot connect to PostgreSQL on {db_host}:{db_port}")
            print(f"   Make sure PostgreSQL is running:")
            print(f"   - macOS: brew services start postgresql@14")
            print(f"   - Linux: sudo systemctl start postgresql")
            print(f"   - Windows: Check Services panel")
    except Exception as e:
        print(f"   ✗ Error checking service: {e}")
    print()
    
    # Try to connect
    print("3. Connection Test:")
    try:
        import psycopg2
        print("   Attempting to connect...")
        
        if db_url:
            conn = psycopg2.connect(db_url, connect_timeout=5)
        else:
            conn = psycopg2.connect(
                host=db_host,
                port=int(db_port),
                database=db_name,
                user=db_user,
                password=db_password,
                connect_timeout=5
            )
        
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        print(f"   ✓ Connection successful!")
        print(f"   PostgreSQL version: {version.split(',')[0]}")
        
        # Check if database has tables
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        table_count = cursor.fetchone()[0]
        print(f"   Tables in database: {table_count}")
        
        if table_count == 0:
            print(f"   ⚠️  Database is empty. Run schema_postgres.sql to create tables.")
        
        cursor.close()
        conn.close()
        return True
    except ImportError:
        print("   ✗ psycopg2 not installed. Install with: pip install psycopg2-binary")
        return False
    except psycopg2.OperationalError as e:
        print(f"   ✗ Connection failed: {e}")
        if "password authentication failed" in str(e).lower():
            print(f"   → Check your DB_PASSWORD in .env file")
        elif "database" in str(e).lower() and "does not exist" in str(e).lower():
            print(f"   → Database '{db_name}' does not exist. Create it with: CREATE DATABASE {db_name};")
        elif "could not connect" in str(e).lower():
            print(f"   → PostgreSQL service may not be running")
        return False
    except Exception as e:
        print(f"   ✗ Connection failed: {e}")
        return False

def print_instructions():
    """Print instructions for fixing the connection"""
    print()
    print("=" * 60)
    print("How to Fix:")
    print("=" * 60)
    print()
    print("1. Install PostgreSQL:")
    print("   macOS: brew install postgresql@14")
    print("   Linux: sudo apt-get install postgresql")
    print()
    print("2. Start PostgreSQL:")
    print("   macOS: brew services start postgresql@14")
    print("   Linux: sudo systemctl start postgresql")
    print()
    print("3. Create database:")
    print("   psql postgres")
    print("   CREATE DATABASE pos_db;")
    print("   \\q")
    print()
    print("4. Update your .env file:")
    print("   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db")
    print()
    print("5. Run schema:")
    print("   psql -U postgres -d pos_db -f schema_postgres.sql")
    print()
    print("See LOCAL_POSTGRES_SETUP.md for detailed instructions.")
    print()

if __name__ == "__main__":
    success = check_postgres_config()
    if not success:
        print_instructions()
        sys.exit(1)
    else:
        print()
        print("✓ All checks passed! Your PostgreSQL connection is configured correctly.")
        sys.exit(0)
