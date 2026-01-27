#!/usr/bin/env python3
"""
Setup script to link Clerk user ID to admin account and set PIN
This works across different computers/environments
Usage: python3 setup_admin_pin.py <clerk_user_id> [pin]
"""

import sys
from database import get_connection, generate_pin

def setup_admin_pin(clerk_user_id=None, pin_code=None):
    """Setup admin PIN and optionally link Clerk user ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Find admin employee
        cursor.execute("""
            SELECT employee_id, first_name, last_name, employee_code, clerk_user_id, pin_code 
            FROM employees 
            WHERE position = 'admin' 
            ORDER BY employee_id 
            LIMIT 1
        """)
        admin = cursor.fetchone()
        
        if not admin:
            print("❌ Error: No admin employee found")
            print("   Please create an admin employee first or run onboarding.")
            return False
        
        admin_id = admin['employee_id'] if isinstance(admin, dict) else admin[0]
        admin_name = f"{admin['first_name']} {admin['last_name']}" if isinstance(admin, dict) else f"{admin[1]} {admin[2]}"
        admin_code = admin['employee_code'] if isinstance(admin, dict) else admin[3]
        existing_clerk_id = admin['clerk_user_id'] if isinstance(admin, dict) else admin[4] if len(admin) > 4 else None
        existing_pin = admin['pin_code'] if isinstance(admin, dict) else admin[5] if len(admin) > 5 else None
        
        print(f"📋 Admin Account Found:")
        print(f"   ID: {admin_id}")
        print(f"   Name: {admin_name}")
        print(f"   Code: {admin_code}")
        print(f"   Current Clerk ID: {existing_clerk_id or 'Not set'}")
        print(f"   Current PIN: {existing_pin or 'Not set'}")
        print()
        
        # Generate PIN if not provided
        if not pin_code:
            if existing_pin:
                print(f"⚠️  Admin already has a PIN: {existing_pin}")
                response = input("   Do you want to keep it? (y/n): ").strip().lower()
                if response == 'y':
                    pin_code = existing_pin
                else:
                    pin_code = generate_pin()
                    print(f"   Generated new PIN: {pin_code}")
            else:
                pin_code = generate_pin()
                print(f"✅ Generated new PIN: {pin_code}")
        else:
            # Validate PIN is 6 digits
            if not pin_code.isdigit() or len(pin_code) != 6:
                print(f"❌ Error: PIN must be exactly 6 digits")
                return False
            print(f"✅ Using provided PIN: {pin_code}")
        
        # Update admin account
        updates = []
        values = []
        
        if clerk_user_id:
            if existing_clerk_id and existing_clerk_id != clerk_user_id:
                print(f"⚠️  Warning: Admin already linked to different Clerk ID: {existing_clerk_id}")
                response = input("   Do you want to update it? (y/n): ").strip().lower()
                if response != 'y':
                    clerk_user_id = existing_clerk_id
            updates.append("clerk_user_id = ?")
            values.append(clerk_user_id)
        
        if pin_code:
            updates.append("pin_code = ?")
            values.append(pin_code)
        
        if not updates:
            print("ℹ️  No changes to make")
            return True
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(admin_id)
        
        query = f"UPDATE employees SET {', '.join(updates)} WHERE employee_id = ?"
        cursor.execute(query, values)
        conn.commit()
        
        print()
        print("✅ Admin account updated successfully!")
        print(f"   Clerk User ID: {clerk_user_id or existing_clerk_id or 'Not set'}")
        print(f"   PIN: {pin_code}")
        print()
        print("📝 You can now use this PIN to login after authenticating with Clerk.")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error setting up admin PIN: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()

def show_current_admin():
    """Show current admin account status"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT employee_id, first_name, last_name, employee_code, clerk_user_id, pin_code 
            FROM employees 
            WHERE position = 'admin' 
            ORDER BY employee_id
        """)
        admins = cursor.fetchall()
        
        if not admins:
            print("❌ No admin employees found")
            return
        
        print("📋 Current Admin Accounts:")
        print()
        for admin in admins:
            admin_id = admin['employee_id'] if isinstance(admin, dict) else admin[0]
            admin_name = f"{admin['first_name']} {admin['last_name']}" if isinstance(admin, dict) else f"{admin[1]} {admin[2]}"
            admin_code = admin['employee_code'] if isinstance(admin, dict) else admin[3]
            clerk_id = admin['clerk_user_id'] if isinstance(admin, dict) else admin[4] if len(admin) > 4 else None
            pin = admin['pin_code'] if isinstance(admin, dict) else admin[5] if len(admin) > 5 else None
            
            print(f"   ID: {admin_id}")
            print(f"   Name: {admin_name}")
            print(f"   Code: {admin_code}")
            print(f"   Clerk ID: {clerk_id or '❌ Not set'}")
            print(f"   PIN: {pin or '❌ Not set'}")
            print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help', 'help']:
        print("Setup Admin PIN Script")
        print("=" * 50)
        print()
        print("Usage:")
        print("  python3 setup_admin_pin.py                    # Interactive setup")
        print("  python3 setup_admin_pin.py <clerk_user_id>   # Link Clerk ID and generate PIN")
        print("  python3 setup_admin_pin.py <clerk_user_id> <pin>  # Link Clerk ID and set specific PIN")
        print()
        print("Examples:")
        print("  python3 setup_admin_pin.py")
        print("  python3 setup_admin_pin.py user_2abc123def456")
        print("  python3 setup_admin_pin.py user_2abc123def456 123456")
        print()
        print("To find your Clerk user ID:")
        print("  1. Open browser developer console on the login page")
        print("  2. Type: window.Clerk?.user?.id")
        print("  3. Copy the user ID")
        sys.exit(0)
    
    if len(sys.argv) == 1:
        # Interactive mode
        show_current_admin()
        print()
        print("🔧 Interactive Setup Mode")
        print("=" * 50)
        print()
        print("To get your Clerk User ID:")
        print("  1. Go to http://localhost:3000 in your browser")
        print("  2. Open Developer Console (F12 or Cmd+Option+I)")
        print("  3. Type: window.Clerk?.user?.id")
        print("  4. Copy the ID (starts with 'user_')")
        print()
        
        clerk_user_id = input("Enter your Clerk User ID (or press Enter to skip): ").strip()
        if not clerk_user_id:
            print("❌ Clerk User ID is required. Exiting.")
            sys.exit(1)
        
        if not clerk_user_id.startswith('user_'):
            print(f"⚠️  Warning: Clerk User ID usually starts with 'user_'. Continue anyway? (y/n): ", end='')
            if input().strip().lower() != 'y':
                sys.exit(1)
        
        pin_choice = input("\nChoose PIN option:\n  1. Auto-generate PIN\n  2. Enter custom PIN\nChoice (1 or 2): ").strip()
        
        if pin_choice == '2':
            pin_code = input("Enter 6-digit PIN: ").strip()
            if not pin_code.isdigit() or len(pin_code) != 6:
                print("❌ Error: PIN must be exactly 6 digits")
                sys.exit(1)
        else:
            pin_code = None
        
        print()
        setup_admin_pin(clerk_user_id, pin_code)
    else:
        clerk_user_id = sys.argv[1]
        pin_code = sys.argv[2] if len(sys.argv) > 2 else None
        setup_admin_pin(clerk_user_id, pin_code)
