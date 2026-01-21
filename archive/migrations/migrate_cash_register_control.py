#!/usr/bin/env python3
"""
Migration script to add cash register control system
Creates tables for register sessions, cash transactions, and reconciliation
"""

import sqlite3
import sys

DB_NAME = 'inventory.db'

def migrate():
    """Add cash register control tables"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if cash_register_sessions table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='cash_register_sessions'
        """)
        if cursor.fetchone():
            print("cash_register_sessions table already exists")
        else:
            print("Creating cash_register_sessions table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cash_register_sessions (
                    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    register_id INTEGER DEFAULT 1,
                    employee_id INTEGER NOT NULL,
                    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    closed_at TIMESTAMP,
                    starting_cash REAL NOT NULL DEFAULT 0 CHECK(starting_cash >= 0),
                    ending_cash REAL,
                    expected_cash REAL,
                    cash_sales REAL DEFAULT 0,
                    cash_refunds REAL DEFAULT 0,
                    cash_in REAL DEFAULT 0,
                    cash_out REAL DEFAULT 0,
                    discrepancy REAL DEFAULT 0,
                    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'reconciled')),
                    notes TEXT,
                    closed_by INTEGER,
                    reconciled_by INTEGER,
                    reconciled_at TIMESTAMP,
                    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
                    FOREIGN KEY (closed_by) REFERENCES employees(employee_id),
                    FOREIGN KEY (reconciled_by) REFERENCES employees(employee_id)
                )
            """)
            print("✓ Created cash_register_sessions table")
        
        # Check if cash_transactions table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='cash_transactions'
        """)
        if cursor.fetchone():
            print("cash_transactions table already exists")
        else:
            print("Creating cash_transactions table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cash_transactions (
                    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('cash_in', 'cash_out', 'deposit', 'withdrawal', 'adjustment')),
                    amount REAL NOT NULL CHECK(amount > 0),
                    reason TEXT,
                    employee_id INTEGER NOT NULL,
                    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notes TEXT,
                    FOREIGN KEY (session_id) REFERENCES cash_register_sessions(session_id),
                    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
                )
            """)
            print("✓ Created cash_transactions table")
        
        # Create indexes
        print("Creating indexes...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_register_sessions_employee 
            ON cash_register_sessions(employee_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_register_sessions_status 
            ON cash_register_sessions(status)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_register_sessions_opened 
            ON cash_register_sessions(opened_at)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_cash_transactions_session 
            ON cash_transactions(session_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_cash_transactions_date 
            ON cash_transactions(transaction_date)
        """)
        print("✓ Created indexes")
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
