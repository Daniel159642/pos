# Database Documentation
## POS Accounting System

## Overview

PostgreSQL database for POS Accounting System implementing double-entry bookkeeping principles with QuickBooks-style features.

## Database Structure

### Core Accounting Tables

#### `accounts` - Chart of Accounts
Stores all accounting accounts in a hierarchical structure.

**Key Fields:**
- `account_number` - Unique account identifier (e.g., "1000", "1100")
- `account_name` - Account name (e.g., "Cash", "Accounts Receivable")
- `account_type` - Asset, Liability, Equity, Revenue, Expense, COGS
- `balance_type` - Normal balance: "debit" or "credit"
- `parent_account_id` - Parent account for hierarchy
- `is_active` - Active status
- `is_system_account` - Protected system accounts

**Indexes:**
- `idx_accounts_account_type` - Filter by account type
- `idx_accounts_parent_account_id` - Hierarchy queries
- `idx_accounts_is_active` - Active accounts only
- `idx_accounts_account_number` - Lookup by number

#### `transactions` - Journal Entry Headers
Stores all financial transactions (journal entries).

**Key Fields:**
- `transaction_number` - Auto-generated unique number (TRX-YYYYMMDD-####)
- `transaction_date` - Date of transaction
- `transaction_type` - journal_entry, invoice, bill, payment, etc.
- `is_posted` - Whether transaction is posted to ledger
- `is_void` - Whether transaction is voided
- `reconciliation_status` - For bank reconciliation

**Indexes:**
- `idx_transactions_transaction_date` - Date range queries
- `idx_transactions_transaction_type` - Filter by type
- `idx_transactions_is_posted` - Posted transactions
- `idx_transactions_reconciliation_status` - Reconciliation

#### `transaction_lines` - Journal Entry Lines
Individual debit and credit lines for each transaction.

**Key Fields:**
- `transaction_id` - Foreign key to transactions
- `account_id` - Foreign key to accounts
- `debit_amount` - Debit amount (must be >= 0)
- `credit_amount` - Credit amount (must be >= 0)
- `line_number` - Line ordering within transaction

**Constraints:**
- CHECK: A line cannot have both debit and credit > 0
- CHECK: Debit and credit amounts must be >= 0
- Foreign key CASCADE delete to transactions

**Indexes:**
- `idx_transaction_lines_transaction_id` - All lines for a transaction
- `idx_transaction_lines_account_id` - All transactions for an account

### Customer & Sales Tables

#### `accounting_customers` - Customer Master Data
Customer information for accounting purposes.

**Key Fields:**
- `customer_number` - Unique customer identifier
- `display_name` - Customer display name
- `customer_type` - individual or business
- `payment_terms` - Payment terms (e.g., "Net 30")
- `account_balance` - Current balance owed

#### `invoices` - Sales Invoices
Customer invoice headers.

**Key Fields:**
- `invoice_number` - Auto-generated invoice number (INV-######)
- `customer_id` - Foreign key to accounting_customers
- `invoice_date` - Invoice date
- `due_date` - Payment due date
- `status` - draft, sent, partial, paid, overdue, void
- `total_amount` - Total invoice amount
- `amount_paid` - Amount paid so far
- `balance_due` - Remaining balance

**Constraints:**
- CHECK: `due_date >= invoice_date`
- CHECK: `amount_paid + balance_due = total_amount`

#### `invoice_lines` - Invoice Line Items
Individual items on invoices.

**Key Fields:**
- `invoice_id` - Foreign key to invoices (CASCADE delete)
- `item_id` - Foreign key to items (nullable)
- `quantity` - Quantity sold
- `unit_price` - Price per unit
- `line_total` - Total for line
- `tax_amount` - Tax for this line

#### `payments` - Customer Payments
Customer payment records.

**Key Fields:**
- `payment_number` - Auto-generated payment number (PAY-######)
- `customer_id` - Foreign key to accounting_customers
- `payment_date` - Payment date
- `payment_method` - cash, check, credit_card, etc.
- `payment_amount` - Total payment amount
- `deposit_to_account_id` - Bank account for deposit

#### `payment_applications` - Payment to Invoice Matching
Links payments to invoices.

**Key Fields:**
- `payment_id` - Foreign key to payments (CASCADE delete)
- `invoice_id` - Foreign key to invoices
- `amount_applied` - Amount applied to this invoice

**Constraints:**
- UNIQUE: (payment_id, invoice_id) - Can't apply same payment twice

### Vendor & Purchase Tables

#### `accounting_vendors` - Vendor Master Data
Vendor information for accounting purposes.

**Key Fields:**
- `vendor_number` - Unique vendor identifier
- `vendor_name` - Vendor name
- `payment_terms` - Payment terms
- `is_1099_vendor` - 1099 reporting flag
- `account_balance` - Current balance owed

#### `bills` - Vendor Bills
Vendor bill headers.

**Key Fields:**
- `bill_number` - Auto-generated bill number (BILL-######)
- `vendor_id` - Foreign key to accounting_vendors
- `bill_date` - Bill date
- `due_date` - Payment due date
- `status` - draft, open, partial, paid, void
- `total_amount` - Total bill amount
- `amount_paid` - Amount paid so far
- `balance_due` - Remaining balance

#### `bill_lines` - Bill Line Items
Individual items on bills.

**Key Fields:**
- `bill_id` - Foreign key to bills (CASCADE delete)
- `item_id` - Foreign key to items (nullable)
- `quantity` - Quantity purchased
- `unit_cost` - Cost per unit
- `line_total` - Total for line
- `account_id` - Expense account

#### `bill_payments` - Vendor Payments
Vendor payment records.

**Key Fields:**
- `payment_number` - Auto-generated payment number (BP-######)
- `vendor_id` - Foreign key to accounting_vendors
- `payment_amount` - Total payment amount
- `paid_from_account_id` - Bank account for payment

#### `bill_payment_applications` - Payment to Bill Matching
Links bill payments to bills.

**Key Fields:**
- `bill_payment_id` - Foreign key to bill_payments (CASCADE delete)
- `bill_id` - Foreign key to bills
- `amount_applied` - Amount applied to this bill

### Inventory Tables

#### `items` - Product/Service Master
Inventory items and services.

**Key Fields:**
- `item_number` - Unique item/SKU number
- `item_name` - Item name
- `item_type` - inventory, non_inventory, service, bundle
- `quantity_on_hand` - Current stock quantity
- `sales_price` - Default sales price
- `purchase_cost` - Last purchase cost
- `average_cost` - Average cost (for inventory valuation)
- `income_account_id` - Sales revenue account
- `expense_account_id` - COGS or expense account
- `asset_account_id` - Inventory asset account

#### `inventory_transactions` - Inventory Movements
Tracks all inventory movements.

**Key Fields:**
- `item_id` - Foreign key to items
- `transaction_date` - Date of movement
- `transaction_type` - sale, purchase, adjustment, return, transfer
- `quantity_change` - Quantity change (positive/negative)
- `unit_cost` - Cost per unit at time of transaction
- `total_cost` - Total cost of transaction

### Supporting Tables

#### `tax_rates` - Sales Tax Configuration
Tax rate definitions.

**Key Fields:**
- `tax_name` - Name of tax (e.g., "CA Sales Tax")
- `tax_rate` - Tax percentage (e.g., 8.5 for 8.5%)
- `tax_type` - sales_tax, vat, gst, other
- `is_active` - Active status

#### `classes` - Department/Division Tracking
Departments or divisions for tracking.

**Key Fields:**
- `class_name` - Name of class/department
- `is_active` - Active status

#### `locations` - Multi-location Support
Locations for multi-location businesses.

**Key Fields:**
- `location_name` - Name of location
- `address_line1`, `city`, `state`, etc. - Address fields
- `is_active` - Active status

#### `users` - System Users
System users for audit trails.

**Key Fields:**
- `username` - Unique username
- `email` - Email address
- `password_hash` - Hashed password
- `role` - admin, manager, accountant, employee, viewer
- `is_active` - Active status

#### `audit_log` - Change Tracking
Logs all changes to important tables.

**Key Fields:**
- `table_name` - Name of table changed
- `record_id` - ID of record changed
- `action` - INSERT, UPDATE, DELETE
- `old_values` - JSON of old values
- `new_values` - JSON of new values
- `user_id` - User who made change
- `timestamp` - When change occurred

## Key Functions

### `calculate_account_balance(account_id, as_of_date)`
Returns the balance of an account as of a specific date.

**Parameters:**
- `account_id` - Account ID
- `as_of_date` - Date to calculate balance as of (default: CURRENT_DATE)

**Returns:** DECIMAL(19,4) - Account balance

**Example:**
```sql
SELECT calculate_account_balance(1, '2024-12-31');
```

### `get_account_balance_by_period(account_id, start_date, end_date)`
Returns account balance breakdown by period.

**Returns:** TABLE with period_start_balance, period_debits, period_credits, period_end_balance

### `get_trial_balance(as_of_date, account_type)`
Returns trial balance report.

**Returns:** TABLE with account_id, account_number, account_name, debit_balance, credit_balance

### `get_profit_and_loss(start_date, end_date)`
Returns profit & loss (income statement) report.

**Returns:** TABLE with account_type, account_name, amount

### `get_balance_sheet(as_of_date)`
Returns balance sheet report.

**Returns:** TABLE with account_type, account_name, amount

### `get_aging_report(as_of_date, customer_id)`
Returns accounts receivable aging report.

**Returns:** TABLE with customer_id, customer_name, current_balance, days_0_30, days_31_60, days_61_90, days_over_90, total_balance

### `post_transaction(transaction_id)`
Posts a transaction to the ledger (marks as posted).

**Parameters:**
- `transaction_id` - Transaction ID to post

**Returns:** BOOLEAN - Success status

**Validates:** Transaction must be balanced (debits = credits)

### `void_transaction(transaction_id, reason)`
Voids a transaction.

**Parameters:**
- `transaction_id` - Transaction ID to void
- `reason` - Reason for voiding (optional)

**Returns:** BOOLEAN - Success status

## Triggers

### Transaction Balance Validation
**Trigger:** `trigger_validate_transaction_balance`
**Table:** `transaction_lines`
**Purpose:** Validates that debits equal credits before allowing transaction to be posted

**How it works:**
- Fires before INSERT or UPDATE on transaction_lines
- Calculates total debits and credits for the transaction
- Raises exception if not balanced

### Updated_at Auto-update
**Trigger:** `update_updated_at_column`
**Tables:** All tables with `updated_at` column
**Purpose:** Automatically updates `updated_at` timestamp on record changes

### Audit Logging
**Trigger:** `audit_trigger_function`
**Tables:** Critical tables (transactions, invoices, bills, accounts, etc.)
**Purpose:** Automatically logs all changes to audit_log table

**Captures:**
- INSERT: new_values only
- UPDATE: old_values and new_values
- DELETE: old_values only

### Invoice Balance Update
**Trigger:** `trigger_update_invoice_balance`
**Table:** `payment_applications`
**Purpose:** Automatically recalculates invoice balance when payments are applied

**Updates:**
- `amount_paid` - Total payments applied
- `balance_due` - Remaining balance
- `status` - paid, partial, or sent
- `paid_date` - Date fully paid (if applicable)

### Inventory Quantity Update
**Trigger:** `trigger_update_inventory_quantity`
**Table:** `inventory_transactions`
**Purpose:** Automatically updates item quantity_on_hand when inventory transactions occur

## Migration

### Running Migrations

**Option 1: Using Python script**
```bash
python3 database/migrations/run_migrations.py
```

**Option 2: Manual execution**
```bash
# Run schema files
psql -U pos_user -d pos_db -f accounting_schema.sql
psql -U pos_user -d pos_db -f accounting_triggers.sql
psql -U pos_user -d pos_db -f accounting_functions.sql

# Run seed data
psql -U pos_user -d pos_db -f accounting_seed_data.sql
```

### Verifying Database

**Using Python script:**
```bash
python3 database/migrations/verify_database.py
```

**Manual verification:**
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check accounts
SELECT COUNT(*) FROM accounts;

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

## Backup & Restore

### Backup Database
```bash
pg_dump -U pos_user -d pos_db -F c -f pos_db_backup_$(date +%Y%m%d).dump
```

### Restore Database
```bash
pg_restore -U pos_user -d pos_db pos_db_backup_YYYYMMDD.dump
```

### Backup SQL Format
```bash
pg_dump -U pos_user -d pos_db > pos_db_backup.sql
```

### Restore SQL Format
```bash
psql -U pos_user -d pos_db < pos_db_backup.sql
```

## Data Integrity Rules

### Double-Entry Bookkeeping
- Every transaction must have equal debits and credits
- Enforced by trigger before posting
- Cannot post unbalanced transactions

### Foreign Key Constraints
- All foreign keys have proper CASCADE or RESTRICT rules
- Line items CASCADE delete when parent deleted
- Payment applications CASCADE delete when payment deleted

### Check Constraints
- Account types must be valid values
- Balance types must be "debit" or "credit"
- Transaction types must be valid values
- Status values must be valid
- Amounts must be >= 0
- Debit and credit cannot both be > 0 on same line

### Unique Constraints
- Account numbers must be unique
- Transaction numbers must be unique
- Invoice numbers must be unique
- Bill numbers must be unique
- Payment numbers must be unique

## Performance Optimization

### Indexes
All foreign keys are indexed for fast joins.

**Key indexes:**
- Transaction dates for date range queries
- Account types for filtering
- Status fields for filtering
- Number fields for lookups

### Query Optimization Tips
1. Use indexes on date ranges for reports
2. Filter by `is_active` for active records only
3. Use `is_posted = true` for posted transactions only
4. Use `is_void = false` to exclude voided transactions

## Security Considerations

1. **User Permissions:** Limit database access to application user only
2. **Audit Trail:** All changes logged with user ID
3. **Transaction Isolation:** Use appropriate isolation levels
4. **Data Encryption:** Consider encrypting sensitive fields
5. **Backup Encryption:** Encrypt backup files

## Troubleshooting

### Common Issues

**Issue: "Transaction is not balanced"**
- Check all transaction_lines for the transaction
- Ensure SUM(debit_amount) = SUM(credit_amount)
- Use: `SELECT SUM(debit_amount), SUM(credit_amount) FROM transaction_lines WHERE transaction_id = X`

**Issue: "Foreign key constraint violation"**
- Verify referenced record exists
- Check CASCADE rules if deleting parent

**Issue: "Unique constraint violation"**
- Check for duplicate numbers
- Use sequences for auto-numbering

**Issue: "Function not found"**
- Verify function was created: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'function_name'`
- Re-run function creation script

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Accounting System Documentation](../ACCOUNTING_SYSTEM_DOCUMENTATION.md)
- [Entity Relationship Diagram](../accounting_erd.md)
