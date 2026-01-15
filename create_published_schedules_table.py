#!/usr/bin/env python3
"""
Create Published_Schedules table
This table contains all information about published schedules in a denormalized format
"""

import sqlite3

DB_NAME = 'inventory.db'

def create_published_schedules_table():
    """Create the Published_Schedules table"""
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        print("Creating Published_Schedules table...")
        
        # Create the table with all schedule information
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Published_Schedules (
                published_schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                
                -- Period information
                period_id INTEGER NOT NULL,
                week_start_date DATE NOT NULL,
                week_end_date DATE NOT NULL,
                generation_method TEXT CHECK(generation_method IN ('manual', 'auto', 'template')),
                generation_settings TEXT,  -- JSON string
                template_id INTEGER,
                total_labor_hours REAL,
                estimated_labor_cost REAL,
                
                -- Shift information
                scheduled_shift_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                employee_code TEXT,
                employee_name TEXT,
                shift_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                break_duration INTEGER DEFAULT 30,
                position TEXT,
                shift_notes TEXT,
                conflicts TEXT,  -- JSON string
                
                -- Publication information
                created_by INTEGER,
                created_by_name TEXT,
                created_at TIMESTAMP,
                published_by INTEGER,
                published_by_name TEXT,
                published_at TIMESTAMP,
                
                -- Timestamps
                created_in_table_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (period_id) REFERENCES Schedule_Periods(period_id) ON DELETE CASCADE,
                FOREIGN KEY (scheduled_shift_id) REFERENCES Scheduled_Shifts(scheduled_shift_id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES employees(employee_id),
                FOREIGN KEY (published_by) REFERENCES employees(employee_id),
                FOREIGN KEY (template_id) REFERENCES Schedule_Templates(template_id)
            )
        """)
        
        # Create indexes for better query performance
        print("Creating indexes...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_published_schedules_period 
            ON Published_Schedules(period_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_published_schedules_employee 
            ON Published_Schedules(employee_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_published_schedules_date 
            ON Published_Schedules(shift_date)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_published_schedules_week 
            ON Published_Schedules(week_start_date, week_end_date)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_published_schedules_shift_id 
            ON Published_Schedules(scheduled_shift_id)
        """)
        
        conn.commit()
        print("✓ Published_Schedules table created successfully!")
        print("✓ Indexes created successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("Create Published_Schedules Table")
    print("=" * 60)
    print()
    create_published_schedules_table()

