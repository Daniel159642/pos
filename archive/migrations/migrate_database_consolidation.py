#!/usr/bin/env python3
"""
Comprehensive database consolidation migration
Consolidates redundant tables and optimizes database structure
"""

import sqlite3
import json
from datetime import datetime
from typing import Optional

DB_NAME = 'inventory.db'

def get_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_NAME, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def backup_database():
    """Create a backup of the database before migration"""
    import shutil
    backup_name = f"{DB_NAME}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(DB_NAME, backup_name)
    print(f"✓ Database backed up to {backup_name}")
    return backup_name

def check_table_exists(cursor, table_name):
    """Check if a table exists"""
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
    """, (table_name,))
    return cursor.fetchone() is not None

def get_table_columns(cursor, table_name):
    """Get column names for a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]

def migrate_consolidate_scheduling(cursor):
    """Consolidate scheduling and availability tables"""
    print("\n=== Consolidating Scheduling Tables ===")
    
    # Step 1: Create unified employee_availability table (normalized)
    if not check_table_exists(cursor, 'employee_availability_unified'):
        print("Creating unified employee_availability table...")
        cursor.execute("""
            CREATE TABLE employee_availability_unified (
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
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                UNIQUE(employee_id, day_of_week, effective_date)
            )
        """)
        
        # Migrate from old employee_availability (JSON format)
        if check_table_exists(cursor, 'employee_availability'):
            print("  Migrating data from old employee_availability...")
            cursor.execute("SELECT * FROM employee_availability")
            old_records = cursor.fetchall()
            
            for record in old_records:
                employee_id = record['employee_id']
                days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                
                for day in days:
                    try:
                        day_data = record[day]
                    except (KeyError, IndexError):
                        day_data = None
                    if day_data:
                        try:
                            data = json.loads(day_data)
                            if data.get('available', False):
                                cursor.execute("""
                                    INSERT INTO employee_availability_unified
                                    (employee_id, day_of_week, start_time, end_time, availability_type)
                                    VALUES (?, ?, ?, ?, ?)
                                """, (employee_id, day, 
                                      data.get('start', '09:00'),
                                      data.get('end', '17:00'),
                                      'preferred' if data.get('preferred') else 'available'))
                        except:
                            pass
        
        # Migrate from Employee_Availability (new format)
        if check_table_exists(cursor, 'Employee_Availability'):
            print("  Migrating data from Employee_Availability...")
            cursor.execute("SELECT * FROM Employee_Availability")
            new_records = cursor.fetchall()
            
            for record in new_records:
                try:
                    start_time = record['start_time']
                except (KeyError, IndexError):
                    start_time = None
                try:
                    end_time = record['end_time']
                except (KeyError, IndexError):
                    end_time = None
                try:
                    availability_type = record['availability_type']
                except (KeyError, IndexError):
                    availability_type = 'available'
                try:
                    is_recurring = record['is_recurring']
                except (KeyError, IndexError):
                    is_recurring = 1
                try:
                    effective_date = record['effective_date']
                except (KeyError, IndexError):
                    effective_date = None
                try:
                    end_date = record['end_date']
                except (KeyError, IndexError):
                    end_date = None
                try:
                    notes = record['notes']
                except (KeyError, IndexError):
                    notes = None
                
                cursor.execute("""
                    INSERT OR IGNORE INTO employee_availability_unified
                    (employee_id, day_of_week, start_time, end_time, availability_type, 
                     is_recurring, effective_date, end_date, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (record['employee_id'], record['day_of_week'],
                      start_time, end_time, availability_type,
                      is_recurring, effective_date, end_date, notes))
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_availability_employee_day 
            ON employee_availability_unified(employee_id, day_of_week)
        """)
        print("  ✓ Created unified employee_availability table")
    
    # Step 2: Create unified scheduled_shifts table
    if not check_table_exists(cursor, 'scheduled_shifts_unified'):
        print("Creating unified scheduled_shifts table...")
        cursor.execute("""
            CREATE TABLE scheduled_shifts_unified (
                shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                shift_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                break_duration INTEGER DEFAULT 30,
                position TEXT,
                notes TEXT,
                status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'clocked_in', 'clocked_out', 'completed', 'no_show', 'cancelled')),
                clock_in_time TIMESTAMP,
                clock_out_time TIMESTAMP,
                hours_worked REAL,
                overtime_hours REAL DEFAULT 0,
                confirmed INTEGER DEFAULT 0 CHECK(confirmed IN (0, 1)),
                confirmed_at TIMESTAMP,
                period_id INTEGER,  -- From Schedule_Periods if exists
                is_draft INTEGER DEFAULT 0 CHECK(is_draft IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
            )
        """)
        
        # Migrate from employee_schedule
        if check_table_exists(cursor, 'employee_schedule'):
            print("  Migrating data from employee_schedule...")
            cursor.execute("SELECT * FROM employee_schedule")
            records = cursor.fetchall()
            
            for record in records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                cursor.execute("""
                    INSERT INTO scheduled_shifts_unified
                    (employee_id, shift_date, start_time, end_time, break_duration,
                     notes, status, clock_in_time, clock_out_time, hours_worked,
                     overtime_hours, confirmed, confirmed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (record['employee_id'], record['schedule_date'],
                      safe_get('start_time'), safe_get('end_time'),
                      safe_get('break_duration', 30),
                      safe_get('notes'),
                      safe_get('status', 'scheduled'),
                      safe_get('clock_in_time'), safe_get('clock_out_time'),
                      safe_get('hours_worked'), safe_get('overtime_hours', 0),
                      safe_get('confirmed', 0), safe_get('confirmed_at')))
        
        # Migrate from Scheduled_Shifts
        if check_table_exists(cursor, 'Scheduled_Shifts'):
            print("  Migrating data from Scheduled_Shifts...")
            cursor.execute("SELECT * FROM Scheduled_Shifts")
            records = cursor.fetchall()
            
            for record in records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                cursor.execute("""
                    INSERT OR IGNORE INTO scheduled_shifts_unified
                    (employee_id, shift_date, start_time, end_time, break_duration,
                     position, notes, status, period_id, is_draft)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (record['employee_id'], record['shift_date'],
                      record['start_time'], record['end_time'],
                      safe_get('break_duration', 30),
                      safe_get('position'), safe_get('notes'),
                      'scheduled', safe_get('period_id'),
                      safe_get('is_draft', 0)))
        
        # Migrate from Employee_Shifts
        if check_table_exists(cursor, 'Employee_Shifts'):
            print("  Migrating data from Employee_Shifts...")
            cursor.execute("SELECT * FROM Employee_Shifts")
            records = cursor.fetchall()
            
            for record in records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                # Extract date from start_time if it's datetime
                start_datetime = safe_get('start_time', '')
                if start_datetime and ' ' in start_datetime:
                    shift_date, start_time = start_datetime.split(' ', 1)
                else:
                    shift_date = datetime.now().date().isoformat()
                    start_time = start_datetime or '09:00'
                
                end_datetime = safe_get('end_time', '')
                if end_datetime and ' ' in end_datetime:
                    _, end_time = end_datetime.split(' ', 1)
                else:
                    end_time = end_datetime or '17:00'
                
                cursor.execute("""
                    INSERT OR IGNORE INTO scheduled_shifts_unified
                    (employee_id, shift_date, start_time, end_time, break_duration,
                     position, notes, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (safe_get('employee_id'), shift_date, start_time, end_time,
                      safe_get('break_duration', 30),
                      safe_get('shift_type'), safe_get('notes'),
                      safe_get('status', 'scheduled')))
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_shifts_employee_date 
            ON scheduled_shifts_unified(employee_id, shift_date)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_shifts_date_status 
            ON scheduled_shifts_unified(shift_date, status)
        """)
        print("  ✓ Created unified scheduled_shifts table")
    
    # Step 3: Consolidate calendar tables
    if not check_table_exists(cursor, 'calendar_events_unified'):
        print("Creating unified calendar_events table...")
        cursor.execute("""
            CREATE TABLE calendar_events_unified (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL CHECK(event_type IN ('schedule', 'shipment', 'holiday', 'event', 'meeting', 'maintenance', 'deadline', 'other')),
                title TEXT NOT NULL,
                description TEXT,
                location TEXT,
                event_date DATE NOT NULL,
                start_time TIME,
                end_time TIME,
                start_datetime TIMESTAMP,  -- For datetime-based events
                end_datetime TIMESTAMP,
                all_day INTEGER DEFAULT 0 CHECK(all_day IN (0, 1)),
                color TEXT,
                related_id INTEGER,  -- ID of related record
                related_table TEXT,  -- Table name of related record
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES employees(employee_id)
            )
        """)
        
        # Migrate from master_calendar
        if check_table_exists(cursor, 'master_calendar'):
            print("  Migrating data from master_calendar...")
            cursor.execute("SELECT * FROM master_calendar")
            records = cursor.fetchall()
            
            for record in records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                cursor.execute("""
                    INSERT INTO calendar_events_unified
                    (event_type, title, description, event_date, start_time, end_time,
                     related_id, related_table, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (safe_get('event_type'), safe_get('title'),
                      safe_get('description'), safe_get('event_date'),
                      safe_get('start_time'), safe_get('end_time'),
                      safe_get('related_id'), safe_get('related_table'),
                      safe_get('created_by'), safe_get('created_at'),
                      safe_get('updated_at')))
        
        # Migrate from Calendar_Events
        if check_table_exists(cursor, 'Calendar_Events'):
            print("  Migrating data from Calendar_Events...")
            cursor.execute("SELECT * FROM Calendar_Events")
            records = cursor.fetchall()
            
            for record in records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                # Parse datetime strings
                start_dt = safe_get('start_datetime', '')
                end_dt = safe_get('end_datetime', '')
                
                if start_dt:
                    try:
                        dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
                        event_date = dt.date().isoformat()
                        start_time = dt.time().isoformat()
                        start_datetime = start_dt
                    except:
                        event_date = start_dt.split('T')[0] if 'T' in start_dt else start_dt
                        start_time = None
                        start_datetime = start_dt
                else:
                    event_date = datetime.now().date().isoformat()
                    start_time = None
                    start_datetime = None
                
                cursor.execute("""
                    INSERT INTO calendar_events_unified
                    (event_type, title, description, location, event_date, start_time,
                     start_datetime, end_datetime, all_day, color, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (safe_get('event_type'), safe_get('title'),
                      safe_get('description'), safe_get('location'),
                      event_date, start_time, start_datetime, end_dt,
                      safe_get('all_day', 0), safe_get('color'),
                      safe_get('created_by'), safe_get('created_at'),
                      safe_get('updated_at')))
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_calendar_date_type 
            ON calendar_events_unified(event_date, event_type)
        """)
        print("  ✓ Created unified calendar_events table")

def migrate_consolidate_shipments(cursor):
    """Consolidate shipment tables"""
    print("\n=== Consolidating Shipment Tables ===")
    
    # Add status column to shipments if it doesn't exist
    if check_table_exists(cursor, 'shipments'):
        columns = get_table_columns(cursor, 'shipments')
        if 'status' not in columns:
            print("Adding status column to shipments table...")
            try:
                cursor.execute("""
                    ALTER TABLE shipments
                    ADD COLUMN status TEXT DEFAULT 'received' 
                    CHECK(status IN ('pending', 'in_transit', 'received', 'approved', 'rejected', 'cancelled'))
                """)
                print("  ✓ Added status column")
            except sqlite3.OperationalError as e:
                if 'duplicate column' not in str(e).lower():
                    print(f"  ⚠ Error: {e}")
        
        # Migrate approved_shipments data to shipments
        if check_table_exists(cursor, 'approved_shipments'):
            print("Migrating approved_shipments to shipments...")
            cursor.execute("""
                SELECT * FROM approved_shipments
            """)
            approved_records = cursor.fetchall()
            
            for record in approved_records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                # Check if shipment already exists from pending_shipment_id
                pending_id = safe_get('pending_shipment_id')
                if pending_id:
                    cursor.execute("""
                        SELECT shipment_id FROM shipments 
                        WHERE shipment_id IN (
                            SELECT shipment_id FROM shipment_items 
                            WHERE shipment_id IN (
                                SELECT shipment_id FROM shipments 
                                WHERE notes LIKE ?
                            )
                        )
                        LIMIT 1
                    """, (f'%pending_shipment_id={pending_id}%',))
                    
                    existing = cursor.fetchone()
                    if existing:
                        # Update existing shipment
                        cursor.execute("""
                            UPDATE shipments
                            SET status = 'approved',
                                received_date = ?,
                                verified_by = ?,
                                notes = COALESCE(notes, '') || ? || CHAR(10)
                            WHERE shipment_id = ?
                        """, (safe_get('received_date'), safe_get('approved_by'),
                              f"\nApproved from approved_shipments: {safe_get('approved_at')}",
                              existing['shipment_id']))
                        approved_shipment_id = existing['shipment_id']
                    else:
                        # Create new shipment
                        cursor.execute("""
                            INSERT INTO shipments
                            (vendor_id, purchase_order_number, received_date, 
                             verified_by, notes, status)
                            VALUES (?, ?, ?, ?, ?, 'approved')
                        """, (safe_get('vendor_id'), safe_get('purchase_order_number'),
                              safe_get('received_date'), safe_get('approved_by'),
                              f"Migrated from approved_shipments. Pending shipment ID: {pending_id}"))
                        approved_shipment_id = cursor.lastrowid
                    
                    # Migrate approved_shipment_items
                    if check_table_exists(cursor, 'approved_shipment_items'):
                        cursor.execute("""
                            UPDATE approved_shipment_items
                            SET shipment_id = ?
                            WHERE shipment_id = ?
                        """, (approved_shipment_id, safe_get('shipment_id')))
            
            print("  ✓ Migrated approved_shipments data")

def migrate_consolidate_audit_logs(cursor):
    """Merge activity_log into audit_log"""
    print("\n=== Consolidating Audit Logs ===")
    
    if check_table_exists(cursor, 'audit_log'):
        columns = get_table_columns(cursor, 'audit_log')
        
        # Add log_category column if it doesn't exist
        if 'log_category' not in columns:
            print("Adding log_category column to audit_log...")
            try:
                cursor.execute("""
                    ALTER TABLE audit_log
                    ADD COLUMN log_category TEXT DEFAULT 'general'
                    CHECK(log_category IN ('general', 'rbac', 'inventory', 'sales', 'shipment', 'schedule', 'other'))
                """)
                print("  ✓ Added log_category column")
            except sqlite3.OperationalError as e:
                if 'duplicate column' not in str(e).lower():
                    print(f"  ⚠ Error: {e}")
        
        # Migrate activity_log data
        if check_table_exists(cursor, 'activity_log'):
            print("Migrating activity_log to audit_log...")
            cursor.execute("SELECT * FROM activity_log")
            records = cursor.fetchall()
            
            for record in records:
                def safe_get(key, default=None):
                    try:
                        return record[key]
                    except (KeyError, IndexError):
                        return default
                
                # Map activity_log fields to audit_log
                action_type = safe_get('action', 'LOG')
                resource_type = safe_get('resource_type', '')
                resource_id = safe_get('resource_id')
                
                # Determine table_name from resource_type
                table_name = resource_type.lower() if resource_type else 'unknown'
                
                # Create new_values JSON
                new_values = json.dumps({
                    'action': action_type,
                    'details': safe_get('details', ''),
                    'ip_address': safe_get('ip_address', '')
                })
                
                cursor.execute("""
                    INSERT INTO audit_log
                    (table_name, record_id, action_type, employee_id, 
                     action_timestamp, new_values, ip_address, notes, log_category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rbac')
                """, (table_name, resource_id or 0, action_type,
                      safe_get('employee_id'), safe_get('created_at'),
                      new_values, safe_get('ip_address'), safe_get('details')))
            
            print(f"  ✓ Migrated {len(records)} activity_log records")

def migrate_consolidate_tips(cursor):
    """Clean up tip tracking redundancy"""
    print("\n=== Consolidating Tip Tracking ===")
    
    # Ensure employee_tips table exists
    if not check_table_exists(cursor, 'employee_tips'):
        print("Creating employee_tips table...")
        cursor.execute("""
            CREATE TABLE employee_tips (
                tip_id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                order_id INTEGER NOT NULL,
                transaction_id INTEGER,
                tip_amount REAL NOT NULL DEFAULT 0 CHECK(tip_amount >= 0),
                tip_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payment_method TEXT,
                notes TEXT,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
                FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id) ON DELETE SET NULL
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_employee_tips_employee 
            ON employee_tips(employee_id, tip_date)
        """)
        print("  ✓ Created employee_tips table")
    
    # Migrate tips from orders.tip
    if check_table_exists(cursor, 'orders'):
        columns = get_table_columns(cursor, 'orders')
        if 'tip' in columns:
            print("Migrating tips from orders.tip...")
            cursor.execute("""
                INSERT INTO employee_tips (employee_id, order_id, tip_amount, tip_date, payment_method)
                SELECT employee_id, order_id, tip, order_date, payment_method
                FROM orders
                WHERE tip > 0
                AND NOT EXISTS (
                    SELECT 1 FROM employee_tips 
                    WHERE employee_tips.order_id = orders.order_id
                )
            """)
            print(f"  ✓ Migrated {cursor.rowcount} tips from orders")
    
    # Migrate tips from payment_transactions.tip
    if check_table_exists(cursor, 'payment_transactions'):
        columns = get_table_columns(cursor, 'payment_transactions')
        if 'tip' in columns:
            print("Migrating tips from payment_transactions.tip...")
            cursor.execute("""
                INSERT INTO employee_tips 
                (employee_id, order_id, transaction_id, tip_amount, tip_date, payment_method)
                SELECT 
                    o.employee_id,
                    pt.order_id,
                    pt.transaction_id,
                    pt.tip,
                    pt.transaction_date,
                    pt.payment_method
                FROM payment_transactions pt
                JOIN orders o ON pt.order_id = o.order_id
                WHERE pt.tip > 0
                AND NOT EXISTS (
                    SELECT 1 FROM employee_tips 
                    WHERE employee_tips.transaction_id = pt.transaction_id
                )
            """)
            print(f"  ✓ Migrated {cursor.rowcount} tips from payment_transactions")

def migrate_consolidate_payment_methods(cursor):
    """Consolidate payment method references"""
    print("\n=== Consolidating Payment Methods ===")
    
    # Ensure payment_methods table exists
    if not check_table_exists(cursor, 'payment_methods'):
        print("Creating payment_methods table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_methods (
                payment_method_id INTEGER PRIMARY KEY AUTOINCREMENT,
                method_name TEXT NOT NULL,
                method_type TEXT NOT NULL CHECK(method_type IN ('card', 'cash', 'mobile_wallet', 'gift_card', 'check', 'store_credit')),
                is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
                requires_terminal INTEGER DEFAULT 0 CHECK(requires_terminal IN (0, 1)),
                icon_path TEXT,
                display_order INTEGER DEFAULT 0
            )
        """)
        
        # Insert default payment methods
        default_methods = [
            ('Credit Card', 'card', 1, 1, 1),
            ('Debit Card', 'card', 1, 1, 2),
            ('Cash', 'cash', 1, 0, 3),
            ('Mobile Payment', 'mobile_wallet', 1, 1, 4),
            ('Gift Card', 'gift_card', 1, 0, 5),
            ('Store Credit', 'store_credit', 1, 0, 6),
            ('Check', 'check', 1, 0, 7)
        ]
        
        cursor.executemany("""
            INSERT OR IGNORE INTO payment_methods 
            (method_name, method_type, is_active, requires_terminal, display_order)
            VALUES (?, ?, ?, ?, ?)
        """, default_methods)
        print("  ✓ Created payment_methods table with defaults")
    
    # Add payment_method_id to orders if it doesn't exist
    if check_table_exists(cursor, 'orders'):
        columns = get_table_columns(cursor, 'orders')
        if 'payment_method_id' not in columns and 'payment_method' in columns:
            print("Adding payment_method_id to orders...")
            try:
                cursor.execute("""
                    ALTER TABLE orders
                    ADD COLUMN payment_method_id INTEGER
                """)
                
                # Map existing payment_method values to payment_method_id
                mapping = {
                    'credit_card': 'Credit Card',
                    'debit_card': 'Debit Card',
                    'cash': 'Cash',
                    'mobile_payment': 'Mobile Payment',
                    'gift_card': 'Gift Card',
                    'store_credit': 'Store Credit',
                    'check': 'Check'
                }
                
                for old_value, method_name in mapping.items():
                    cursor.execute("""
                        UPDATE orders
                        SET payment_method_id = (
                            SELECT payment_method_id FROM payment_methods 
                            WHERE method_name = ?
                        )
                        WHERE payment_method = ? AND payment_method_id IS NULL
                    """, (method_name, old_value))
                
                print("  ✓ Added payment_method_id to orders")
            except sqlite3.OperationalError as e:
                if 'duplicate column' not in str(e).lower():
                    print(f"  ⚠ Error: {e}")

def create_compatibility_views(cursor):
    """Create views for backward compatibility"""
    print("\n=== Creating Compatibility Views ===")
    
    # View for old employee_availability format
    if check_table_exists(cursor, 'employee_availability_unified'):
        cursor.execute("""
            CREATE VIEW IF NOT EXISTS employee_availability_legacy AS
            SELECT 
                employee_id,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'monday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as monday,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'tuesday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as tuesday,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'wednesday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as wednesday,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'thursday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as thursday,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'friday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as friday,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'saturday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as saturday,
                GROUP_CONCAT(
                    CASE day_of_week 
                        WHEN 'sunday' THEN json_object('available', 1, 'start', start_time, 'end', end_time)
                    END
                ) as sunday
            FROM employee_availability_unified
            WHERE availability_type = 'available' OR availability_type = 'preferred'
            GROUP BY employee_id
        """)
        print("  ✓ Created employee_availability_legacy view")

def add_missing_indexes(cursor):
    """Add missing composite indexes for performance"""
    print("\n=== Adding Missing Indexes ===")
    
    indexes = [
        ("idx_order_items_order_product", "order_items", "(order_id, product_id)"),
        ("idx_shipment_items_shipment_product", "shipment_items", "(shipment_id, product_id)"),
        ("idx_pending_items_shipment_sku", "pending_shipment_items", "(pending_shipment_id, product_sku)"),
        ("idx_audit_log_category_timestamp", "audit_log", "(log_category, action_timestamp)"),
        ("idx_employee_tips_date_amount", "employee_tips", "(tip_date, tip_amount)"),
    ]
    
    for idx_name, table, columns in indexes:
        if check_table_exists(cursor, table):
            try:
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} {columns}")
                print(f"  ✓ Created index {idx_name}")
            except sqlite3.OperationalError as e:
                print(f"  ⚠ Could not create {idx_name}: {e}")

def main():
    """Run the consolidation migration"""
    print("=" * 60)
    print("Database Consolidation Migration")
    print("=" * 60)
    
    # Create backup
    backup_file = backup_database()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Run all migrations
        migrate_consolidate_scheduling(cursor)
        migrate_consolidate_shipments(cursor)
        migrate_consolidate_audit_logs(cursor)
        migrate_consolidate_tips(cursor)
        migrate_consolidate_payment_methods(cursor)
        create_compatibility_views(cursor)
        add_missing_indexes(cursor)
        
        conn.commit()
        print("\n" + "=" * 60)
        print("✓ Migration completed successfully!")
        print(f"✓ Backup saved to: {backup_file}")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Test the application with the new consolidated tables")
        print("2. Update application code to use new table names:")
        print("   - employee_availability_unified (instead of employee_availability/Employee_Availability)")
        print("   - scheduled_shifts_unified (instead of employee_schedule/Scheduled_Shifts/Employee_Shifts)")
        print("   - calendar_events_unified (instead of master_calendar/Calendar_Events)")
        print("3. Once verified, you can drop old tables (they are preserved for safety)")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        print(f"\nDatabase backup available at: {backup_file}")
        print("You can restore it if needed.")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    main()

