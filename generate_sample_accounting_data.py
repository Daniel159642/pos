#!/usr/bin/env python3
"""
Generate sample accounting data for testing the accounting module
"""

import sqlite3
from datetime import datetime, timedelta
import random

DB_NAME = 'inventory.db'

def generate_sample_data():
    """Generate sample accounting data"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Generating sample accounting data...")
    
    # Get an admin/manager employee for created_by
    cursor.execute("""
        SELECT employee_id FROM employees 
        WHERE position IN ('admin', 'manager') 
        LIMIT 1
    """)
    admin_employee = cursor.fetchone()
    if not admin_employee:
        print("Error: No admin/manager employee found. Please create one first.")
        conn.close()
        return
    created_by = admin_employee[0]
    
    # Get current month start and end dates
    today = datetime.now()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    
    print(f"\nGenerating data for {month_start.strftime('%Y-%m-%d')} to {month_end.strftime('%Y-%m-%d')}...")
    
    # Sample employees for payroll (get existing employees)
    cursor.execute("SELECT employee_id, first_name, last_name, hourly_rate, salary FROM employees LIMIT 5")
    employees = cursor.fetchall()
    
    if employees:
        print(f"\n1. Creating payroll records for {len(employees)} employees...")
        for emp_id, first_name, last_name, hourly_rate, salary in employees:
            # Generate 2-3 payroll records per employee for the month (bi-weekly)
            num_records = 2
            for i in range(num_records):
                if i == 0:
                    pay_start = month_start
                    pay_end = month_start + timedelta(days=13)
                else:
                    pay_start = month_start + timedelta(days=14)
                    pay_end = month_start + timedelta(days=27)
                
                pay_date = pay_end + timedelta(days=2)
                
                # Calculate gross pay
                if hourly_rate:
                    hours_worked = random.uniform(75, 85)  # Bi-weekly hours
                    gross_pay = hours_worked * hourly_rate
                    if hours_worked > 80:
                        # Overtime calculation
                        regular = 80 * hourly_rate
                        overtime = (hours_worked - 80) * hourly_rate * 1.5
                        gross_pay = regular + overtime
                elif salary:
                    gross_pay = salary / 26  # Bi-weekly
                    hours_worked = None
                else:
                    continue
                
                # Calculate taxes (simplified)
                federal_tax = gross_pay * 0.12
                state_tax = gross_pay * 0.05
                ss_tax = min(gross_pay, 160200) * 0.062  # Social Security capped
                medicare_tax = gross_pay * 0.0145
                total_withheld = federal_tax + state_tax + ss_tax + medicare_tax
                net_pay = gross_pay - total_withheld
                
                # Insert payroll record
                cursor.execute("""
                    INSERT OR IGNORE INTO payroll_records (
                        employee_id, pay_period_start, pay_period_end, pay_date,
                        pay_type, hours_worked, hourly_rate, gross_pay,
                        federal_income_tax_withheld, state_income_tax_withheld,
                        social_security_tax_withheld, medicare_tax_withheld,
                        social_security_tax_employer, medicare_tax_employer,
                        federal_unemployment_tax, state_unemployment_tax,
                        net_pay, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    emp_id, pay_start.strftime('%Y-%m-%d'), pay_end.strftime('%Y-%m-%d'),
                    pay_date.strftime('%Y-%m-%d'),
                    'hourly' if hourly_rate else 'salary',
                    hours_worked, hourly_rate, gross_pay,
                    federal_tax, state_tax,
                    ss_tax, medicare_tax,
                    min(gross_pay, 160200) * 0.062, gross_pay * 0.0145,  # Employer matching
                    min(gross_pay, 7000) * 0.006, min(gross_pay, 7000) * 0.03,  # FUTA/SUTA
                    net_pay, created_by
                ))
        print(f"   ✓ Created {len(employees) * num_records} payroll records")
    
    # Generate sample expenses
    print("\n2. Creating sample expenses...")
    expense_categories = [
        ('Rent', 3500.00),
        ('Utilities', 450.00),
        ('Insurance', 650.00),
        ('Office Supplies', 125.50),
        ('Marketing', 850.00),
        ('Bank Fees', 45.00),
        ('Professional Services', 1200.00),
        ('Equipment', 850.00),
        ('Maintenance', 320.00),
        ('Meals & Entertainment', 180.00)
    ]
    
    for category_name, amount in expense_categories:
        # Get category_id
        cursor.execute("SELECT category_id FROM expense_categories WHERE category_name = ?", (category_name,))
        cat_result = cursor.fetchone()
        category_id = cat_result[0] if cat_result else None
        
        # Create 1-2 expense records per category for the month
        num_expenses = random.randint(1, 2)
        for i in range(num_expenses):
            expense_date = month_start + timedelta(days=random.randint(1, 28))
            
            cursor.execute("""
                INSERT OR IGNORE INTO expenses (
                    expense_date, category_id, description, amount,
                    payment_method, created_by
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                expense_date.strftime('%Y-%m-%d'),
                category_id,
                f"{category_name} - {expense_date.strftime('%B %Y')}",
                amount * (0.8 + random.random() * 0.4),  # Vary by ±20%
                random.choice(['credit_card', 'check', 'cash', 'ach']),
                created_by
            ))
    print(f"   ✓ Created {len(expense_categories) * 2} expense records")
    
    # Generate sample sales tax records
    print("\n3. Creating sales tax records...")
    cursor.execute("""
        SELECT order_id, order_date, tax_amount, subtotal
        FROM orders
        WHERE order_date >= ? AND order_date <= ? AND tax_amount > 0
        LIMIT 50
    """, (month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d')))
    
    orders = cursor.fetchall()
    if not orders:
        print("   ⚠ No orders found for the period. Creating sample sales tax records...")
        # Create sample tax records
        for i in range(30):
            transaction_date = month_start + timedelta(days=random.randint(1, 28))
            taxable_amount = random.uniform(100, 2000)
            tax_rate = 0.0875  # 8.75% sample rate
            tax_amount = taxable_amount * tax_rate
            
            cursor.execute("""
                INSERT INTO sales_tax_collected (
                    transaction_date, jurisdiction, tax_rate,
                    taxable_amount, tax_amount, tax_type
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                transaction_date.strftime('%Y-%m-%d'),
                'California',
                tax_rate,
                taxable_amount,
                tax_amount,
                'sales_tax'
            ))
    else:
        for order_id, order_date, tax_amount, subtotal in orders:
            # Check if tax record already exists
            cursor.execute("SELECT COUNT(*) FROM sales_tax_collected WHERE order_id = ?", (order_id,))
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    INSERT INTO sales_tax_collected (
                        order_id, transaction_date, jurisdiction, tax_rate,
                        taxable_amount, tax_amount, tax_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    order_id,
                    order_date.split()[0] if isinstance(order_date, str) else str(order_date),
                    'California',  # Default jurisdiction
                    tax_amount / subtotal if subtotal > 0 else 0.0875,
                    subtotal,
                    tax_amount,
                    'sales_tax'
                ))
        print(f"   ✓ Created sales tax records for {len(orders)} orders")
    
    # Generate sample contractor payments
    print("\n4. Creating contractor payment records...")
    contractors = [
        ('John Smith Consulting', '123-45-6789', '1000.00'),
        ('Jane Doe Marketing', '987-65-4321', '2500.00'),
        ('Tech Solutions Inc', '555-12-3456', '3500.00'),
    ]
    
    tax_year = today.year
    for contractor_name, tin, base_amount in contractors:
        payment_date = month_start + timedelta(days=random.randint(1, 15))
        amount = float(base_amount)
        
        cursor.execute("""
            INSERT OR IGNORE INTO contractor_payments (
                contractor_name, contractor_tin, payment_date,
                payment_amount, tax_year, payment_description, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            contractor_name, tin, payment_date.strftime('%Y-%m-%d'),
            amount, tax_year, f"Monthly services - {payment_date.strftime('%B %Y')}",
            created_by
        ))
    print(f"   ✓ Created {len(contractors)} contractor payment records")
    
    # Update bank account balance (if exists)
    print("\n5. Setting bank account balance...")
    cursor.execute("""
        UPDATE bank_accounts 
        SET current_balance = 25000.00
        WHERE account_name = 'Main Cash Account'
    """)
    if cursor.rowcount > 0:
        print("   ✓ Updated bank account balance to $25,000.00")
    else:
        print("   ⚠ Bank account not found")
    
    conn.commit()
    conn.close()
    
    print("\n" + "="*60)
    print("Sample accounting data generation complete!")
    print("="*60)
    print(f"\nSummary for {month_start.strftime('%B %Y')}:")
    
    # Show summary
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Total payroll
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            SUM(gross_pay) as total_gross,
            SUM(net_pay) as total_net
        FROM payroll_records
        WHERE pay_date >= ? AND pay_date <= ?
    """, (month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d')))
    payroll = cursor.fetchone()
    
    # Total expenses
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            SUM(amount) as total
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
    """, (month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d')))
    expenses = cursor.fetchone()
    
    # Total sales tax
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            SUM(tax_amount) as total
        FROM sales_tax_collected
        WHERE transaction_date >= ? AND transaction_date <= ?
    """, (month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d')))
    sales_tax = cursor.fetchone()
    
    # Revenue from orders
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            SUM(total) as total_revenue
        FROM orders
        WHERE order_date >= ? AND order_date <= ? AND order_status = 'completed'
    """, (month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d')))
    revenue = cursor.fetchone()
    
    print(f"\n📊 Expected Dashboard Numbers:")
    print(f"   Total Revenue:        ${revenue['total_revenue']:,.2f}" if revenue['total_revenue'] else "   Total Revenue:        $0.00")
    print(f"   Total Expenses:       ${expenses['total']:,.2f}" if expenses['total'] else "   Total Expenses:       $0.00")
    print(f"   Total Payroll:        ${payroll['total_gross']:,.2f}" if payroll['total_gross'] else "   Total Payroll:        $0.00")
    print(f"   Tax Collected:        ${sales_tax['total']:,.2f}" if sales_tax['total'] else "   Tax Collected:        $0.00")
    print(f"   Cash Balance:         $25,000.00")
    if revenue and expenses and payroll:
        net_income = (revenue['total_revenue'] or 0) - (expenses['total'] or 0) - (payroll['total_gross'] or 0)
        print(f"   Net Income:           ${net_income:,.2f}")
    
    print(f"\n📋 Records Created:")
    print(f"   Payroll Records:      {payroll['count']}")
    print(f"   Expense Records:      {expenses['count']}")
    print(f"   Sales Tax Records:    {sales_tax['count']}")
    print(f"   Contractor Payments:  3")
    
    conn.close()

if __name__ == '__main__':
    generate_sample_data()
