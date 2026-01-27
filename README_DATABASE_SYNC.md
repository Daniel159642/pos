# 🔄 Automatic Database Sync

## How It Works

**SQL files ARE pushed to GitHub** - but they need to be RUN against the database.

We've set up automatic execution so you don't have to think about it!

## Setup (One Time)

On each computer, run once:

```bash
./install_git_hooks.sh
```

This installs a git hook that automatically runs SQL files after `git pull`.

## What Happens Now

**When you pull code:**
```bash
git pull origin main
# ✅ SQL files automatically run and update database!
```

**That's it!** No manual steps needed.

## What Gets Updated Automatically

- `accounting_triggers.sql` - Trigger functions
- `schema_postgres.sql` - Main schema
- `accounting_schema.sql` - Accounting tables
- `returns_schema.sql` - Returns tables
- All files in `migrations/` - Database migrations

## Manual Override

If automatic update doesn't work, you can run manually:

```bash
# Update triggers only
psql -U postgres -d pos_db -f accounting_triggers.sql

# Or restore from schema dump
./restore_schema.sh

# Or run complete setup
python3 setup_complete_database.py
```

## Why This Is Needed

- ✅ **Code files** (Python, SQL files) are in git and sync automatically
- ❌ **Database** (actual tables/triggers in PostgreSQL) is NOT in git
- 🔧 **Solution**: Automatically run SQL files after pulling code

Now it "just works" - push SQL files, pull them, they run automatically!
