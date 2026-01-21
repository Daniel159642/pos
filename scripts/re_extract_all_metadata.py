#!/usr/bin/env python3
"""Re-extract metadata for all existing products with the new human-like metadata system"""

from database import get_connection, extract_metadata_for_product

def re_extract_all_metadata():
    """Re-extract metadata for all products in inventory with the new human-like system"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get all products
    cursor.execute("""
        SELECT product_id, product_name, sku
        FROM inventory
        ORDER BY product_id
    """)
    
    products = cursor.fetchall()
    print(f"Found {len(products)} products to update")
    print("=" * 70)
    
    if len(products) == 0:
        print("No products found in inventory!")
        conn.close()
        return
    
    success_count = 0
    fail_count = 0
    
    for idx, product in enumerate(products, 1):
        product_id = product['product_id']
        product_name = product['product_name']
        sku = product['sku']
        
        print(f"\n[{idx}/{len(products)}] Re-extracting metadata for:")
        print(f"  Product ID: {product_id}")
        print(f"  Name: {product_name}")
        print(f"  SKU: {sku}")
        
        try:
            # Re-extract metadata (this will update existing metadata with new human-like attributes)
            extract_metadata_for_product(product_id, auto_sync_category=True)
            print(f"  ✓ Success - metadata updated with human-like attributes")
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
    print(f"  Successfully updated: {success_count}")
    print(f"  Failed: {fail_count}")
    print("=" * 70)
    print("\nAll products now have human-like metadata:")
    print("  - Type (fruit, vegetable, dairy, etc.)")
    print("  - Texture (crunchy, crisp, juicy, etc.)")
    print("  - Taste (sweet, mild, creamy, etc.)")
    print("  - Uses (snack, salad, cooking, etc.)")
    print("  - Characteristics (refreshing, healthy, etc.)")
    print("  - Storage instructions")
    print("  - Human-readable descriptions")

if __name__ == '__main__':
    re_extract_all_metadata()
