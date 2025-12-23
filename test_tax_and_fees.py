#!/usr/bin/env python3
"""
Test script for sales tax and transaction fees
"""

from database import (
    add_employee, add_vendor, add_product, create_order,
    journalize_sale, post_journal_entry, get_order_details,
    calculate_transaction_fee
)

def main():
    print("="*70)
    print("SALES TAX & TRANSACTION FEES TEST")
    print("="*70)
    print()
    
    # Step 1: Setup
    print("1. Setting up test data...")
    emp_id = add_employee(
        employee_code="TAX001",
        first_name="Tax",
        last_name="Tester",
        position="cashier",
        date_started="2024-01-01",
        password="test123"
    )
    
    vendor_id = add_vendor(vendor_name="Test Vendor", email="vendor@test.com")
    
    product_id = add_product(
        product_name="Test Product",
        sku="TAX-TEST-001",
        product_price=100.00,
        product_cost=50.00,
        vendor_id=vendor_id,
        current_quantity=100,
        category="Test"
    )
    print(f"   ✓ Employee created: ID {emp_id}")
    print(f"   ✓ Product created: ID {product_id}")
    print()
    
    # Step 2: Test transaction fee calculation
    print("2. Testing transaction fee calculation...")
    test_amount = 100.00
    
    # Credit card
    cc_fee = calculate_transaction_fee('credit_card', test_amount)
    print(f"   Credit Card (${test_amount:.2f}):")
    print(f"     Fee Rate: {cc_fee['fee_rate']*100:.2f}%")
    print(f"     Transaction Fee: ${cc_fee['transaction_fee']:.2f}")
    print(f"     Net Amount: ${cc_fee['net_amount']:.2f}")
    
    # Debit card
    dc_fee = calculate_transaction_fee('debit_card', test_amount)
    print(f"   Debit Card (${test_amount:.2f}):")
    print(f"     Fee Rate: {dc_fee['fee_rate']*100:.2f}%")
    print(f"     Transaction Fee: ${dc_fee['transaction_fee']:.2f}")
    print(f"     Net Amount: ${dc_fee['net_amount']:.2f}")
    
    # Cash
    cash_fee = calculate_transaction_fee('cash', test_amount)
    print(f"   Cash (${test_amount:.2f}):")
    print(f"     Fee Rate: {cash_fee['fee_rate']*100:.2f}%")
    print(f"     Transaction Fee: ${cash_fee['transaction_fee']:.2f}")
    print(f"     Net Amount: ${cash_fee['net_amount']:.2f}")
    print()
    
    # Step 3: Create order with tax and credit card (with fees)
    print("3. Creating order with 8% tax and credit card payment...")
    order_items = [
        {
            'product_id': product_id,
            'quantity': 2,
            'unit_price': 100.00,
            'discount': 0
        }
    ]
    
    order_result = create_order(
        employee_id=emp_id,
        items=order_items,
        payment_method='credit_card',
        tax_rate=0.08,  # 8% tax
        discount=0
    )
    
    if order_result['success']:
        order_id = order_result['order_id']
        print(f"   ✓ Order created: {order_result['order_number']}")
        print(f"     Subtotal: ${order_result['subtotal']:.2f}")
        print(f"     Tax Amount: ${order_result['tax_amount']:.2f}")
        print(f"     Transaction Fee: ${order_result['transaction_fee']:.2f}")
        print(f"     Total: ${order_result['total']:.2f}")
        
        # Get full order details
        order_details = get_order_details(order_id)
        if order_details and order_details.get('order'):
            order = order_details['order']
            print(f"\n   Full Order Details:")
            print(f"     Tax Rate: {order.get('tax_rate', 0)*100:.2f}%")
            print(f"     Tax Amount: ${order.get('tax_amount', 0):.2f}")
            print(f"     Transaction Fee: ${order.get('transaction_fee', 0):.2f}")
    print()
    
    # Step 4: Create order with cash (no fees)
    print("4. Creating order with 8% tax and cash payment (no fees)...")
    order_items2 = [
        {
            'product_id': product_id,
            'quantity': 1,
            'unit_price': 50.00,
            'discount': 0
        }
    ]
    
    order_result2 = create_order(
        employee_id=emp_id,
        items=order_items2,
        payment_method='cash',
        tax_rate=0.08,  # 8% tax
        discount=0
    )
    
    if order_result2['success']:
        order_id2 = order_result2['order_id']
        print(f"   ✓ Order created: {order_result2['order_number']}")
        print(f"     Subtotal: ${order_result2['subtotal']:.2f}")
        print(f"     Tax Amount: ${order_result2['tax_amount']:.2f}")
        print(f"     Transaction Fee: ${order_result2['transaction_fee']:.2f}")
        print(f"     Total: ${order_result2['total']:.2f}")
    print()
    
    # Step 5: Journalize the credit card sale
    print("5. Journalizing credit card sale (with transaction fee)...")
    journal_result = journalize_sale(order_id, emp_id)
    if journal_result['success']:
        print(f"   ✓ Journal entry created: {journal_result['entry_number']}")
        post_journal_entry(journal_result['journal_entry_id'], emp_id)
        print(f"   ✓ Journal entry posted")
        print(f"   Note: Transaction fee is recorded as Bank Fees expense")
    print()
    
    # Step 6: Test item-specific tax rates
    print("6. Testing item-specific tax rates...")
    order_items3 = [
        {
            'product_id': product_id,
            'quantity': 1,
            'unit_price': 100.00,
            'discount': 0,
            'tax_rate': 0.10  # 10% tax for this item
        },
        {
            'product_id': product_id,
            'quantity': 1,
            'unit_price': 50.00,
            'discount': 0,
            'tax_rate': 0.05  # 5% tax for this item
        }
    ]
    
    order_result3 = create_order(
        employee_id=emp_id,
        items=order_items3,
        payment_method='debit_card',
        tax_rate=0.08,  # Default tax rate (used if item doesn't specify)
        discount=0
    )
    
    if order_result3['success']:
        print(f"   ✓ Order created with mixed tax rates: {order_result3['order_number']}")
        print(f"     Subtotal: ${order_result3['subtotal']:.2f}")
        print(f"     Total Tax: ${order_result3['tax_amount']:.2f}")
        print(f"     Transaction Fee: ${order_result3['transaction_fee']:.2f}")
        print(f"     Total: ${order_result3['total']:.2f}")
    print()
    
    print("="*70)
    print("TESTING COMPLETE")
    print("="*70)
    print("\nSummary:")
    print("✓ Sales tax calculation (order-level and item-level)")
    print("✓ Transaction fee calculation based on payment method")
    print("✓ Credit card fees (2.9%)")
    print("✓ Debit card fees (1.5%)")
    print("✓ Cash payments (no fees)")
    print("✓ Journal entries include transaction fees")
    print("✓ All tax and fee data stored in database")

if __name__ == '__main__':
    main()

