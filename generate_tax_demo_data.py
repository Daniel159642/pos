#!/usr/bin/env python3
"""
Generate comprehensive demo data for tax document generation
Creates a full year of payroll, expenses, sales, and contractor payments
Perfect for demonstrating W-2, 1099-NEC, Sales Tax Returns, Form 941, Form 940
"""

import sqlite3
from datetime import datetime, timedelta
import random

DB_NAME = 'inventory.db'

def generate_tax_demo_data():
    """Generate a full year of data for tax document demos"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("="*70)
    print("GENERATING COMPREHENSIVE TAX DEMO DATA")
    print("="*70)
    print("\nThis will generate a full year of accounting data for tax document demos.")
    print("Includes: Payroll, Sales, Expenses, Contractor Payments, Sales Tax\n")
    
    # Get admin employee
    cursor.execute("""
        SELECT employee_id FROM employees 
        WHERE position IN ('admin', 'manager') 
        LIMIT 1
    """)
    admin_emp = cursor.fetchone()
    if not admin_emp:
        print("Error: Need at least one admin/manager employee to create data.")
        print("Please create an admin employee first.")
        conn.close()
        return
    created_by = admin_emp[0]
    
    # Get all employees
    cursor.execute("""
        SELECT employee_id, first_name, last_name, hourly_rate, salary 
        FROM employees 
        WHERE active = 1
        LIMIT 10
    """)
    employees = cursor.fetchall()
    
    if not employees:
        print("Error: No active employees found. Please add employees first.")
        conn.close()
        return
    
    current_year = datetime.now().year
    year_start = datetime(current_year, 1, 1)
    
    print(f"Tax Year: {current_year}")
    print(f"Employees: {len(employees)}")
    print("\nGenerating data...\n")
    
    # ============================================================================
    # 1. GENERATE FULL YEAR OF PAYROLL (Bi-weekly for each employee)
    # ============================================================================
    print("1. Creating payroll records (bi-weekly for each employee)...")
    payroll_count = 0
    
    for emp_id, first_name, last_name, hourly_rate, salary in employees:
        if not hourly_rate and not salary:
            continue
        
        # Generate 26 pay periods (bi-weekly for full year)
        for period in range(26):
            pay_start = year_start + timedelta(days=period * 14)
            pay_end = pay_start + timedelta(days=13)
            pay_date = pay_end + timedelta(days=2)
            
            # Calculate gross pay
            if hourly_rate:
                hours = random.uniform(75, 85)
                if hours > 80:
                    # Overtime calculation
                    regular = 80 * hourly_rate
                    overtime = (hours - 80) * hourly_rate * 1.5
                    gross_pay = regular + overtime
                else:
                    gross_pay = hours * hourly_rate
                hours_worked = hours
            else:
                gross_pay = salary / 26  # Bi-weekly salary
                hours_worked = None
            
            # Calculate taxes (realistic rates)
            federal_tax = gross_pay * 0.12  # 12% federal withholding
            state_tax = gross_pay * 0.05    # 5% state withholding
            ss_wage_base = 160200.0
            ss_wages = min(gross_pay, max(0, ss_wage_base - (gross_pay * period)))
            social_security_tax = ss_wages * 0.062 if ss_wages > 0 else 0
            medicare_tax = gross_pay * 0.0145
            
            # Employer taxes
            ss_employer = ss_wages * 0.062 if ss_wages > 0 else 0
            medicare_employer = gross_pay * 0.0145
            futa_tax = min(gross_pay, 7000.0) * 0.006  # FUTA on first $7,000
            suta_tax = min(gross_pay, 7000.0) * 0.03   # SUTA on first $7,000
            
            net_pay = gross_pay - (federal_tax + state_tax + social_security_tax + medicare_tax)
            
            try:
                cursor.execute("""
                    INSERT INTO payroll_records (
                        employee_id, pay_period_start, pay_period_end, pay_date,
                        pay_type, hours_worked, hourly_rate, gross_pay,
                        federal_income_tax_withheld, state_income_tax_withheld,
                        social_security_tax_withheld, medicare_tax_withheld,
                        social_security_tax_employer, medicare_tax_employer,
                        federal_unemployment_tax, state_unemployment_tax,
                        net_pay, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    emp_id, 
                    pay_start.strftime('%Y-%m-%d'), 
                    pay_end.strftime('%Y-%m-%d'),
                    pay_date.strftime('%Y-%m-%d'), 
                    'hourly' if hourly_rate else 'salary',
                    hours_worked, hourly_rate, gross_pay, 
                    federal_tax, state_tax, 
                    social_security_tax, medicare_tax,
                    ss_employer, medicare_employer,
                    futa_tax, suta_tax,
                    net_pay, created_by
                ))
                payroll_count += 1
            except sqlite3.Error as e:
                print(f"   Warning: Error creating payroll for employee {emp_id}, period {period}: {e}")
    
    print(f"   ✓ Created {payroll_count} payroll records")
    
    # ============================================================================
    # 2. GENERATE SALES/ORDERS WITH TAX
    # ============================================================================
    print("\n2. Creating sales orders with tax...")
    
    # Ensure products have sufficient inventory (set to 1000 for demo)
    print("   Setting inventory quantities for demo...")
    cursor.execute("UPDATE inventory SET current_quantity = 1000 WHERE current_quantity < 1000")
    updated_count = cursor.rowcount
    if updated_count > 0:
        print(f"   ✓ Updated {updated_count} products to have sufficient inventory")
    
    # Get products
    cursor.execute("SELECT product_id, product_price FROM inventory LIMIT 20")
    products = cursor.fetchall()
    
    if not products:
        print("   ⚠ Warning: No products found. Skipping sales orders.")
        sales_count = 0
    else:
        # Get cashiers
        cursor.execute("SELECT employee_id FROM employees WHERE position IN ('cashier', 'manager', 'admin') LIMIT 5")
        cashiers = [row[0] for row in cursor.fetchall()]
        
        if not cashiers:
            cashiers = [created_by]
        
        sales_count = 0
        tax_rate = 0.0875  # 8.75% sales tax
        
        # Generate sales for each month
        for month in range(1, 13):
            month_start = datetime(current_year, month, 1)
            if month == 12:
                month_end = datetime(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = datetime(current_year, month + 1, 1) - timedelta(days=1)
            
            days_in_month = month_end.day
            # 3-5 sales per day = 90-150 sales per month
            num_sales = random.randint(90, 150)
            
            for i in range(num_sales):
                # Random day in month
                day = random.randint(1, days_in_month)
                sale_date = datetime(current_year, month, day)
                # Random time during business hours (9 AM - 8 PM)
                hour = random.randint(9, 20)
                minute = random.randint(0, 59)
                sale_datetime = sale_date.replace(hour=hour, minute=minute)
                
                # Create order with 1-5 items
                num_items = random.randint(1, 5)
                subtotal = 0
                
                order_number = f"ORD-{current_year}{month:02d}{day:02d}-{i+1:04d}"
                
                try:
                    # Create order
                    cursor.execute("""
                        INSERT INTO orders (
                            order_number, order_date, employee_id, subtotal,
                            tax_rate, tax_amount, total, payment_method, 
                            payment_status, order_status
                        ) VALUES (?, ?, ?, 0, ?, 0, 0, ?, 'completed', 'completed')
                    """, (
                        order_number, 
                        sale_datetime.strftime('%Y-%m-%d %H:%M:%S'),
                        random.choice(cashiers), 
                        tax_rate, 
                        random.choice(['cash', 'credit_card', 'debit_card', 'mobile_payment'])
                    ))
                    
                    order_id = cursor.lastrowid
                    
                    # Create order items
                    for item_num in range(num_items):
                        prod_id, price = random.choice(products)
                        qty = random.randint(1, 3)
                        item_subtotal = price * qty
                        item_tax = item_subtotal * tax_rate
                        subtotal += item_subtotal
                        
                        cursor.execute("""
                            INSERT INTO order_items (
                                order_id, product_id, quantity, unit_price, 
                                subtotal, tax_rate, tax_amount
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (order_id, prod_id, qty, price, item_subtotal, tax_rate, item_tax))
                    
                    # Update order totals
                    tax_amount = subtotal * tax_rate
                    total = subtotal + tax_amount
                    
                    cursor.execute("""
                        UPDATE orders 
                        SET subtotal = ?, tax_amount = ?, total = ?
                        WHERE order_id = ?
                    """, (subtotal, tax_amount, total, order_id))
                    
                    # Record sales tax
                    cursor.execute("""
                        INSERT INTO sales_tax_collected (
                            order_id, transaction_date, jurisdiction, tax_rate, 
                            taxable_amount, tax_amount, tax_type
                        ) VALUES (?, ?, 'California', ?, ?, ?, 'sales_tax')
                    """, (
                        order_id, 
                        sale_date.strftime('%Y-%m-%d'), 
                        tax_rate, 
                        subtotal, 
                        tax_amount
                    ))
                    
                    sales_count += 1
                except sqlite3.Error as e:
                    print(f"   Warning: Error creating order {order_number}: {e}")
    
    print(f"   ✓ Created {sales_count} sales orders with tax")
    
    # ============================================================================
    # 3. GENERATE EXPENSES (Monthly for each category)
    # ============================================================================
    print("\n3. Creating business expenses...")
    
    cursor.execute("SELECT category_id, category_name FROM expense_categories WHERE is_active = 1")
    categories = cursor.fetchall()
    
    expense_amounts = {
        'Rent': 3500.00,
        'Utilities': 450.00,
        'Insurance': 650.00,
        'Marketing': 850.00,
        'Office Supplies': 125.50,
        'Professional Services': 1200.00,
        'Equipment': 850.00,
        'Maintenance': 320.00,
        'Meals & Entertainment': 180.00,
    }
    
    expense_count = 0
    for month in range(1, 13):
        for category_id, category_name in categories:
            amount = expense_amounts.get(category_name, random.uniform(100, 500))
            # Vary amount by ±20%
            amount = amount * (0.8 + random.random() * 0.4)
            
            expense_date = datetime(current_year, month, random.randint(1, 28))
            
            try:
                cursor.execute("""
                    INSERT INTO expenses (
                        expense_date, category_id, description, amount, 
                        payment_method, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    expense_date.strftime('%Y-%m-%d'), 
                    category_id, 
                    f"{category_name} - {expense_date.strftime('%B %Y')}", 
                    round(amount, 2),
                    random.choice(['credit_card', 'check', 'cash', 'ach']), 
                    created_by
                ))
                expense_count += 1
            except sqlite3.Error as e:
                print(f"   Warning: Error creating expense: {e}")
    
    print(f"   ✓ Created {expense_count} expense records")
    
    # ============================================================================
    # 4. GENERATE CONTRACTOR PAYMENTS (For 1099-NEC)
    # ============================================================================
    print("\n4. Creating contractor payments (for 1099-NEC)...")
    
    contractors = [
        ('John Smith Consulting', '123-45-6789', '1000.00'),
        ('Jane Doe Marketing', '987-65-4321', '2500.00'),
        ('Tech Solutions Inc', '555-12-3456', '3500.00'),
        ('Legal Services LLC', '111-22-3333', '2000.00'),
        ('Accounting Pro Services', '444-55-6666', '1500.00'),
    ]
    
    contractor_count = 0
    for contractor_name, tin, base_amount in contractors:
        # Monthly payments (12 months)
        for month in range(1, 13):
            payment_date = datetime(current_year, month, 15)
            amount = float(base_amount)
            
            try:
                cursor.execute("""
                    INSERT INTO contractor_payments (
                        contractor_name, contractor_tin, payment_date,
                        payment_amount, tax_year, payment_description, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    contractor_name, tin, 
                    payment_date.strftime('%Y-%m-%d'),
                    amount, current_year, 
                    f"Monthly services - {payment_date.strftime('%B %Y')}", 
                    created_by
                ))
                contractor_count += 1
            except sqlite3.Error as e:
                print(f"   Warning: Error creating contractor payment: {e}")
    
    print(f"   ✓ Created {contractor_count} contractor payment records")
    
    # ============================================================================
    # 5. UPDATE BANK ACCOUNT BALANCE (Realistic amount)
    # ============================================================================
    print("\n5. Setting bank account balance...")
    
    cursor.execute("SELECT account_id FROM bank_accounts WHERE account_name = 'Main Cash Account'")
    account = cursor.fetchone()
    
    if account:
        # Set realistic balance based on sales
        estimated_balance = sales_count * 150  # Rough estimate
        cursor.execute("""
            UPDATE bank_accounts 
            SET current_balance = ?
            WHERE account_id = ?
        """, (estimated_balance, account[0]))
        print(f"   ✓ Updated bank account balance to ${estimated_balance:,.2f}")
    else:
        print("   ⚠ Bank account not found, creating default...")
        cursor.execute("""
            INSERT INTO bank_accounts (account_name, account_type, bank_name, current_balance)
            VALUES ('Main Cash Account', 'checking', 'Primary Bank', 0)
        """)
    
    # ============================================================================
    # COMMIT ALL CHANGES
    # ============================================================================
    conn.commit()
    conn.close()
    
    # ============================================================================
    # SUMMARY
    # ============================================================================
    print("\n" + "="*70)
    print("TAX DEMO DATA GENERATION COMPLETE!")
    print("="*70)
    print(f"\nSummary for Tax Year {current_year}:")
    print(f"   • Payroll Records: {payroll_count:,} (26 periods × {len(employees)} employees)")
    print(f"   • Sales Orders: {sales_count:,} (with sales tax)")
    print(f"   • Expense Records: {expense_count:,}")
    print(f"   • Contractor Payments: {contractor_count:,} (5 contractors × 12 months)")
    print(f"\n📋 You can now generate:")
    print(f"   • W-2 forms for {len(employees)} employees")
    print(f"   • 1099-NEC forms for {len(contractors)} contractors")
    print(f"   • Sales Tax Returns (quarterly/monthly)")
    print(f"   • Form 941 (Quarterly Federal Tax Return)")
    print(f"   • Form 940 (Federal Unemployment Tax)")
    print(f"   • Complete financial statements (Income Statement, Balance Sheet, Cash Flow)")
    print("\n💰 Estimated Annual Totals:")
    
    # Calculate estimated totals
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            SUM(gross_pay) as total_payroll,
            COUNT(*) as payroll_records
        FROM payroll_records
        WHERE strftime('%Y', pay_date) = ?
    """, (str(current_year),))
    payroll_stats = cursor.fetchone()
    
    cursor.execute("""
        SELECT 
            SUM(total) as total_revenue,
            SUM(tax_amount) as total_tax
        FROM orders
        WHERE strftime('%Y', order_date) = ? AND order_status = 'completed'
    """, (str(current_year),))
    revenue_stats = cursor.fetchone()
    
    cursor.execute("""
        SELECT SUM(amount) as total_expenses
        FROM expenses
        WHERE strftime('%Y', expense_date) = ?
    """, (str(current_year),))
    expense_stats = cursor.fetchone()
    
    cursor.execute("""
        SELECT SUM(payment_amount) as total_contractors
        FROM contractor_payments
        WHERE tax_year = ?
    """, (current_year,))
    contractor_stats = cursor.fetchone()
    
    conn.close()
    
    print(f"   • Total Payroll: ${payroll_stats[0] or 0:,.2f}")
    print(f"   • Total Revenue: ${revenue_stats[0] or 0:,.2f}")
    print(f"   • Total Expenses: ${expense_stats[0] or 0:,.2f}")
    print(f"   • Sales Tax Collected: ${revenue_stats[1] or 0:,.2f}")
    print(f"   • Contractor Payments: ${contractor_stats[0] or 0:,.2f}")
    
    net_income = (revenue_stats[0] or 0) - (expense_stats[0] or 0) - (payroll_stats[0] or 0)
    print(f"   • Estimated Net Income: ${net_income:,.2f}")
    
    print("\n✅ All data is ready for tax document generation!")

if __name__ == '__main__':
    try:
        generate_tax_demo_data()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()
