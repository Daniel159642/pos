# Automated Schedule Builder System

## Overview

A comprehensive automated schedule builder with AI-powered generation that creates optimal employee schedules based on availability, business requirements, and fairness constraints.

## Features

✅ **One-click generation** - AI creates optimal schedule automatically  
✅ **Smart algorithm** - Considers availability, hours, fairness  
✅ **Conflict detection** - Warns about issues before publishing  
✅ **Draft system** - Edit before sending to employees  
✅ **Template system** - Save and reuse schedules  
✅ **Copy/paste** - Reuse previous weeks  
✅ **Employee availability** - Staff sets their own availability  
✅ **Time off requests** - Integrated with availability  
✅ **Multiple positions** - Assigns based on skills  
✅ **Hours tracking** - Ensures fair distribution  
✅ **Cost estimation** - Shows labor cost  
✅ **Notification system** - Auto-notify on publish  
✅ **Visual calendar** - Easy drag-drop editing  
✅ **Audit trail** - All changes logged  

## Setup

### 1. Run Migration

First, run the migration script to create all necessary database tables:

```bash
python migrate_schedule_system.py
```

This will create the following tables:
- `Employee_Availability` - Employee availability preferences
- `Time_Off_Requests` - Time off request management
- `Schedule_Templates` - Saved schedule templates
- `Schedule_Periods` - Weekly schedule periods
- `Scheduled_Shifts` - Individual shift assignments
- `Schedule_Requirements` - Business staffing requirements
- `Employee_Positions` - Employee skills/positions
- `Schedule_Changes` - Change audit log
- `Schedule_Notifications` - Notification tracking

### 2. Set Up Schedule Requirements

Before generating schedules, you need to define your business requirements. You can do this by inserting records into the `Schedule_Requirements` table:

```sql
INSERT INTO Schedule_Requirements 
(day_of_week, time_block_start, time_block_end, min_employees, preferred_positions, priority)
VALUES 
('monday', '09:00', '17:00', 2, '["cashier", "stock"]', 'high'),
('tuesday', '09:00', '17:00', 2, '["cashier", "stock"]', 'high'),
-- ... etc for each day
```

### 3. Set Employee Positions

Assign positions/skills to employees:

```sql
INSERT INTO Employee_Positions (employee_id, position_name, skill_level, hourly_rate)
VALUES (1, 'cashier', 'proficient', 15.00),
       (1, 'stock', 'competent', 15.00);
```

### 4. Employee Availability

Employees can set their availability through the frontend at `/availability` or via API:

```bash
POST /api/availability/submit
{
  "availability": [
    {"day": "monday", "start_time": "09:00:00", "end_time": "17:00:00", "type": "available"},
    {"day": "tuesday", "start_time": "09:00:00", "end_time": "17:00:00", "type": "preferred"},
    ...
  ]
}
```

## Usage

### Admin Interface

Navigate to `/schedule` in the frontend to access the schedule management interface.

#### Generate Schedule

1. Select the week you want to schedule
2. Click "🤖 Generate Schedule"
3. Review the generated schedule
4. Edit if needed (when in draft status)
5. Publish when ready

#### Settings

Configure generation algorithm settings:
- **Algorithm**: Balanced, Cost Optimized, or Preference Prioritized
- **Max Consecutive Days**: Maximum days in a row (default: 6)
- **Min Hours Between Shifts**: Minimum rest time (default: 10 hours)
- **Distribute Hours Evenly**: Try to balance hours across employees
- **Avoid Clopening**: Prevent closing then opening next day

#### Templates

- **Save as Template**: Save current schedule for reuse
- **Copy from Template**: Use a previous schedule as starting point

### API Endpoints

#### Generate Schedule
```bash
POST /api/schedule/generate
{
  "week_start_date": "2024-01-01",
  "settings": {
    "algorithm": "balanced",
    "max_consecutive_days": 6,
    "min_time_between_shifts": 10,
    "distribute_hours_evenly": true,
    "avoid_clopening": true
  }
}
```

#### Get Schedule
```bash
GET /api/schedule/{period_id}
```

#### Publish Schedule
```bash
POST /api/schedule/{period_id}/publish
```

#### Save as Template
```bash
POST /api/schedule/{period_id}/save-template
{
  "template_name": "Weekday Template",
  "description": "Standard weekday schedule"
}
```

#### Copy from Template
```bash
POST /api/schedule/copy-template
{
  "template_id": 1,
  "week_start_date": "2024-01-08"
}
```

#### Manage Shifts
```bash
# Create shift
POST /api/schedule/{period_id}/shift
{
  "employee_id": 1,
  "shift_date": "2024-01-01",
  "start_time": "09:00",
  "end_time": "17:00",
  "position": "cashier"
}

# Update shift
PUT /api/schedule/{period_id}/shift
{
  "scheduled_shift_id": 1,
  "employee_id": 1,
  "shift_date": "2024-01-01",
  "start_time": "10:00",
  "end_time": "18:00"
}

# Delete shift
DELETE /api/schedule/{period_id}/shift?shift_id=1
```

## Algorithm Details

The schedule generator uses a scoring system to assign employees to shifts:

1. **Availability Check**: Only employees available during the time block are considered
2. **Hours Distribution**: Prefers employees with fewer scheduled hours
3. **Position Match**: Prioritizes employees with matching skills/positions
4. **Consecutive Days**: Avoids excessive consecutive work days
5. **Employment Type**: Slightly favors full-time employees
6. **Constraints**: Enforces max hours, min rest time, and consecutive day limits

## Conflict Detection

The system automatically detects:
- **Double Bookings**: Overlapping shifts for the same employee
- **Over Max Hours**: Employees scheduled beyond their max hours per week

Conflicts are displayed before publishing and can be resolved manually.

## Time Off Requests

Employees can submit time off requests:

```sql
INSERT INTO Time_Off_Requests 
(employee_id, start_date, end_date, reason, status)
VALUES (1, '2024-01-15', '2024-01-17', 'Vacation', 'pending');
```

Managers can approve/deny requests, and approved requests are automatically respected during schedule generation.

## Notifications

When a schedule is published, notifications are automatically created for all affected employees. These can be used to send email/SMS notifications (implementation depends on your notification system).

## Best Practices

1. **Set Requirements First**: Define your business needs in `Schedule_Requirements` before generating
2. **Update Availability Regularly**: Encourage employees to keep availability current
3. **Review Drafts**: Always review generated schedules before publishing
4. **Use Templates**: Save good schedules as templates for consistency
5. **Handle Conflicts**: Resolve conflicts before publishing
6. **Monitor Hours**: Check employee hours summary to ensure fair distribution

## Troubleshooting

### No employees available
- Check that employees have set their availability
- Verify time off requests aren't blocking all employees
- Ensure requirements match employee availability windows

### Understaffed shifts
- Increase `min_employees` in requirements
- Add more employees or expand availability
- Check for conflicting time off requests

### Over-scheduled employees
- Review max hours per week settings
- Check for double bookings
- Adjust algorithm settings to distribute hours more evenly

## Future Enhancements

Potential improvements:
- Drag-and-drop shift editing in UI
- Automatic conflict resolution
- Shift swap requests between employees
- Integration with payroll systems
- Mobile app for employees
- Advanced analytics and reporting
- Multi-location support









