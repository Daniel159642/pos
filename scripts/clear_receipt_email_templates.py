#!/usr/bin/env python3
"""Delete all receipt email templates from the database.
Run from project root: python3 scripts/clear_receipt_email_templates.py"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database_postgres import get_connection


def main():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM email_templates WHERE category = 'receipt'")
            deleted = cur.rowcount
        conn.commit()
        print(f"Deleted {deleted} receipt email template(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
