#!/usr/bin/env python3
"""
Example usage of the Barcode Scanner
"""

from barcode_scanner import BarcodeScanner, smart_product_identification
from product_image_matcher import ProductImageMatcher
import os

def main():
    print("=" * 60)
    print("Barcode Scanner - Example Usage")
    print("=" * 60)
    
    # Initialize scanner
    print("\n1. Initializing barcode scanner...")
    try:
        scanner = BarcodeScanner()
        print("✓ Barcode scanner initialized")
    except ImportError as e:
        print(f"✗ Error: {e}")
        print("Install dependencies: pip install pyzbar opencv-python")
        return
    
    # Example: Scan barcode from image
    print("\n2. Example: Scanning barcode from image...")
    query_image = input("Enter path to image with barcode (or press Enter to skip): ").strip()
    
    if query_image and os.path.exists(query_image):
        try:
            # Scan barcode
            result = scanner.identify_product(query_image)
            
            if result and result.get('product'):
                print(f"\n✓ Product found via barcode:")
                product = result['product']
                print(f"    Product: {product.get('product_name')}")
                print(f"    SKU: {product.get('sku')}")
                print(f"    Barcode: {result.get('barcode', {}).get('data')}")
                print(f"    Barcode Type: {result.get('barcode', {}).get('type')}")
            elif result and result.get('barcode'):
                print(f"\n✓ Barcode found but product not in database:")
                print(f"    Barcode: {result['barcode']['data']}")
                print(f"    Type: {result['barcode']['type']}")
                print(f"    Message: {result.get('message')}")
            else:
                print("\n✗ No barcode found in image")
        except Exception as e:
            print(f"\n✗ Error: {e}")
    else:
        print("   Skipped (no image provided)")
    
    # Example: Smart identification (barcode + image matching)
    print("\n3. Example: Smart identification (barcode first, then image matching)...")
    smart_image = input("Enter path to image (or press Enter to skip): ").strip()
    
    if smart_image and os.path.exists(smart_image):
        try:
            # Initialize image matcher if available
            image_matcher = None
            try:
                image_matcher = ProductImageMatcher()
                image_matcher.load_from_database()
                print("   Image matcher loaded")
            except:
                print("   Image matcher not available (will use barcode only)")
            
            # Smart identification
            result = smart_product_identification(
                image_path=smart_image,
                barcode_scanner=scanner,
                image_matcher=image_matcher,
                prefer_barcode=True
            )
            
            if result.get('product'):
                product = result['product']
                print(f"\n✓ Product identified via {result.get('method')}:")
                print(f"    Product: {product.get('product_name')}")
                print(f"    SKU: {product.get('sku')}")
                print(f"    Confidence: {result.get('confidence', 1.0):.2%}")
                if result.get('barcode'):
                    print(f"    Barcode: {result['barcode']['data']}")
            else:
                print(f"\n✗ No product identified")
                print(f"    Message: {result.get('message')}")
        except Exception as e:
            print(f"\n✗ Error: {e}")
    else:
        print("   Skipped (no image provided)")
    
    # Example: Batch scan
    print("\n4. Example: Batch scanning multiple images...")
    batch_images = input("Enter comma-separated image paths (or press Enter to skip): ").strip()
    
    if batch_images:
        image_paths = [path.strip() for path in batch_images.split(',')]
        existing_paths = [p for p in image_paths if os.path.exists(p)]
        
        if existing_paths:
            try:
                results = scanner.batch_scan(existing_paths)
                
                print(f"\n✓ Scanned {len(results)} images:")
                for item in results:
                    if item.get('product'):
                        product = item['product']
                        print(f"  {item['image']}: {product.get('product_name')} (SKU: {product.get('sku')})")
                    elif item.get('barcode'):
                        print(f"  {item['image']}: Barcode {item['barcode']['data']} (product not found)")
                    else:
                        print(f"  {item['image']}: {item.get('message', 'No barcode found')}")
            except Exception as e:
                print(f"\n✗ Error: {e}")
        else:
            print("   No valid image paths found")
    else:
        print("   Skipped (no images provided)")
    
    print("\n" + "=" * 60)
    print("Example completed!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Use /api/scan_barcode for barcode-only scanning")
    print("2. Use /api/identify_product for smart identification (barcode + image matching)")
    print("3. Add barcode field to products in database for better matching")


if __name__ == '__main__':
    main()

