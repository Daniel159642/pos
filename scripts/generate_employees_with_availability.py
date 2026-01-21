#!/usr/bin/env python3
"""
Generate multiple employee accounts with their availability already set in the system
"""

import sqlite3
import json
import random
from datetime import datetime, timedelta
from database import add_employee, add_schedule, get_connection, DB_NAME

# Sample employee data
EMPLOYEES = [
    {
        'username': 'alice.smith',
        'first_name': 'Alice',
        'last_name': 'Smith',
        'email': 'alice.smith@pos.com',
        'phone': '555-1001',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 16.50,
        'date_started': '2024-01-15',
        'availability': {
            'monday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'tuesday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'wednesday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'thursday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'friday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'saturday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'bob.jones',
        'first_name': 'Bob',
        'last_name': 'Jones',
        'email': 'bob.jones@pos.com',
        'phone': '555-1002',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 17.00,
        'date_started': '2024-02-01',
        'availability': {
            'monday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'tuesday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'wednesday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'thursday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'friday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'saturday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': True, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'carol.white',
        'first_name': 'Carol',
        'last_name': 'White',
        'email': 'carol.white@pos.com',
        'phone': '555-1003',
        'position': 'stock_clerk',
        'department': 'Inventory',
        'employment_type': 'full_time',
        'hourly_rate': 18.50,
        'date_started': '2023-11-10',
        'availability': {
            'monday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'tuesday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'wednesday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'thursday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'friday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'david.brown',
        'first_name': 'David',
        'last_name': 'Brown',
        'email': 'david.brown@pos.com',
        'phone': '555-1004',
        'position': 'supervisor',
        'department': 'Sales',
        'employment_type': 'full_time',
        'salary': 45000.00,
        'date_started': '2023-08-20',
        'availability': {
            'monday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'tuesday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'wednesday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'thursday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'friday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'emma.davis',
        'first_name': 'Emma',
        'last_name': 'Davis',
        'email': 'emma.davis@pos.com',
        'phone': '555-1005',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 16.00,
        'date_started': '2024-03-05',
        'availability': {
            'monday': {'available': True, 'start': '14:00', 'end': '22:00'},
            'tuesday': {'available': True, 'start': '14:00', 'end': '22:00'},
            'wednesday': {'available': True, 'start': '14:00', 'end': '22:00'},
            'thursday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'friday': {'available': True, 'start': '14:00', 'end': '22:00'},
            'saturday': {'available': True, 'start': '12:00', 'end': '20:00'},
            'sunday': {'available': True, 'start': '12:00', 'end': '20:00'}
        }
    },
    {
        'username': 'frank.miller',
        'first_name': 'Frank',
        'last_name': 'Miller',
        'email': 'frank.miller@pos.com',
        'phone': '555-1006',
        'position': 'stock_clerk',
        'department': 'Inventory',
        'employment_type': 'part_time',
        'hourly_rate': 17.50,
        'date_started': '2024-01-22',
        'availability': {
            'monday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'tuesday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'wednesday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'thursday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'friday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'saturday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'sunday': {'available': True, 'start': '08:00', 'end': '16:00'}
        }
    },
    {
        'username': 'grace.wilson',
        'first_name': 'Grace',
        'last_name': 'Wilson',
        'email': 'grace.wilson@pos.com',
        'phone': '555-1007',
        'position': 'assistant_manager',
        'department': 'Management',
        'employment_type': 'full_time',
        'salary': 52000.00,
        'date_started': '2023-05-15',
        'availability': {
            'monday': {'available': True, 'start': '08:00', 'end': '17:00'},
            'tuesday': {'available': True, 'start': '08:00', 'end': '17:00'},
            'wednesday': {'available': True, 'start': '08:00', 'end': '17:00'},
            'thursday': {'available': True, 'start': '08:00', 'end': '17:00'},
            'friday': {'available': True, 'start': '08:00', 'end': '17:00'},
            'saturday': {'available': True, 'start': '09:00', 'end': '15:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'henry.taylor',
        'first_name': 'Henry',
        'last_name': 'Taylor',
        'email': 'henry.taylor@pos.com',
        'phone': '555-1008',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 15.75,
        'date_started': '2024-04-10',
        'availability': {
            'monday': {'available': True, 'start': '11:00', 'end': '19:00'},
            'tuesday': {'available': True, 'start': '11:00', 'end': '19:00'},
            'wednesday': {'available': True, 'start': '11:00', 'end': '19:00'},
            'thursday': {'available': True, 'start': '11:00', 'end': '19:00'},
            'friday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'ivy.anderson',
        'first_name': 'Ivy',
        'last_name': 'Anderson',
        'email': 'ivy.anderson@pos.com',
        'phone': '555-1009',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 16.25,
        'date_started': '2024-02-28',
        'availability': {
            'monday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'tuesday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'wednesday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'thursday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'friday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'saturday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'sunday': {'available': True, 'start': '10:00', 'end': '18:00'}
        }
    },
    {
        'username': 'jack.thomas',
        'first_name': 'Jack',
        'last_name': 'Thomas',
        'email': 'jack.thomas@pos.com',
        'phone': '555-1010',
        'position': 'stock_clerk',
        'department': 'Inventory',
        'employment_type': 'part_time',
        'hourly_rate': 17.00,
        'date_started': '2024-03-18',
        'availability': {
            'monday': {'available': True, 'start': '06:00', 'end': '14:00'},
            'tuesday': {'available': True, 'start': '06:00', 'end': '14:00'},
            'wednesday': {'available': True, 'start': '06:00', 'end': '14:00'},
            'thursday': {'available': True, 'start': '06:00', 'end': '14:00'},
            'friday': {'available': True, 'start': '06:00', 'end': '14:00'},
            'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'karen.jackson',
        'first_name': 'Karen',
        'last_name': 'Jackson',
        'email': 'karen.jackson@pos.com',
        'phone': '555-1011',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'full_time',
        'hourly_rate': 19.00,
        'date_started': '2023-09-12',
        'availability': {
            'monday': {'available': True, 'start': '09:00', 'end': '18:00'},
            'tuesday': {'available': True, 'start': '09:00', 'end': '18:00'},
            'wednesday': {'available': True, 'start': '09:00', 'end': '18:00'},
            'thursday': {'available': True, 'start': '09:00', 'end': '18:00'},
            'friday': {'available': True, 'start': '09:00', 'end': '18:00'},
            'saturday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'liam.martinez',
        'first_name': 'Liam',
        'last_name': 'Martinez',
        'email': 'liam.martinez@pos.com',
        'phone': '555-1012',
        'position': 'supervisor',
        'department': 'Sales',
        'employment_type': 'full_time',
        'salary': 48000.00,
        'date_started': '2023-07-08',
        'availability': {
            'monday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'tuesday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'wednesday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'thursday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'friday': {'available': True, 'start': '08:00', 'end': '16:00'},
            'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'mia.garcia',
        'first_name': 'Mia',
        'last_name': 'Garcia',
        'email': 'mia.garcia@pos.com',
        'phone': '555-1013',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 16.50,
        'date_started': '2024-05-01',
        'availability': {
            'monday': {'available': True, 'start': '12:00', 'end': '20:00'},
            'tuesday': {'available': True, 'start': '12:00', 'end': '20:00'},
            'wednesday': {'available': True, 'start': '12:00', 'end': '20:00'},
            'thursday': {'available': True, 'start': '12:00', 'end': '20:00'},
            'friday': {'available': True, 'start': '12:00', 'end': '20:00'},
            'saturday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'noah.rodriguez',
        'first_name': 'Noah',
        'last_name': 'Rodriguez',
        'email': 'noah.rodriguez@pos.com',
        'phone': '555-1014',
        'position': 'stock_clerk',
        'department': 'Inventory',
        'employment_type': 'full_time',
        'hourly_rate': 20.00,
        'date_started': '2023-12-05',
        'availability': {
            'monday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'tuesday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'wednesday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'thursday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'friday': {'available': True, 'start': '07:00', 'end': '15:00'},
            'saturday': {'available': True, 'start': '08:00', 'end': '14:00'},
            'sunday': {'available': False, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'olivia.lee',
        'first_name': 'Olivia',
        'last_name': 'Lee',
        'email': 'olivia.lee@pos.com',
        'phone': '555-1015',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 15.50,
        'date_started': '2024-04-22',
        'availability': {
            'monday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'tuesday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'wednesday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'thursday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'friday': {'available': True, 'start': '10:00', 'end': '18:00'},
            'saturday': {'available': True, 'start': '09:00', 'end': '17:00'},
            'sunday': {'available': True, 'start': '09:00', 'end': '17:00'}
        }
    },
    {
        'username': 'peter.walker',
        'first_name': 'Peter',
        'last_name': 'Walker',
        'email': 'peter.walker@pos.com',
        'phone': '555-1016',
        'position': 'cashier',
        'department': 'Sales',
        'employment_type': 'part_time',
        'hourly_rate': 16.75,
        'date_started': '2024-01-08',
        'availability': {
            'monday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'tuesday': {'available': False, 'start': '09:00', 'end': '17:00'},
            'wednesday': {'available': True, 'start': '13:00', 'end': '21:00'},
            'thursday': {'available': True, 'start': '13:00', 'end': '21:00'},
            'friday': {'available': True, 'start': '13:00', 'end': '21:00'},
            'saturday': {'available': True, 'start': '11:00', 'end': '19:00'},
            'sunday': {'available': True, 'start': '11:00', 'end': '19:00'}
        }
    }
]

def set_employee_availability(employee_id: int, availability: dict):
    """Set employee availability in the database"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if availability record exists
        cursor.execute("""
            SELECT availability_id FROM employee_availability
            WHERE employee_id = ?
        """, (employee_id,))
        
        exists = cursor.fetchone()
        
        # Prepare data for insertion/update
        availability_data = {}
        for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
            if day in availability:
                availability_data[day] = json.dumps(availability[day])
            else:
                # Default unavailable
                availability_data[day] = json.dumps({'available': False, 'start': '09:00', 'end': '17:00'})
        
        if exists:
            # Update existing
            update_fields = [f"{day} = ?" for day in availability_data.keys()]
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            values = list(availability_data.values())
            values.append(employee_id)
            
            query = f"""
                UPDATE employee_availability
                SET {', '.join(update_fields)}
                WHERE employee_id = ?
            """
            cursor.execute(query, values)
        else:
            # Insert new
            fields = ['employee_id'] + list(availability_data.keys())
            placeholders = ['?'] * len(fields)
            values = [employee_id] + list(availability_data.values())
            
            query = f"""
                INSERT INTO employee_availability ({', '.join(fields)}, updated_at)
                VALUES ({', '.join(placeholders)}, CURRENT_TIMESTAMP)
            """
            cursor.execute(query, values)
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        conn.rollback()
        conn.close()
        raise e

def generate_schedules_from_availability(weeks_ahead: int = 4):
    """Generate schedules for all employees based on their availability"""
    
    print("=" * 70)
    print("GENERATING SCHEDULES FROM AVAILABILITY")
    print("=" * 70)
    print()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all employees with availability
    cursor.execute("""
        SELECT e.employee_id, e.first_name, e.last_name, ea.*
        FROM employees e
        INNER JOIN employee_availability ea ON e.employee_id = ea.employee_id
        WHERE e.active = 1
    """)
    
    employees = cursor.fetchall()
    conn.close()
    
    if not employees:
        print("No employees with availability found.")
        return
    
    # Calculate date range
    today = datetime.now().date()
    start_date = today
    end_date = today + timedelta(weeks=weeks_ahead)
    
    total_schedules = 0
    
    for emp_row in employees:
        emp = dict(emp_row)
        employee_id = emp['employee_id']
        first_name = emp['first_name']
        last_name = emp['last_name']
        
        print(f"Generating schedules for {first_name} {last_name}...")
        
        # Parse availability for each day
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        schedules_created = 0
        
        # Generate schedules for each date in range
        current_date = start_date
        while current_date <= end_date:
            # Get day of week (0=Monday, 6=Sunday)
            current_weekday = current_date.weekday()  # 0=Monday, 6=Sunday
            day_name = days[current_weekday]
            
            # Get availability for this day
            day_availability_json = emp.get(day_name)
            if day_availability_json:
                try:
                    day_avail = json.loads(day_availability_json)
                    if day_avail.get('available', False):
                        start_time = day_avail.get('start', '09:00')
                        end_time = day_avail.get('end', '17:00')
                        
                        # Check if schedule already exists for this date
                        conn = get_connection()
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT schedule_id FROM employee_schedule
                            WHERE employee_id = ? AND schedule_date = ?
                        """, (employee_id, current_date.isoformat()))
                        existing = cursor.fetchone()
                        conn.close()
                        
                        if not existing:
                            # Create schedule
                            add_schedule(
                                employee_id=employee_id,
                                schedule_date=current_date.isoformat(),
                                start_time=start_time,
                                end_time=end_time,
                                break_duration=30,  # Default 30 min break
                                notes=f"Auto-generated from availability"
                            )
                            schedules_created += 1
                            total_schedules += 1
                except json.JSONDecodeError:
                    pass  # Skip invalid JSON
            
            # Move to next day
            current_date += timedelta(days=1)
        
        print(f"  ✓ Created {schedules_created} schedule entries")
        print()
    
    print("=" * 70)
    print(f"SUMMARY: Created {total_schedules} schedule entries")
    print("=" * 70)

def main():
    """Generate employee accounts with availability"""
    print("=" * 70)
    print("GENERATING EMPLOYEE ACCOUNTS WITH AVAILABILITY")
    print("=" * 70)
    print()
    
    created_count = 0
    updated_count = 0
    error_count = 0
    
    for emp_data in EMPLOYEES:
        try:
            # Extract availability before creating employee
            availability = emp_data.pop('availability')
            
            # Check if employee already exists
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT employee_id FROM employees WHERE username = ? OR employee_code = ?", 
                          (emp_data['username'], emp_data['username']))
            existing = cursor.fetchone()
            
            if existing:
                employee_id = existing[0]
                print(f"Updating availability for existing employee: {emp_data['first_name']} {emp_data['last_name']} ({emp_data['username']})...")
                conn.close()
                
                # Set availability for existing employee
                set_employee_availability(employee_id, availability)
                
                print(f"  ✓ Updated availability for employee ID: {employee_id}")
                available_days = sum(1 for day, data in availability.items() if data.get('available', False))
                print(f"  ✓ Available {available_days} days per week")
                print()
                updated_count += 1
            else:
                # Create employee directly in database to ensure both username and employee_code are set
                print(f"Creating employee: {emp_data['first_name']} {emp_data['last_name']} ({emp_data['username']})...")
                
                from database import hash_password
                password_hash = hash_password(emp_data['username'])  # Password same as username
                
                cursor.execute("""
                    INSERT INTO employees (
                        username, employee_code, first_name, last_name, email, phone, position, department,
                        date_started, password_hash, hourly_rate, salary, employment_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    emp_data['username'], emp_data['username'],  # Set both username and employee_code
                    emp_data['first_name'], emp_data['last_name'],
                    emp_data['email'], emp_data['phone'],
                    emp_data['position'], emp_data.get('department'),
                    emp_data['date_started'], password_hash,
                    emp_data.get('hourly_rate'), emp_data.get('salary'),
                    emp_data['employment_type']
                ))
                
                employee_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                # Set availability
                set_employee_availability(employee_id, availability)
                
                print(f"  ✓ Created employee ID: {employee_id}")
                print(f"  ✓ Set availability")
                available_days = sum(1 for day, data in availability.items() if data.get('available', False))
                print(f"  ✓ Available {available_days} days per week")
                print()
                created_count += 1
            
        except Exception as e:
            print(f"  ✗ Error processing {emp_data.get('username', 'unknown')}: {e}")
            import traceback
            traceback.print_exc()
            error_count += 1
            print()
    
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"✓ Created: {created_count} employees")
    print(f"✓ Updated availability: {updated_count} employees")
    print(f"✗ Errors: {error_count} employees")
    print()
    print("All employees have their availability set in the system.")
    print("Default password for all accounts: same as username")
    print()
    
    # Generate schedules from availability
    print()
    generate_schedules_from_availability(weeks_ahead=4)
    print("=" * 70)

if __name__ == '__main__':
    main()

