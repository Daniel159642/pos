#!/usr/bin/env python3
"""
Migration: Add SMS CRM tables with Email-to-AWS migration path
Starts with FREE email-to-SMS, easy migration to AWS SNS
"""

import sqlite3
import os

DB_NAME = 'inventory.db'

def migrate_sms_crm_email_to_aws():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Stores Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stores (
            store_id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_name TEXT NOT NULL,
            store_code TEXT UNIQUE,
            address TEXT,
            phone TEXT,
            email TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # SMS Settings - Email-first, AWS-ready
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sms_settings (
            setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER,
            
            -- Provider selection (start with 'email', migrate to 'aws_sns')
            sms_provider TEXT DEFAULT 'email' CHECK(sms_provider IN ('email', 'aws_sns', 'twilio', 'vonage', 'textbelt')),
            
            -- Email-to-SMS Settings (FREE - starting point)
            smtp_server TEXT DEFAULT 'smtp.gmail.com',
            smtp_port INTEGER DEFAULT 587,
            smtp_user TEXT,  -- Store's email address
            smtp_password TEXT,  -- App password for Gmail
            smtp_use_tls INTEGER DEFAULT 1,
            
            -- AWS SNS Settings (for migration later)
            aws_access_key_id TEXT,
            aws_secret_access_key TEXT,
            aws_region TEXT DEFAULT 'us-east-1',
            aws_phone_number TEXT,  -- Optional: dedicated AWS number
            
            -- Twilio (optional future)
            twilio_account_sid TEXT,
            twilio_auth_token TEXT,
            twilio_phone_number TEXT,
            
            -- General settings
            business_name TEXT,
            store_phone_number TEXT,  -- Store's phone number (for email-to-SMS)
            
            -- Auto-send settings
            auto_send_rewards_earned INTEGER DEFAULT 1,
            auto_send_rewards_redeemed INTEGER DEFAULT 1,
            auto_send_birthday INTEGER DEFAULT 0,
            auto_send_order_confirmation INTEGER DEFAULT 0,
            
            -- Compliance
            opt_out_keyword TEXT DEFAULT 'STOP',
            is_active INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(store_id)
        )
    """)
    
    # SMS Messages
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sms_messages (
            message_id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER,
            customer_id INTEGER,
            phone_number TEXT NOT NULL,
            message_text TEXT NOT NULL,
            direction TEXT NOT NULL CHECK(direction IN ('outbound', 'inbound')),
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'received')),
            message_type TEXT DEFAULT 'manual' CHECK(message_type IN ('manual', 'rewards_earned', 'rewards_redeemed', 'birthday', 'promotion', 'campaign', 'order_confirmation')),
            provider TEXT,  -- 'email', 'aws_sns', etc.
            provider_sid TEXT,  -- Provider message ID
            error_message TEXT,
            sent_at TIMESTAMP,
            delivered_at TIMESTAMP,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(store_id),
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    
    # SMS Templates
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sms_templates (
            template_id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER,
            template_name TEXT NOT NULL,
            template_text TEXT NOT NULL,
            category TEXT DEFAULT 'rewards' CHECK(category IN ('rewards', 'promotion', 'reminder', 'custom')),
            variables TEXT,  -- JSON: ["customer_name", "points", "reward_name"]
            is_active INTEGER DEFAULT 1,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(store_id),
            FOREIGN KEY (created_by) REFERENCES employees(employee_id)
        )
    """)
    
    # SMS Opt-Outs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sms_opt_outs (
            opt_out_id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL,
            customer_id INTEGER,
            store_id INTEGER,
            opted_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
            FOREIGN KEY (store_id) REFERENCES stores(store_id),
            UNIQUE(phone_number, store_id)
        )
    """)
    
    # Add store_id to customers if needed
    try:
        cursor.execute("ALTER TABLE customers ADD COLUMN store_id INTEGER")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id)")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Add store_id to orders if needed
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN store_id INTEGER")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id)")
    except sqlite3.OperationalError:
        pass
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_settings_store ON sms_settings(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_messages_store ON sms_messages(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_messages_customer ON sms_messages(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_messages_provider ON sms_messages(provider)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_templates_store ON sms_templates(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone_store ON sms_opt_outs(phone_number, store_id)")
    
    # Insert default store if none exists
    cursor.execute("SELECT COUNT(*) FROM stores")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO stores (store_name, store_code) 
            VALUES ('Main Store', 'MAIN')
        """)
        store_id = cursor.lastrowid
        # Create default SMS settings with email provider
        cursor.execute("""
            INSERT INTO sms_settings (store_id, sms_provider, smtp_server, smtp_port)
            VALUES (?, 'email', 'smtp.gmail.com', 587)
        """, (store_id,))
        
        # Insert default rewards templates
        cursor.execute("""
            INSERT INTO sms_templates (store_id, template_name, template_text, category)
            VALUES 
            (?, 'Rewards Earned', 'Hi {customer_name}! You earned {points_earned} points! You now have {total_points} total points. Thanks for shopping with us!', 'rewards'),
            (?, 'Rewards Redeemed', 'Hi {customer_name}! You redeemed {points_used} points for {reward_name}. You have {remaining_points} points remaining.', 'rewards')
        """, (store_id, store_id))
    
    conn.commit()
    conn.close()
    print("✅ SMS CRM tables created successfully!")
    print("\n📧 Starting with FREE email-to-SMS")
    print("🚀 Easy migration to AWS SNS when ready")
    print("\nNext steps:")
    print("1. Configure email settings in SMS Settings page")
    print("2. Test sending SMS")
    print("3. When ready, migrate to AWS SNS for better reliability")

if __name__ == '__main__':
    migrate_sms_crm_email_to_aws()
