#!/usr/bin/env python3
"""
Remove all published schedules from the database
This script removes:
- All Scheduled_Shifts for published periods
- Calendar events related to those shifts
- Schedule_Changes and Schedule_Notifications for those periods
- The Schedule_Periods records themselves
"""

import sqlite3
from datetime import datetime

DB_NAME = 'inventory.db'

def remove_published_schedules():
    """Remove all published schedules and related data"""
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Get all published period IDs
        cursor.execute("SELECT period_id, week_start_date, week_end_date FROM Schedule_Periods WHERE status = 'published'")
        published_periods = cursor.fetchall()
        
        if not published_periods:
            print("No published schedules found.")
            conn.close()
            return
        
        period_ids = [row[0] for row in published_periods]
        print(f"Found {len(published_periods)} published schedule period(s):")
        for period_id, start_date, end_date in published_periods:
            print(f"  - Period {period_id}: {start_date} to {end_date}")
        
        # Count shifts to be deleted
        cursor.execute("SELECT COUNT(*) FROM Scheduled_Shifts WHERE period_id IN ({})".format(
            ','.join('?' * len(period_ids))
        ), period_ids)
        shift_count = cursor.fetchone()[0]
        print(f"\nShifts to delete: {shift_count}")
        
        # Count calendar events to be deleted
        cursor.execute("""
            SELECT COUNT(*) FROM master_calendar 
            WHERE event_type = 'schedule' 
            AND related_table = 'Scheduled_Shifts'
            AND related_id IN (
                SELECT scheduled_shift_id FROM Scheduled_Shifts 
                WHERE period_id IN ({})
            )
        """.format(','.join('?' * len(period_ids))), period_ids)
        calendar_count = cursor.fetchone()[0]
        print(f"Calendar events to delete: {calendar_count}")
        
        # Check for Schedule_Changes table
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='Schedule_Changes'
        """)
        has_changes_table = cursor.fetchone()
        
        changes_count = 0
        if has_changes_table:
            cursor.execute("""
                SELECT COUNT(*) FROM Schedule_Changes 
                WHERE period_id IN ({})
            """.format(','.join('?' * len(period_ids))), period_ids)
            changes_count = cursor.fetchone()[0]
            print(f"Schedule changes to delete: {changes_count}")
        
        # Check for Schedule_Notifications table
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='Schedule_Notifications'
        """)
        has_notifications_table = cursor.fetchone()
        
        notifications_count = 0
        if has_notifications_table:
            cursor.execute("""
                SELECT COUNT(*) FROM Schedule_Notifications 
                WHERE period_id IN ({})
            """.format(','.join('?' * len(period_ids))), period_ids)
            notifications_count = cursor.fetchone()[0]
            print(f"Schedule notifications to delete: {notifications_count}")
        
        # Confirm deletion
        print(f"\nTotal records to delete:")
        print(f"  - Scheduled_Shifts: {shift_count}")
        print(f"  - Calendar events: {calendar_count}")
        if has_changes_table:
            print(f"  - Schedule_Changes: {changes_count}")
        if has_notifications_table:
            print(f"  - Schedule_Notifications: {notifications_count}")
        print(f"  - Schedule_Periods: {len(period_ids)}")
        
        # Delete calendar events first (they reference Scheduled_Shifts)
        if calendar_count > 0:
            cursor.execute("""
                DELETE FROM master_calendar 
                WHERE event_type = 'schedule' 
                AND related_table = 'Scheduled_Shifts'
                AND related_id IN (
                    SELECT scheduled_shift_id FROM Scheduled_Shifts 
                    WHERE period_id IN ({})
                )
            """.format(','.join('?' * len(period_ids))), period_ids)
            print(f"\n✓ Deleted {cursor.rowcount} calendar events")
        
        # Delete Schedule_Changes (if table exists)
        if has_changes_table and changes_count > 0:
            cursor.execute("""
                DELETE FROM Schedule_Changes 
                WHERE period_id IN ({})
            """.format(','.join('?' * len(period_ids))), period_ids)
            print(f"✓ Deleted {cursor.rowcount} schedule changes")
        
        # Delete Schedule_Notifications (if table exists)
        if has_notifications_table and notifications_count > 0:
            cursor.execute("""
                DELETE FROM Schedule_Notifications 
                WHERE period_id IN ({})
            """.format(','.join('?' * len(period_ids))), period_ids)
            print(f"✓ Deleted {cursor.rowcount} schedule notifications")
        
        # Delete Scheduled_Shifts
        if shift_count > 0:
            cursor.execute("""
                DELETE FROM Scheduled_Shifts 
                WHERE period_id IN ({})
            """.format(','.join('?' * len(period_ids))), period_ids)
            print(f"✓ Deleted {cursor.rowcount} scheduled shifts")
        
        # Delete Schedule_Periods
        cursor.execute("""
            DELETE FROM Schedule_Periods 
            WHERE period_id IN ({})
        """.format(','.join('?' * len(period_ids))), period_ids)
        print(f"✓ Deleted {cursor.rowcount} schedule periods")
        
        # Commit all changes
        conn.commit()
        print(f"\n✓ Successfully removed all published schedules!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("Remove Published Schedules")
    print("=" * 60)
    print()
    remove_published_schedules()


