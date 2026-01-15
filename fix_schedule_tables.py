#!/usr/bin/env python3
"""
Fix missing Schedule_Periods table by running the migration
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from migrate_schedule_system import migrate
    print("Running schedule system migration...")
    migrate()
    print("\n✅ Migration completed successfully!")
except Exception as e:
    print(f"\n❌ Error running migration: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)




