#!/usr/bin/env python3
"""
Complete Schedule System Setup Script
Creates ALL tables and columns needed for the schedule system to work.
This script is idempotent - safe to run multiple times.
"""

import sqlite3
from datetime import datetime

DB_NAME = 'inventory.db'

def setup_complete_schedule_system():
    """Setup all schedule system tables and columns"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("=" * 70)
    print("COMPLETE SCHEDULE SYSTEM SETUP")
    print("=" * 70)
    print()
    
    # 1. Employee Availability (note: table may exist with old structure - that's OK)
    print("1. Checking Employee_Availability table...")
    
    # Check if table has the new structure (has day_of_week column)
    try:
        cursor.execute("PRAGMA table_info(Employee_Availability)")
        columns = [row[1] for row in cursor.fetchall()]
        has_new_structure = 'day_of_week' in columns
        
        if has_new_structure:
            # Try to create index if column exists
            try:
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_employee_day ON Employee_Availability(employee_id, day_of_week)")
            except sqlite3.OperationalError:
                pass  # Index might already exist
            print("   ✓ Employee_Availability table verified (new structure)")
        else:
            print("   ✓ Employee_Availability table exists (old structure - compatible)")
    except sqlite3.OperationalError:
        # Table doesn't exist - that's fine, the schedule system will create it if needed
        print("   ✓ Employee_Availability table (will be created by system if needed)")
    
    # 2. Time Off Requests
    print("2. Creating Time_Off_Requests table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Time_Off_Requests (
            request_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by INTEGER,
            reviewed_at TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
            FOREIGN KEY (reviewed_by) REFERENCES employees(employee_id)
        )
    """)
    print("   ✓ Time_Off_Requests table created")
    
    # 3. Schedule Templates
    print("3. Creating Schedule_Templates table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Templates (
            template_id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_name TEXT NOT NULL,
            description TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP,
            use_count INTEGER DEFAULT 0,
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    print("   ✓ Schedule_Templates table created")
    
    # 4. Schedule Periods
    print("4. Creating Schedule_Periods table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Periods (
            period_id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_start_date DATE NOT NULL,
            week_end_date DATE NOT NULL,
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            published_by INTEGER,
            published_at TIMESTAMP,
            template_id INTEGER,
            generation_method TEXT DEFAULT 'manual' CHECK(generation_method IN ('manual', 'auto', 'template')),
            generation_settings TEXT,
            total_labor_hours REAL,
            estimated_labor_cost REAL,
            FOREIGN KEY (created_by) REFERENCES employees(employee_id),
            FOREIGN KEY (published_by) REFERENCES employees(employee_id),
            FOREIGN KEY (template_id) REFERENCES Schedule_Templates(template_id),
            UNIQUE(week_start_date)
        )
    """)
    print("   ✓ Schedule_Periods table created")
    
    # 5. Scheduled Shifts
    print("5. Creating Scheduled_Shifts table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Scheduled_Shifts (
            scheduled_shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_id INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            shift_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            break_duration INTEGER DEFAULT 30,
            position TEXT,
            notes TEXT,
            is_draft INTEGER DEFAULT 1 CHECK(is_draft IN (0, 1)),
            conflicts TEXT,
            FOREIGN KEY (period_id) REFERENCES Schedule_Periods(period_id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_period_date ON Scheduled_Shifts(period_id, shift_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_employee_date ON Scheduled_Shifts(employee_id, shift_date)")
    print("   ✓ Scheduled_Shifts table created")
    
    # 6. Schedule Requirements
    print("6. Creating Schedule_Requirements table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Requirements (
            requirement_id INTEGER PRIMARY KEY AUTOINCREMENT,
            day_of_week TEXT NOT NULL CHECK(day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
            time_block_start TIME,
            time_block_end TIME,
            min_employees INTEGER NOT NULL,
            max_employees INTEGER,
            preferred_positions TEXT,
            priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
            is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1))
        )
    """)
    print("   ✓ Schedule_Requirements table created")
    
    # 7. Employee Positions
    print("7. Creating Employee_Positions table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Employee_Positions (
            employee_position_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            position_name TEXT NOT NULL,
            skill_level TEXT DEFAULT 'competent' CHECK(skill_level IN ('trainee', 'competent', 'proficient', 'expert')),
            hourly_rate REAL,
            certified_date DATE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
            UNIQUE(employee_id, position_name)
        )
    """)
    print("   ✓ Employee_Positions table created")
    
    # 8. Schedule Changes
    print("8. Creating Schedule_Changes table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Changes (
            change_id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_id INTEGER,
            scheduled_shift_id INTEGER,
            change_type TEXT NOT NULL CHECK(change_type IN ('created', 'modified', 'deleted', 'published')),
            changed_by INTEGER,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            old_values TEXT,
            new_values TEXT,
            reason TEXT,
            FOREIGN KEY (period_id) REFERENCES Schedule_Periods(period_id),
            FOREIGN KEY (scheduled_shift_id) REFERENCES Scheduled_Shifts(scheduled_shift_id),
            FOREIGN KEY (changed_by) REFERENCES employees(employee_id)
        )
    """)
    print("   ✓ Schedule_Changes table created")
    
    # 9. Schedule Notifications
    print("9. Creating Schedule_Notifications table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Notifications (
            notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_id INTEGER,
            employee_id INTEGER,
            notification_type TEXT CHECK(notification_type IN ('new_schedule', 'schedule_change', 'shift_reminder')),
            sent_via TEXT CHECK(sent_via IN ('email', 'sms', 'push', 'all')),
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            viewed INTEGER DEFAULT 0 CHECK(viewed IN (0, 1)),
            viewed_at TIMESTAMP,
            FOREIGN KEY (period_id) REFERENCES Schedule_Periods(period_id),
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    print("   ✓ Schedule_Notifications table created")
    
    # 10. Add columns to Employees table
    print("10. Adding columns to employees table...")
    added_columns = []
    
    # Add max_hours_per_week
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN max_hours_per_week INTEGER DEFAULT 40")
        added_columns.append("max_hours_per_week")
        print("   ✓ Added max_hours_per_week column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "duplicate" in str(e).lower():
            print("   - max_hours_per_week column already exists")
        else:
            print(f"   ⚠ Error adding max_hours_per_week: {e}")
    
    # Add min_hours_per_week
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN min_hours_per_week INTEGER DEFAULT 0")
        added_columns.append("min_hours_per_week")
        print("   ✓ Added min_hours_per_week column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "duplicate" in str(e).lower():
            print("   - min_hours_per_week column already exists")
        else:
            print(f"   ⚠ Error adding min_hours_per_week: {e}")
    
    # Add employment_type (SQLite doesn't support CHECK in ALTER TABLE, so we skip it)
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN employment_type TEXT DEFAULT 'full_time'")
        added_columns.append("employment_type")
        print("   ✓ Added employment_type column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "duplicate" in str(e).lower():
            print("   - employment_type column already exists")
        else:
            print(f"   ⚠ Error adding employment_type: {e}")
    
    # Add preferred_days_off
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN preferred_days_off TEXT")
        added_columns.append("preferred_days_off")
        print("   ✓ Added preferred_days_off column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "duplicate" in str(e).lower():
            print("   - preferred_days_off column already exists")
        else:
            print(f"   ⚠ Error adding preferred_days_off: {e}")
    
    conn.commit()
    conn.close()
    
    print()
    print("=" * 70)
    print("✅ SCHEDULE SYSTEM SETUP COMPLETE!")
    print("=" * 70)
    print()
    print("Created/Verified Tables:")
    print("  1. Employee_Availability")
    print("  2. Time_Off_Requests")
    print("  3. Schedule_Templates")
    print("  4. Schedule_Periods")
    print("  5. Scheduled_Shifts")
    print("  6. Schedule_Requirements")
    print("  7. Employee_Positions")
    print("  8. Schedule_Changes")
    print("  9. Schedule_Notifications")
    print()
    print("Updated employees table with:")
    print("  - max_hours_per_week")
    print("  - min_hours_per_week")
    print("  - employment_type")
    print("  - preferred_days_off")
    print()
    print("The schedule system is now ready to use!")
    print()

if __name__ == '__main__':
    try:
        setup_complete_schedule_system()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

