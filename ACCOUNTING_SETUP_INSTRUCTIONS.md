# Accounting System Setup Instructions

## Option 1: Use Existing POS Database (Recommended)

The accounting tables are designed to work alongside your existing POS tables. Some tables (customers, vendors) already exist in your POS schema, so the accounting system will use those.

### Setup Steps

1. **Run accounting schema** (creates new accounting-specific tables):
   ```bash
   psql -U danielbudnyatsky -d pos_db -f accounting_schema.sql
   ```

2. **Run triggers**:
   ```bash
   psql -U danielbudnyatsky -d pos_db -f accounting_triggers.sql
   ```

3. **Run functions**:
   ```bash
   psql -U danielbudnyatsky -d pos_db -f accounting_functions.sql
   ```

4. **Load seed data**:
   ```bash
   psql -U danielbudnyatsky -d pos_db -f accounting_seed_data.sql
   ```

**Note**: The schema will skip creating customers/vendors tables if they already exist, but will create all accounting-specific tables (accounts, transactions, invoices, bills, etc.)

## Option 2: Separate Accounting Database

If you prefer a completely separate database:

```bash
# Create new database
psql postgres
CREATE DATABASE pos_accounting;
\c pos_accounting
\q

# Run all schema files
psql -U postgres -d pos_accounting -f accounting_schema.sql
psql -U postgres -d pos_accounting -f accounting_triggers.sql
psql -U postgres -d pos_accounting -f accounting_functions.sql
psql -U postgres -d pos_accounting -f accounting_seed_data.sql
```

## Verification

After setup, verify:

```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('accounts', 'transactions', 'transaction_lines', 'invoices', 'bills')
ORDER BY table_name;

-- Check chart of accounts loaded
SELECT COUNT(*) FROM accounts;
-- Should return ~50-60 accounts

-- Test a function
SELECT calculate_account_balance(
    (SELECT id FROM accounts WHERE account_number = '1000'),
    CURRENT_DATE
);
```

## Integration with Existing POS

The accounting system is designed to integrate with your existing POS tables:

- **employees** table → used for created_by/updated_by
- **customers** table → used by accounting invoices (if exists)
- **vendors** table → used by accounting bills (if exists)
- **inventory** table → can link to accounting.items

If these tables don't exist yet, the accounting schema will create minimal versions.

## Next Steps

1. ✅ Run schema files
2. ✅ Verify tables created
3. ✅ Test with sample transaction
4. ✅ Integrate with POS application code
5. ✅ Set up automated backups

See `ACCOUNTING_SYSTEM_DOCUMENTATION.md` for complete usage guide.
