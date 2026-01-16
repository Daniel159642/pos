#!/usr/bin/env python3
"""
Clear all accounting data from the database
"""

import sqlite3
from datetime import datetime

DB_NAME = 'inventory.db'

def clear_accounting_data():
    """Clear all accounting data"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Clearing all accounting data...")
    
    # Clear payroll records
    cursor.execute("DELETE FROM payroll_records")
    deleted_payroll = cursor.rowcount
    print(f"✓ Deleted {deleted_payroll} payroll records")
    
    # Clear tax withholdings summary
    cursor.execute("DELETE FROM tax_withholdings_summary")
    deleted_tax = cursor.rowcount
    print(f"✓ Deleted {deleted_tax} tax withholding summaries")
    
    # Clear contractor payments
    cursor.execute("DELETE FROM contractor_payments")
    deleted_contractors = cursor.rowcount
    print(f"✓ Deleted {deleted_contractors} contractor payment records")
    
    # Clear sales tax collected
    cursor.execute("DELETE FROM sales_tax_collected")
    deleted_sales_tax = cursor.rowcount
    print(f"✓ Deleted {deleted_sales_tax} sales tax records")
    
    # Clear expenses
    cursor.execute("DELETE FROM expenses")
    deleted_expenses = cursor.rowcount
    print(f"✓ Deleted {deleted_expenses} expense records")
    
    # Clear tax remittances
    cursor.execute("DELETE FROM tax_remittances")
    deleted_remittances = cursor.rowcount
    print(f"✓ Deleted {deleted_remittances} tax remittance records")
    
    # Clear bank reconciliations
    cursor.execute("DELETE FROM bank_reconciliations")
    deleted_reconciliations = cursor.rowcount
    print(f"✓ Deleted {deleted_reconciliations} bank reconciliation records")
    
    # Reset bank account balances to 0
    cursor.execute("UPDATE bank_accounts SET current_balance = 0")
    updated_accounts = cursor.rowcount
    print(f"✓ Reset {updated_accounts} bank account balances to $0.00")
    
    # Clear journal entries (optional - this will clear all accounting entries)
    # Uncomment if you want to clear journal entries too
    # cursor.execute("DELETE FROM journal_entry_lines")
    # cursor.execute("DELETE FROM journal_entries")
    # print("✓ Cleared journal entries")
    
    conn.commit()
    conn.close()
    
    print("\n" + "="*60)
    print("Accounting data cleared successfully!")
    print("="*60)
    print("\nNote: Chart of accounts and account structure remain intact.")
    print("Only transaction data (payroll, expenses, taxes) has been cleared.")

if __name__ == '__main__':
    confirm = input("Are you sure you want to delete all accounting data? (yes/no): ")
    if confirm.lower() == 'yes':
        clear_accounting_data()
    else:
        print("Operation cancelled.")
