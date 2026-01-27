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
        
        # Generate unique token
        token = hashlib.sha256(
            f"{employee_id}{datetime.now().isoformat()}{uuid.uuid4()}".encode()
        ).hexdigest()
        
        # Default preferences
        prefs = preferences or {
            'include_shifts': True,
            'include_shipments': True,
            'include_meetings': True,
            'include_deadlines': True,
            'calendar_name': 'My Work Schedule'
        }
        
        cursor.execute("""
            INSERT INTO Calendar_Subscriptions
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
        cursor = conn.cursor()
        
        # Get subscription preferences
        cursor.execute("""
            SELECT cs.*, e.first_name, e.last_name
            FROM Calendar_Subscriptions cs
            JOIN employees e ON cs.employee_id = e.employee_id
            WHERE cs.subscription_token = %s AND cs.is_active = 1
        """, (token,))
        
        subscription = cursor.fetchone()
        
        if not subscription:
            cursor.close()
            conn.close()
            return None
        
        employee_id = subscription['employee_id']
        
        # Create calendar
        cal = Calendar()
        cal.add('prodid', '-//POS System//Calendar//EN')
        cal.add('version', '2.0')
        cal.add('calscale', 'GREGORIAN')
        cal.add('method', 'PUBLISH')
        cal.add('x-wr-calname', subscription['calendar_name'] or 'My Work Schedule')
        cal.add('x-wr-timezone', 'America/New_York')
        
        # Get events based on preferences
        events = []
        subscription_dict = dict(subscription) if isinstance(subscription, dict) else subscription
        
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
        
        # Add events to calendar
        for event_data in events:
            event = Event()
            
            # Generate unique ID
            event.add('uid', f"{event_data['event_id']}@pos-system.local")
            event.add('summary', event_data['title'])
            event.add('description', event_data['description'] or '')
            
            if event_data.get('location'):
                event.add('location', event_data['location'])
            
            # Handle datetime
            start_dt_str = event_data['start_datetime']
            end_dt_str = event_data['end_datetime']
            
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
            except:
                # Fallback parsing
                start_dt = datetime.strptime(start_dt_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                end_dt = datetime.strptime(end_dt_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
            
            if event_data.get('all_day'):
                event.add('dtstart', start_dt.date())
                event.add('dtend', (end_dt + timedelta(days=1)).date())  # All-day events need next day
            else:
                # Localize to timezone
                if start_dt.tzinfo is None:
                    start_dt = self.timezone.localize(start_dt)
                if end_dt.tzinfo is None:
                    end_dt = self.timezone.localize(end_dt)
                event.add('dtstart', start_dt)
                event.add('dtend', end_dt)
            
            event.add('dtstamp', datetime.now(self.timezone))
            
            if event_data.get('created_at'):
                try:
                    created_dt = datetime.fromisoformat(event_data['created_at'].replace('Z', '+00:00'))
                    if created_dt.tzinfo is None:
                        created_dt = self.timezone.localize(created_dt)
                    event.add('created', created_dt)
                except:
                    pass
            
            if event_data.get('updated_at'):
                try:
                    updated_dt = datetime.fromisoformat(event_data['updated_at'].replace('Z', '+00:00'))
                    if updated_dt.tzinfo is None:
                        updated_dt = self.timezone.localize(updated_dt)
                    event.add('last-modified', updated_dt)
                except:
                    pass
            
            # Add color if specified
            if event_data.get('color'):
                event.add('color', event_data['color'])
            
            # Add category based on event type
            event.add('categories', [event_data['event_type'].upper()])
            
            # Add alarm/reminder (15 minutes before)
            alarm = Alarm()
            alarm.add('action', 'DISPLAY')
            alarm.add('description', f"Reminder: {event_data['title']}")
            alarm.add('trigger', timedelta(minutes=-15))
            event.add_component(alarm)
            
            # Add event-specific details to description
            enhanced_description = event_data.get('description') or ''
            
            if event_data.get('shift_type'):
                enhanced_description += f"\n\nShift Type: {event_data['shift_type']}"
                enhanced_description += f"\nBreak: {event_data.get('break_duration', 30)} minutes"
            
            if event_data.get('vendor_name'):
                enhanced_description += f"\n\nVendor: {event_data['vendor_name']}"
                if event_data.get('estimated_delivery_window'):
                    enhanced_description += f"\nDelivery Window: {event_data['estimated_delivery_window']}"
                if event_data.get('tracking_number'):
                    enhanced_description += f"\nTracking: {event_data['tracking_number']}"
            
            if enhanced_description:
                event['description'] = enhanced_description
            
            cal.add_component(event)
        
        # Update last synced time
        cursor.execute("""
            UPDATE Calendar_Subscriptions
            SET last_synced = CURRENT_TIMESTAMP
            WHERE subscription_token = %s
        """, (token,))
        conn.commit()
        
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
            SELECT subscription_token FROM Calendar_Subscriptions
            WHERE employee_id = %s AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
        """, (employee_id,))
        
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if result:
            token = result['subscription_token']
            ical_url = f"{self.base_url}/calendar/subscribe/{token}.ics"
            return {
                'ical_url': ical_url,
                'webcal_url': ical_url.replace('http://', 'webcal://').replace('https://', 'webcal://'),
                'google_url': f"https://calendar.google.com/calendar/render?cid={ical_url}"
            }
        
        return None

