#!/usr/bin/env python3
"""
Migration script to create Stripe integration tables for hybrid payment processing
Supports: Stripe Connect, Direct API keys, and Cash-only mode
"""

import sqlite3
from database import get_connection, DB_NAME

def migrate_stripe_integration():
    """Create Stripe integration tables"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if stripe_accounts table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='stripe_accounts'
        """)
        
        if cursor.fetchone():
            print("stripe_accounts table already exists")
        else:
            # Create stripe_accounts table (for Stripe Connect)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stripe_accounts (
                    stripe_account_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    store_id INTEGER,  -- For multi-store support (NULL for single store)
                    stripe_account_type TEXT NOT NULL CHECK(stripe_account_type IN ('standard', 'express', 'custom')),
                    stripe_connected_account_id TEXT UNIQUE,  -- Stripe's connected account ID (acct_xxx)
                    stripe_publishable_key TEXT,
                    stripe_access_token_encrypted TEXT,  -- Encrypted access token
                    stripe_refresh_token_encrypted TEXT,  -- Encrypted refresh token
                    onboarding_completed INTEGER DEFAULT 0 CHECK(onboarding_completed IN (0, 1)),
                    onboarding_link TEXT,  -- Stripe onboarding link
                    onboarding_link_expires_at TIMESTAMP,
                    charges_enabled INTEGER DEFAULT 0 CHECK(charges_enabled IN (0, 1)),
                    payouts_enabled INTEGER DEFAULT 0 CHECK(payouts_enabled IN (0, 1)),
                    country TEXT,
                    email TEXT,
                    business_type TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✓ Created stripe_accounts table")
        
        # Check if stripe_credentials table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='stripe_credentials'
        """)
        
        if cursor.fetchone():
            print("stripe_credentials table already exists")
        else:
            # Create stripe_credentials table (for Direct API keys)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stripe_credentials (
                    credential_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    store_id INTEGER,  -- For multi-store support (NULL for single store)
                    stripe_publishable_key TEXT NOT NULL,
                    stripe_secret_key_encrypted TEXT NOT NULL,  -- MUST be encrypted!
                    webhook_secret_encrypted TEXT,  -- For webhook verification
                    test_mode INTEGER DEFAULT 0 CHECK(test_mode IN (0, 1)),  -- 1 for test keys, 0 for live
                    verified INTEGER DEFAULT 0 CHECK(verified IN (0, 1)),  -- Verified that keys work
                    last_verified_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✓ Created stripe_credentials table")
        
        # Check if payment_settings table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='payment_settings'
        """)
        
        if cursor.fetchone():
            print("payment_settings table already exists")
        else:
            # Create payment_settings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS payment_settings (
                    setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    store_id INTEGER,  -- For multi-store support (NULL for single store)
                    payment_processor TEXT DEFAULT 'cash_only' CHECK(payment_processor IN ('stripe_connect', 'stripe_direct', 'square', 'paypal', 'cash_only')),
                    stripe_account_id INTEGER,  -- FK to stripe_accounts (for Connect)
                    stripe_credential_id INTEGER,  -- FK to stripe_credentials (for Direct)
                    default_currency TEXT DEFAULT 'usd',
                    transaction_fee_rate REAL DEFAULT 0.029,  -- 2.9% default
                    transaction_fee_fixed REAL DEFAULT 0.30,  -- $0.30 fixed
                    enabled_payment_methods TEXT DEFAULT '["cash"]',  -- JSON: ["card", "cash", "apple_pay", "google_pay"]
                    require_cvv INTEGER DEFAULT 1 CHECK(require_cvv IN (0, 1)),
                    require_zip INTEGER DEFAULT 0 CHECK(require_zip IN (0, 1)),
                    auto_capture INTEGER DEFAULT 1 CHECK(auto_capture IN (0, 1)),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (stripe_account_id) REFERENCES stripe_accounts(stripe_account_id),
                    FOREIGN KEY (stripe_credential_id) REFERENCES stripe_credentials(credential_id)
                )
            """)
            print("✓ Created payment_settings table")
            
            # Insert default cash-only settings
            cursor.execute("""
                INSERT INTO payment_settings (
                    payment_processor, enabled_payment_methods
                ) VALUES ('cash_only', '["cash"]')
            """)
            print("✓ Created default payment settings (cash-only)")
        
        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_stripe_accounts_store 
            ON stripe_accounts(store_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_stripe_credentials_store 
            ON stripe_credentials(store_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_settings_store 
            ON payment_settings(store_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_stripe_connected_account 
            ON stripe_accounts(stripe_connected_account_id)
        """)
        
        conn.commit()
        print("✓ Stripe integration migration complete!")
        
    except Exception as e:
        print(f"Error creating Stripe integration tables: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_stripe_integration()
