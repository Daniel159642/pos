#!/usr/bin/env python3
"""
Run migration: add total_spent to customers for rewards tracking.
Fixes: column "total_spent" does not exist when awarding rewards on order.

Usage: from pos directory (with .env or DB_* set):
  python run_add_customers_total_spent.py
"""
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    try:
        from database_postgres import get_connection
    except ImportError:
        print("Error: Could not import database_postgres. Run this script from the pos directory.")
        sys.exit(1)

    migration_path = os.path.join(os.path.dirname(__file__), 'migrations', 'add_customers_total_spent.sql')
    with open(migration_path) as f:
        sql = f.read()

    try:
        conn = get_connection()
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        conn.close()
        print("OK: customers.total_spent added (or already exists).")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
