"""
Migration script for Customer Display System
Adds tables for transactions, payments, and customer display settings
"""

import sqlite3
import json
from datetime import datetime

def migrate_customer_display(db_path='inventory.db'):
    """Add customer display system tables to the database"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Payment Methods Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_methods (
                payment_method_id INTEGER PRIMARY KEY AUTOINCREMENT,
                method_name TEXT NOT NULL,
                method_type TEXT NOT NULL CHECK(method_type IN ('card', 'cash', 'mobile_wallet', 'gift_card', 'check', 'store_credit')),
                is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
                requires_terminal INTEGER DEFAULT 0 CHECK(requires_terminal IN (0, 1)),
                icon_path TEXT,
                display_order INTEGER DEFAULT 0
            )
        """)
        
        # Transactions Table (enhanced version of orders)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_number TEXT UNIQUE NOT NULL,
                employee_id INTEGER,
                customer_id INTEGER,
                subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
                tax REAL NOT NULL DEFAULT 0 CHECK(tax >= 0),
                discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
                tip REAL NOT NULL DEFAULT 0 CHECK(tip >= 0),
                total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
                payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
                FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
            )
        """)
        
        # Transaction Items Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transaction_items (
                item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL CHECK(quantity > 0),
                unit_price REAL NOT NULL CHECK(unit_price >= 0),
                discount REAL DEFAULT 0 CHECK(discount >= 0),
                subtotal REAL NOT NULL CHECK(subtotal >= 0),
                FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES inventory(product_id)
            )
        """)
        
        # Payments Table (can have multiple payments per transaction - split payments)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                payment_method_id INTEGER NOT NULL,
                amount REAL NOT NULL CHECK(amount >= 0),
                card_last_four TEXT,
                card_type TEXT,
                authorization_code TEXT,
                terminal_id TEXT,
                payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'approved', 'declined', 'cancelled')),
                processed_at TIMESTAMP,
                FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
                FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)
            )
        """)
        
        # Receipt Preferences Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS receipt_preferences (
                preference_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                receipt_type TEXT NOT NULL CHECK(receipt_type IN ('printed', 'email', 'sms', 'none')),
                email_address TEXT,
                phone_number TEXT,
                sent INTEGER DEFAULT 0 CHECK(sent IN (0, 1)),
                sent_at TIMESTAMP,
                FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
            )
        """)
        
        # Customer Display Settings Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_display_settings (
                setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_location TEXT,
                show_promotions INTEGER DEFAULT 1 CHECK(show_promotions IN (0, 1)),
                show_survey_prompt INTEGER DEFAULT 1 CHECK(show_survey_prompt IN (0, 1)),
                show_loyalty_signup INTEGER DEFAULT 1 CHECK(show_loyalty_signup IN (0, 1)),
                tip_enabled INTEGER DEFAULT 0 CHECK(tip_enabled IN (0, 1)),
                tip_after_payment INTEGER DEFAULT 0 CHECK(tip_after_payment IN (0, 1)),
                tip_suggestions TEXT,  -- JSON array: [15, 18, 20, 25]
                idle_screen_content TEXT,
                branding_logo_path TEXT,
                theme_color TEXT DEFAULT '#4CAF50',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Customer Display Sessions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_display_sessions (
                session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                session_end TIMESTAMP,
                actions_taken TEXT,  -- JSON array of actions
                FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
            )
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_employee ON transactions(employee_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_receipt_preferences_transaction ON receipt_preferences(transaction_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_display_sessions_transaction ON customer_display_sessions(transaction_id)")
        
        # Insert default payment methods
        default_payment_methods = [
            ('Card', 'card', 1, 1, 1),  # Consolidated: Credit Card, Debit Card, Apple Pay, Google Pay, Samsung Pay
            ('Cash', 'cash', 1, 0, 2),
            ('Gift Card', 'gift_card', 1, 0, 3),
            ('Store Credit', 'store_credit', 1, 0, 4)
        ]
        
        cursor.executemany("""
            INSERT OR IGNORE INTO payment_methods 
            (method_name, method_type, is_active, requires_terminal, display_order)
            VALUES (?, ?, ?, ?, ?)
        """, default_payment_methods)
        
        # Insert default customer display settings
        tip_suggestions = json.dumps([15, 18, 20, 25])
        cursor.execute("""
            INSERT OR IGNORE INTO customer_display_settings 
            (store_location, tip_enabled, tip_suggestions, theme_color)
            VALUES (?, ?, ?, ?)
        """, ('Main Store', 0, tip_suggestions, '#4CAF50'))
        
        conn.commit()
        print("✓ Customer display system tables created successfully")
        print("✓ Default payment methods inserted")
        print("✓ Default display settings inserted")
        
    except sqlite3.Error as e:
        print(f"Error creating customer display tables: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_customer_display()
    print("Migration completed!")

