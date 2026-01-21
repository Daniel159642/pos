#!/usr/bin/env python3
"""
Batch process metadata extraction for all products
Completely FREE - no API costs
Run this periodically to extract metadata for products
"""

import sys
import json
import sqlite3
from metadata_extraction import FreeMetadataSystem
from database import get_connection, DB_NAME

def batch_process_all_products(limit=None):
    """
    Process all products without metadata
    Completely FREE - no API costs
    """
    
    metadata_system = FreeMetadataSystem()
    
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get products without metadata or with outdated metadata
    query = """
        SELECT i.*
        FROM inventory i
        LEFT JOIN product_metadata pm ON i.product_id = pm.product_id
        WHERE pm.metadata_id IS NULL OR pm.updated_at < i.updated_at
        ORDER BY i.created_at DESC
    """
    
    if limit:
        query += f" LIMIT {limit}"
    
    cursor.execute(query)
    products = cursor.fetchall()
    
    print(f"Processing {len(products)} products...")
    print("-" * 70)
    
    success_count = 0
    error_count = 0
    
    for idx, product in enumerate(products, 1):
        try:
            # Convert Row to dict for easier access (sqlite3.Row doesn't have .get() method)
            product_dict = dict(product)
            print(f"[{idx}/{len(products)}] Processing: {product_dict['product_name']}")
            
            # Extract metadata (FREE)
            metadata = metadata_system.extract_metadata_from_product(
                product_dict['product_name'],
                product_dict.get('barcode'),
                None  # No description field in current schema
            )
            
            # Save
            metadata_system.save_product_metadata(
                product_dict['product_id'],
                metadata,
                'batch_free'
            )
            
            # Get category name safely
            category_name = 'N/A'
            category_suggestions = metadata.get('category_suggestions', [])
            if category_suggestions and len(category_suggestions) > 0:
                category_name = category_suggestions[0].get('category_name', 'N/A')
            
            print(f"  ✓ Completed - Brand: {metadata.get('brand', 'N/A')}, Category: {category_name}")
            success_count += 1
            
        except Exception as e:
            print(f"  ✗ Error: {e}")
            import traceback
            traceback.print_exc()
            error_count += 1
    
    cursor.close()
    conn.close()
    
    # Auto-categorize after processing (only if scikit-learn is available)
    if success_count > 0:
        print("\n" + "-" * 70)
        print("Auto-categorizing products using K-Means clustering...")
        try:
            metadata_system.auto_categorize_products_kmeans()
            print("✓ Auto-categorization completed")
            
            # Sync categories to inventory table for frontend display
            print("\nSyncing categories to inventory table...")
            try:
                from sync_categories_to_inventory import sync_categories
                sync_categories()
            except Exception as sync_error:
                print(f"⚠ Category sync error: {sync_error}")
        except Exception as e:
            # Silently skip if scikit-learn not available
            if "scikit-learn" in str(e):
                print("⚠ Auto-categorization skipped (scikit-learn not installed)")
            else:
                print(f"⚠ Auto-categorization error: {e}")
    
    print("\n" + "=" * 70)
    print(f"Batch completed: {success_count} products processed successfully, {error_count} errors")
    print(f"Total cost: $0.00 (100% FREE!)")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Batch process metadata extraction')
    parser.add_argument('--limit', type=int, help='Limit number of products to process')
    args = parser.parse_args()
    
    batch_process_all_products(limit=args.limit)

