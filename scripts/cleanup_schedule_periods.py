#!/usr/bin/env python3
"""
Clean up schedule periods that might be causing conflicts
"""

from datetime import datetime
from database import get_connection

def cleanup_periods():
    conn = get_connection()
    cursor = conn.cursor()
    
    print("Checking for schedule periods...")
    print()
    
    cursor.execute("SELECT period_id, week_start_date, status, created_at FROM Schedule_Periods ORDER BY week_start_date DESC")
    periods = cursor.fetchall()
    
    if not periods:
        print("No schedule periods found.")
        conn.close()
        return
    
    print(f"Found {len(periods)} schedule period(s):")
    print()
    
    for period in periods:
        period_dict = dict(period) if isinstance(period, dict) else {
            'period_id': period[0],
            'week_start_date': period[1],
            'status': period[2],
            'created_at': period[3] if len(period) > 3 else None
        }
        print(f"Period ID: {period_dict['period_id']}")
        print(f"  Week Start: {period_dict['week_start_date']}")
        print(f"  Status: {period_dict['status']}")
        print(f"  Created: {period_dict.get('created_at', 'N/A')}")
        
        # Count shifts
        cursor.execute("SELECT COUNT(*) FROM Scheduled_Shifts WHERE period_id = %s", (period_dict['period_id'],))
        row = cursor.fetchone()
        shift_count = row[0] if isinstance(row, tuple) else row['count']
        print(f"  Shifts: {shift_count}")
        print()
    
    # Ask if user wants to delete draft periods
    cursor.execute("SELECT COUNT(*) FROM Schedule_Periods WHERE status = 'draft'")
    row = cursor.fetchone()
    draft_count = row[0] if isinstance(row, tuple) else row['count']
    
    if draft_count > 0:
        print(f"Found {draft_count} draft period(s).")
        print("Draft periods can be safely deleted.")
        response = input("Delete all draft periods? (y/N): ").strip().lower()
        
        if response == 'y':
            cursor.execute("SELECT period_id FROM Schedule_Periods WHERE status = 'draft'")
            draft_periods = cursor.fetchall()
            
            for period in draft_periods:
                period_dict = dict(period) if isinstance(period, dict) else {'period_id': period[0]}
                period_id = period_dict['period_id']
                # Delete shifts
                cursor.execute("DELETE FROM Scheduled_Shifts WHERE period_id = %s", (period_id,))
                # Delete period
                cursor.execute("DELETE FROM Schedule_Periods WHERE period_id = %s", (period_id,))
            
            conn.commit()
            print(f"✓ Deleted {len(draft_periods)} draft period(s)")
        else:
            print("Cancelled.")
    else:
        print("No draft periods to clean up.")
    
    conn.close()

if __name__ == '__main__':
    try:
        cleanup_periods()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()





