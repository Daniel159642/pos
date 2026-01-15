#!/usr/bin/env python3
"""
Example usage of the Product Image Matcher
"""

from product_image_matcher import ProductImageMatcher
import os

def main():
    print("=" * 60)
    print("Product Image Matcher - Example Usage")
    print("=" * 60)
    
    # Initialize matcher
    print("\n1. Initializing image matcher...")
    matcher = ProductImageMatcher(model_name='efficientnet_b0')
    
    # Build product database (one-time setup)
    print("\n2. Building product database from inventory...")
    print("   This extracts embeddings from all product images in the database.")
    matcher.build_product_database(rebuild_existing=False)
    
    # Or load from existing database/file
    print("\n3. Loading embeddings from database...")
    matcher.load_from_database()
    
    # Example: Identify a product from an image
    print("\n4. Example: Identifying a product from an image...")
    query_image = input("Enter path to query image (or press Enter to skip): ").strip()
    
    if query_image and os.path.exists(query_image):
        results = matcher.identify_product(
            query_image_path=query_image,
            top_k=5,
            threshold=0.7
        )
        
        if results:
            print(f"\n✓ Found {len(results)} match(es):")
            for i, result in enumerate(results, 1):
                print(f"\n  Match {i}:")
                print(f"    Product: {result['name']}")
                print(f"    SKU: {result['sku']}")
                print(f"    Confidence: {result['confidence']:.2%}")
                print(f"    Category: {result['category']}")
                print(f"    Product ID: {result['product_id']}")
        else:
            print("\n✗ No matches found above threshold (0.7)")
    else:
        print("   Skipped (no image provided)")
    
    # Example: Batch identify shipment
    print("\n5. Example: Batch identifying products from shipment...")
    shipment_images = input("Enter comma-separated image paths (or press Enter to skip): ").strip()
    
    if shipment_images:
        image_paths = [path.strip() for path in shipment_images.split(',')]
        existing_paths = [p for p in image_paths if os.path.exists(p)]
        
        if existing_paths:
            identified = matcher.batch_identify_shipment(existing_paths, threshold=0.75)
            
            print(f"\n✓ Identified {len(identified)} items:")
            for item in identified:
                if item.get('match'):
                    match = item['match']
                    print(f"  {item['image']}: {match['name']} (SKU: {match['sku']}, Confidence: {match['confidence']:.2%})")
                else:
                    print(f"  {item['image']}: No match found")
        else:
            print("   No valid image paths found")
    else:
        print("   Skipped (no images provided)")
    
    print("\n" + "=" * 60)
    print("Example completed!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Use the Flask API endpoints in web_viewer.py for mobile app integration")
    print("2. Call /api/identify_product with POST request containing image file")
    print("3. Call /api/identify_shipment for batch identification")
    print("4. View identification history at /api/image_identifications")


if __name__ == '__main__':
    main()











