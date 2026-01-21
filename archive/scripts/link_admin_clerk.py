#!/usr/bin/env python3
"""
Script to manually link a Clerk user ID to an admin employee account
Usage: python3 link_admin_clerk.py <clerk_user_id> <pin>
"""

import sys
from database import get_connection, get_employee_by_clerk_user_id, link_clerk_user_to_employee, generate_pin

def link_admin_clerk(clerk_user_id, pin_code=None):
    """Link Clerk user ID to admin account"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Find admin employee
        cursor.execute("SELECT employee_id, first_name, last_name FROM employees WHERE position = 'admin' LIMIT 1")
        admin = cursor.fetchone()
        
        if not admin:
            print("Error: No admin employee found")
            return False
        
        admin_id = admin['employee_id']
        admin_name = f"{admin['first_name']} {admin['last_name']}"
        
        # Check if already linked
        cursor.execute("SELECT clerk_user_id, pin_code FROM employees WHERE employee_id = ?", (admin_id,))
        row = cursor.fetchone()
        
        if row:
            existing_clerk_id = row.get('clerk_user_id') if isinstance(row, dict) else row[0] if row else None
            existing_pin = row.get('pin_code') if isinstance(row, dict) else row[1] if row else None
            
            if existing_clerk_id:
                print(f"Admin account (ID: {admin_id}, Name: {admin_name}) is already linked to Clerk user: {existing_clerk_id}")
                if existing_pin:
                    print(f"Existing PIN: {existing_pin}")
                return True
        
        # Generate PIN if not provided
        if not pin_code:
            pin_code = generate_pin()
            print(f"Generated new PIN: {pin_code}")
        
        # Update admin account with Clerk user ID and PIN
        cursor.execute("""
            UPDATE employees 
            SET clerk_user_id = ?, pin_code = ?
            WHERE employee_id = ?
        """, (clerk_user_id, pin_code, admin_id))
        
        conn.commit()
        print(f"✓ Successfully linked Clerk user {clerk_user_id} to admin account (ID: {admin_id}, Name: {admin_name})")
        print(f"✓ PIN: {pin_code}")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"Error linking admin Clerk account: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 link_admin_clerk.py <clerk_user_id> [pin]")
        print("\nTo find your Clerk user ID:")
        print("1. Open browser developer console on the login page")
        print("2. Type: window.Clerk?.user?.id")
        print("3. Copy the user ID and use it in this script")
        sys.exit(1)
    
    clerk_user_id = sys.argv[1]
    pin_code = sys.argv[2] if len(sys.argv) > 2 else None
    
    link_admin_clerk(clerk_user_id, pin_code)
