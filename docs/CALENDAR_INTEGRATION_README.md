# Calendar Integration System - iCal/Google Calendar Support

## Overview

This system provides comprehensive calendar integration with iCal/Google Calendar support, allowing employees to subscribe to their work schedules, shipments, meetings, and deadlines in their preferred calendar application.

## Features

✅ **iCal/WebCal format** - Works with all major calendar apps  
✅ **Google Calendar** - One-click subscription  
✅ **Apple Calendar** - Native iOS/macOS support  
✅ **Outlook** - Microsoft 365 integration  
✅ **Automatic sync** - Changes update automatically  
✅ **Customizable** - Choose which events to include  
✅ **Individual event export** - Download single events  
✅ **Reminders** - Built-in alarm support  

## Database Schema

The system uses the following tables:

- `Calendar_Events` - Master table for all calendar events
- `Employee_Shifts` - Employee shift schedules linked to calendar events
- `Shipment_Schedule` - Shipment delivery schedules linked to calendar events
- `Calendar_Subscriptions` - Employee calendar subscription preferences
- `Event_Attendees` - Meeting attendees
- `Event_Reminders` - Event reminder settings

## Installation

1. **Run the database migration:**
   ```bash
   python3 migrate_calendar_integration.py
   ```

2. **Install Python dependencies:**
   ```bash
   pip install icalendar pytz
   ```

   Or install all requirements:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### For Employees

1. **Access Calendar Subscription:**
   - Navigate to `/calendar-subscription` in the web app
   - Or click "📅 Subscribe to Calendar" button on the Calendar page

2. **Configure Preferences:**
   - Choose which events to include:
     - My Shifts
     - Assigned Shipments
     - Meetings
     - Deadlines & Holidays
   - Set a custom calendar name

3. **Subscribe to Calendar:**
   - **Google Calendar:** Click "Add to Google Calendar" button
   - **Apple Calendar:** Click "Add to Apple Calendar" button
   - **Outlook:** Click "Get Instructions" for step-by-step guide
   - **Manual:** Copy the iCal URL and paste it into any calendar app

4. **Export Individual Events:**
   - On the Calendar page, click "📥 Download .ics" on any event
   - Or click "📅 Add to Google Calendar" to add directly

### For Administrators

#### Creating Shift Events

```python
from calendar_integration import CalendarIntegrationSystem
from datetime import datetime

calendar_system = CalendarIntegrationSystem()

# Create a shift event
result = calendar_system.create_shift_event(
    employee_id=1,
    start_time=datetime(2024, 1, 15, 9, 0),
    end_time=datetime(2024, 1, 15, 17, 0),
    shift_type='full',
    notes='Regular shift',
    created_by=admin_employee_id
)
```

#### Creating Shipment Events

```python
# Schedule a shipment delivery
result = calendar_system.create_shipment_event(
    vendor_id=1,
    expected_date=datetime(2024, 1, 20, 10, 0),
    delivery_window='9 AM - 12 PM',
    assigned_receiver=employee_id,
    notes='Large shipment - need extra help',
    created_by=admin_employee_id
)
```

#### API Endpoints

**Get Calendar Subscription URLs:**
```
GET /api/calendar/subscription/urls
Headers: Authorization: Bearer <session_token>
```

**Create/Update Subscription:**
```
POST /api/calendar/subscription/create
Headers: Authorization: Bearer <session_token>
Body: {
  "include_shifts": true,
  "include_shipments": true,
  "include_meetings": true,
  "include_deadlines": true,
  "calendar_name": "My Work Schedule"
}
```

**Get Calendar Events:**
```
GET /api/calendar/events?start=2024-01-01&end=2024-01-31
Headers: Authorization: Bearer <session_token>
```

**Export Single Event:**
```
GET /api/calendar/events/<event_id>/export
Headers: Authorization: Bearer <session_token>
```

**Create Shift:**
```
POST /api/shifts/create
Headers: Authorization: Bearer <session_token>
Body: {
  "employee_id": 1,
  "start_time": "2024-01-15T09:00:00",
  "end_time": "2024-01-15T17:00:00",
  "shift_type": "full",
  "notes": "Regular shift"
}
```

**Schedule Shipment:**
```
POST /api/shipments/schedule
Headers: Authorization: Bearer <session_token>
Body: {
  "vendor_id": 1,
  "expected_date": "2024-01-20T10:00:00",
  "delivery_window": "9 AM - 12 PM",
  "assigned_receiver": 1,
  "notes": "Large shipment"
}
```

**iCal Feed (Public):**
```
GET /calendar/subscribe/<subscription_token>.ics
```

## How It Works

1. **Subscription Creation:**
   - Each employee gets a unique subscription token
   - Token is used to generate personalized iCal feed
   - Preferences determine which events are included

2. **Event Generation:**
   - Events are stored in `Calendar_Events` table
   - Related data (shifts, shipments) linked via foreign keys
   - iCal feed generated on-demand when calendar app syncs

3. **Automatic Updates:**
   - When events are created/updated, they automatically appear in subscribed calendars
   - Calendar apps sync periodically (usually every few hours)
   - No manual refresh needed

## Event Types

- **shift** - Employee work shifts (Green: #4CAF50)
- **shipment** - Delivery schedules (Blue: #2196F3)
- **meeting** - Meetings and appointments (Orange: #FF9800)
- **deadline** - Important deadlines (Red: #F44336)
- **holiday** - Company holidays (Red: #F44336)
- **maintenance** - Maintenance schedules (Gray: #607D8B)
- **other** - Other events (Gray: #9E9E9E)

## Timezone

Default timezone is set to `America/New_York`. To change:

Edit `calendar_integration.py`:
```python
self.timezone = pytz.timezone('Your/Timezone')
```

## Security

- Subscription tokens are unique and secure (SHA-256 hashed)
- Each employee can only access their own calendar feed
- API endpoints require authentication
- Tokens can be deactivated via `is_active` flag

## Troubleshooting

### Calendar not syncing
- Check that subscription is active (`is_active = 1`)
- Verify the calendar app supports iCal feeds
- Try re-subscribing with a new token

### Events not appearing
- Check subscription preferences (include_shifts, etc.)
- Verify events exist in database
- Check event dates are within sync window (1 month past, 3 months future)

### Export not working
- Ensure event has `event_id` (must be from Calendar_Events table)
- Check authentication token is valid
- Verify event exists in database

## Integration with Existing Systems

The calendar system integrates with:
- **Employee Schedule** - Shifts automatically create calendar events
- **Shipment Verification** - Shipments can be scheduled with calendar events
- **Master Calendar** - Existing calendar events are included

## Future Enhancements

- Email notifications with calendar attachments
- SMS reminders
- Recurring events support
- Calendar conflict detection
- Multi-calendar support (personal + work)









