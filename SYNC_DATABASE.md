# 🔄 Syncing Database After Pulling Code

**IMPORTANT:** When you pull code from GitHub, the database doesn't automatically update!

## The Problem

- ✅ Code files are updated when you `git pull`
- ❌ Database schema/triggers are NOT automatically updated
- The database still has old functions/triggers until you run the SQL files

## Solution: Schema Dump (Recommended)

The easiest way to keep databases identical:

**On your computer (after making database changes):**
```bash
./dump_schema.sh
git add database_schema_dump.sql
git commit -m "Update database schema"
git push
```

**On other computers (after pulling):**
```bash
git pull
./restore_schema.sh
```

This ensures everyone has the exact same database structure!

## Quick Fix After Pulling

After pulling code that includes database changes, run:

```bash
# Option 1: Run the fix script (recommended)
python3 fix_audit_triggers.py

# Option 2: Manually update triggers
psql -U postgres -d pos_db -f accounting_triggers.sql
```

## Complete Database Sync

If you want to ensure everything matches:

```bash
# Run the complete setup (safe to run multiple times)
python3 setup_complete_database.py
```

This will:
- Run all schemas
- Run all migrations
- Update triggers
- Create missing tables

## When to Run This

Run `fix_audit_triggers.py` or `setup_complete_database.py` when:
- You pull code that includes `.sql` file changes
- You see database errors that work on other computers
- You get trigger/function errors
- After pulling changes to `accounting_triggers.sql`, `schema_postgres.sql`, etc.

## Verify It Worked

```bash
# Check if trigger function exists and is correct
psql -U postgres -d pos_db -c "SELECT proname FROM pg_proc WHERE proname = 'audit_trigger_function';"
```

If you see `audit_trigger_function` in the output, it's installed.
