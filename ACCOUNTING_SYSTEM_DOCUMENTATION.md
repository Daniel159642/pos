# POS Accounting System - Complete Documentation

## Overview

This is a complete double-entry bookkeeping system designed for a Point of Sale (POS) application. It implements all QuickBooks-style features including:

- Complete Chart of Accounts with hierarchy
- Double-entry journal entries with automatic balance validation
- Customer and Vendor management
- Invoice and Bill processing
- Payment tracking and application
- Inventory management with cost tracking
- Tax rate management
- Financial reporting (Trial Balance, P&L, Balance Sheet)
- Comprehensive audit trail
- Multi-location and department (class) tracking

## Database Technology

**PostgreSQL 12+** (Recommended)
- Full ACID compliance
- Excellent transaction support
- Robust constraint enforcement
- JSON support for flexible fields
- Strong trigger and function support

## Installation

### Step 1: Create Database

```bash
psql postgres
CREATE DATABASE pos_accounting;
\c pos_accounting
\q
```

### Step 2: Run Schema Files

Run in this exact order:

```bash
psql -U postgres -d pos_accounting -f accounting_schema.sql
psql -U postgres -d pos_accounting -f accounting_triggers.sql
psql -U postgres -d pos_accounting -f accounting_functions.sql
psql -U postgres -d pos_accounting -f accounting_seed_data.sql
```

Or use the master script:
```bash
psql -U postgres -d pos_accounting -f setup_accounting_system.sql
```

## Table Structure

### Core Accounting Tables (3)

1. **accounts** - Chart of Accounts
   - Hierarchical account structure (parent_account_id)
   - Account types: Asset, Liability, Equity, Revenue, Expense, COGS
   - Normal balance tracking (debit/credit)
   - Opening balances

2. **transactions** - Journal Entry Headers
   - All financial transactions
   - Auto-generated transaction numbers
   - Posting status and void tracking
   - Reconciliation status

3. **transaction_lines** - Journal Entry Lines
   - Individual debit/credit lines
   - Links to accounts, entities, classes, locations
   - Enforced: Debits must equal Credits

### Customer & Invoice Tables (4)

4. **customers** - Customer master data
5. **invoices** - Invoice headers
6. **invoice_lines** - Invoice line items
7. **payments** - Customer payments
8. **payment_applications** - Payment to invoice matching

### Vendor & Bill Tables (4)

9. **vendors** - Vendor master data
10. **bills** - Vendor bill headers
11. **bill_lines** - Bill line items
12. **bill_payments** - Vendor payments
13. **bill_payment_applications** - Payment to bill matching

### Inventory Tables (2)

14. **items** - Product/service master data
15. **inventory_transactions** - Inventory movement tracking

### Supporting Tables (5)

16. **tax_rates** - Sales tax configuration
17. **classes** - Department/division tracking
18. **locations** - Multi-location support
19. **users** - System users
20. **audit_log** - Change tracking

## Key Features

### 1. Double-Entry Bookkeeping

Every transaction must balance:
- Sum of all debits = Sum of all credits
- Enforced by database triggers
- Cannot post unbalanced transactions

### 2. Automatic Number Generation

- **Transactions**: TRX-YYYYMMDD-####
- **Invoices**: INV-######
- **Bills**: BILL-######
- **Payments**: PAY-######
- **Bill Payments**: BP-######

### 3. Account Balance Calculation

Use the function:
```sql
SELECT calculate_account_balance(account_id, '2024-12-31');
```

Returns balance considering:
- Opening balance
- Normal balance type (debit/credit)
- All posted transactions up to date

### 4. Financial Reports

**Trial Balance:**
```sql
SELECT * FROM get_trial_balance('2024-12-31');
```

**Profit & Loss:**
```sql
SELECT * FROM get_profit_and_loss('2024-01-01', '2024-12-31');
```

**Balance Sheet:**
```sql
SELECT * FROM get_balance_sheet('2024-12-31');
```

**Aging Report:**
```sql
SELECT * FROM get_aging_report('2024-12-31');
```

### 5. Audit Trail

All changes to major tables are automatically logged:
- Table name and record ID
- Action (create, update, delete)
- Old and new values (JSON)
- User ID and timestamp

### 6. Transaction Posting

```sql
-- Validate and post a transaction
SELECT post_transaction(transaction_id);

-- Void a transaction
SELECT void_transaction(transaction_id, 'Reason for voiding');
```

## Data Dictionary

### accounts Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| account_number | VARCHAR(20) | Unique account number (e.g., "1000") |
| account_name | VARCHAR(255) | Account name (e.g., "Cash") |
| account_type | VARCHAR(50) | Asset, Liability, Equity, Revenue, Expense, COGS |
| sub_type | VARCHAR(100) | More specific classification |
| parent_account_id | INTEGER | Parent account for hierarchy |
| balance_type | VARCHAR(10) | "debit" or "credit" (normal balance) |
| opening_balance | DECIMAL(19,4) | Starting balance |
| is_active | BOOLEAN | Active status |

### transactions Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| transaction_number | VARCHAR(50) | Auto-generated unique number |
| transaction_date | DATE | Date of transaction |
| transaction_type | VARCHAR(50) | journal_entry, invoice, bill, payment, etc. |
| is_posted | BOOLEAN | Whether transaction is posted to ledger |
| is_void | BOOLEAN | Whether transaction is voided |

### transaction_lines Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| transaction_id | INTEGER | FK to transactions |
| account_id | INTEGER | FK to accounts |
| debit_amount | DECIMAL(19,4) | Debit amount (must be >= 0) |
| credit_amount | DECIMAL(19,4) | Credit amount (must be >= 0) |
| entity_type | VARCHAR(50) | Related entity type (customer, vendor, etc.) |
| entity_id | INTEGER | Related entity ID |

## Usage Examples

### Create a Journal Entry

```sql
-- 1. Create transaction
INSERT INTO transactions (transaction_date, transaction_type, description)
VALUES ('2024-01-15', 'journal_entry', 'Monthly rent payment')
RETURNING id;

-- 2. Add debit line (Rent Expense)
INSERT INTO transaction_lines (transaction_id, account_id, line_number, debit_amount, description)
VALUES (transaction_id, rent_expense_account_id, 1, 2000.00, 'Office rent');

-- 3. Add credit line (Cash)
INSERT INTO transaction_lines (transaction_id, account_id, line_number, credit_amount, description)
VALUES (transaction_id, cash_account_id, 2, 2000.00, 'Cash payment');

-- 4. Post transaction
SELECT post_transaction(transaction_id);
```

### Create an Invoice

```sql
-- 1. Create invoice
INSERT INTO invoices (customer_id, invoice_date, due_date, status)
VALUES (customer_id, '2024-01-15', '2024-02-14', 'draft')
RETURNING id;

-- 2. Add invoice lines
INSERT INTO invoice_lines (invoice_id, line_number, description, quantity, unit_price, 
    line_total, account_id)
VALUES (invoice_id, 1, 'Product A', 10, 29.99, 299.90, sales_account_id);

-- 3. Calculate totals and create transaction
-- (Application code handles this)
```

### Apply Payment to Invoice

```sql
-- 1. Create payment
INSERT INTO payments (customer_id, payment_date, payment_method, payment_amount, 
    deposit_to_account_id)
VALUES (customer_id, '2024-01-20', 'check', 299.90, bank_account_id)
RETURNING id;

-- 2. Apply to invoice
INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
VALUES (payment_id, invoice_id, 299.90);

-- Trigger automatically updates invoice balance and status
```

## Constraints and Validation

### Database-Level Constraints

1. **Transaction Balance**: Trigger ensures debits = credits
2. **Account Types**: CHECK constraint on valid account types
3. **Balance Types**: CHECK constraint on debit/credit
4. **Date Validation**: due_date >= invoice_date
5. **Amount Validation**: All amounts >= 0
6. **Unique Constraints**: All number fields are unique

### Application-Level Validation

- Transaction must have at least 2 lines
- Cannot post voided transactions
- Cannot void already posted transactions (without reversal)
- Payment applications cannot exceed invoice/bill balance

## Indexing Strategy

### Primary Indexes
- All primary keys (automatic)
- All foreign keys
- All unique constraints

### Performance Indexes
- Transaction dates (for date range queries)
- Account types (for filtering)
- Status fields (for active/inactive filtering)
- Composite indexes on common query patterns

### Partial Indexes (Consider)
- Active accounts only: `CREATE INDEX idx_accounts_active ON accounts(id) WHERE is_active = TRUE`
- Posted transactions only: `CREATE INDEX idx_transactions_posted ON transactions(id) WHERE is_posted = TRUE`

## Backup and Maintenance

### Recommended Backup Strategy

1. **Daily Full Backup**: Complete database dump
2. **Transaction Log Backup**: Continuous WAL archiving (PostgreSQL)
3. **Point-in-Time Recovery**: Enable for financial data

### Maintenance Tasks

1. **Reindex**: Monthly to maintain performance
2. **Vacuum**: Weekly to reclaim space
3. **Analyze**: Weekly to update statistics
4. **Archive Old Data**: Move old transactions to archive tables

### Sample Backup Command

```bash
pg_dump -U postgres -d pos_accounting -F c -f accounting_backup_$(date +%Y%m%d).dump
```

## Security Considerations

1. **User Permissions**: Limit database access to application user only
2. **Audit Trail**: All changes logged with user ID
3. **Transaction Isolation**: Use appropriate isolation levels
4. **Data Encryption**: Encrypt sensitive fields (credit cards, SSNs)
5. **Backup Encryption**: Encrypt backup files

## Testing

### Test Transaction Balance

```sql
-- This should fail (unbalanced)
INSERT INTO transactions (transaction_date, transaction_type) VALUES ('2024-01-01', 'journal_entry');
INSERT INTO transaction_lines (transaction_id, account_id, line_number, debit_amount) 
VALUES (1, 1, 1, 100.00);
-- Missing credit line - trigger will prevent posting
```

### Test Account Balance

```sql
-- Get cash account balance
SELECT calculate_account_balance(
    (SELECT id FROM accounts WHERE account_number = '1000'),
    CURRENT_DATE
);
```

### Test Financial Reports

```sql
-- Trial Balance
SELECT * FROM get_trial_balance(CURRENT_DATE);

-- P&L for current year
SELECT * FROM get_profit_and_loss(
    DATE_TRUNC('year', CURRENT_DATE)::DATE,
    CURRENT_DATE
);

-- Balance Sheet
SELECT * FROM get_balance_sheet(CURRENT_DATE);
```

## Migration from Existing System

If migrating from an existing system:

1. **Export Chart of Accounts** from old system
2. **Map Account Numbers** to new structure
3. **Import Opening Balances** with opening_balance_date
4. **Import Historical Transactions** (if needed)
5. **Verify Balances** match old system

## Support and Troubleshooting

### Common Issues

1. **Unbalanced Transaction Error**
   - Check all transaction_lines for the transaction
   - Ensure debits = credits
   - Use: `SELECT SUM(debit_amount), SUM(credit_amount) FROM transaction_lines WHERE transaction_id = X`

2. **Account Balance Mismatch**
   - Verify opening_balance is set correctly
   - Check all transactions are posted
   - Use calculate_account_balance() function

3. **Missing Transaction Numbers**
   - Check sequences exist: `SELECT * FROM pg_sequences WHERE sequencename LIKE '%_number_seq';`
   - Reset if needed: `ALTER SEQUENCE transaction_number_seq RESTART WITH 1;`

## Next Steps

After setting up the schema:

1. ✅ Test with sample transactions
2. ✅ Verify all triggers work
3. ✅ Test financial reports
4. ✅ Set up backup schedule
5. ✅ Configure user permissions
6. ✅ Integrate with POS application

## File Reference

- `accounting_schema.sql` - All table definitions (642 lines)
- `accounting_triggers.sql` - Validation and audit triggers (479 lines)
- `accounting_functions.sql` - Calculation and reporting functions (434 lines)
- `accounting_seed_data.sql` - Default chart of accounts (204 lines)
- `accounting_erd.md` - Entity relationship diagram
- `setup_accounting_system.sql` - Master setup script

**Total: ~1,933 lines of SQL**
