#!/usr/bin/env python3
"""
Initialize roles and permissions for PostgreSQL and assign admin role to admin account
"""

import os
from datetime import datetime

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed")

from database_postgres import get_connection

def init_rbac_data():
    """Insert default roles and permissions for PostgreSQL"""
    
    conn = get_connection()
    cursor = conn.cursor()
    
    print("Initializing RBAC data for PostgreSQL...")
    
    # Get establishment_id (should be 1)
    cursor.execute("SELECT establishment_id FROM establishments LIMIT 1")
    establishment = cursor.fetchone()
    establishment_id = establishment[0] if establishment else 1
    
    # Insert default roles
    print("\n1. Inserting default roles...")
    roles = [
        ('Admin', 'Full system access - can do everything', 1),
        ('Employee', 'Standard employee - POS, calendar, limited settings (no accounting/tables)', 0),
        ('Manager', 'Can manage inventory, view reports, manage employees', 0),
        ('Cashier', 'Can process sales and returns, basic inventory view', 0),
        ('Stock Clerk', 'Can manage inventory, receive shipments, no sales access', 0),
        ('Viewer', 'Read-only access to reports and inventory', 0)
    ]
    
    role_ids = {}
    for role_name, description, is_system in roles:
        try:
            cursor.execute("""
                INSERT INTO roles (establishment_id, role_name, description, is_system_role, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING role_id
            """, (establishment_id, role_name, description, is_system, datetime.now()))
            result = cursor.fetchone()
            if result:
                role_ids[role_name] = result[0]
                print(f"  ✓ {role_name} (ID: {result[0]})")
            else:
                # Role already exists, get its ID
                cursor.execute("SELECT role_id FROM roles WHERE role_name = %s AND establishment_id = %s", 
                             (role_name, establishment_id))
                existing = cursor.fetchone()
                if existing:
                    role_ids[role_name] = existing[0]
                    print(f"  - {role_name} already exists (ID: {existing[0]})")
        except Exception as e:
            print(f"  ✗ Error inserting {role_name}: {e}")
    
    # Insert all permissions
    print("\n2. Inserting permissions...")
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
        try:
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
                # Permission already exists, get its ID
                cursor.execute("SELECT permission_id FROM permissions WHERE permission_name = %s", (perm_name,))
                existing = cursor.fetchone()
                if existing:
                    permission_ids[perm_name] = existing[0]
        except Exception as e:
            print(f"  ✗ Error inserting {perm_name}: {e}")
    
    print(f"  ✓ Inserted/found {len(permission_ids)} permissions")
    
    # Assign permissions to Admin role (ALL permissions)
    print("\n3. Assigning permissions to roles...")
    
    if 'Admin' in role_ids:
        admin_role_id = role_ids['Admin']
        for perm_name, perm_id in permission_ids.items():
            try:
                cursor.execute("""
                    INSERT INTO role_permissions (role_id, permission_id, granted)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (admin_role_id, perm_id, 1))
            except Exception as e:
                pass
        print(f"  ✓ Admin: {len(permission_ids)} permissions")
    
    # Assign permissions to Employee role (restricted: no accounting, tables, schedule edit, manage_permissions, add_employee)
    employee_perms = [
        'process_sale', 'process_return', 'apply_discount', 'view_sales', 'void_transaction',
        'view_inventory', 'view_employees',
        'view_sales_reports', 'view_inventory_reports', 'export_reports',
        'manage_vendors', 'manage_customers', 'modify_settings', 'view_audit_logs'
    ]
    if 'Employee' in role_ids:
        employee_role_id = role_ids['Employee']
        for perm_name in employee_perms:
            if perm_name in permission_ids:
                try:
                    cursor.execute("""
                        INSERT INTO role_permissions (role_id, permission_id, granted)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (employee_role_id, permission_ids[perm_name], 1))
                except Exception as e:
                    pass
        print(f"  ✓ Employee: {len(employee_perms)} permissions")

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
                try:
                    cursor.execute("""
                        INSERT INTO role_permissions (role_id, permission_id, granted)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (manager_role_id, permission_ids[perm_name], 1))
                except Exception as e:
                    pass
        print(f"  ✓ Manager: {len(manager_perms)} permissions")
    
    conn.commit()
    
    return role_ids

def assign_admin_role_to_admin():
    """Assign Admin role to the admin employee"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("\n4. Adding role_id column to employees table if needed...")
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(role_id)")
        conn.commit()
        print("  ✓ role_id column added/verified")
    except Exception as e:
        # Column might already exist, that's okay
        conn.rollback()
        print(f"  - role_id column check: {e}")
    
    print("\n5. Assigning Admin role to admin account...")
    
    # Get admin employee
    cursor.execute("SELECT employee_id FROM employees WHERE position = 'admin' AND active = 1 LIMIT 1")
    admin_employee = cursor.fetchone()
    
    if not admin_employee:
        print("  ✗ No admin employee found")
        conn.close()
        return False
    
    admin_employee_id = admin_employee[0] if isinstance(admin_employee, tuple) else admin_employee['employee_id']
    
    # Get Admin role
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Admin' LIMIT 1")
    admin_role = cursor.fetchone()
    
    if not admin_role:
        print("  ✗ Admin role not found")
        conn.close()
        return False
    
    admin_role_id = admin_role[0] if isinstance(admin_role, tuple) else admin_role['role_id']
    
    # Update employee with role_id
    cursor.execute("""
        UPDATE employees 
        SET role_id = %s 
        WHERE employee_id = %s
    """, (admin_role_id, admin_employee_id))
    
    conn.commit()
    conn.close()
    
    print(f"  ✓ Assigned Admin role (ID: {admin_role_id}) to admin employee (ID: {admin_employee_id})")
    return True


def migrate_current_employees_to_roles():
    """Assign Admin or Employee role (and position) to all existing employees."""
    conn = get_connection()
    cursor = conn.cursor()
    print("\n6. Migrating current employees to Admin/Employee roles...")
    try:
        # Allow 'employee' in position check constraint if it exists
        try:
            cursor.execute("ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_position_check")
            cursor.execute("""
                ALTER TABLE employees ADD CONSTRAINT employees_position_check
                CHECK (position = ANY (ARRAY['cashier', 'stock_clerk', 'manager', 'admin', 'supervisor', 'assistant_manager', 'employee']))
            """)
            conn.commit()
            print("  ✓ Updated position constraint to include 'employee'")
        except Exception as e:
            conn.rollback()
            print(f"  - Position constraint update: {e}")

        cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Admin' LIMIT 1")
        admin_row = cursor.fetchone()
        cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Employee' LIMIT 1")
        employee_row = cursor.fetchone()
        if not admin_row or not employee_row:
            print("  ✗ Admin or Employee role not found; skip migration")
            conn.close()
            return
        admin_role_id = admin_row[0] if isinstance(admin_row, tuple) else admin_row['role_id']
        employee_role_id = employee_row[0] if isinstance(employee_row, tuple) else employee_row['role_id']

        # Everyone with position = admin (case-insensitive) -> Admin role, position 'admin'
        cursor.execute("""
            UPDATE employees
            SET role_id = %s, position = 'admin', updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(TRIM(COALESCE(position, ''))) = 'admin'
        """, (admin_role_id,))
        admin_count = cursor.rowcount

        # Everyone else -> Employee role, position 'employee'
        cursor.execute("""
            UPDATE employees
            SET role_id = %s, position = 'employee', updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(TRIM(COALESCE(position, ''))) != 'admin' OR position IS NULL
        """, (employee_role_id,))
        employee_count = cursor.rowcount

        conn.commit()
        print(f"  ✓ Set Admin role + position 'admin' for {admin_count} employee(s)")
        print(f"  ✓ Set Employee role + position 'employee' for {employee_count} employee(s)")
    except Exception as e:
        conn.rollback()
        print(f"  ✗ Migration error: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    try:
        role_ids = init_rbac_data()
        assign_admin_role_to_admin()
        migrate_current_employees_to_roles()
        print("\n✓ RBAC initialization and migration completed!")
        print("  Admin/Employee roles are assigned; positions set to 'admin' or 'employee'.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
