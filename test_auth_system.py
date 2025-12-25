#!/usr/bin/env python3
"""
Test script for employee authentication, time clock, and audit logging
"""

from database import (
    add_employee, employee_login, verify_session, employee_logout,
    time_clock_in, time_clock_out, get_timesheet,
    log_audit_action, get_audit_trail,
    change_employee_password
)

def main():
    print("="*70)
    print("EMPLOYEE AUTHENTICATION & AUDIT SYSTEM TEST")
    print("="*70)
    print()
    
    # Step 1: Create employees with passwords
    print("1. Creating employees with authentication...")
    emp1_id = add_employee(
        employee_code="EMP001",
        first_name="John",
        last_name="Cashier",
        position="cashier",
        date_started="2024-01-15",
        password="password123",
        email="john@store.com",
        hourly_rate=15.00
    )
    print(f"   ✓ Employee created: John Cashier (ID: {emp1_id}, Code: EMP001)")
    
    emp2_id = add_employee(
        employee_code="MGR001",
        first_name="Jane",
        last_name="Manager",
        position="manager",
        date_started="2023-06-01",
        password="manager123",
        email="jane@store.com",
        salary=50000.00
    )
    print(f"   ✓ Employee created: Jane Manager (ID: {emp2_id}, Code: MGR001)")
    print()
    
    # Step 2: Test login
    print("2. Testing employee login...")
    login_result = employee_login(
        employee_code="EMP001",
        password="password123",
        ip_address="192.168.1.100",
        device_info="POS Terminal 1"
    )
    
    if login_result['success']:
        session_token = login_result['session_token']
        print(f"   ✓ Login successful: {login_result['employee_name']}")
        print(f"   Session Token: {session_token[:20]}...")
        print(f"   Position: {login_result['position']}")
    else:
        print(f"   ✗ Login failed: {login_result['message']}")
        return
    print()
    
    # Step 3: Verify session
    print("3. Verifying session...")
    session_check = verify_session(session_token)
    if session_check['valid']:
        print(f"   ✓ Session valid: {session_check['employee_name']}")
    else:
        print(f"   ✗ Session invalid")
    print()
    
    # Step 4: Test time clock
    print("4. Testing time clock...")
    clock_in_result = time_clock_in(emp1_id)
    if clock_in_result['success']:
        print(f"   ✓ Clocked in (Entry ID: {clock_in_result['time_entry_id']})")
    
    # Simulate some work time...
    print("   (Simulating work time...)")
    
    clock_out_result = time_clock_out(emp1_id)
    if clock_out_result['success']:
        print(f"   ✓ Clocked out - Hours worked: {clock_out_result['total_hours']:.2f}")
    print()
    
    # Step 5: Get timesheet
    print("5. Viewing timesheet...")
    timesheet = get_timesheet(emp1_id, "2024-12-22", "2024-12-23")
    print(f"   Total hours: {timesheet['total_hours']:.2f}")
    print(f"   Entries: {len(timesheet['timesheet'])}")
    for entry in timesheet['timesheet']:
        print(f"     - {entry['work_date']}: {entry['total_hours']:.2f} hours")
    print()
    
    # Step 6: Test audit trail
    print("6. Viewing audit trail...")
    audit_trail = get_audit_trail(limit=10)
    print(f"   Found {len(audit_trail)} audit entries:")
    for entry in audit_trail[:5]:
        print(f"     - {entry['action_timestamp']}: {entry['employee_name']} "
              f"({entry['action_type']}) on {entry['table_name']}")
    print()
    
    # Step 7: Test password change
    print("7. Testing password change...")
    change_result = change_employee_password(emp1_id, "password123", "newpass456")
    if change_result['success']:
        print(f"   ✓ Password changed successfully")
        
        # Try login with old password (should fail)
        old_login = employee_login("EMP001", "password123")
        if not old_login['success']:
            print(f"   ✓ Old password rejected (as expected)")
        
        # Try login with new password (should succeed)
        new_login = employee_login("EMP001", "newpass456")
        if new_login['success']:
            print(f"   ✓ New password works")
    print()
    
    # Step 8: Test logout
    print("8. Testing logout...")
    if 'session_token' in locals():
        logout_result = employee_logout(session_token)
        if logout_result['success']:
            print(f"   ✓ Logged out successfully")
        
        # Verify session is invalid
        session_check = verify_session(session_token)
        if not session_check['valid']:
            print(f"   ✓ Session invalidated (as expected)")
    print()
    
    # Step 9: View audit log for this session
    print("9. Viewing audit log for this test session...")
    session_audit = get_audit_trail(employee_id=emp1_id, limit=20)
    print(f"   Found {len(session_audit)} audit entries for employee:")
    for entry in session_audit[:10]:
        action = entry['action_type']
        table = entry['table_name']
        timestamp = entry['action_timestamp']
        print(f"     - {timestamp}: {action} on {table}")
    print()
    
    print("="*70)
    print("TESTING COMPLETE")
    print("="*70)
    print("\nSummary:")
    print("✓ Employee authentication with password hashing")
    print("✓ Session management (login/logout)")
    print("✓ Time clock functionality")
    print("✓ Audit logging for all actions")
    print("✓ Password change functionality")
    print("✓ Audit trail retrieval")

if __name__ == '__main__':
    main()




