#!/usr/bin/env python3
"""
Script to update existing admin passwords to numeric-only passwords
"""

import sqlite3
from database import DB_NAME, hash_password, get_connection

def update_admin_passwords():
    """Update all admin passwords to numeric-only (default: 123456)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("=" * 70)
    print("UPDATING ADMIN PASSWORDS TO NUMERIC-ONLY")
    print("=" * 70)
    print()
    
    # Find all admin users
    cursor.execute("""
        SELECT e.employee_id, e.username, e.employee_code, e.first_name, e.last_name,
               r.role_name, e.position
        FROM employees e
        LEFT JOIN roles r ON e.role_id = r.role_id
        WHERE (r.role_name IS NOT NULL AND LOWER(r.role_name) LIKE '%admin%')
           OR (e.position IS NOT NULL AND LOWER(e.position) LIKE '%admin%')
    """)
    
    admin_users = cursor.fetchall()
    
    if not admin_users:
        print("No admin users found.")
        conn.close()
        return
    
    print(f"Found {len(admin_users)} admin user(s):")
    for user in admin_users:
        user_dict = dict(user)
        print(f"  - ID: {user_dict['employee_id']}, Username: {user_dict.get('username') or user_dict.get('employee_code')}, Name: {user_dict['first_name']} {user_dict['last_name']}")
    print()
    
    # Update passwords
    new_password = input("Enter new numeric password for all admins (default: 123456): ").strip()
    if not new_password:
        new_password = "123456"
    
    # Validate password is numeric
    if not new_password.isdigit():
        print("Error: Admin passwords must contain only numbers!")
        conn.close()
        return
    
    confirm = input(f"Update all admin passwords to '{new_password}'? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("Cancelled.")
        conn.close()
        return
    
    password_hash = hash_password(new_password)
    updated_count = 0
    
    for user in admin_users:
        user_dict = dict(user)
        employee_id = user_dict['employee_id']
        
        cursor.execute("""
            UPDATE employees
            SET password_hash = ?
            WHERE employee_id = ?
        """, (password_hash, employee_id))
        
        updated_count += 1
        username = user_dict.get('username') or user_dict.get('employee_code')
        print(f"  ✓ Updated password for {username} (ID: {employee_id})")
    
    conn.commit()
    conn.close()
    
    print()
    print(f"Successfully updated {updated_count} admin password(s) to: {new_password}")
    print()
    print("Login credentials:")
    for user in admin_users:
        user_dict = dict(user)
        username = user_dict.get('username') or user_dict.get('employee_code')
        print(f"  Username: {username}")
        print(f"  Password: {new_password}")
        print()

if __name__ == '__main__':
    update_admin_passwords()

