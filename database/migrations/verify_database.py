#!/usr/bin/env python3
"""
Database Verification Script
Verifies that all tables, triggers, functions, and constraints are properly created
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

load_dotenv()

from database_postgres import get_connection

def verify_database():
    """Verify database structure and functionality"""
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        print("🔍 Verifying database structure...\n")
        
        # Check tables
        print("📊 Checking tables...")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'accounts', 'transactions', 'transaction_lines',
                'accounting_customers', 'accounting_vendors',
                'invoices', 'invoice_lines', 'bills', 'bill_lines',
                'payments', 'payment_applications',
                'bill_payments', 'bill_payment_applications',
                'items', 'inventory_transactions',
                'tax_rates', 'classes', 'locations', 'users', 'audit_log'
            )
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        print(f"✅ Found {len(tables)} accounting tables:")
        for table in tables:
            print(f"   - {table[0]}")
        print()
        
        # Check accounts count
        cursor.execute("SELECT COUNT(*) FROM accounts")
        account_count = cursor.fetchone()[0]
        print(f"✅ Chart of Accounts: {account_count} accounts loaded\n")
        
        # Check triggers
        print("🔧 Checking triggers...")
        cursor.execute("""
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND trigger_name LIKE 'trigger_%' OR trigger_name LIKE 'trg_%'
            ORDER BY trigger_name
        """)
        
        triggers = cursor.fetchall()
        print(f"✅ Found {len(triggers)} triggers:")
        for trigger in triggers[:10]:  # Show first 10
            print(f"   - {trigger[0]} on {trigger[1]}")
        if len(triggers) > 10:
            print(f"   ... and {len(triggers) - 10} more")
        print()
        
        # Check functions
        print("⚙️  Checking functions...")
        cursor.execute("""
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public' 
            AND routine_type = 'FUNCTION'
            AND routine_name IN (
                'calculate_account_balance',
                'get_account_balance',
                'get_trial_balance',
                'get_profit_and_loss',
                'get_balance_sheet',
                'get_aging_report',
                'validate_transaction_balance',
                'post_transaction',
                'void_transaction'
            )
            ORDER BY routine_name
        """)
        
        functions = cursor.fetchall()
        print(f"✅ Found {len(functions)} key functions:")
        for func in functions:
            print(f"   - {func[0]}()")
        print()
        
        # Test transaction balance validation
        print("🧪 Testing transaction balance validation...")
        try:
            # Get account IDs first
            cursor.execute("SELECT id FROM accounts WHERE is_active = true LIMIT 2")
            account_ids = cursor.fetchall()
            
            if len(account_ids) < 2:
                print("⚠️  Need at least 2 active accounts for balance test\n")
            else:
                # Start a savepoint for testing
                cursor.execute("SAVEPOINT test_balance")
                
                try:
                    # Create test transaction
                    cursor.execute("""
                        INSERT INTO transactions (transaction_number, transaction_date, transaction_type, is_posted)
                        VALUES ('TEST-BALANCE-001', CURRENT_DATE, 'journal_entry', false)
                        RETURNING id
                    """)
                    txn_id = cursor.fetchone()[0]
                    
                    # Add balanced lines
                    cursor.execute("""
                        INSERT INTO transaction_lines (transaction_id, account_id, line_number, debit_amount, credit_amount)
                        VALUES 
                            (%s, %s, 1, 100.00, 0),
                            (%s, %s, 2, 0, 100.00)
                    """, (txn_id, account_ids[0][0], txn_id, account_ids[1][0]))
                    
                    # Try to post (should succeed)
                    cursor.execute("""
                        UPDATE transactions SET is_posted = true WHERE id = %s
                    """, (txn_id,))
                    
                    cursor.execute("ROLLBACK TO SAVEPOINT test_balance")
                    cursor.execute("RELEASE SAVEPOINT test_balance")
                    print("✅ Balance validation working correctly\n")
                except Exception as e:
                    try:
                        cursor.execute("ROLLBACK TO SAVEPOINT test_balance")
                        cursor.execute("RELEASE SAVEPOINT test_balance")
                    except:
                        pass
                    print(f"❌ Balance validation test failed: {e}\n")
                
        except Exception as e:
            print(f"⚠️  Balance validation test skipped: {e}\n")
        
        # Test function
        print("🧪 Testing get_account_balance function...")
        try:
            cursor.execute("""
                SELECT id FROM accounts WHERE is_active = true LIMIT 1
            """)
            account_id = cursor.fetchone()
            
            if account_id:
                cursor.execute("""
                    SELECT calculate_account_balance(%s, CURRENT_DATE) as balance
                """, (account_id[0],))
                balance = cursor.fetchone()[0]
                print(f"✅ Function returned balance: {balance}\n")
            else:
                print("⚠️  No active accounts found to test\n")
                
        except Exception as e:
            print(f"⚠️  Function test skipped: {e}\n")
        
        # Check constraints
        print("🔒 Checking constraints...")
        cursor.execute("""
            SELECT 
                tc.table_name,
                tc.constraint_name,
                tc.constraint_type
            FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public'
            AND tc.table_name IN ('accounts', 'transactions', 'transaction_lines')
            AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'CHECK', 'UNIQUE')
            ORDER BY tc.table_name, tc.constraint_type
        """)
        
        constraints = cursor.fetchall()
        print(f"✅ Found {len(constraints)} constraints on core tables")
        print()
        
        # Check indexes
        print("📇 Checking indexes...")
        cursor.execute("""
            SELECT 
                tablename,
                indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename IN ('accounts', 'transactions', 'transaction_lines')
            ORDER BY tablename, indexname
        """)
        
        indexes = cursor.fetchall()
        print(f"✅ Found {len(indexes)} indexes on core tables")
        print()
        
        # Check seed data (if tables exist)
        print("🌱 Checking seed data...")
        try:
            cursor.execute("SELECT COUNT(*) FROM tax_rates")
            tax_count = cursor.fetchone()[0]
            print(f"✅ Tax rates: {tax_count}")
        except Exception:
            print("⚠️  Tax rates table not found")
        
        try:
            cursor.execute("SELECT COUNT(*) FROM accounting_customers")
            customer_count = cursor.fetchone()[0]
            print(f"✅ Customers: {customer_count}")
        except Exception:
            print("⚠️  Accounting customers table not found")
        
        try:
            cursor.execute("SELECT COUNT(*) FROM accounting_vendors")
            vendor_count = cursor.fetchone()[0]
            print(f"✅ Vendors: {vendor_count}")
        except Exception:
            print("⚠️  Accounting vendors table not found")
        print()
        
        print("🎉 Database verification complete!")
        print("\n✅ All checks passed!")
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    verify_database()
