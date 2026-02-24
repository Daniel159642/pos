#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()
from database_postgres import get_connection

def run_migration():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        print("Creating integrations table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS integrations (
                id SERIAL PRIMARY KEY,
                provider_name VARCHAR(50) NOT NULL UNIQUE,
                access_token TEXT,
                refresh_token TEXT,
                realm_id VARCHAR(100),
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        print("Adding qbo_id to accounting.accounts...")
        try:
            cur.execute("ALTER TABLE accounting.accounts ADD COLUMN qbo_id VARCHAR(255);")
        except Exception as e:
            if "already exists" in str(e):
                print("qbo_id already exists in accounting.accounts")
                conn.rollback() # reset transaction block
            else:
                raise

        print("Adding qbo_id to accounting.transactions...")
        try:
            cur.execute("ALTER TABLE accounting.transactions ADD COLUMN qbo_id VARCHAR(255);")
        except Exception as e:
            if "already exists" in str(e):
                print("qbo_id already exists in accounting.transactions")
                conn.rollback()
            else:
                raise

        print("Adding qbo_id to customers...")
        try:
            cur.execute("ALTER TABLE customers ADD COLUMN qbo_id VARCHAR(255);")
        except Exception as e:
            if "already exists" in str(e):
                print("qbo_id already exists in customers")
                conn.rollback()
            else:
                try:
                    conn.rollback()
                except:
                    pass
                print("customers table might not exist, skipping")

        print("Adding qbo_id to vendors...")
        try:
            cur.execute("ALTER TABLE vendors ADD COLUMN qbo_id VARCHAR(255);")
        except Exception as e:
            if "already exists" in str(e):
                print("qbo_id already exists in vendors")
                conn.rollback()
            else:
                try:
                    conn.rollback()
                except:
                    pass
                print("vendors table might not exist, skipping")

        conn.commit()
        print("Migration complete.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during migration: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    run_migration()
