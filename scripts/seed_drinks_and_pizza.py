#!/usr/bin/env python3
"""
Seed drinks and pizza into inventory with multiple sizes (variants) and categories.
Run from project root: python3 scripts/seed_drinks_and_pizza.py

Requires: migrations add_product_variants_and_ingredients.sql applied.
Uses current/default establishment. Works with or without vendor/item_type columns.
"""

import os
import sys

# Project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_establishment_id(conn):
    from database_postgres import get_current_establishment
    eid = get_current_establishment()
    if eid:
        return eid
    cur = conn.cursor()
    cur.execute("SELECT establishment_id FROM establishments ORDER BY establishment_id LIMIT 1")
    row = cur.fetchone()
    return row[0] if row and not isinstance(row, dict) else (row.get('establishment_id') if row else None)

def get_inventory_columns(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'inventory'
    """)
    return [r[0] if not isinstance(r, dict) else r.get('column_name') for r in cur.fetchall()]

def insert_product(conn, cols, establishment_id, name, sku, price, cost, category, qty=999):
    cur = conn.cursor()
    base = ['establishment_id', 'product_name', 'sku', 'product_price', 'product_cost', 'current_quantity', 'category']
    optional = {'barcode': None, 'photo': None, 'vendor': None, 'vendor_id': None, 'item_type': 'product', 'unit': None, 'sell_at_pos': True}
    col_set = set(cols)
    names = [c for c in base if c in col_set]
    values = [establishment_id, name, sku, price, cost, qty, category]
    for k, v in optional.items():
        if k in col_set:
            names.append(k)
            values.append(v)
    placeholders = ', '.join(['%s'] * len(names))
    cur.execute(
        f"INSERT INTO inventory ({', '.join(names)}) VALUES ({placeholders}) RETURNING product_id",
        values
    )
    row = cur.fetchone()
    return row[0] if row and not isinstance(row, dict) else (row.get('product_id') if row else None)

def main():
    from database import get_connection, add_product_variant

    conn = get_connection()
    try:
        cols = get_inventory_columns(conn)
        establishment_id = get_establishment_id(conn)
        if not establishment_id:
            raise SystemExit("No establishment found. Create one first.")
    finally:
        conn.close()

    # ---- Drinks ----
    drinks = [
        ('Coffee', 'DRINK-COFFEE', 'Beverages > Hot', [('Small', 2.50, 0.50), ('Medium', 3.00, 0.60), ('Large', 3.50, 0.70)]),
        ('Iced Coffee', 'DRINK-ICED-COFFEE', 'Beverages > Cold', [('Small', 3.00, 0.60), ('Medium', 3.50, 0.70), ('Large', 4.00, 0.80)]),
        ('Soda', 'DRINK-SODA', 'Beverages > Cold', [('Small', 1.50, 0.20), ('Medium', 2.00, 0.25), ('Large', 2.50, 0.30)]),
        ('Lemonade', 'DRINK-LEMONADE', 'Beverages > Cold', [('Small', 2.00, 0.30), ('Medium', 2.50, 0.40), ('Large', 3.00, 0.50)]),
        ('Tea', 'DRINK-TEA', 'Beverages > Hot', [('Small', 2.00, 0.25), ('Medium', 2.50, 0.30), ('Large', 3.00, 0.40)]),
        ('Smoothie', 'DRINK-SMOOTHIE', 'Beverages > Cold', [('Small', 4.00, 1.00), ('Medium', 5.00, 1.25), ('Large', 6.00, 1.50)]),
    ]
    for name, sku, category, variants in drinks:
        conn = get_connection()
        try:
            try:
                pid = insert_product(conn, cols, establishment_id, name, sku, variants[0][1], variants[0][2], category)
                conn.commit()
                for i, (vname, price, cost) in enumerate(variants):
                    add_product_variant(pid, vname, price, cost, sort_order=i)
                print(f"Added drink: {name} with variants {[v[0] for v in variants]}")
            except Exception as e:
                conn.rollback()
                if 'already exists' in str(e).lower() or 'unique' in str(e).lower():
                    print(f"Skip (exists): {name} / {sku}")
                else:
                    raise
        finally:
            conn.close()

    # ---- Pizza ----
    pizzas = [
        ('Cheese Pizza', 'PIZZA-CHEESE', 'Food > Pizza', [
            ('Slice', 3.50, 0.80), ('10" Small', 12.00, 3.00), ('12" Medium', 15.00, 3.75), ('14" Large', 18.00, 4.50),
        ]),
        ('Pepperoni Pizza', 'PIZZA-PEPPERONI', 'Food > Pizza', [
            ('Slice', 4.00, 1.00), ('10" Small', 14.00, 3.50), ('12" Medium', 17.00, 4.25), ('14" Large', 20.00, 5.00),
        ]),
        ('House Pizza', 'PIZZA-HOUSE', 'Food > Pizza', [
            ('Slice', 4.50, 1.10), ('10" Small', 15.00, 3.75), ('12" Medium', 18.00, 4.50), ('14" Large', 21.00, 5.25),
        ]),
    ]
    for name, sku, category, variants in pizzas:
        conn = get_connection()
        try:
            try:
                pid = insert_product(conn, cols, establishment_id, name, sku, variants[0][1], variants[0][2], category)
                conn.commit()
                for i, (vname, price, cost) in enumerate(variants):
                    add_product_variant(pid, vname, price, cost, sort_order=i)
                print(f"Added pizza: {name} with variants {[v[0] for v in variants]}")
            except Exception as e:
                conn.rollback()
                if 'already exists' in str(e).lower() or 'unique' in str(e).lower():
                    print(f"Skip (exists): {name} / {sku}")
                else:
                    raise
        finally:
            conn.close()

    print("Done. Customize POS search filters via GET/POST /api/pos-search-filters.")

if __name__ == '__main__':
    main()
