#!/usr/bin/env python3
"""
Run DoorDash-related migrations (same set as API /api/integrations/doordash/run-migrations).
Usage: from project root, python3 scripts/run_doordash_migrations.py
Requires: .env with DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME
"""
import os
import sys
from pathlib import Path

# Project root
root = Path(__file__).resolve().parent.parent
os.chdir(root)
sys.path.insert(0, str(root))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def main():
    from database import get_connection
    migrations_dir = root / 'migrations'
    files = [
        ('add_orders_external_order_id_and_experience.sql', 'Orders external_order_id + experience'),
        ('add_inventory_item_special_hours.sql', 'Inventory item_special_hours'),
        ('add_product_variants_photo.sql', 'Product variants photo (modifier images)'),
        ('add_doordash_recipe_fields.sql', 'DoorDash recipe fields (operation_context, quantity_info)'),
        ('add_doordash_nutritional_info.sql', 'DoorDash nutritional/dietary'),
        ('add_doordash_order_lines.sql', 'DoorDash order lines (line_item_id/line_option_id)'),
        ('add_doordash_promotions.sql', 'DoorDash Integrated Promotions'),
        ('add_orders_dasher_status.sql', 'Orders dasher_status / dasher_status_at / dasher_info (Dasher Status webhook)'),
        ('add_doordash_store_deactivation_events.sql', 'DoorDash store temporarily deactivated events'),
    ]
    conn = get_connection()
    cur = conn.cursor()
    run = []
    try:
        for filename, label in files:
            path = migrations_dir / filename
            if not path.is_file():
                print(f"  Skip (not found): {filename}")
                continue
            print(f"  Running: {label} ...")
            try:
                sql = path.read_text(encoding='utf-8')
                cur.execute(sql)
                conn.commit()
                run.append(label)
                print(f"    OK: {label}")
            except Exception as e:
                conn.rollback()
                if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                    conn.commit()
                    run.append(label)
                    print(f"    OK (already applied): {label}")
                else:
                    print(f"    FAIL: {e}")
                    raise
        print(f"\nDone. Applied {len(run)} migration(s): {run}")
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
