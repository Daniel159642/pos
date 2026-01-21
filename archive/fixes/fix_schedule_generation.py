#!/usr/bin/env python3
"""
Fix schedule generation by creating default requirements and checking for issues
"""

import sqlite3
import json

DB_NAME = 'inventory.db'

def fix_schedule_generation():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("=" * 70)
    print("SCHEDULE GENERATION FIX")
    print("=" * 70)
    print()
    
    # 1. Check for active employees
    print("1. Checking for active employees...")
    cursor.execute("SELECT COUNT(*) FROM employees WHERE active = 1")
    active_count = cursor.fetchone()[0]
    print(f"   Found {active_count} active employee(s)")
    
    if active_count == 0:
        print("   ⚠️ WARNING: No active employees found!")
        print("   You need active employees to generate schedules.")
        conn.close()
        return
    
    # 2. Check for schedule requirements
    print("\n2. Checking schedule requirements...")
    cursor.execute("SELECT COUNT(*) FROM Schedule_Requirements WHERE is_active = 1")
    req_count = cursor.fetchone()[0]
    print(f"   Found {req_count} active requirement(s)")
    
    if req_count == 0:
        print("   Creating default requirements...")
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        for day in days:
            try:
                cursor.execute("""
                    INSERT INTO Schedule_Requirements 
                    (day_of_week, time_block_start, time_block_end, min_employees, max_employees, 
                     priority, is_active)
                    VALUES (?, '09:00', '17:00', 1, 2, 'medium', 1)
                """, (day,))
                print(f"      ✓ Added requirement for {day.capitalize()}")
            except sqlite3.IntegrityError:
                print(f"      - Requirement for {day.capitalize()} already exists")
            except Exception as e:
                print(f"      ⚠ Error adding requirement for {day}: {e}")
        
        conn.commit()
        print("   ✅ Default requirements created!")
    else:
        print("   ✅ Requirements already exist")
    
    # 3. Check employee availability (optional - not required)
    print("\n3. Checking employee availability data...")
    cursor.execute("SELECT COUNT(*) FROM Employee_Availability")
    avail_count = cursor.fetchone()[0]
    print(f"   Found {avail_count} availability record(s)")
    if avail_count == 0:
        print("   ℹ️  No availability data (this is OK - requirements will be used)")
    
    # 4. Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"✅ Active employees: {active_count}")
    print(f"✅ Schedule requirements: {req_count if req_count > 0 else 'Created (5)'}")
    print()
    print("The schedule generator should now be able to create shifts.")
    print("Try generating a draft schedule again.")
    print()
    
    conn.close()

if __name__ == '__main__':
    try:
        fix_schedule_generation()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()





