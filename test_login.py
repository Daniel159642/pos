#!/usr/bin/env python3
"""
Test script to verify login functionality
"""
from database import employee_login

print("=" * 70)
print("LOGIN TEST")
print("=" * 70)
print()

# Test admin login
print("Testing admin login...")
result = employee_login(
    username='admin',
    employee_code='admin',
    password='admin123',
    ip_address='127.0.0.1',
    device_info='Test Script'
)

if result.get('success'):
    print(f"✓ Admin login successful!")
    print(f"  Employee: {result.get('employee_name')}")
    print(f"  Position: {result.get('position')}")
    print(f"  Session token: {result.get('session_token', '')[:30]}...")
else:
    print(f"✗ Admin login failed: {result.get('message')}")
print()

# Test cashier login
print("Testing cashier login...")
result = employee_login(
    username='cashier1',
    employee_code='cashier1',
    password='cashier123',
    ip_address='127.0.0.1',
    device_info='Test Script'
)

if result.get('success'):
    print(f"✓ Cashier login successful!")
    print(f"  Employee: {result.get('employee_name')}")
    print(f"  Position: {result.get('position')}")
    print(f"  Session token: {result.get('session_token', '')[:30]}...")
else:
    print(f"✗ Cashier login failed: {result.get('message')}")
print()

print("=" * 70)
print("If both logins work here but not in the web app,")
print("check the Flask server console for error messages.")
print("=" * 70)











