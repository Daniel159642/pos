#!/usr/bin/env python3
"""
Sync categories from product_metadata to inventory.category field
This updates the inventory table so the frontend can display categories
"""

from database import get_connection

def sync_categories():
    """Update inventory.category from product_metadata categories"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("Syncing categories from metadata to inventory table...")
    print("-" * 60)
    
    # Get all products with metadata categories
    cursor.execute("""
        SELECT 
            i.product_id,
            i.product_name,
            i.category as current_category,
            c.category_name as metadata_category
        FROM inventory i
        LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
        LEFT JOIN categories c ON pm.category_id = c.category_id
        WHERE c.category_name IS NOT NULL
    """)
    
    products = cursor.fetchall()
    
    updated = 0
    for product_id, product_name, current_category, metadata_category in products:
        if current_category != metadata_category:
            cursor.execute("""
                UPDATE inventory 
                SET category = ?, updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ?
            """, (metadata_category, product_id))
            
            print(f"✓ Updated: {product_name}")
            print(f"  Old: {current_category or 'None'}")
            print(f"  New: {metadata_category}")
            updated += 1
    
    conn.commit()
    conn.close()
    
    print("-" * 60)
    print(f"✓ Updated {updated} products with categories")
    print("Categories are now visible in the frontend!")

if __name__ == '__main__':
    sync_categories()

