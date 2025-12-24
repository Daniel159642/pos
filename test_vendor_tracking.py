#!/usr/bin/env python3
"""
Test script to demonstrate vendor-specific inventory tracking
Scenario: 50 units from Vendor A, 100 units from Vendor B, then some sales
"""

from database import (
    add_product, add_vendor, create_shipment, add_shipment_item,
    record_sale, get_inventory_by_vendor, get_product
)

def main():
    print("=== Testing Vendor-Specific Inventory Tracking ===\n")
    
    # Step 1: Create two vendors
    print("1. Creating vendors...")
    vendor_a_id = add_vendor(
        vendor_name="Vendor A",
        contact_person="Alice Smith",
        email="alice@vendora.com",
        phone="555-0001"
    )
    vendor_b_id = add_vendor(
        vendor_name="Vendor B",
        contact_person="Bob Jones",
        email="bob@vendorb.com",
        phone="555-0002"
    )
    print(f"   Vendor A ID: {vendor_a_id}")
    print(f"   Vendor B ID: {vendor_b_id}\n")
    
    # Step 2: Create a product
    print("2. Creating product...")
    product_id = add_product(
        product_name="Test Product",
        sku="TEST-001",
        product_price=25.00,
        product_cost=10.00,
        current_quantity=0,
        category="Test"
    )
    print(f"   Product ID: {product_id}\n")
    
    # Step 3: Receive 50 units from Vendor A
    print("3. Receiving 50 units from Vendor A...")
    shipment_a_id = create_shipment(
        vendor_id=vendor_a_id,
        purchase_order_number="PO-A-001",
        tracking_number="TRACK-A-001"
    )
    add_shipment_item(
        shipment_id=shipment_a_id,
        product_id=product_id,
        quantity_received=50,
        unit_cost=10.00,
        lot_number="LOT-A-001"
    )
    product = get_product(product_id)
    print(f"   Total inventory: {product['current_quantity']} units\n")
    
    # Step 4: Receive 100 units from Vendor B
    print("4. Receiving 100 units from Vendor B...")
    shipment_b_id = create_shipment(
        vendor_id=vendor_b_id,
        purchase_order_number="PO-B-001",
        tracking_number="TRACK-B-001"
    )
    add_shipment_item(
        shipment_id=shipment_b_id,
        product_id=product_id,
        quantity_received=100,
        unit_cost=9.50,
        lot_number="LOT-B-001"
    )
    product = get_product(product_id)
    print(f"   Total inventory: {product['current_quantity']} units\n")
    
    # Step 5: Check inventory breakdown BEFORE any sales
    print("5. Inventory breakdown BEFORE sales:")
    breakdown = get_inventory_by_vendor(product_id)
    print(f"   Product: {breakdown['product_name']} (SKU: {breakdown['sku']})")
    print(f"   Total in stock: {breakdown['current_quantity']} units")
    print(f"   Total sold: {breakdown['total_sold']} units\n")
    print("   Remaining by vendor:")
    for vendor_total in breakdown['vendor_totals']:
        print(f"     - {vendor_total['vendor_name']}: {vendor_total['total_remaining']} units")
        for shipment in vendor_total['shipments']:
            print(f"       Shipment {shipment['shipment_id']} (PO: {shipment['purchase_order_number']}): "
                  f"{shipment['quantity_remaining']} units remaining")
    print()
    
    # Step 6: Sell 80 units (FIFO: 50 from Vendor A, 30 from Vendor B)
    print("6. Selling 80 units (FIFO logic applies)...")
    record_sale(product_id=product_id, quantity_sold=80, sale_price=25.00, notes="Bulk sale")
    product = get_product(product_id)
    print(f"   Total inventory after sale: {product['current_quantity']} units\n")
    
    # Step 7: Check inventory breakdown AFTER sales
    print("7. Inventory breakdown AFTER sales:")
    breakdown = get_inventory_by_vendor(product_id)
    print(f"   Product: {breakdown['product_name']} (SKU: {breakdown['sku']})")
    print(f"   Total in stock: {breakdown['current_quantity']} units")
    print(f"   Total sold: {breakdown['total_sold']} units\n")
    print("   Remaining by vendor:")
    for vendor_total in breakdown['vendor_totals']:
        print(f"     - {vendor_total['vendor_name']}: {vendor_total['total_remaining']} units")
        for shipment in vendor_total['shipments']:
            print(f"       Shipment {shipment['shipment_id']} (PO: {shipment['purchase_order_number']}): "
                  f"{shipment['quantity_remaining']} units remaining "
                  f"(from {shipment['quantity_received']} received, "
                  f"{shipment['quantity_sold_from_shipment']} sold)")
    print()
    
    # Step 8: Detailed breakdown
    print("8. Detailed shipment breakdown:")
    for item in breakdown['vendor_breakdown']:
        if item['quantity_remaining'] > 0:
            print(f"   {item['vendor_name']} - Shipment {item['shipment_id']}:")
            print(f"     Received: {item['quantity_received']} units")
            print(f"     Sold: {item['quantity_sold_from_shipment']} units")
            print(f"     Remaining: {item['quantity_remaining']} units")
            print(f"     Lot: {item['lot_number']}")
            print(f"     Unit Cost: ${item['unit_cost']:.2f}")
            print()
    
    print("=== Test Complete ===")
    print("\nSummary:")
    print(f"- Started with: 50 from Vendor A + 100 from Vendor B = 150 total")
    print(f"- Sold: 80 units (FIFO: all 50 from Vendor A + 30 from Vendor B)")
    print(f"- Remaining: 70 units (all from Vendor B)")

if __name__ == '__main__':
    main()


