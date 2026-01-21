#!/usr/bin/env python3
"""
Generate barcode images for products with barcodes
Creates scannable barcode images that can be used for testing
"""

import os
from database import get_connection, list_products

try:
    import barcode
    from barcode.writer import ImageWriter
    BARCODE_AVAILABLE = True
except ImportError:
    BARCODE_AVAILABLE = False
    print("Warning: python-barcode not installed. Install with: pip install python-barcode[images]")

def generate_barcode_image(barcode_value: str, product_name: str, output_dir: str = "barcode_images"):
    """
    Generate a barcode image for a given barcode value
    
    Args:
        barcode_value: The barcode number (string)
        product_name: Product name for filename
        output_dir: Directory to save images
    """
    if not BARCODE_AVAILABLE:
        return None
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Clean product name for filename
    safe_name = "".join(c for c in product_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')[:50]  # Limit length
    
    try:
        # Use Code128 format (supports alphanumeric, widely compatible)
        # For numeric-only, we could use EAN13 or Code39
        if barcode_value.isdigit() and len(barcode_value) == 12:
            # Use EAN13 format for 12-digit codes (add leading 0 to make 13 digits)
            code = barcode.get('ean13', '0' + barcode_value, writer=ImageWriter())
        elif barcode_value.isdigit():
            # Use Code128 for other numeric codes
            code = barcode.get('code128', barcode_value, writer=ImageWriter())
        else:
            # Use Code128 for alphanumeric
            code = barcode.get('code128', barcode_value, writer=ImageWriter())
        
        # Configure writer options
        options = {
            'module_width': 0.5,
            'module_height': 15.0,
            'quiet_zone': 6.5,
            'font_size': 10,
            'text_distance': 5.0,
            'background': 'white',
            'foreground': 'black',
            'write_text': True,
            'text': barcode_value
        }
        
        # Generate and save barcode
        filename = f"{safe_name}_{barcode_value}"
        filepath = os.path.join(output_dir, filename)
        code.save(filepath, options=options)
        
        return filepath + '.png'
    except Exception as e:
        print(f"  ✗ Error generating barcode image: {e}")
        return None

def main():
    """Generate barcode images for all products with barcodes"""
    if not BARCODE_AVAILABLE:
        print("Please install python-barcode first:")
        print("  pip install python-barcode[images]")
        return
    
    print("Generating barcode images for test products...\n")
    
    # Get all products
    products = list_products()
    
    if not products:
        print("No products found in database.")
        return
    
    # Filter products with barcodes
    products_with_barcodes = [
        p for p in products 
        if p.get('barcode') and p.get('barcode').strip() != ''
    ]
    
    if not products_with_barcodes:
        print("No products with barcodes found.")
        print("Run generate_test_barcodes.py first to generate barcodes.")
        return
    
    print(f"Found {len(products_with_barcodes)} products with barcodes.\n")
    
    output_dir = "barcode_images"
    generated_count = 0
    failed_count = 0
    
    for product in products_with_barcodes:
        product_id = product['product_id']
        product_name = product.get('product_name', f'Product_{product_id}')
        sku = product.get('sku', '')
        barcode_value = product.get('barcode', '').strip()
        
        print(f"Generating barcode for: {product_name}")
        print(f"  Product ID: {product_id}, SKU: {sku}")
        print(f"  Barcode: {barcode_value}")
        
        image_path = generate_barcode_image(barcode_value, product_name, output_dir)
        
        if image_path:
            print(f"  ✓ Saved: {image_path}\n")
            generated_count += 1
        else:
            print(f"  ✗ Failed to generate image\n")
            failed_count += 1
    
    print(f"\n{'='*50}")
    print(f"Summary:")
    print(f"  Generated: {generated_count} barcode images")
    print(f"  Failed: {failed_count} images")
    print(f"  Output directory: {os.path.abspath(output_dir)}")
    print(f"{'='*50}\n")
    
    if generated_count > 0:
        print("Barcode images generated successfully!")
        print(f"\nYou can find the images in: {os.path.abspath(output_dir)}")
        print("\nTo test:")
        print("  1. Open the barcode images on your phone/tablet")
        print("  2. Use the camera scanner in the POS system")
        print("  3. Point the camera at the barcode image\n")

if __name__ == "__main__":
    main()


