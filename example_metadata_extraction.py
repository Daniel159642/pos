#!/usr/bin/env python3
"""
Example usage of the FREE metadata extraction system
"""

from metadata_extraction import FreeMetadataSystem
from database import get_product, list_products

def example_extract_single_product():
    """Example: Extract metadata for a single product"""
    
    print("=" * 70)
    print("Example 1: Extract Metadata for Single Product")
    print("=" * 70)
    
    # Initialize system
    metadata_system = FreeMetadataSystem()
    
    # Example product name
    product_name = "Nike Air Max Running Shoes Size 10 Black"
    barcode = None
    
    # Extract metadata
    print(f"\nProduct: {product_name}")
    metadata = metadata_system.extract_metadata_from_product(
        product_name=product_name,
        barcode=barcode,
        description="High-performance running shoes with air cushioning technology"
    )
    
    # Display results
    print("\nExtracted Metadata:")
    print(f"  Brand: {metadata.get('brand', 'N/A')}")
    print(f"  Keywords: {', '.join(metadata.get('keywords', [])[:10])}")
    print(f"  Tags: {', '.join(metadata.get('tags', [])[:5])}")
    print(f"  Attributes: {metadata.get('attributes', {})}")
    
    category_suggestion = metadata.get('category_suggestions', [None])[0]
    if category_suggestion:
        print(f"  Category: {category_suggestion.get('category_name')} (confidence: {category_suggestion.get('confidence', 0):.2f})")
    
    print(f"\n  Execution time: {metadata.get('execution_time_ms', 0)}ms")
    print(f"  Cost: $0.00 (100% FREE!)")


def example_process_existing_product():
    """Example: Process an existing product from database"""
    
    print("\n" + "=" * 70)
    print("Example 2: Process Existing Product from Database")
    print("=" * 70)
    
    # Initialize system
    metadata_system = FreeMetadataSystem()
    
    # Get products from database
    products = list_products(limit=5)
    
    if not products:
        print("\nNo products found in database. Add some products first!")
        return
    
    # Process first product
    product = products[0]
    print(f"\nProcessing product: {product['product_name']}")
    
    # Extract metadata
    metadata = metadata_system.extract_metadata_from_product(
        product_name=product['product_name'],
        barcode=product.get('barcode'),
        description=None
    )
    
    # Save to database
    metadata_system.save_product_metadata(
        product_id=product['product_id'],
        metadata=metadata,
        extraction_method='example'
    )
    
    print(f"✓ Metadata saved to database")
    print(f"  Brand: {metadata.get('brand', 'N/A')}")
    print(f"  Category: {metadata.get('category_suggestions', [{}])[0].get('category_name', 'N/A')}")


def example_search():
    """Example: Intelligent search"""
    
    print("\n" + "=" * 70)
    print("Example 3: Intelligent Search")
    print("=" * 70)
    
    # Initialize system
    metadata_system = FreeMetadataSystem()
    
    # Search query
    query = "running shoes"
    print(f"\nSearch query: '{query}'")
    
    # Perform search
    results = metadata_system.intelligent_search(query, limit=5)
    
    print(f"\nFound {len(results)} results:\n")
    
    for idx, result in enumerate(results, 1):
        print(f"{idx}. {result.get('product_name', 'N/A')}")
        print(f"   Relevance: {result.get('relevance_score', 0):.3f}")
        print(f"   Price: ${result.get('product_price', 0):.2f}")
        if result.get('brand'):
            print(f"   Brand: {result['brand']}")
        print()
    
    print(f"Cost: $0.00 (100% FREE!)")


def example_auto_categorize():
    """Example: Auto-categorize products"""
    
    print("\n" + "=" * 70)
    print("Example 4: Auto-Categorize Products with K-Means")
    print("=" * 70)
    
    # Initialize system
    metadata_system = FreeMetadataSystem()
    
    print("\nAuto-categorizing products using K-Means clustering...")
    print("(This may take a moment for large inventories)")
    
    try:
        metadata_system.auto_categorize_products_kmeans(min_products_per_category=5)
        print("\n✓ Auto-categorization completed!")
        print("  Cost: $0.00 (100% FREE!)")
    except Exception as e:
        print(f"\n⚠ Error: {e}")
        print("  (This is normal if you don't have enough products with metadata)")


if __name__ == '__main__':
    import json
    
    print("\n")
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "FREE Metadata Extraction Examples" + " " * 20 + "║")
    print("╚" + "═" * 68 + "╝")
    print("\n")
    
    try:
        # Example 1: Extract from single product name
        example_extract_single_product()
        
        # Example 2: Process existing product (requires database)
        try:
            example_process_existing_product()
        except Exception as e:
            print(f"\n⚠ Skipping database example: {e}")
        
        # Example 3: Search (requires products with metadata in database)
        try:
            example_search()
        except Exception as e:
            print(f"\n⚠ Skipping search example: {e}")
        
        # Example 4: Auto-categorize (requires products with metadata)
        try:
            example_auto_categorize()
        except Exception as e:
            print(f"\n⚠ Skipping auto-categorize example: {e}")
        
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("Examples completed!")
    print("=" * 70)
    print("\nRemember: All of this is 100% FREE - no API costs!")
    print("\n")

