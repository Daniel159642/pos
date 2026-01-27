# Database Optimization Migration

This migration optimizes the database by removing redundancies and consolidating overlapping functionality.

## What This Migration Does

### ✅ Completed Optimizations

1. **Fixed Returns Schema**
   - Converted from SQLite to PostgreSQL syntax
   - Added `establishment_id` for multi-tenant support
   - Created proper indexes

2. **Unified Shipments**
   - Added `status` field to `shipments` table
   - Migrated data from `pending_shipments` to `shipments`
   - Added fields for pending shipment workflow
   - **Note**: `pending_shipments` tables kept for backward compatibility (will be dropped in cleanup)

3. **Consolidated Logging**
   - Migrated `activity_log` data to `audit_log`
   - Added missing columns to `audit_log`
   - **Note**: `activity_log` table kept for backward compatibility (will be dropped in cleanup)

4. **Resolved Time Tracking Overlap**
   - Linked `employee_schedule` to `time_clock` via `time_entry_id`
   - Migrated clock data from `employee_schedule` to `time_clock`
   - **Note**: Clock fields in `employee_schedule` kept for backward compatibility (will be dropped in cleanup)

5. **Added Missing Indexes**
   - Created indexes for all `establishment_id` columns
   - Improves query performance for multi-tenant queries

6. **Fixed Date Fields**
   - Converted `shipment_date` and `received_date` from TEXT to DATE
   - Enables proper date queries and validation

7. **Renamed Session ID Conflicts**
   - Renamed `cash_register_sessions.session_id` to `register_session_id`
   - Prevents confusion with `employee_sessions.session_id`

8. **Created Backward Compatibility Views**
   - `sales` view: Provides sales data from `order_items` (replaces `sales` table)
   - `orders_with_payment_method` view: Includes payment method from `payment_transactions`

### ⚠️ Deferred Changes (Require Code Updates)

These changes are prepared but columns/tables are kept for backward compatibility:

1. **Sales Table**
   - Created `sales` view for backward compatibility
   - Actual `sales` table will be dropped in cleanup migration
   - **Action Required**: Update code to use `orders` + `order_items` instead of `sales`

2. **Payment Method in Orders**
   - Created `orders_with_payment_method` view
   - `orders.payment_method` column kept for now
   - **Action Required**: Update code to use `payment_transactions.payment_method`

3. **Vendor Field in Inventory**
   - Migrated data from `vendor` TEXT to `vendor_id`
   - `vendor` column kept for now
   - **Action Required**: Update code to use `vendor_id` with JOIN

4. **Clock Fields in Employee Schedule**
   - Linked to `time_clock` table
   - Clock fields kept for now
   - **Action Required**: Update code to use `time_clock` table directly

## How to Run

### Step 1: Run Optimization Migration

```bash
python run_optimization_migration.py
```

This will:
- Apply all optimizations
- Migrate data
- Create backward compatibility views
- Keep deprecated columns/tables for now

### Step 2: Test Your Application

After running the migration, test all functionality to ensure everything works correctly.

### Step 3: Update Application Code

Update your code to use the new structure:

1. **Replace `sales` table usage:**
   ```python
   # Old
   sales = get_sales()
   
   # New - use orders/order_items
   orders = get_orders()
   # Aggregate from order_items
   ```

2. **Use `payment_transactions` for payment method:**
   ```python
   # Old
   payment_method = order['payment_method']
   
   # New
   payment = get_payment_transaction(order_id)
   payment_method = payment['payment_method']
   ```

3. **Use `vendor_id` instead of `vendor` TEXT:**
   ```python
   # Old
   vendor_name = product['vendor']
   
   # New
   vendor = get_vendor(product['vendor_id'])
   vendor_name = vendor['vendor_name']
   ```

4. **Use `time_clock` for clock tracking:**
   ```python
   # Old
   clock_in = schedule['clock_in_time']
   
   # New
   time_entry = get_time_clock_entry(schedule['time_entry_id'])
   clock_in = time_entry['clock_in']
   ```

5. **Use `audit_log` instead of `activity_log`:**
   ```python
   # Old
   log_activity(action, details)
   
   # New
   log_audit(action, details)  # Uses audit_log table
   ```

### Step 4: Run Cleanup Migration (After Code Updates)

Once all code is updated, run the cleanup migration to remove deprecated tables/columns:

```bash
python run_optimization_migration.py --cleanup
```

**WARNING**: This will permanently drop:
- `sales` table
- `pending_shipments` and `pending_shipment_items` tables
- `activity_log` table
- `orders.payment_method` column
- `inventory.vendor` column
- Clock fields from `employee_schedule`

## Migration Files

- `optimize_database_redundancies.sql` - Main optimization migration
- `cleanup_deprecated_tables.sql` - Cleanup migration (run after code updates)
- `run_optimization_migration.py` - Python script to run migrations

## Rollback

If you need to rollback, you'll need to:
1. Restore from database backup, OR
2. Manually recreate dropped tables/columns from schema files

**Recommendation**: Create a database backup before running migrations.

## Summary of Changes

| Table/Column | Action | Status |
|-------------|--------|--------|
| `sales` | View created, table deprecated | ⚠️ Will drop in cleanup |
| `pending_shipments` | Data migrated to `shipments` | ⚠️ Will drop in cleanup |
| `activity_log` | Data migrated to `audit_log` | ⚠️ Will drop in cleanup |
| `orders.payment_method` | View created, column deprecated | ⚠️ Will drop in cleanup |
| `inventory.vendor` | Data migrated, column deprecated | ⚠️ Will drop in cleanup |
| `employee_schedule` clock fields | Linked to `time_clock` | ⚠️ Will drop in cleanup |
| `returns` tables | Fixed schema + establishment_id | ✅ Complete |
| Date fields | Converted TEXT to DATE | ✅ Complete |
| Indexes | Added for all establishment_id | ✅ Complete |
| Session IDs | Renamed conflicts | ✅ Complete |

## Questions?

If you encounter any issues or have questions about the migration, check:
1. Database logs for errors
2. Application logs for code that needs updating
3. This README for migration details
