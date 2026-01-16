#!/usr/bin/env python3
"""
Migration script to add comprehensive accounting system tables
Includes: payroll tracking, tax withholdings, contractor payments, sales tax tracking
"""

import sqlite3
from datetime import datetime

DB_NAME = 'inventory.db'

def migrate():
    """Run the accounting system migration"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Starting accounting system migration...")
    
    # ============================================================================
    # PAYROLL TABLES
    # ============================================================================
    
    # Payroll Records Table (tracks each pay period for each employee)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payroll_records (
            payroll_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            pay_period_start DATE NOT NULL,
            pay_period_end DATE NOT NULL,
            pay_date DATE NOT NULL,
            pay_type TEXT NOT NULL CHECK(pay_type IN ('hourly', 'salary', 'commission', 'bonus')),
            hours_worked REAL DEFAULT 0,
            hourly_rate REAL,
            gross_pay REAL NOT NULL CHECK(gross_pay >= 0),
            federal_income_tax_withheld REAL DEFAULT 0 CHECK(federal_income_tax_withheld >= 0),
            state_income_tax_withheld REAL DEFAULT 0 CHECK(state_income_tax_withheld >= 0),
            local_income_tax_withheld REAL DEFAULT 0 CHECK(local_income_tax_withheld >= 0),
            social_security_tax_withheld REAL DEFAULT 0 CHECK(social_security_tax_withheld >= 0),
            medicare_tax_withheld REAL DEFAULT 0 CHECK(medicare_tax_withheld >= 0),
            social_security_tax_employer REAL DEFAULT 0 CHECK(social_security_tax_employer >= 0),
            medicare_tax_employer REAL DEFAULT 0 CHECK(medicare_tax_employer >= 0),
            federal_unemployment_tax REAL DEFAULT 0 CHECK(federal_unemployment_tax >= 0),
            state_unemployment_tax REAL DEFAULT 0 CHECK(state_unemployment_tax >= 0),
            other_deductions REAL DEFAULT 0 CHECK(other_deductions >= 0),
            net_pay REAL NOT NULL CHECK(net_pay >= 0),
            journal_entry_id INTEGER,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(journal_entry_id),
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    print("✓ Created payroll_records table")
    
    # Tax Withholdings Summary Table (year-to-date totals for W-2 generation)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tax_withholdings_summary (
            summary_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            tax_year INTEGER NOT NULL,
            total_wages REAL NOT NULL DEFAULT 0,
            federal_income_tax_withheld REAL DEFAULT 0,
            state_income_tax_withheld REAL DEFAULT 0,
            local_income_tax_withheld REAL DEFAULT 0,
            social_security_wages REAL DEFAULT 0,
            social_security_tax_withheld REAL DEFAULT 0,
            medicare_wages REAL DEFAULT 0,
            medicare_tax_withheld REAL DEFAULT 0,
            social_security_tax_employer REAL DEFAULT 0,
            medicare_tax_employer REAL DEFAULT 0,
            tips REAL DEFAULT 0,
            dependent_care_benefits REAL DEFAULT 0,
            nonqualified_plans REAL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
            UNIQUE(employee_id, tax_year)
        )
    """)
    print("✓ Created tax_withholdings_summary table")
    
    # Contractor Payments Table (for 1099-NEC generation)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contractor_payments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            contractor_name TEXT NOT NULL,
            contractor_tin TEXT,  -- Tax Identification Number (SSN or EIN)
            contractor_address TEXT,
            contractor_city TEXT,
            contractor_state TEXT,
            contractor_zip TEXT,
            payment_date DATE NOT NULL,
            payment_amount REAL NOT NULL CHECK(payment_amount >= 0),
            payment_description TEXT,
            tax_year INTEGER NOT NULL,
            journal_entry_id INTEGER,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(journal_entry_id),
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    print("✓ Created contractor_payments table")
    
    # Sales Tax Collected Table (tracks sales tax by jurisdiction)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales_tax_collected (
            tax_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            transaction_date DATE NOT NULL,
            jurisdiction TEXT NOT NULL,  -- State, county, city, etc.
            tax_rate REAL NOT NULL CHECK(tax_rate >= 0 AND tax_rate <= 1),
            taxable_amount REAL NOT NULL CHECK(taxable_amount >= 0),
            tax_amount REAL NOT NULL CHECK(tax_amount >= 0),
            tax_type TEXT DEFAULT 'sales_tax' CHECK(tax_type IN ('sales_tax', 'use_tax', 'excise_tax')),
            remittance_period TEXT,  -- 'monthly', 'quarterly', 'annual'
            remitted INTEGER DEFAULT 0 CHECK(remitted IN (0, 1)),
            remitted_date DATE,
            remitted_by INTEGER,
            remittance_reference TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(order_id),
            FOREIGN KEY (remitted_by) REFERENCES employees(employee_id)
        )
    """)
    print("✓ Created sales_tax_collected table")
    
    # Tax Remittances Table (tracks when taxes were paid to authorities)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tax_remittances (
            remittance_id INTEGER PRIMARY KEY AUTOINCREMENT,
            remittance_type TEXT NOT NULL CHECK(remittance_type IN ('sales_tax', 'payroll_tax', 'income_tax')),
            jurisdiction TEXT NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            due_date DATE NOT NULL,
            remittance_date DATE,
            amount_due REAL NOT NULL CHECK(amount_due >= 0),
            amount_paid REAL DEFAULT 0 CHECK(amount_paid >= 0),
            payment_method TEXT,
            payment_reference TEXT,
            form_number TEXT,  -- e.g., '941', '940', 'State Sales Tax Return'
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue', 'filed')),
            filed_by INTEGER,
            filed_date TIMESTAMP,
            journal_entry_id INTEGER,
            notes TEXT,
            FOREIGN KEY (filed_by) REFERENCES employees(employee_id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(journal_entry_id)
        )
    """)
    print("✓ Created tax_remittances table")
    
    # Expense Categories Table (for expense tracking)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expense_categories (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name TEXT UNIQUE NOT NULL,
            account_id INTEGER,  -- Links to chart_of_accounts
            description TEXT,
            is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES chart_of_accounts(account_id)
        )
    """)
    print("✓ Created expense_categories table")
    
    # Expenses Table (tracks business expenses)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_date DATE NOT NULL,
            category_id INTEGER,
            vendor_id INTEGER,
            description TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            payment_method TEXT CHECK(payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'ach', 'wire')),
            receipt_path TEXT,
            account_id INTEGER,  -- Links to chart_of_accounts expense account
            journal_entry_id INTEGER,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (category_id) REFERENCES expense_categories(category_id),
            FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
            FOREIGN KEY (account_id) REFERENCES chart_of_accounts(account_id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(journal_entry_id),
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    print("✓ Created expenses table")
    
    # Bank Accounts Table (for cash reconciliation)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bank_accounts (
            account_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_name TEXT NOT NULL,
            account_type TEXT NOT NULL CHECK(account_type IN ('checking', 'savings', 'credit_card', 'petty_cash')),
            bank_name TEXT,
            account_number_last_four TEXT,
            routing_number TEXT,
            opening_balance REAL DEFAULT 0,
            current_balance REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✓ Created bank_accounts table")
    
    # Bank Reconciliation Table (tracks reconciliation of bank statements)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bank_reconciliations (
            reconciliation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            statement_date DATE NOT NULL,
            statement_balance REAL NOT NULL,
            beginning_balance REAL NOT NULL,
            ending_balance REAL NOT NULL,
            deposits_in_transit REAL DEFAULT 0,
            outstanding_checks REAL DEFAULT 0,
            bank_charges REAL DEFAULT 0,
            bank_interest REAL DEFAULT 0,
            adjusted_balance REAL NOT NULL,
            book_balance REAL NOT NULL,
            reconciled_by INTEGER NOT NULL,
            reconciled_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (account_id) REFERENCES bank_accounts(account_id),
            FOREIGN KEY (reconciled_by) REFERENCES employees(employee_id)
        )
    """)
    print("✓ Created bank_reconciliations table")
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_records(employee_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(pay_period_start, pay_period_end)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tax_withholdings_employee_year ON tax_withholdings_summary(employee_id, tax_year)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contractor_payments_year ON contractor_payments(tax_year)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contractor_payments_tin ON contractor_payments(contractor_tin)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_tax_date ON sales_tax_collected(transaction_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_tax_jurisdiction ON sales_tax_collected(jurisdiction)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_tax_remitted ON sales_tax_collected(remitted)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tax_remittances_type ON tax_remittances(remittance_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tax_remittances_period ON tax_remittances(period_start, period_end)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account ON bank_reconciliations(account_id)")
    
    # Insert default expense categories
    default_categories = [
        ('Rent', 6100),  # Links to Rent Expense account
        ('Utilities', 6200),
        ('Insurance', 6300),
        ('Office Supplies', 6400),
        ('Marketing', 6600),
        ('Bank Fees', 6700),
        ('Professional Services', None),
        ('Travel', None),
        ('Meals & Entertainment', None),
        ('Equipment', None),
        ('Maintenance', None),
    ]
    
    for category_name, account_number in default_categories:
        account_id = None
        if account_number:
            cursor.execute("SELECT account_id FROM chart_of_accounts WHERE account_number = ?", (account_number,))
            result = cursor.fetchone()
            if result:
                account_id = result[0]
        
        cursor.execute("""
            INSERT OR IGNORE INTO expense_categories (category_name, account_id)
            VALUES (?, ?)
        """, (category_name, account_id))
    
    print("✓ Inserted default expense categories")
    
    # Create default bank account (Cash)
    cursor.execute("""
        INSERT OR IGNORE INTO bank_accounts (account_name, account_type, bank_name)
        VALUES ('Main Cash Account', 'checking', 'Primary Bank')
    """)
    print("✓ Created default bank account")
    
    conn.commit()
    conn.close()
    
    print("\n✓ Accounting system migration completed successfully!")
    print("\nNew tables created:")
    print("  - payroll_records")
    print("  - tax_withholdings_summary")
    print("  - contractor_payments")
    print("  - sales_tax_collected")
    print("  - tax_remittances")
    print("  - expense_categories")
    print("  - expenses")
    print("  - bank_accounts")
    print("  - bank_reconciliations")

if __name__ == '__main__':
    migrate()
