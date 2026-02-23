#!/usr/bin/env python3
"""
Calendar Integration System - iCal/Google Calendar support
Generates iCal feeds for employee calendar subscriptions
"""

from icalendar import Calendar, Event, Alarm
from datetime import datetime, timedelta
import pytz
import uuid
import hashlib
from typing import Optional, Dict, Any, List
from psycopg2.extras import RealDictCursor
from database import get_connection

class CalendarIntegrationSystem:
    
    def __init__(self, base_url: str = 'http://localhost:5001'):
        """
        Initialize calendar integration system
        
        Args:
            base_url: Base URL for generating calendar feed URLs
        """
        self.base_url = base_url.rstrip('/')
        self.timezone = pytz.timezone('America/New_York')  # Adjust to your timezone
    
    def create_subscription(self, employee_id: int, preferences: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a calendar subscription for an employee"""
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Ensure table exists (lowercase name so unquoted Calendar_Subscriptions in any code resolves to it)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calendar_subscriptions (
                subscription_id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                subscription_token VARCHAR(255) NOT NULL,
                include_shifts SMALLINT DEFAULT 1,
                include_shipments SMALLINT DEFAULT 1,
                include_meetings SMALLINT DEFAULT 1,
                include_deadlines SMALLINT DEFAULT 1,
                calendar_name VARCHAR(255) DEFAULT 'My Work Schedule',
                is_active SMALLINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        # Generate unique token
        token = hashlib.sha256(
            f"{employee_id}{datetime.now().isoformat()}{uuid.uuid4()}".encode()
        ).hexdigest()
        
        # Default preferences (ensure dict)
        if preferences is None or not isinstance(preferences, dict):
            prefs = {
                'include_shifts': True,
                'include_shipments': True,
                'include_meetings': True,
                'include_deadlines': True,
                'calendar_name': 'My Work Schedule'
            }
        else:
            prefs = preferences
        
        cursor.execute("""
            INSERT INTO calendar_subscriptions
            (employee_id, subscription_token, include_shifts, include_shipments,
             include_meetings, include_deadlines, calendar_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING subscription_id
        """, (
            employee_id, token,
            1 if prefs.get('include_shifts', True) else 0,
            1 if prefs.get('include_shipments', True) else 0,
            1 if prefs.get('include_meetings', True) else 0,
            1 if prefs.get('include_deadlines', True) else 0,
            prefs.get('calendar_name', 'My Work Schedule')
        ))
        
        row = cursor.fetchone()
        subscription_id = row[0] if isinstance(row, tuple) else (row['subscription_id'] if row else None)
        conn.commit()
        cursor.close()
        conn.close()
        
        # Generate subscription URLs
        ical_url = f"{self.base_url}/calendar/subscribe/{token}.ics"
        webcal_url = ical_url.replace('http://', 'webcal://').replace('https://', 'webcal://')
        google_url = f"https://calendar.google.com/calendar/render?cid={ical_url}"
        
        return {
            'subscription_id': subscription_id,
            'token': token,
            'ical_url': ical_url,
            'webcal_url': webcal_url,  # For Apple Calendar
            'google_url': google_url,
            'outlook_url': ical_url  # Outlook can use iCal URL
        }
    
    def generate_ical_feed(self, token: str) -> Optional[bytes]:
        """Generate iCal feed for a subscription token"""
        
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get subscription preferences
        cursor.execute("""
            SELECT cs.*, e.first_name, e.last_name
            FROM calendar_subscriptions cs
            JOIN employees e ON cs.employee_id = e.employee_id
            WHERE cs.subscription_token = %s AND cs.is_active = 1
        """, (token,))
        
        subscription = cursor.fetchone()
        
        if not subscription:
            cursor.close()
            conn.close()
            return None
        
        subscription_dict = dict(subscription)
        employee_id = subscription_dict['employee_id']
        
        # Create calendar
        cal = Calendar()
        cal.add('prodid', '-//POS System//Calendar//EN')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        cal.add('x-wr-calname', subscription_dict.get('calendar_name') or 'My Work Schedule')
        cal.add('x-wr-timezone', 'America/New_York')
        
        # Get events based on preferences (wrap in try so missing event tables don't break feed)
        events = []
        try:
            # Get shifts if enabled
            if subscription_dict.get('include_shifts') == 1:
                cursor.execute("""
                    SELECT ce.*, es.shift_type, es.break_duration
                    FROM Calendar_Events ce
                    JOIN Employee_Shifts es ON ce.event_id = es.event_id
                    WHERE es.employee_id = %s
                    AND ce.start_datetime >= CURRENT_TIMESTAMP - INTERVAL '1 month'
                    AND ce.start_datetime <= CURRENT_TIMESTAMP + INTERVAL '3 months'
                    AND es.status != 'cancelled'
                """, (employee_id,))
                events.extend([dict(row) if isinstance(row, dict) else row for row in cursor.fetchall()])
            # Get shipments if enabled
            if subscription_dict.get('include_shipments') == 1:
                cursor.execute("""
                    SELECT ce.*, ss.vendor_id, v.vendor_name,
                           ss.estimated_delivery_window, ss.tracking_number
                    FROM Calendar_Events ce
                    JOIN Shipment_Schedule ss ON ce.event_id = ss.event_id
                    LEFT JOIN vendors v ON ss.vendor_id = v.vendor_id
                    WHERE ss.assigned_receiver = %s
                    AND ce.start_datetime >= CURRENT_TIMESTAMP - INTERVAL '1 month'
                    AND ce.start_datetime <= CURRENT_TIMESTAMP + INTERVAL '3 months'
                    AND ss.status != 'cancelled'
                """, (employee_id,))
                events.extend([dict(row) if isinstance(row, dict) else row for row in cursor.fetchall()])
            # Get meetings if enabled
            if subscription_dict.get('include_meetings') == 1:
                cursor.execute("""
                    SELECT ce.*
                    FROM Calendar_Events ce
                    JOIN Event_Attendees ea ON ce.event_id = ea.event_id
                    WHERE ea.employee_id = %s
                    AND ce.event_type = 'meeting'
                    AND ce.start_datetime >= CURRENT_TIMESTAMP - INTERVAL '1 month'
                    AND ce.start_datetime <= CURRENT_TIMESTAMP + INTERVAL '3 months'
                """, (employee_id,))
                events.extend([dict(row) if isinstance(row, dict) else row for row in cursor.fetchall()])
            # Get deadlines if enabled
            if subscription_dict.get('include_deadlines') == 1:
                cursor.execute("""
                    SELECT ce.*
                    FROM Calendar_Events ce
                    WHERE ce.event_type IN ('deadline', 'holiday')
                    AND ce.start_datetime >= CURRENT_TIMESTAMP - INTERVAL '1 month'
                    AND ce.start_datetime <= CURRENT_TIMESTAMP + INTERVAL '3 months'
                """)
                events.extend([dict(row) if isinstance(row, dict) else row for row in cursor.fetchall()])
        except Exception:
            pass  # events stays empty if Calendar_Events etc. don't exist
        
        # Add events to calendar (skip malformed events so feed still returns)
        for event_data in events:
            try:
                event_row = dict(event_data) if not isinstance(event_data, dict) else event_data
            except Exception:
                continue
            if not event_row.get('event_id') or not event_row.get('start_datetime') or not event_row.get('end_datetime'):
                continue
            event = Event()
            try:
                event.add('uid', f"{event_row.get('event_id')}@pos-system.local")
                event.add('summary', event_row.get('title') or 'Event')
                event.add('description', (event_row.get('description') or ''))
                
                if event_row.get('location'):
                    event.add('location', event_row['location'])
                
                start_dt_str = event_row['start_datetime']
                end_dt_str = event_row['end_datetime']
                
                # Parse datetime strings (SQLite stores as TEXT)
                try:
                    if 'T' in start_dt_str:
                        start_dt = datetime.fromisoformat(start_dt_str.replace('Z', '+00:00'))
                    else:
                        start_dt = datetime.strptime(start_dt_str, '%Y-%m-%d %H:%M:%S')
                    
                    if 'T' in end_dt_str:
                        end_dt = datetime.fromisoformat(end_dt_str.replace('Z', '+00:00'))
                    else:
                        end_dt = datetime.strptime(end_dt_str, '%Y-%m-%d %H:%M:%S')
                except Exception:
                    # Fallback parsing
                    start_dt = datetime.strptime(start_dt_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                    end_dt = datetime.strptime(end_dt_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                
                if event_row.get('all_day'):
                    event.add('dtstart', start_dt.date())
                    event.add('dtend', (end_dt + timedelta(days=1)).date())
                else:
                    if start_dt.tzinfo is None:
                        start_dt = self.timezone.localize(start_dt)
                    if end_dt.tzinfo is None:
                        end_dt = self.timezone.localize(end_dt)
                    event.add('dtstart', start_dt)
                    event.add('dtend', end_dt)
                
                event.add('dtstamp', datetime.now(self.timezone))
                
                if event_row.get('created_at'):
                    try:
                        created_dt = datetime.fromisoformat(str(event_row.get('created_at')).replace('Z', '+00:00'))
                        if created_dt.tzinfo is None:
                            created_dt = self.timezone.localize(created_dt)
                        event.add('created', created_dt)
                    except Exception:
                        pass
                
                if event_row.get('updated_at'):
                    try:
                        updated_dt = datetime.fromisoformat(str(event_row.get('updated_at')).replace('Z', '+00:00'))
                        if updated_dt.tzinfo is None:
                            updated_dt = self.timezone.localize(updated_dt)
                        event.add('last-modified', updated_dt)
                    except Exception:
                        pass
                
                if event_row.get('color'):
                    event.add('color', event_row['color'])
                if event_row.get('event_type'):
                    event.add('categories', [str(event_row.get('event_type')).upper()])
                alarm = Alarm()
                alarm.add('action', 'DISPLAY')
                alarm.add('description', f"Reminder: {event_row.get('title') or 'Event'}")
                alarm.add('trigger', timedelta(minutes=-15))
                event.add_component(alarm)
                
                enhanced_description = event_row.get('description') or ''
                if event_row.get('shift_type'):
                    enhanced_description += f"\n\nShift Type: {event_row['shift_type']}"
                    enhanced_description += f"\nBreak: {event_row.get('break_duration', 30)} minutes"
                if event_row.get('vendor_name'):
                    enhanced_description += f"\n\nVendor: {event_row['vendor_name']}"
                if event_row.get('estimated_delivery_window'):
                    enhanced_description += f"\nDelivery Window: {event_row['estimated_delivery_window']}"
                if event_row.get('tracking_number'):
                    enhanced_description += f"\nTracking: {event_row['tracking_number']}"
                
                if enhanced_description:
                    event.add('description', enhanced_description)
                
                cal.add_component(event)
            except Exception:
                continue
        
        try:
            cursor.execute("""
                UPDATE calendar_subscriptions
                SET last_synced = CURRENT_TIMESTAMP
                WHERE subscription_token = %s
            """, (token,))
            conn.commit()
        except Exception:
            pass  # column may not exist
        cursor.close()
        conn.close()
        return cal.to_ical()
    
    def create_shift_event(self, employee_id: int, start_time: datetime, end_time: datetime,
                          shift_type: str, notes: Optional[str] = None, created_by: Optional[int] = None) -> Dict[str, Any]:
        """Create a shift event for an employee"""
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Create calendar event
        cursor.execute("""
            INSERT INTO Calendar_Events
            (event_type, title, description, start_datetime, end_datetime, created_by, color)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING event_id
        """, (
            'shift',
            f"Shift - {shift_type.title()}",
            notes,
            start_time.isoformat(),
            end_time.isoformat(),
            created_by,
            '#4CAF50'  # Green for shifts
        ))
        
        row = cursor.fetchone()
        event_id = row[0] if isinstance(row, tuple) else row['event_id']
        
        # Create shift record
        cursor.execute("""
            INSERT INTO Employee_Shifts
            (event_id, employee_id, shift_type, start_time, end_time, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING shift_id
        """, (
            event_id,
            employee_id,
            shift_type,
            start_time.isoformat(),
            end_time.isoformat(),
            notes
        ))
        
        row = cursor.fetchone()
        shift_id = row[0] if isinstance(row, tuple) else row['shift_id']
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'event_id': event_id,
            'shift_id': shift_id
        }
    
    def create_shipment_event(self, vendor_id: int, expected_date: datetime, delivery_window: str,
                            assigned_receiver: int, notes: Optional[str] = None, created_by: Optional[int] = None) -> Dict[str, Any]:
        """Create a shipment delivery event"""
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get vendor name
        cursor.execute("SELECT vendor_name FROM vendors WHERE vendor_id = %s", (vendor_id,))
        vendor = cursor.fetchone()
        vendor_dict = dict(vendor) if isinstance(vendor, dict) else {'vendor_name': vendor[0] if vendor else None}
        vendor_name = vendor_dict.get('vendor_name', 'Unknown Vendor')
        
        # Create calendar event
        title = f"Shipment Delivery - {vendor_name}"
        description = f"Expected delivery from {vendor_name}\nWindow: {delivery_window}"
        if notes:
            description += f"\n\n{notes}"
        
        end_datetime = expected_date + timedelta(hours=4)  # 4 hour window
        
        cursor.execute("""
            INSERT INTO Calendar_Events
            (event_type, title, description, start_datetime, end_datetime, 
             location, created_by, color)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING event_id
        """, (
            'shipment',
            title,
            description,
            expected_date.isoformat(),
            end_datetime.isoformat(),
            'Receiving Dock',
            created_by,
            '#2196F3'  # Blue for shipments
        ))
        
        row = cursor.fetchone()
        event_id = row[0] if isinstance(row, tuple) else row['event_id']
        
        # Create shipment schedule
        cursor.execute("""
            INSERT INTO Shipment_Schedule
            (event_id, vendor_id, expected_date, estimated_delivery_window, 
             assigned_receiver, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING schedule_id
        """, (
            event_id,
            vendor_id,
            expected_date.isoformat(),
            delivery_window,
            assigned_receiver,
            notes
        ))
        
        row = cursor.fetchone()
        schedule_id = row[0] if isinstance(row, tuple) else row['schedule_id']
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'event_id': event_id,
            'schedule_id': schedule_id
        }
    
    def export_single_event_ics(self, event_id: int, employee_id: Optional[int] = None) -> Optional[bytes]:
        """Export a single event as .ics file for download"""
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM Calendar_Events WHERE event_id = %s
        """, (event_id,))
        
        event_data = cursor.fetchone()
        
        if not event_data:
            cursor.close()
            conn.close()
            return None
        
        event_dict = dict(event_data)
        
        # Create calendar
        cal = Calendar()
        cal.add('prodid', '-//POS System//Event//EN')
        cal.add('version', '2.0')
        
        # Create event
        event = Event()
        event.add('uid', f"{event_dict['event_id']}@pos-system.local")
        event.add('summary', event_dict['title'])
        event.add('description', event_dict.get('description') or '')
        
        if event_dict.get('location'):
            event.add('location', event_dict['location'])
        
        # Parse datetime
        start_dt_str = event_dict['start_datetime']
        end_dt_str = event_dict['end_datetime']
        
        try:
            if 'T' in start_dt_str:
                start_dt = datetime.fromisoformat(start_dt_str.replace('Z', '+00:00'))
            else:
                start_dt = datetime.strptime(start_dt_str, '%Y-%m-%d %H:%M:%S')
            
            if 'T' in end_dt_str:
                end_dt = datetime.fromisoformat(end_dt_str.replace('Z', '+00:00'))
            else:
                end_dt = datetime.strptime(end_dt_str, '%Y-%m-%d %H:%M:%S')
        except:
            start_dt = datetime.strptime(start_dt_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
            end_dt = datetime.strptime(end_dt_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
        
        if event_dict.get('all_day'):
            event.add('dtstart', start_dt.date())
            event.add('dtend', (end_dt + timedelta(days=1)).date())
        else:
            if start_dt.tzinfo is None:
                start_dt = self.timezone.localize(start_dt)
            if end_dt.tzinfo is None:
                end_dt = self.timezone.localize(end_dt)
            event.add('dtstart', start_dt)
            event.add('dtend', end_dt)
        
        event.add('dtstamp', datetime.now(self.timezone))
        
        # Add reminder
        alarm = Alarm()
        alarm.add('action', 'DISPLAY')
        alarm.add('description', f"Reminder: {event_dict['title']}")
        alarm.add('trigger', timedelta(minutes=-15))
        event.add_component(alarm)
        
        cal.add_component(event)
        
        cursor.close()
        conn.close()
        
        return cal.to_ical()
    
    def get_employee_calendar_url(self, employee_id: int) -> Optional[Dict[str, Any]]:
        """Get calendar subscription URLs for an employee"""
        
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calendar_subscriptions (
                subscription_id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL,
                subscription_token VARCHAR(255) NOT NULL,
                include_shifts SMALLINT DEFAULT 1,
                include_shipments SMALLINT DEFAULT 1,
                include_meetings SMALLINT DEFAULT 1,
                include_deadlines SMALLINT DEFAULT 1,
                calendar_name VARCHAR(255) DEFAULT 'My Work Schedule',
                is_active SMALLINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        
        cursor.execute("""
            SELECT subscription_token FROM calendar_subscriptions
            WHERE employee_id = %s AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
        """, (employee_id,))
        
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if result:
            token = result[0] if isinstance(result, (tuple, list)) else result.get('subscription_token')
            ical_url = f"{self.base_url}/calendar/subscribe/{token}.ics"
            return {
                'ical_url': ical_url,
                'webcal_url': ical_url.replace('http://', 'webcal://').replace('https://', 'webcal://'),
                'google_url': f"https://calendar.google.com/calendar/render?cid={ical_url}"
            }
        
        return None

