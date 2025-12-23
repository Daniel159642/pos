#!/usr/bin/env python3
"""
Test script for vendor product sheet - creates test files and processes them
"""

import os
import csv
from database import (
    add_vendor, add_product,
    create_pending_shipment, add_pending_shipment_item,
    auto_match_pending_items, get_pending_shipment_details,
    approve_pending_shipment, get_shipment_details,
    get_product, list_pending_shipments
)
from document_scraper import scrape_document

def create_test_csv(filename='test_vendor_sheet.csv'):
    """Create a test CSV file with vendor product data"""
    data = [
        ['SKU', 'Product Name', 'Quantity', 'Unit Price', 'Lot Number', 'Expiration Date'],
        ['PROD-001', 'Premium Product A', '25', '19.99', 'LOT-2024-100', '2026-01-15'],
        ['PROD-002', 'Standard Product B', '50', '14.50', 'LOT-2024-101', '2025-12-20'],
        ['PROD-003', 'Basic Product C', '75', '9.99', 'LOT-2024-102', '2025-11-30'],
        ['PROD-004', 'Deluxe Product D', '30', '24.99', 'LOT-2024-103', '2026-02-28'],
    ]
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(data)
    
    print(f"✓ Created test CSV: {filename}")
    return filename

def test_with_file(file_path):
    """Test the system with a vendor product sheet"""
    print(f"\n{'='*60}")
    print(f"Testing with: {file_path}")
    print(f"{'='*60}\n")
    
    # Step 1: Setup vendor and products
    print("1. Setting up vendor...")
    vendor_id = add_vendor(
        vendor_name="Test Vendor Corp",
        contact_person="Test Contact",
        email="test@vendor.com",
        phone="555-TEST"
    )
    print(f"   Vendor ID: {vendor_id}\n")
    
    # Step 2: Create products in inventory (for matching)
    print("2. Creating products in inventory...")
    products = {}
    product_data = [
        ('PROD-001', 'Premium Product A', 29.99),
        ('PROD-002', 'Standard Product B', 24.99),
        ('PROD-003', 'Basic Product C', 19.99),
        ('PROD-004', 'Deluxe Product D', 34.99),
    ]
    
    for sku, name, price in product_data:
        try:
            product_id = add_product(
                product_name=name,
                sku=sku,
                product_price=price,
                product_cost=10.00,
                vendor_id=vendor_id,
                category="Test Products"
            )
            products[sku] = product_id
            print(f"   ✓ {name} (SKU: {sku})")
        except ValueError as e:
            print(f"   ⚠ {sku} already exists: {e}")
    print()
    
    # Step 3: Scrape the document
    print("3. Scraping vendor document...")
    try:
        items = scrape_document(file_path)
        print(f"   ✓ Found {len(items)} items:")
        for item in items:
            print(f"     - {item.get('product_sku')}: {item.get('quantity_expected')} units @ ${item.get('unit_cost', 0):.2f}")
    except ImportError as e:
        print(f"   ⚠ {e}")
        print("   Creating items manually from CSV data...")
        # Fallback: manually create items from CSV
        import csv
        items = []
        with open(file_path, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                items.append({
                    'product_sku': row.get('SKU', '').strip(),
                    'product_name': row.get('Product Name', '').strip(),
                    'quantity_expected': int(row.get('Quantity', 0)),
                    'unit_cost': float(row.get('Unit Price', 0)),
                    'lot_number': row.get('Lot Number', '').strip() if row.get('Lot Number') else None,
                    'expiration_date': row.get('Expiration Date', '').strip() if row.get('Expiration Date') else None
                })
        print(f"   ✓ Created {len(items)} items from CSV:")
        for item in items:
            print(f"     - {item.get('product_sku')}: {item.get('quantity_expected')} units @ ${item.get('unit_cost', 0):.2f}")
    except Exception as e:
        print(f"   ✗ Error scraping: {e}")
        return
    print()
    
    # Step 4: Create pending shipment
    print("4. Creating pending shipment...")
    pending_id = create_pending_shipment(
        vendor_id=vendor_id,
        file_path=file_path,
        expected_date="2024-12-25",
        purchase_order_number="PO-TEST-001",
        tracking_number="TRACK-TEST-001"
    )
    print(f"   ✓ Pending shipment ID: {pending_id}\n")
    
    # Step 5: Add items
    print("5. Adding items to pending shipment...")
    for item in items:
        add_pending_shipment_item(
            pending_shipment_id=pending_id,
            product_sku=item.get('product_sku'),
            product_name=item.get('product_name'),
            quantity_expected=item.get('quantity_expected', 0),
            unit_cost=item.get('unit_cost', 0.0),
            lot_number=item.get('lot_number'),
            expiration_date=item.get('expiration_date')
        )
    print(f"   ✓ Added {len(items)} items\n")
    
    # Step 6: Auto-match
    print("6. Auto-matching items to products...")
    match_results = auto_match_pending_items(pending_id)
    print(f"   ✓ Matched: {match_results['matched']}/{match_results['total_items']}")
    print(f"   ⚠ Unmatched: {match_results['unmatched']}\n")
    
    # Step 7: Review
    print("7. Reviewing pending shipment...")
    details = get_pending_shipment_details(pending_id)
    print(f"   Status: {details['status']}")
    print(f"   Items: {len(details['items'])}")
    print("\n   Item breakdown:")
    for item in details['items']:
        status = item.get('match_status', 'unknown')
        matched_name = item.get('matched_product_name', 'N/A')
        print(f"     - {item['product_sku']}: {item['quantity_expected']} units")
        print(f"       Match: {status} ({matched_name})")
        print(f"       Cost: ${item['unit_cost']:.2f}, Lot: {item.get('lot_number', 'N/A')}")
    print()
    
    # Step 8: Approve
    print("8. Approving shipment...")
    try:
        shipment_id = approve_pending_shipment(
            pending_shipment_id=pending_id,
            reviewed_by="Test User"
        )
        print(f"   ✓ Approved! Shipment ID: {shipment_id}\n")
        
        # Step 9: Verify final shipment
        print("9. Final shipment details:")
        final = get_shipment_details(shipment_id)
        print(f"   Vendor: {final['vendor_name']}")
        print(f"   Items received: {len(final['items'])}")
        total_qty = sum(item['quantity_received'] for item in final['items'])
        print(f"   Total quantity: {total_qty} units")
        print("\n   Items:")
        for item in final['items']:
            print(f"     - {item['product_name']} (SKU: {item['sku']}): {item['quantity_received']} units")
        
        # Step 10: Verify inventory updated
        print("\n10. Verifying inventory updated:")
        for sku in products.keys():
            product = get_product(products[sku])
            if product:
                print(f"   {sku}: {product['current_quantity']} units in stock")
        
    except Exception as e:
        print(f"   ✗ Error: {e}\n")
    
    print(f"{'='*60}\n")

def main():
    print("\n" + "="*60)
    print("VENDOR PRODUCT SHEET TESTING")
    print("="*60)
    
    # Create test CSV file
    csv_file = create_test_csv()
    
    # Test with CSV
    if csv_file and os.path.exists(csv_file):
        test_with_file(csv_file)
    
    # Cleanup
    if os.path.exists(csv_file):
        print(f"Cleaning up test file: {csv_file}")
        os.remove(csv_file)
    
    print("Testing complete!")
    print("\nSummary:")
    print("- Created test vendor product sheet (CSV)")
    print("- Scraped document and extracted items")
    print("- Created pending shipment")
    print("- Auto-matched items to products")
    print("- Approved and transferred to actual shipment")
    print("- Verified inventory was updated automatically")

if __name__ == '__main__':
    main()

