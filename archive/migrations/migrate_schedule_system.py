#!/usr/bin/env python3
"""
Migration script to add comprehensive schedule management system tables
Adapts MySQL schema to SQLite
"""

import sqlite3
from datetime import datetime

DB_NAME = 'inventory.db'

def migrate():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Starting schedule system migration...")
    
    # 1. Employee Availability (enhanced version)
    # Check if old-style table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='employee_availability'
    """)
    old_table_exists = cursor.fetchone()
    
    # Check if new-style table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='Employee_Availability'
    """)
    new_table_exists = cursor.fetchone()
    
    if not new_table_exists:
        print("Creating Employee_Availability table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Employee_Availability (
                availability_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                day_of_week TEXT NOT NULL CHECK(day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
                start_time TIME,
                end_time TIME,
                availability_type TEXT DEFAULT 'available' CHECK(availability_type IN ('available', 'preferred', 'unavailable')),
                is_recurring INTEGER DEFAULT 1 CHECK(is_recurring IN (0, 1)),
                effective_date DATE,
                end_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        """)
        
        # Check if table has the new schema (has day_of_week column)
        cursor.execute("PRAGMA table_info(Employee_Availability)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'day_of_week' in columns:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_employee_day ON Employee_Availability(employee_id, day_of_week)
            """)
        else:
            print("  Note: Old-style Employee_Availability table exists. New table will use different structure.")
    else:
        # Check if table has the new schema
        cursor.execute("PRAGMA table_info(Employee_Availability)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'day_of_week' in columns:
            print("Employee_Availability table already exists with new schema, skipping...")
        else:
            print("  Note: Old-style Employee_Availability table exists. Consider migrating data.")
    
    # 2. Time Off Requests
    print("Creating Time_Off_Requests table...")
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
    
    # 3. Schedule Templates
    print("Creating Schedule_Templates table...")
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
    
    # 4. Schedule Periods
    print("Creating Schedule_Periods table...")
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
            generation_settings TEXT,  -- JSON string
            total_labor_hours REAL,
            estimated_labor_cost REAL,
            FOREIGN KEY (created_by) REFERENCES employees(employee_id),
            FOREIGN KEY (published_by) REFERENCES employees(employee_id),
            FOREIGN KEY (template_id) REFERENCES Schedule_Templates(template_id),
            UNIQUE(week_start_date)
        )
    """)
    
    # 5. Scheduled Shifts
    print("Creating Scheduled_Shifts table...")
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
            conflicts TEXT,  -- JSON string
            FOREIGN KEY (period_id) REFERENCES Schedule_Periods(period_id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_period_date ON Scheduled_Shifts(period_id, shift_date)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_employee_date ON Scheduled_Shifts(employee_id, shift_date)
    """)
    
    # 6. Schedule Requirements
    print("Creating Schedule_Requirements table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Requirements (
            requirement_id INTEGER PRIMARY KEY AUTOINCREMENT,
            day_of_week TEXT NOT NULL CHECK(day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
            time_block_start TIME,
            time_block_end TIME,
            min_employees INTEGER NOT NULL,
            max_employees INTEGER,
            preferred_positions TEXT,  -- JSON string
            priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
            is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1))
        )
    """)
    
    # 7. Employee Positions
    print("Creating Employee_Positions table...")
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
    
    # 8. Schedule Changes
    print("Creating Schedule_Changes table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Schedule_Changes (
            change_id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_id INTEGER,
            scheduled_shift_id INTEGER,
            change_type TEXT NOT NULL CHECK(change_type IN ('created', 'modified', 'deleted', 'published')),
            changed_by INTEGER,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            old_values TEXT,  -- JSON string
            new_values TEXT,  -- JSON string
            reason TEXT,
            FOREIGN KEY (period_id) REFERENCES Schedule_Periods(period_id),
            FOREIGN KEY (scheduled_shift_id) REFERENCES Scheduled_Shifts(scheduled_shift_id),
            FOREIGN KEY (changed_by) REFERENCES employees(employee_id)
        )
    """)
    
    # 9. Schedule Notifications
    print("Creating Schedule_Notifications table...")
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
    
    # 10. Add columns to Employees table if they don't exist
    print("Adding columns to Employees table...")
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN max_hours_per_week INTEGER DEFAULT 40")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN min_hours_per_week INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN employment_type TEXT DEFAULT 'full_time'")
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute("ALTER TABLE employees ADD COLUMN preferred_days_off TEXT")  # JSON string
    except sqlite3.OperationalError:
        pass
    
    # Note: SQLite doesn't support ALTER TABLE ADD COLUMN with CHECK constraints easily
    # We'll handle the constraint in application code
    
    conn.commit()
    print("✓ Schedule system migration completed successfully!")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    migrate()

