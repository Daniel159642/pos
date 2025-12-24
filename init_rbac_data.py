#!/usr/bin/env python3
"""
Initialize RBAC system with default roles and permissions
"""

import sqlite3
from database import DB_NAME


def init_rbac_data():
    """Insert default roles and permissions"""
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Initializing RBAC data...")
    
    # Insert default roles
    print("\n1. Inserting default roles...")
    roles = [
        ('Admin', 'Full system access - can do everything', 1),
        ('Manager', 'Can manage inventory, view reports, manage employees', 0),
        ('Cashier', 'Can process sales and returns, basic inventory view', 0),
        ('Stock Clerk', 'Can manage inventory, receive shipments, no sales access', 0),
        ('Viewer', 'Read-only access to reports and inventory', 0)
    ]
    
    for role_name, description, is_system in roles:
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO roles (role_name, description, is_system_role)
                VALUES (?, ?, ?)
            """, (role_name, description, is_system))
            print(f"  ✓ {role_name}")
        except sqlite3.IntegrityError:
            print(f"  - {role_name} already exists")
    
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
    
    for perm_name, category, description in permissions:
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO permissions (permission_name, permission_category, description)
                VALUES (?, ?, ?)
            """, (perm_name, category, description))
        except sqlite3.IntegrityError:
            pass
    
    print(f"  ✓ Inserted {len(permissions)} permissions")
    
    # Assign permissions to Admin role (ALL permissions)
    print("\n3. Assigning permissions to roles...")
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Admin'")
    admin_role = cursor.fetchone()
    if admin_role:
        admin_role_id = admin_role[0]
        cursor.execute("SELECT permission_id FROM permissions")
        all_perms = cursor.fetchall()
        for perm_id in all_perms:
            cursor.execute("""
                INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
                VALUES (?, ?, 1)
            """, (admin_role_id, perm_id[0]))
        print(f"  ✓ Admin: {len(all_perms)} permissions")
    
    # Assign permissions to Manager role
    manager_perms = [
        'process_sale', 'process_return', 'apply_discount', 'view_sales',
        'view_inventory', 'add_product', 'edit_product', 'adjust_inventory',
        'receive_shipment', 'view_employees', 'view_sales_reports',
        'view_inventory_reports', 'view_employee_reports', 'export_reports',
        'manage_vendors', 'manage_customers'
    ]
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Manager'")
    manager_role = cursor.fetchone()
    if manager_role:
        manager_role_id = manager_role[0]
        for perm_name in manager_perms:
            cursor.execute("""
                SELECT permission_id FROM permissions WHERE permission_name = ?
            """, (perm_name,))
            perm = cursor.fetchone()
            if perm:
                cursor.execute("""
                    INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
                    VALUES (?, ?, 1)
                """, (manager_role_id, perm[0]))
        print(f"  ✓ Manager: {len(manager_perms)} permissions")
    
    # Assign permissions to Cashier role
    cashier_perms = [
        'process_sale', 'process_return', 'apply_discount', 'view_sales',
        'view_inventory'
    ]
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Cashier'")
    cashier_role = cursor.fetchone()
    if cashier_role:
        cashier_role_id = cashier_role[0]
        for perm_name in cashier_perms:
            cursor.execute("""
                SELECT permission_id FROM permissions WHERE permission_name = ?
            """, (perm_name,))
            perm = cursor.fetchone()
            if perm:
                cursor.execute("""
                    INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
                    VALUES (?, ?, 1)
                """, (cashier_role_id, perm[0]))
        print(f"  ✓ Cashier: {len(cashier_perms)} permissions")
    
    # Assign permissions to Stock Clerk role
    stock_clerk_perms = [
        'view_inventory', 'add_product', 'edit_product', 'adjust_inventory',
        'receive_shipment', 'transfer_inventory', 'view_inventory_reports'
    ]
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Stock Clerk'")
    stock_role = cursor.fetchone()
    if stock_role:
        stock_role_id = stock_role[0]
        for perm_name in stock_clerk_perms:
            cursor.execute("""
                SELECT permission_id FROM permissions WHERE permission_name = ?
            """, (perm_name,))
            perm = cursor.fetchone()
            if perm:
                cursor.execute("""
                    INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
                    VALUES (?, ?, 1)
                """, (stock_role_id, perm[0]))
        print(f"  ✓ Stock Clerk: {len(stock_clerk_perms)} permissions")
    
    # Assign permissions to Viewer role
    viewer_perms = [
        'view_inventory', 'view_sales', 'view_sales_reports',
        'view_inventory_reports'
    ]
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Viewer'")
    viewer_role = cursor.fetchone()
    if viewer_role:
        viewer_role_id = viewer_role[0]
        for perm_name in viewer_perms:
            cursor.execute("""
                SELECT permission_id FROM permissions WHERE permission_name = ?
            """, (perm_name,))
            perm = cursor.fetchone()
            if perm:
                cursor.execute("""
                    INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
                    VALUES (?, ?, 1)
                """, (viewer_role_id, perm[0]))
        print(f"  ✓ Viewer: {len(viewer_perms)} permissions")
    
    conn.commit()
    conn.close()
    
    print("\n✓ RBAC data initialization completed!")
    print("\nNext steps:")
    print("1. Assign roles to employees using:")
    print("   from permission_manager import get_permission_manager")
    print("   pm = get_permission_manager()")
    print("   pm.assign_role_to_employee(employee_id, role_id)")


if __name__ == '__main__':
    init_rbac_data()

