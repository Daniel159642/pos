#!/usr/bin/env python3
"""
Setup script to create admin user and employee
"""

import sqlite3
from database import DB_NAME, add_employee, assign_role_to_employee, get_employee
from migrate_rbac import migrate_rbac
from init_rbac_data import init_rbac_data


def setup_admin_users():
    """Run migrations, initialize RBAC, and create users"""
    
    print("=" * 70)
    print("SETTING UP RBAC SYSTEM AND CREATING USERS")
    print("=" * 70)
    print()
    
    # Step 1: Run RBAC migration
    print("Step 1: Running RBAC migration...")
    try:
        migrate_rbac()
        print("✓ Migration completed\n")
    except Exception as e:
        print(f"✗ Migration failed: {e}\n")
        return
    
    # Step 2: Initialize RBAC data (roles and permissions)
    print("Step 2: Initializing RBAC data (roles and permissions)...")
    try:
        init_rbac_data()
        print("✓ RBAC data initialized\n")
    except Exception as e:
        print(f"✗ RBAC initialization failed: {e}\n")
        return
    
    # Step 3: Get Admin role ID
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Admin'")
    admin_role = cursor.fetchone()
    if not admin_role:
        print("✗ Admin role not found. Please check RBAC initialization.")
        conn.close()
        return
    admin_role_id = admin_role[0]
    
    cursor.execute("SELECT role_id FROM roles WHERE role_name = 'Cashier'")
    cashier_role = cursor.fetchone()
    cashier_role_id = cashier_role[0] if cashier_role else None
    
    conn.close()
    
    # Step 4: Create Admin User
    print("Step 3: Creating Admin User...")
    try:
        admin_id = add_employee(
            username='admin',
            first_name='Admin',
            last_name='User',
            position='admin',
            date_started='2024-01-01',
            password='123456',  # Admin passwords must be numeric only
            email='admin@pos.com',
            phone='555-0001',
            department='Management',
            employment_type='full_time',
            role_id=admin_role_id,
            pin_code='000000'
        )
        
        # Ensure role is assigned
        assign_role_to_employee(admin_id, admin_role_id)
        
        admin = get_employee(admin_id)
        print(f"✓ Admin user created:")
        print(f"  - ID: {admin_id}")
        print(f"  - Username: {admin.get('username', 'admin')}")
        print(f"  - Name: {admin['first_name']} {admin['last_name']}")
        print(f"  - Password: 123456 (Admin passwords must be numeric only - CHANGE THIS IN PRODUCTION!)")
        print(f"  - Role: Admin (Full Access)")
        print()
    except Exception as e:
        print(f"✗ Failed to create admin user: {e}\n")
        # Check if admin already exists
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT employee_id, username FROM employees WHERE username = 'admin' OR employee_code = 'admin'")
        existing = cursor.fetchone()
        if existing:
            print(f"  Admin user already exists (ID: {existing[0]})")
            admin_id = existing[0]
            # Assign admin role if not already assigned
            try:
                assign_role_to_employee(admin_id, admin_role_id)
                print(f"  ✓ Assigned Admin role to existing user")
            except:
                pass
        conn.close()
        print()
    
    # Step 5: Create Regular Employee
    print("Step 4: Creating Regular Employee...")
    try:
        employee_id = add_employee(
            username='cashier1',
            first_name='John',
            last_name='Cashier',
            position='cashier',
            date_started='2024-01-15',
            password='cashier123',  # Change this in production!
            email='cashier1@pos.com',
            phone='555-0002',
            department='Sales',
            employment_type='part_time',
            hourly_rate=15.00,
            role_id=cashier_role_id if cashier_role_id else None,
            pin_code='123456'
        )
        
        # Assign Cashier role if available
        if cashier_role_id:
            assign_role_to_employee(employee_id, cashier_role_id)
        
        employee = get_employee(employee_id)
        print(f"✓ Employee created:")
        print(f"  - ID: {employee_id}")
        print(f"  - Username: {employee.get('username', 'cashier1')}")
        print(f"  - Name: {employee['first_name']} {employee['last_name']}")
        print(f"  - Password: cashier123 (CHANGE THIS IN PRODUCTION!)")
        print(f"  - Role: Cashier")
        print()
    except Exception as e:
        print(f"✗ Failed to create employee: {e}\n")
        # Check if employee already exists
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT employee_id, username FROM employees WHERE username = 'cashier1' OR employee_code = 'cashier1'")
        existing = cursor.fetchone()
        if existing:
            print(f"  Employee already exists (ID: {existing[0]})")
        conn.close()
        print()
    
    print("=" * 70)
    print("SETUP COMPLETE!")
    print("=" * 70)
    print()
    print("Login Credentials:")
    print("  Admin User:")
    print("    Username: admin")
    print("    Password: 123456 (numeric only)")
    print()
    print("  Employee (Cashier):")
    print("    Username: cashier1")
    print("    Password: cashier123")
    print()
    print("⚠️  IMPORTANT: Change these passwords in production!")
    print()
    print("Next Steps:")
    print("1. Start the Flask server: python web_viewer.py")
    print("2. Navigate to http://localhost:5001")
    print("3. Login with admin credentials")
    print("4. Access /admin to manage employees and permissions")


if __name__ == '__main__':
    setup_admin_users()










