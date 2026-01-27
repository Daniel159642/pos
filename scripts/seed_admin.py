#!/usr/bin/env python3
"""
Seed a default establishment and admin employee for login.
Run from project root: python3 scripts/seed_admin.py

Admin credentials:
  - Username / Employee code: admin
  - Password: 123456

If you get "role postgres does not exist":
  - On macOS, Postgres often uses your system username. In .env set:
      DB_USER=your_mac_username
      DB_PASSWORD=
      DB_NAME=pos_db
    (or use DATABASE_URL=postgresql://your_mac_username@localhost/pos_db)
  - Create the DB: createdb pos_db
  - Run schema: psql pos_db -f schema_supabase.sql
"""

import os
import sys
import hashlib

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ADMIN_PASSWORD = "123456"


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def main():
    try:
        from database_postgres import get_cursor
    except Exception as e:
        print(f"Failed to import database_postgres: {e}")
        print("Ensure Postgres is running and DB_* / DATABASE_URL are set.")
        sys.exit(1)

    try:
        cursor = get_cursor()
        conn = cursor.connection
    except Exception as e:
        err = str(e).lower()
        print(f"Database connection failed: {e}")
        if "postgres" in err and ("does not exist" in err or "role" in err):
            print("")
            print("Your Postgres likely uses your macOS username, not 'postgres'.")
            print("In .env set:  DB_USER=your_mac_username   (and DB_NAME=pos_db)")
            print("Then:  createdb pos_db   and   psql pos_db -f schema_supabase.sql")
            print("Run this script again:  python3 scripts/seed_admin.py")
        sys.exit(1)

    try:
        # 1. Ensure establishments table exists and we have at least one
        cursor.execute("""
            SELECT establishment_id FROM establishments LIMIT 1
        """)
        row = cursor.fetchone()
        if row:
            establishment_id = row["establishment_id"] if isinstance(row, dict) else row[0]
            print(f"Using existing establishment_id={establishment_id}")
        else:
            cursor.execute("""
                INSERT INTO establishments (establishment_name, establishment_code)
                VALUES ('Default Store', 'default')
                RETURNING establishment_id
            """)
            r = cursor.fetchone()
            establishment_id = r["establishment_id"] if isinstance(r, dict) else r[0]
            conn.commit()
            print(f"Created establishment_id={establishment_id} (Default Store)")

        # 2. Add username column to employees if missing (RBAC)
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'username'
        """)
        has_username = cursor.fetchone() is not None
        if not has_username:
            cursor.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS username TEXT")
            conn.commit()
            print("Added username column to employees")

        # 3. Check if admin already exists
        cursor.execute("""
            SELECT employee_id FROM employees
            WHERE (username = 'admin' OR employee_code = 'admin') AND establishment_id = %s
        """, (establishment_id,))
        existing = cursor.fetchone()
        if existing:
            print("Admin user already exists. Use username 'admin' and password '123456' to sign in.")
            return

        # 4. Insert admin employee
        pw_hash = hash_password(ADMIN_PASSWORD)
        cursor.execute("""
            INSERT INTO employees (
                establishment_id, employee_code, username, first_name, last_name,
                position, password_hash, date_started, active
            ) VALUES (
                %s, 'admin', 'admin', 'Admin', 'User',
                'admin', %s, CURRENT_DATE, 1
            )
            RETURNING employee_id
        """, (establishment_id, pw_hash))
        r = cursor.fetchone()
        emp_id = r["employee_id"] if isinstance(r, dict) else r[0]
        conn.commit()

        print("")
        print("Admin user created successfully.")
        print("  Username / Employee code: admin")
        print("  Password: 123456")
        print("")
        print("Sign in at the login page, select 'Admin User (admin)', and enter 123456.")
    except Exception as e:
        try:
            if conn and not getattr(conn, "closed", True):
                conn.rollback()
        except Exception:
            pass
        err = str(e).lower()
        print(f"Error: {e}")
        if "role \"postgres\" does not exist" in err or "postgres" in err and "does not exist" in err:
            print("")
            print("Postgres connection failed. Try:")
            print("  1. In .env set DB_USER to your macOS username (not 'postgres')")
            print("  2. createdb pos_db")
            print("  3. psql pos_db -f schema_supabase.sql")
            print("  4. Run this script again: python3 scripts/seed_admin.py")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        pass


if __name__ == "__main__":
    main()
