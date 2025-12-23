#!/usr/bin/env python3
"""
Example usage of the inventory database with shipment tracking
"""

from database import (
    add_product, add_vendor, create_shipment, add_shipment_item,
    trace_product_to_vendors, get_shipment_details, get_product
)

def main():
    print("=== POS Inventory Database Example ===\n")
    
    # Step 1: Add a vendor
    print("1. Adding vendor...")
    vendor_id = add_vendor(
        vendor_name="Widget Co",
        contact_person="John Doe",
        email="john@widgetco.com",
        phone="555-0123",
        address="123 Main St, City, State 12345"
    )
    print(f"   Vendor added with ID: {vendor_id}\n")
    
    # Step 2: Add a product
    print("2. Adding product...")
    product_id = add_product(
        product_name="Premium Widget",
        sku="WID-PREM-001",
        product_price=29.99,
        product_cost=15.00,
        vendor_id=vendor_id,
        current_quantity=0,  # Start with 0, will be updated by shipment
        category="Electronics"
    )
    print(f"   Product added with ID: {product_id}\n")
    
    # Step 3: Create a shipment
    print("3. Creating shipment...")
    shipment_id = create_shipment(
        vendor_id=vendor_id,
        purchase_order_number="PO-2024-001",
        tracking_number="TRACK123456",
        total_cost=1500.00,
        notes="First shipment of the year"
    )
    print(f"   Shipment created with ID: {shipment_id}\n")
    
    # Step 4: Add items to shipment (this automatically updates inventory!)
    print("4. Adding items to shipment (inventory will update automatically)...")
    shipment_item_id = add_shipment_item(
        shipment_id=shipment_id,
        product_id=product_id,
        quantity_received=50,
        unit_cost=15.00,
        lot_number="LOT-2024-001",
        expiration_date="2025-12-31"
    )
    print(f"   Shipment item added with ID: {shipment_item_id}\n")
    
    # Step 5: Check updated inventory
    print("5. Checking updated inventory...")
    product = get_product(product_id)
    print(f"   Product: {product['product_name']}")
    print(f"   Current Quantity: {product['current_quantity']}")
    print(f"   Last Restocked: {product['last_restocked']}\n")
    
    # Step 6: Trace product back to vendors
    print("6. Tracing product back to vendors...")
    history = trace_product_to_vendors(product_id)
    for record in history:
        print(f"   Received {record['quantity_received']} units from {record['vendor_name']}")
        print(f"   Shipment Date: {record['shipment_date']}")
        print(f"   Unit Cost: ${record['unit_cost']:.2f}")
        print(f"   Lot Number: {record['lot_number']}\n")
    
    # Step 7: Get full shipment details
    print("7. Getting full shipment details...")
    shipment = get_shipment_details(shipment_id)
    print(f"   Shipment ID: {shipment['shipment_id']}")
    print(f"   Vendor: {shipment['vendor_name']}")
    print(f"   PO Number: {shipment['purchase_order_number']}")
    print(f"   Tracking: {shipment['tracking_number']}")
    print(f"   Total Cost: ${shipment['total_cost']:.2f}")
    print(f"   Items in shipment: {len(shipment['items'])}")
    for item in shipment['items']:
        print(f"     - {item['product_name']} (SKU: {item['sku']}): {item['quantity_received']} units")
    
    print("\n=== Example Complete ===")

if __name__ == '__main__':
    main()

