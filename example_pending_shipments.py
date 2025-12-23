#!/usr/bin/env python3
"""
Example workflow for pending shipments with document scraping
Demonstrates: upload -> scrape -> review -> approve
"""

import os
import csv
from database import (
    add_vendor, add_product,
    create_pending_shipment, add_pending_shipment_item,
    get_pending_shipment_details, list_pending_shipments,
    update_pending_item_verification, auto_match_pending_items,
    approve_pending_shipment, get_shipment_details
)
from document_scraper import scrape_document

def create_sample_csv(filename: str):
    """Create a sample CSV file for demonstration"""
    data = [
        ['SKU', 'Product Name', 'Quantity', 'Unit Price', 'Lot Number', 'Expiration Date'],
        ['WID-001', 'Premium Widget', '50', '15.00', 'LOT-2024-001', '2025-12-31'],
        ['WID-002', 'Standard Widget', '100', '12.50', 'LOT-2024-002', '2025-11-30'],
        ['WID-003', 'Basic Widget', '75', '10.00', 'LOT-2024-003', '2025-10-31'],
    ]
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(data)
    
    print(f"Created sample CSV file: {filename}")

def main():
    print("=== Pending Shipments Workflow Example ===\n")
    
    # Step 1: Setup - Create vendor and products
    print("1. Setting up vendor and products...")
    vendor_id = add_vendor(
        vendor_name="Widget Suppliers Inc",
        contact_person="Jane Smith",
        email="jane@widgetsuppliers.com",
        phone="555-0100"
    )
    print(f"   Vendor created: ID {vendor_id}\n")
    
    # Create products that match the CSV
    products = {}
    for sku, name, price in [('WID-001', 'Premium Widget', 29.99),
                            ('WID-002', 'Standard Widget', 24.99),
                            ('WID-003', 'Basic Widget', 19.99)]:
        product_id = add_product(
            product_name=name,
            sku=sku,
            product_price=price,
            product_cost=10.00,
            vendor_id=vendor_id,
            category="Widgets"
        )
        products[sku] = product_id
        print(f"   Product created: {name} (SKU: {sku}, ID: {product_id})")
    print()
    
    # Step 2: Create sample CSV file
    print("2. Creating sample shipment document...")
    csv_file = 'sample_shipment.csv'
    create_sample_csv(csv_file)
    print()
    
    # Step 3: Scrape the document
    print("3. Scraping document...")
    try:
        items = scrape_document(csv_file)
        print(f"   Found {len(items)} items in document:")
        for item in items:
            print(f"     - {item.get('product_sku')}: {item.get('quantity_expected')} units @ ${item.get('unit_cost', 0):.2f}")
        print()
    except ImportError as e:
        print(f"   Error: {e}")
        print("   Install required packages: pip install pandas openpyxl")
        print("   Creating pending shipment manually instead...\n")
        items = [
            {'product_sku': 'WID-001', 'product_name': 'Premium Widget', 'quantity_expected': 50, 'unit_cost': 15.00, 'lot_number': 'LOT-2024-001', 'expiration_date': '2025-12-31'},
            {'product_sku': 'WID-002', 'product_name': 'Standard Widget', 'quantity_expected': 100, 'unit_cost': 12.50, 'lot_number': 'LOT-2024-002', 'expiration_date': '2025-11-30'},
            {'product_sku': 'WID-003', 'product_name': 'Basic Widget', 'quantity_expected': 75, 'unit_cost': 10.00, 'lot_number': 'LOT-2024-003', 'expiration_date': '2025-10-31'},
        ]
    
    # Step 4: Create pending shipment
    print("4. Creating pending shipment from scraped data...")
    pending_shipment_id = create_pending_shipment(
        vendor_id=vendor_id,
        file_path=csv_file,
        expected_date="2024-12-23",
        notes="Initial shipment from Widget Suppliers"
    )
    print(f"   Pending shipment created: ID {pending_shipment_id}\n")
    
    # Step 5: Add items to pending shipment
    print("5. Adding items to pending shipment...")
    for item in items:
        item_id = add_pending_shipment_item(
            pending_shipment_id=pending_shipment_id,
            product_sku=item.get('product_sku'),
            product_name=item.get('product_name'),
            quantity_expected=item.get('quantity_expected', 0),
            unit_cost=item.get('unit_cost', 0.0),
            lot_number=item.get('lot_number'),
            expiration_date=item.get('expiration_date')
        )
        print(f"   Added item: {item.get('product_sku')} - {item.get('quantity_expected')} units")
    print()
    
    # Step 6: Auto-match items to products
    print("6. Auto-matching items to products...")
    match_results = auto_match_pending_items(pending_shipment_id)
    print(f"   Matched: {match_results['matched']}/{match_results['total_items']} items")
    print(f"   Unmatched: {match_results['unmatched']} items\n")
    
    # Step 7: Review pending shipment
    print("7. Reviewing pending shipment...")
    pending_details = get_pending_shipment_details(pending_shipment_id)
    print(f"   Status: {pending_details['status']}")
    print(f"   Vendor: {pending_details['vendor_name']}")
    print(f"   Items: {len(pending_details['items'])}")
    print("\n   Item details:")
    for item in pending_details['items']:
        match_status = item.get('match_status', 'unknown')
        matched_name = item.get('matched_product_name', 'N/A')
        print(f"     - {item['product_sku']}: {item['quantity_expected']} expected")
        print(f"       Match: {match_status} ({matched_name})")
        print(f"       Cost: ${item['unit_cost']:.2f}, Lot: {item.get('lot_number', 'N/A')}")
    print()
    
    # Step 8: Verify quantities (simulate finding a discrepancy)
    print("8. Verifying quantities (simulating discrepancy check)...")
    # In real scenario, you'd check actual received quantities
    # Here we'll verify one item has a different quantity
    items_list = pending_details['items']
    if items_list:
        first_item = items_list[0]
        # Simulate: expected 50, but actually received 48
        verified_qty = 48
        update_pending_item_verification(
            pending_item_id=first_item['pending_item_id'],
            quantity_verified=verified_qty,
            discrepancy_notes=f"Expected {first_item['quantity_expected']}, received {verified_qty}"
        )
        print(f"   Updated {first_item['product_sku']}: verified quantity = {verified_qty}")
        print(f"   Discrepancy noted: {first_item['quantity_expected'] - verified_qty} units short")
    print()
    
    # Step 9: Approve and transfer to actual shipment
    print("9. Approving pending shipment and transferring to actual shipment...")
    try:
        shipment_id = approve_pending_shipment(
            pending_shipment_id=pending_shipment_id,
            reviewed_by="Admin User",
            notes="Approved with quantity adjustment"
        )
        print(f"   Shipment approved! New shipment ID: {shipment_id}\n")
        
        # Step 10: View final shipment
        print("10. Viewing final shipment details...")
        final_shipment = get_shipment_details(shipment_id)
        print(f"   Shipment ID: {final_shipment['shipment_id']}")
        print(f"   Vendor: {final_shipment['vendor_name']}")
        print(f"   Received Date: {final_shipment['received_date']}")
        print(f"   Items received: {len(final_shipment['items'])}")
        for item in final_shipment['items']:
            print(f"     - {item['product_name']} (SKU: {item['sku']}): {item['quantity_received']} units")
        
    except ValueError as e:
        print(f"   Error: {e}\n")
    
    # Step 11: List all pending shipments
    print("11. Listing all pending shipments...")
    all_pending = list_pending_shipments()
    print(f"   Total pending shipments: {len(all_pending)}")
    for ps in all_pending:
        print(f"     - ID {ps['pending_shipment_id']}: {ps['vendor_name']} - Status: {ps['status']}")
    
    # Cleanup
    if os.path.exists(csv_file):
        os.remove(csv_file)
        print(f"\n   Cleaned up sample file: {csv_file}")
    
    print("\n=== Workflow Complete ===")

if __name__ == '__main__':
    main()

