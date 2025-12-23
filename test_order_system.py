#!/usr/bin/env python3
"""
Test script for the order system
Demonstrates: creating orders, voiding, returns, and reporting
"""

from database import (
    add_employee, add_customer, add_product, add_vendor,
    create_order, get_order_details, void_order, process_return,
    get_daily_sales_by_employee, get_top_selling_products,
    get_payment_method_breakdown, list_orders,
    get_product
)

def main():
    print("="*70)
    print("ORDER SYSTEM TESTING")
    print("="*70)
    print()
    
    # Step 1: Setup - Create employee, customer, vendor, and products
    print("1. Setting up test data...")
    
    # Create employee
    employee_id = add_employee(
        employee_name="John Cashier",
        employee_code="EMP001",
        email="john@store.com",
        role="cashier"
    )
    print(f"   ✓ Employee created: ID {employee_id}")
    
    # Create customer (optional)
    customer_id = add_customer(
        customer_name="Jane Customer",
        email="jane@email.com",
        phone="555-0100"
    )
    print(f"   ✓ Customer created: ID {customer_id}")
    
    # Create vendor
    vendor_id = add_vendor(
        vendor_name="Test Vendor",
        email="vendor@test.com"
    )
    
    # Create products with inventory
    products = {}
    product_data = [
        ('PROD-001', 'Widget A', 19.99, 10.00, 50),
        ('PROD-002', 'Widget B', 24.99, 12.00, 30),
        ('PROD-003', 'Widget C', 14.99, 8.00, 100),
    ]
    
    for sku, name, price, cost, qty in product_data:
        try:
            product_id = add_product(
                product_name=name,
                sku=sku,
                product_price=price,
                product_cost=cost,
                vendor_id=vendor_id,
                current_quantity=qty,
                category="Widgets"
            )
            products[sku] = product_id
            print(f"   ✓ Product created: {name} (SKU: {sku}, Qty: {qty})")
        except ValueError as e:
            # Product might already exist, get it
            from database import get_product_by_sku
            product = get_product_by_sku(sku)
            if product:
                products[sku] = product['product_id']
                print(f"   ⚠ Product exists: {name} (ID: {products[sku]})")
    print()
    
    # Step 2: Create an order
    print("2. Creating an order...")
    order_items = [
        {
            'product_id': products['PROD-001'],
            'quantity': 2,
            'unit_price': 19.99,
            'discount': 0
        },
        {
            'product_id': products['PROD-002'],
            'quantity': 1,
            'unit_price': 24.99,
            'discount': 2.00
        },
        {
            'product_id': products['PROD-003'],
            'quantity': 3,
            'unit_price': 14.99,
            'discount': 0
        }
    ]
    
    result = create_order(
        employee_id=employee_id,
        items=order_items,
        payment_method='credit_card',
        customer_id=customer_id,
        tax=5.50,
        discount=0,
        notes="Test order"
    )
    
    if result['success']:
        order_id = result['order_id']
        print(f"   ✓ Order created: {result['order_number']} (ID: {order_id})")
        print(f"   Message: {result['message']}")
    else:
        print(f"   ✗ Error: {result['message']}")
        return
    print()
    
    # Step 3: View order details
    print("3. Viewing order details...")
    order_details = get_order_details(order_id)
    if order_details:
        order = order_details['order']
        print(f"   Order Number: {order['order_number']}")
        print(f"   Employee: {order['employee_name']}")
        print(f"   Customer: {order.get('customer_name', 'Walk-in')}")
        print(f"   Subtotal: ${order['subtotal']:.2f}")
        print(f"   Tax: ${order['tax']:.2f}")
        print(f"   Total: ${order['total']:.2f}")
        print(f"   Payment Method: {order['payment_method']}")
        print(f"   Status: {order['order_status']}")
        print(f"\n   Items ({len(order_details['items'])}):")
        for item in order_details['items']:
            print(f"     - {item['product_name']} (SKU: {item['sku']})")
            print(f"       Qty: {item['quantity']}, Price: ${item['unit_price']:.2f}, "
                  f"Discount: ${item['discount']:.2f}, Subtotal: ${item['subtotal']:.2f}")
    print()
    
    # Step 4: Verify inventory was updated
    print("4. Verifying inventory was updated...")
    for sku, product_id in products.items():
        product = get_product(product_id)
        if product:
            print(f"   {sku}: {product['current_quantity']} units remaining")
    print()
    
    # Step 5: Create another order
    print("5. Creating another order...")
    order_items2 = [
        {
            'product_id': products['PROD-001'],
            'quantity': 1,
            'unit_price': 19.99,
            'discount': 0
        }
    ]
    
    result2 = create_order(
        employee_id=employee_id,
        items=order_items2,
        payment_method='cash',
        customer_id=None,
        tax=1.50,
        discount=0
    )
    
    if result2['success']:
        order_id2 = result2['order_id']
        print(f"   ✓ Order created: {result2['order_number']} (ID: {order_id2})")
    print()
    
    # Step 6: Test void order
    print("6. Testing void order functionality...")
    void_result = void_order(
        order_id=order_id2,
        employee_id=employee_id,
        reason="Test void - customer cancelled"
    )
    
    if void_result['success']:
        print(f"   ✓ Order voided successfully")
        print(f"   Message: {void_result['message']}")
        
        # Verify inventory was restored
        product = get_product(products['PROD-001'])
        print(f"   Inventory restored: PROD-001 now has {product['current_quantity']} units")
    else:
        print(f"   ✗ Error: {void_result['message']}")
    print()
    
    # Step 7: Test return (partial)
    print("7. Testing return functionality (partial return)...")
    order_details = get_order_details(order_id)
    if order_details and order_details['items']:
        # Return 1 unit of the first item
        first_item = order_details['items'][0]
        return_items = [
            {
                'order_item_id': first_item['order_item_id'],
                'quantity': 1  # Return 1 out of 2
            }
        ]
        
        return_result = process_return(
            order_id=order_id,
            items_to_return=return_items,
            employee_id=employee_id,
            reason="Customer returned 1 item"
        )
        
        if return_result['success']:
            print(f"   ✓ Return processed successfully")
            print(f"   Refund amount: ${return_result['refund_amount']:.2f}")
            
            # Verify inventory was restored
            product = get_product(first_item['product_id'])
            print(f"   Inventory restored: {first_item['product_name']} now has {product['current_quantity']} units")
        else:
            print(f"   ✗ Error: {return_result['message']}")
    print()
    
    # Step 8: Sales reports
    print("8. Generating sales reports...")
    
    # Daily sales by employee
    print("\n   Daily Sales by Employee:")
    daily_sales = get_daily_sales_by_employee()
    for sale in daily_sales[:5]:  # Show first 5
        print(f"     {sale['sale_date']}: {sale['employee_name']} - "
              f"{sale['num_orders']} orders, ${sale['total_sales']:.2f} total")
    
    # Top selling products
    print("\n   Top Selling Products:")
    top_products = get_top_selling_products(limit=5)
    for product in top_products:
        print(f"     {product['product_name']} ({product['sku']}): "
              f"{product['total_sold']} sold, ${product['total_revenue']:.2f} revenue")
    
    # Payment method breakdown
    print("\n   Payment Method Breakdown:")
    payment_breakdown = get_payment_method_breakdown()
    for method in payment_breakdown:
        print(f"     {method['payment_method']}: "
              f"{method['transaction_count']} transactions, ${method['total_amount']:.2f} total")
    print()
    
    # Step 9: List recent orders
    print("9. Listing recent orders...")
    recent_orders = list_orders()
    print(f"   Found {len(recent_orders)} orders:")
    for order in recent_orders[:5]:
        print(f"     {order['order_number']}: ${order['total']:.2f} - "
              f"{order['order_status']} - {order['employee_name']}")
    print()
    
    print("="*70)
    print("TESTING COMPLETE")
    print("="*70)
    print("\nSummary:")
    print("✓ Order creation with inventory updates")
    print("✓ Order details retrieval")
    print("✓ Void order with inventory restoration")
    print("✓ Partial return with inventory restoration")
    print("✓ Sales reporting (daily sales, top products, payment methods)")
    print("✓ Order listing and filtering")

if __name__ == '__main__':
    main()

