#!/usr/bin/env python3
"""
Wipe all PostgreSQL data while keeping admin login credentials.
Keeps:
- employees with position = 'admin'
- their associated establishments

After wiping, automatically re-initializes RBAC system and assigns Admin role
with all permissions to the admin account.
"""

import argparse
from typing import List
from datetime import datetime

from psycopg2 import sql
from psycopg2.extras import RealDictCursor

from database_postgres import get_connection


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
    """, (table_name,))
    result = cursor.fetchone()
    return bool(result[0] if isinstance(result, tuple) else result.get('exists'))


def _get_base_tables(cursor) -> List[str]:
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    rows = cursor.fetchall()
    tables = []
    for row in rows:
        if isinstance(row, dict):
            tables.append(row.get('table_name'))
        else:
            tables.append(row[0])
    return [t for t in tables if t]


def _get_admin_employees(cursor):
    cursor.execute("""
        SELECT *
        FROM employees
        WHERE LOWER(position) = 'admin'
    """)
    return cursor.fetchall()


def _reinitialize_rbac(admin_employee_id: int = None):
    """Re-initialize RBAC system and assign Admin role to admin account"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get establishment_id
        cursor.execute("SELECT establishment_id FROM establishments LIMIT 1")
        establishment = cursor.fetchone()
        establishment_id = establishment[0] if establishment else 1
        
        # Insert default roles
        roles = [
            ('Admin', 'Full system access - can do everything', 1),
            ('Manager', 'Can manage inventory, view reports, manage employees', 0),
            ('Cashier', 'Can process sales and returns, basic inventory view', 0),
            ('Stock Clerk', 'Can manage inventory, receive shipments, no sales access', 0),
            ('Viewer', 'Read-only access to reports and inventory', 0)
        ]
        
        role_ids = {}
        for role_name, description, is_system in roles:
            cursor.execute("""
                INSERT INTO roles (establishment_id, role_name, description, is_system_role, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (establishment_id, role_name) DO NOTHING
                RETURNING role_id
            """, (establishment_id, role_name, description, is_system, datetime.now()))
            result = cursor.fetchone()
            if result:
                role_ids[role_name] = result[0]
            else:
                cursor.execute("SELECT role_id FROM roles WHERE role_name = %s AND establishment_id = %s", 
                             (role_name, establishment_id))
                existing = cursor.fetchone()
                if existing:
                    role_ids[role_name] = existing[0]
        
        # Insert all permissions
        permissions = [
            # Sales permissions
            ('process_sale', 'sales', 'Process a sale transaction'),
            ('process_return', 'sales', 'Process returns and refunds'),
            ('apply_discount', 'sales', 'Apply discounts to items'),
            ('void_transaction', 'sales', 'Void a transaction'),
            ('view_sales', 'sales', 'View sales transactions'),
            ('edit_sale', 'sales', 'Edit completed sales'),
            
            # Inventory permissions
            ('view_inventory', 'inventory', 'View inventory levels and products'),
            ('add_product', 'inventory', 'Add new products'),
            ('edit_product', 'inventory', 'Edit product information'),
            ('delete_product', 'inventory', 'Delete products'),
            ('adjust_inventory', 'inventory', 'Manually adjust inventory counts'),
            ('receive_shipment', 'inventory', 'Receive and process shipments'),
            ('transfer_inventory', 'inventory', 'Transfer inventory between locations'),
            
            # Employee/User management
            ('view_employees', 'users', 'View employee list'),
            ('add_employee', 'users', 'Add new employees'),
            ('edit_employee', 'users', 'Edit employee information'),
            ('delete_employee', 'users', 'Delete employees'),
            ('manage_permissions', 'users', 'Manage user roles and permissions'),
            ('view_activity_log', 'users', 'View system activity logs'),
            
            # Reports permissions
            ('view_sales_reports', 'reports', 'View sales reports'),
            ('view_inventory_reports', 'reports', 'View inventory reports'),
            ('view_employee_reports', 'reports', 'View employee performance reports'),
            ('view_financial_reports', 'reports', 'View financial reports'),
            ('export_reports', 'reports', 'Export reports to file'),
            
            # Settings permissions
            ('modify_settings', 'settings', 'Modify system settings'),
            ('manage_vendors', 'settings', 'Manage vendor information'),
            ('manage_customers', 'settings', 'Manage customer database'),
            ('backup_database', 'settings', 'Create database backups'),
            ('view_audit_logs', 'settings', 'View system audit logs'),
        ]
        
        permission_ids = {}
        for perm_name, category, description in permissions:
            cursor.execute("""
                INSERT INTO permissions (permission_name, permission_category, description, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (permission_name) DO NOTHING
                RETURNING permission_id
            """, (perm_name, category, description, datetime.now()))
            result = cursor.fetchone()
            if result:
                permission_ids[perm_name] = result[0]
            else:
                cursor.execute("SELECT permission_id FROM permissions WHERE permission_name = %s", (perm_name,))
                existing = cursor.fetchone()
                if existing:
                    permission_ids[perm_name] = existing[0]
        
        # Assign ALL permissions to Admin role
        if 'Admin' in role_ids:
            admin_role_id = role_ids['Admin']
            for perm_name, perm_id in permission_ids.items():
                cursor.execute("""
                    INSERT INTO role_permissions (role_id, permission_id, granted)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                """, (admin_role_id, perm_id, 1))
        
        # Assign permissions to Manager role
        manager_perms = [
            'process_sale', 'process_return', 'apply_discount', 'view_sales',
            'view_inventory', 'add_product', 'edit_product', 'adjust_inventory',
            'receive_shipment', 'view_employees', 'view_sales_reports',
            'view_inventory_reports', 'view_employee_reports', 'export_reports',
            'manage_vendors', 'manage_customers'
        ]
        
        if 'Manager' in role_ids:
            manager_role_id = role_ids['Manager']
            for perm_name in manager_perms:
                if perm_name in permission_ids:
                    cursor.execute("""
                        INSERT INTO role_permissions (role_id, permission_id, granted)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (role_id, permission_id) DO NOTHING
                    """, (manager_role_id, permission_ids[perm_name], 1))
        
        # Ensure role_id column exists
        try:
            cursor.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(role_id)")
        except Exception:
            pass  # Column might already exist
        
        # Assign Admin role to admin employee
        if admin_employee_id and 'Admin' in role_ids:
            admin_role_id = role_ids['Admin']
            cursor.execute("""
                UPDATE employees 
                SET role_id = %s 
                WHERE employee_id = %s
            """, (admin_role_id, admin_employee_id))
        
        conn.commit()
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


def wipe_database_keep_admin(assume_yes: bool = False, dry_run: bool = False) -> bool:
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        if not _table_exists(cursor, 'employees'):
            print("❌ employees table not found. Run schema_postgres.sql first.")
            return False

        admins = _get_admin_employees(cursor)
        if not admins:
            print("❌ No admin employees found. Aborting to avoid lockout.")
            print("   Create an admin account first, then retry.")
            return False

        admin_ids = sorted({admin.get('employee_id') for admin in admins if admin.get('employee_id')})
        admin_establishments = sorted({
            admin.get('establishment_id')
            for admin in admins
            if admin.get('establishment_id') is not None
        })

        print("This will wipe ALL data except admin login records.")
        print("Admins kept:")
        for admin in admins:
            emp_id = admin.get('employee_id')
            name = f"{admin.get('first_name', '')} {admin.get('last_name', '')}".strip() or "Unknown"
            code = admin.get('employee_code') or "N/A"
            est_id = admin.get('establishment_id')
            print(f"  - employee_id={emp_id} | name={name} | code={code} | establishment_id={est_id}")

        if not assume_yes:
            confirm = input("Type WIPE to continue: ").strip()
            if confirm != "WIPE":
                print("Cancelled.")
                return False

        tables = _get_base_tables(cursor)
        tables_to_clear = [t for t in tables if t not in ("employees", "establishments")]

        if dry_run:
            print("\nDry run: no changes made.")
            print("Tables to clear:", ", ".join(tables_to_clear))
            print("Employees to keep:", admin_ids)
            print("Establishments to keep:", admin_establishments)
            return True

        replication_disabled = False
        try:
            cursor.execute("SET session_replication_role = 'replica';")
            replication_disabled = True
        except Exception as e:
            print(f"⚠️  Could not disable triggers ({e}). Using TRUNCATE CASCADE fallback.")

        if replication_disabled:
            for table in tables_to_clear:
                cursor.execute(sql.SQL("DELETE FROM {}").format(sql.Identifier(table)))
        else:
            if tables_to_clear:
                cursor.execute(
                    sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                        sql.SQL(", ").join(sql.Identifier(t) for t in tables_to_clear)
                    )
                )

        cursor.execute(
            "DELETE FROM employees WHERE employee_id NOT IN %s",
            (tuple(admin_ids),)
        )

        if admin_establishments:
            cursor.execute(
                "DELETE FROM establishments WHERE establishment_id NOT IN %s",
                (tuple(admin_establishments),)
            )

        if replication_disabled:
            cursor.execute("SET session_replication_role = 'origin';")

        conn.commit()
        print("✅ Database wiped. Admin login records preserved.")
        
        # Re-initialize RBAC system and assign Admin role to admin account
        print("\n🔄 Re-initializing RBAC system...")
        try:
            # Get the admin employee ID after wipe (should still be the same)
            admin_employee_id = admin_ids[0] if admin_ids else None
            _reinitialize_rbac(admin_employee_id)
            print("✅ RBAC system re-initialized. Admin account has all permissions.")
        except Exception as e:
            print(f"⚠️  Warning: Failed to re-initialize RBAC: {e}")
            import traceback
            traceback.print_exc()
            print("   You may need to run 'python3 init_admin_permissions.py' manually.")
        
        return True

    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Wipe PostgreSQL data while keeping admin login credentials."
    )
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted")
    args = parser.parse_args()

    wipe_database_keep_admin(assume_yes=args.yes, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
