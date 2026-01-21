#!/usr/bin/env python3
"""Fix missing metadata for products that don't have it"""

from database import get_connection, get_product, extract_metadata_for_product

def fix_missing_metadata():
    """Extract metadata for all products that don't have it"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Find products without metadata
    cursor.execute("""
        SELECT i.product_id, i.product_name, i.sku
        FROM inventory i
        LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
        WHERE pm.metadata_id IS NULL
        ORDER BY i.product_id
    """)
    
    products = cursor.fetchall()
    print(f"Found {len(products)} products without metadata")
    print("=" * 70)
    
    if len(products) == 0:
        print("All products already have metadata!")
        conn.close()
        return
    
    success_count = 0
    fail_count = 0
    
    for product in products:
        product_id = product['product_id']
        product_name = product['product_name']
        sku = product['sku']
        
        print(f"\nExtracting metadata for:")
        print(f"  Product ID: {product_id}")
        print(f"  Name: {product_name}")
        print(f"  SKU: {sku}")
        
        try:
            extract_metadata_for_product(product_id, auto_sync_category=True)
            print(f"  ✓ Success - metadata extracted and category assigned")
            success_count += 1
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            fail_count += 1
            import traceback
            traceback.print_exc()
    
    conn.close()
    
    print("\n" + "=" * 70)
    print(f"Summary:")
    print(f"  Total products processed: {len(products)}")
    print(f"  Successfully extracted: {success_count}")
    print(f"  Failed: {fail_count}")
    print("=" * 70)

if __name__ == '__main__':
    fix_missing_metadata()

