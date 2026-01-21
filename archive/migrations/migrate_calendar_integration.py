#!/usr/bin/env python3
"""
Database migration script for calendar integration system
Adds tables for iCal/Google Calendar support
"""

import sqlite3
from datetime import datetime

DB_NAME = 'inventory.db'

def migrate():
    """Run the migration"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Creating calendar integration tables...")
    
    # Calendar Events (master table for all events)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Calendar_Events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL CHECK(event_type IN ('shipment', 'shift', 'meeting', 'deadline', 'holiday', 'maintenance', 'other')),
            title TEXT NOT NULL,
            description TEXT,
            location TEXT,
            start_datetime TEXT NOT NULL,
            end_datetime TEXT NOT NULL,
            all_day INTEGER DEFAULT 0 CHECK(all_day IN (0, 1)),
            color TEXT,  -- Hex color code
            created_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    
    # Employee Shifts Schedule
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Employee_Shifts (
            shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            employee_id INTEGER,
            shift_type TEXT CHECK(shift_type IN ('opening', 'closing', 'mid', 'full', 'split')),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            break_duration INTEGER DEFAULT 30,  -- minutes
            notes TEXT,
            status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'completed', 'missed', 'cancelled')),
            FOREIGN KEY (event_id) REFERENCES Calendar_Events(event_id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    
    # Shipment Schedule (linked to calendar)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Shipment_Schedule (
            schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            vendor_id INTEGER,
            expected_date TEXT NOT NULL,
            estimated_delivery_window TEXT,  -- e.g., "9 AM - 12 PM"
            status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_transit', 'arrived', 'cancelled')),
            tracking_number TEXT,
            assigned_receiver INTEGER,  -- Employee assigned to receive
            notes TEXT,
            FOREIGN KEY (event_id) REFERENCES Calendar_Events(event_id) ON DELETE CASCADE,
            FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
            FOREIGN KEY (assigned_receiver) REFERENCES employees(employee_id)
        )
    """)
    
    # Calendar Subscriptions (for individual employees)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Calendar_Subscriptions (
            subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            subscription_token TEXT UNIQUE,  -- Unique token for iCal feed
            include_shifts INTEGER DEFAULT 1 CHECK(include_shifts IN (0, 1)),
            include_shipments INTEGER DEFAULT 1 CHECK(include_shipments IN (0, 1)),
            include_meetings INTEGER DEFAULT 1 CHECK(include_meetings IN (0, 1)),
            include_deadlines INTEGER DEFAULT 1 CHECK(include_deadlines IN (0, 1)),
            calendar_name TEXT DEFAULT 'My Work Schedule',
            is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_synced TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    
    # Event Attendees (for meetings, etc.)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Event_Attendees (
            attendee_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            employee_id INTEGER,
            response TEXT DEFAULT 'pending' CHECK(response IN ('pending', 'accepted', 'declined', 'tentative')),
            notified INTEGER DEFAULT 0 CHECK(notified IN (0, 1)),
            FOREIGN KEY (event_id) REFERENCES Calendar_Events(event_id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    
    # Event Reminders
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Event_Reminders (
            reminder_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            employee_id INTEGER,
            remind_before INTEGER NOT NULL,  -- minutes before event
            reminder_type TEXT DEFAULT 'push' CHECK(reminder_type IN ('email', 'sms', 'push', 'all')),
            sent INTEGER DEFAULT 0 CHECK(sent IN (0, 1)),
            sent_at TEXT,
            FOREIGN KEY (event_id) REFERENCES Calendar_Events(event_id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        )
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON Calendar_Events(event_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON Calendar_Events(start_datetime)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON Employee_Shifts(employee_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_employee_shifts_event ON Employee_Shifts(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipment_schedule_vendor ON Shipment_Schedule(vendor_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipment_schedule_receiver ON Shipment_Schedule(assigned_receiver)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_token ON Calendar_Subscriptions(subscription_token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_employee ON Calendar_Subscriptions(employee_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON Event_Attendees(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_event_attendees_employee ON Event_Attendees(employee_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_event_reminders_event ON Event_Reminders(event_id)")
    
    conn.commit()
    conn.close()
    
    print("Calendar integration tables created successfully!")

if __name__ == '__main__':
    migrate()









