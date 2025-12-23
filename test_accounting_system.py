#!/usr/bin/env python3
"""
Test script for the accounting system
Demonstrates: chart of accounts, journal entries, financial statements, discrepancies
"""

from database import (
    initialize_chart_of_accounts, add_employee, add_vendor, add_product,
    create_shipment, add_shipment_item, journalize_shipment_received,
    create_order, journalize_sale, post_journal_entry,
    generate_balance_sheet, generate_income_statement, generate_trial_balance,
    report_discrepancy, resolve_discrepancy, get_discrepancy_summary,
    add_fiscal_period, calculate_retained_earnings
)

def main():
    print("="*70)
    print("ACCOUNTING SYSTEM TEST")
    print("="*70)
    print()
    
    # Step 1: Initialize chart of accounts
    print("1. Initializing chart of accounts...")
    result = initialize_chart_of_accounts()
    print(f"   ✓ Added {result['added']} accounts")
    print(f"   ⚠ Skipped {result['skipped']} (already exist)")
    print()
    
    # Step 2: Setup employees and products
    print("2. Setting up test data...")
    emp_id = add_employee(
        employee_code="ACC001",
        first_name="Accountant",
        last_name="User",
        position="manager",
        date_started="2024-01-01",
        password="test123"
    )
    print(f"   ✓ Employee created: ID {emp_id}")
    
    vendor_id = add_vendor(vendor_name="Test Vendor", email="vendor@test.com")
    
    product_id = add_product(
        product_name="Test Product",
        sku="TEST-ACC-001",
        product_price=25.00,
        product_cost=10.00,
        vendor_id=vendor_id,
        current_quantity=100,
        category="Test"
    )
    print(f"   ✓ Product created: ID {product_id}")
    print()
    
    # Step 3: Receive shipment and journalize
    print("3. Receiving shipment and creating journal entry...")
    shipment_id = create_shipment(
        vendor_id=vendor_id,
        received_date="2024-12-22",
        purchase_order_number="PO-ACC-001"
    )
    
    add_shipment_item(
        shipment_id=shipment_id,
        product_id=product_id,
        quantity_received=50,
        unit_cost=10.00
    )
    
    journal_result = journalize_shipment_received(shipment_id, emp_id)
    if journal_result['success']:
        print(f"   ✓ Journal entry created: {journal_result['entry_number']}")
        post_journal_entry(journal_result['journal_entry_id'], emp_id)
        print(f"   ✓ Journal entry posted")
    print()
    
    # Step 4: Create sale and journalize
    print("4. Creating sale and journalizing...")
    order_items = [
        {
            'product_id': product_id,
            'quantity': 2,
            'unit_price': 25.00,
            'discount': 0
        }
    ]
    
    order_result = create_order(
        employee_id=emp_id,
        items=order_items,
        payment_method='cash',
        tax=1.50,
        discount=0
    )
    
    if order_result['success']:
        order_id = order_result['order_id']
        print(f"   ✓ Order created: {order_result['order_number']}")
        
        # Journalize the sale
        sale_journal = journalize_sale(order_id, emp_id)
        if sale_journal['success']:
            print(f"   ✓ Sale journalized: {sale_journal['entry_number']}")
            post_journal_entry(sale_journal['journal_entry_id'], emp_id)
            print(f"   ✓ Journal entry posted")
    print()
    
    # Step 5: Report discrepancy
    print("5. Reporting shipment discrepancy...")
    discrepancy_result = report_discrepancy(
        product_id=product_id,
        discrepancy_type='damaged',
        expected_quantity=50,
        actual_quantity=48,
        unit_cost=10.00,
        employee_id=emp_id,
        shipment_id=shipment_id,
        notes="2 units damaged during shipping"
    )
    
    if discrepancy_result['success']:
        print(f"   ✓ Discrepancy reported: ID {discrepancy_result['discrepancy_id']}")
        print(f"   Financial impact: ${discrepancy_result['financial_impact']:.2f}")
    print()
    
    # Step 6: Resolve discrepancy and write off
    print("6. Resolving discrepancy (writing off)...")
    resolve_result = resolve_discrepancy(
        discrepancy_id=discrepancy_result['discrepancy_id'],
        resolution_status='written_off',
        employee_id=emp_id,
        resolution_notes="Damaged goods written off",
        journalize=True
    )
    
    if resolve_result['success']:
        print(f"   ✓ Discrepancy resolved and written off")
    print()
    
    # Step 7: Generate financial statements
    print("7. Generating financial statements...")
    
    # Trial Balance
    trial_balance = generate_trial_balance()
    print(f"\n   Trial Balance (as of {trial_balance['date']}):")
    print(f"   Total Debits: ${trial_balance['total_debits']:.2f}")
    print(f"   Total Credits: ${trial_balance['total_credits']:.2f}")
    print(f"   Balance: ${trial_balance['total_debits'] - trial_balance['total_credits']:.2f}")
    
    # Balance Sheet
    balance_sheet = generate_balance_sheet()
    print(f"\n   Balance Sheet (as of {balance_sheet['date']}):")
    print(f"   Total Assets: ${balance_sheet['total_assets']:.2f}")
    print(f"   Total Liabilities: ${balance_sheet['total_liabilities']:.2f}")
    print(f"   Total Equity: ${balance_sheet['total_equity']:.2f}")
    print(f"   Total Liabilities + Equity: ${balance_sheet['total_liabilities_and_equity']:.2f}")
    
    # Income Statement
    income_stmt = generate_income_statement("2024-12-01", "2024-12-31")
    print(f"\n   Income Statement ({income_stmt['period']}):")
    print(f"   Total Revenue: ${income_stmt['total_revenue']:.2f}")
    print(f"   Total COGS: ${income_stmt['total_cogs']:.2f}")
    print(f"   Gross Profit: ${income_stmt['gross_profit']:.2f}")
    print(f"   Total Expenses: ${income_stmt['total_expenses']:.2f}")
    print(f"   Net Income: ${income_stmt['net_income']:.2f}")
    print()
    
    # Step 8: Discrepancy summary
    print("8. Discrepancy summary...")
    discrepancy_summary = get_discrepancy_summary()
    print(f"   Found {len(discrepancy_summary)} discrepancy categories:")
    for item in discrepancy_summary:
        print(f"     - {item['discrepancy_type']} ({item['resolution_status']}): "
              f"{item['count']} occurrences, ${item['total_impact']:.2f} impact")
    print()
    
    # Step 9: Fiscal period and retained earnings
    print("9. Creating fiscal period and calculating retained earnings...")
    period_id = add_fiscal_period(
        period_name="Q4 2024",
        start_date="2024-10-01",
        end_date="2024-12-31"
    )
    print(f"   ✓ Fiscal period created: ID {period_id}")
    
    retained_result = calculate_retained_earnings(
        period_id=period_id,
        beginning_balance=10000.00,
        dividends=0.0
    )
    
    if retained_result['success']:
        print(f"   ✓ Retained earnings calculated:")
        print(f"     Beginning Balance: ${retained_result['beginning_balance']:.2f}")
        print(f"     Net Income: ${retained_result['net_income']:.2f}")
        print(f"     Dividends: ${retained_result['dividends']:.2f}")
        print(f"     Ending Balance: ${retained_result['ending_balance']:.2f}")
    print()
    
    print("="*70)
    print("TESTING COMPLETE")
    print("="*70)
    print("\nSummary:")
    print("✓ Chart of accounts initialized")
    print("✓ Journal entries created (double-entry bookkeeping)")
    print("✓ Financial statements generated (Balance Sheet, Income Statement, Trial Balance)")
    print("✓ Shipment discrepancy tracking")
    print("✓ Automatic journalization of transactions")
    print("✓ Fiscal period management")
    print("✓ Retained earnings calculation")

if __name__ == '__main__':
    main()

