#!/usr/bin/env python3
"""
Run migration: add unit_price to pending_shipment_items.
Fixes: column "unit_price" of relation "pending_shipment_items" does not exist

Usage: from pos directory (with .env or DB_* set):
  python run_add_pending_shipment_unit_price.py
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

    migration_path = os.path.join(os.path.dirname(__file__), 'migrations', 'add_pending_shipment_items_unit_price.sql')
    with open(migration_path) as f:
        sql = f.read()

    try:
        conn = get_connection()
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        cur.close()
        conn.close()
        print("OK: pending_shipment_items.unit_price column added (or already exists).")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
