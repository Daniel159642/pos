#!/usr/bin/env python3
"""
POS → Accounting bridge: creates posted journal entries in accounting.transactions
when POS events occur (sale completed, shipment received).
Uses accounting.accounts / accounting.transactions (same data the Accounting page shows).
"""

from typing import Dict, Any, List, Optional
from datetime import datetime

# Database for order/shipment data (public schema)
from database import get_connection
from psycopg2.extras import RealDictCursor

# Accounting backend (accounting schema)
from backend.models.account_model import AccountRepository
from backend.models.transaction_model import TransactionRepository


def _resolve_lines_to_account_ids(line_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert line items with account_number to lines with account_id. Raises if any account missing."""
    out = []
    for item in line_items:
        acct_num = item.get('account_number')
        if not acct_num:
            raise ValueError('Line item missing account_number')
        account = AccountRepository.find_by_account_number(str(acct_num))
        if not account:
            raise ValueError(f'Account not found: {acct_num}')
        out.append({
            'account_id': account.id,
            'debit_amount': float(item.get('debit_amount', 0)),
            'credit_amount': float(item.get('credit_amount', 0)),
            'description': item.get('description', ''),
        })
    return out


def _payment_account_for_order(order: Dict[str, Any]) -> str:
    """Return account number for payment side of a sale: 1000 Cash, 1100 A/R, or 2110 Store Credit."""
    pm = str(order.get('payment_method') or '').lower()
    if pm == 'store_credit':
        return '2110'  # Store Credit Liability
    if pm in ('credit_card', 'debit_card', 'mobile_payment', 'card'):
        return '1100'  # Accounts Receivable
    return '1000'  # Cash


def journalize_sale_to_accounting(order_id: int, employee_id: int) -> Dict[str, Any]:
    """
    Create and post a sales_receipt transaction in accounting.transactions for a completed order.
    Uses same logic as database.journalize_sale but writes to accounting schema.
    Idempotent: skips if a posted transaction already exists for this order.
    """
    # Idempotency: skip if we already posted a sale for this order
    existing = TransactionRepository.find_by_source_document('order', order_id)
    if existing and existing.get('transaction', {}).get('is_posted'):
        return {'success': True, 'transaction_id': existing['transaction']['id'], 'skipped': True}

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Check order columns (tip, payment_method)
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders'
        """)
        columns = [r['column_name'] for r in cursor.fetchall()]
        has_tip = 'tip' in columns
        has_payment = 'payment_method' in columns

        if has_tip and has_payment:
            cursor.execute("""
                SELECT o.total, o.tax_amount, o.subtotal, o.transaction_fee, o.tip, o.payment_method
                FROM orders o WHERE o.order_id = %s
            """, (order_id,))
        else:
            cursor.execute("""
                SELECT o.total, o.tax_amount, o.subtotal,
                       COALESCE(o.transaction_fee, 0) as transaction_fee,
                       0.0 as tip, COALESCE(o.payment_method, 'cash') as payment_method
                FROM orders o WHERE o.order_id = %s
            """, (order_id,))

        order_row = cursor.fetchone()
        if not order_row:
            conn.close()
            return {'success': False, 'message': 'Order not found'}
        order = dict(order_row)

        cursor.execute("""
            SELECT net_amount, transaction_fee FROM payment_transactions WHERE order_id = %s LIMIT 1
        """, (order_id,))
        pay_row = cursor.fetchone()
        payment = dict(pay_row) if pay_row else {
            'net_amount': order['total'],
            'transaction_fee': order.get('transaction_fee', 0.0)
        }
        cursor.execute("""
            SELECT COALESCE(SUM(oi.quantity * i.product_cost), 0) as cogs
            FROM order_items oi
            JOIN inventory i ON oi.product_id = i.product_id
            WHERE oi.order_id = %s
        """, (order_id,))
        cogs_row = cursor.fetchone()
        cogs = float(cogs_row['cogs'] or 0) if cogs_row else 0.0
        conn.close()

        cash_account = _payment_account_for_order(order)
        tip_amount = float(order.get('tip', 0) or 0)

        line_items = [
            {'account_number': cash_account, 'debit_amount': float(payment['net_amount'] or 0) + tip_amount, 'credit_amount': 0, 'description': 'Payment received (net + tip)'},
            {'account_number': '4000', 'debit_amount': 0, 'credit_amount': float(order['subtotal'] or 0), 'description': 'Sales revenue'},
            {'account_number': '2040', 'debit_amount': 0, 'credit_amount': float(order['tax_amount'] or 0), 'description': 'Sales tax collected'},
            {'account_number': '5000', 'debit_amount': cogs, 'credit_amount': 0, 'description': 'Cost of goods sold'},
            {'account_number': '1200', 'debit_amount': 0, 'credit_amount': cogs, 'description': 'Inventory reduction'},
        ]
        if tip_amount > 0:
            line_items.append({'account_number': '4100', 'debit_amount': 0, 'credit_amount': tip_amount, 'description': 'Tip income'})
        fee = float(payment.get('transaction_fee', 0) or 0)
        if fee > 0:
            line_items.append({'account_number': '5100', 'debit_amount': fee, 'credit_amount': 0, 'description': 'Payment processing fee'})
            gross = float(order['total'] or 0)
            line_items[0]['debit_amount'] = gross + tip_amount

        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'sales_receipt',
            'description': f'Sale – Order #{order_id}',
            'source_document_id': order_id,
            'source_document_type': 'order',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id, 'entry_number': result['transaction'].get('transaction_number')}
    except Exception as e:
        if conn and not conn.closed:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return {'success': False, 'message': str(e)}


def journalize_shipment_received_to_accounting(pending_shipment_id: int, employee_id: int) -> Dict[str, Any]:
    """
    Create and post a journal entry in accounting.transactions when a pending shipment
    is completed (add-to-inventory). Uses total cost from pending_shipment_items.
    Idempotent: skips if a posted transaction already exists for this pending_shipment.
    """
    existing = TransactionRepository.find_by_source_document('pending_shipment', pending_shipment_id)
    if existing and existing.get('transaction', {}).get('is_posted'):
        return {'success': True, 'transaction_id': existing['transaction']['id'], 'skipped': True}

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT COALESCE(SUM(psi.quantity_verified * psi.unit_cost), 0) as total_cost
            FROM pending_shipment_items psi
            WHERE psi.pending_shipment_id = %s
        """, (pending_shipment_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return {'success': False, 'message': 'Shipment not found'}
        total_cost = float(row.get('total_cost') or 0)
        if total_cost <= 0:
            return {'success': False, 'message': 'Shipment has no cost (no items or zero cost)'}

        line_items = [
            {'account_number': '1200', 'debit_amount': total_cost, 'credit_amount': 0, 'description': 'Inventory received'},
            {'account_number': '2000', 'debit_amount': 0, 'credit_amount': total_cost, 'description': 'Amount owed to vendor'},
        ]
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'purchase',
            'description': f'Inventory received – Shipment #{pending_shipment_id}',
            'source_document_id': pending_shipment_id,
            'source_document_type': 'pending_shipment',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id, 'entry_number': result['transaction'].get('transaction_number')}
    except Exception as e:
        if conn and not conn.closed:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return {'success': False, 'message': str(e)}


def journalize_void_sale_to_accounting(order_id: int, employee_id: int) -> Dict[str, Any]:
    """
    Post a reversing entry in accounting.transactions when an order is voided.
    Same accounts as the sale but debits and credits swapped.
    Idempotent: skips if a posted order_void transaction already exists for this order.
    """
    existing = TransactionRepository.find_by_source_document('order_void', order_id)
    if existing and existing.get('transaction', {}).get('is_posted'):
        return {'success': True, 'transaction_id': existing['transaction']['id'], 'skipped': True}

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders'
        """)
        columns = [r['column_name'] for r in cursor.fetchall()]
        has_tip = 'tip' in columns
        has_payment = 'payment_method' in columns
        if has_tip and has_payment:
            cursor.execute("""
                SELECT o.total, o.tax_amount, o.subtotal, o.transaction_fee, o.tip, o.payment_method
                FROM orders o WHERE o.order_id = %s
            """, (order_id,))
        else:
            cursor.execute("""
                SELECT o.total, o.tax_amount, o.subtotal,
                       COALESCE(o.transaction_fee, 0) as transaction_fee,
                       0.0 as tip, COALESCE(o.payment_method, 'cash') as payment_method
                FROM orders o WHERE o.order_id = %s
            """, (order_id,))
        order_row = cursor.fetchone()
        if not order_row:
            conn.close()
            return {'success': False, 'message': 'Order not found'}
        order = dict(order_row)
        cursor.execute("""
            SELECT net_amount, transaction_fee FROM payment_transactions WHERE order_id = %s LIMIT 1
        """, (order_id,))
        pay_row = cursor.fetchone()
        payment = dict(pay_row) if pay_row else {'net_amount': order['total'], 'transaction_fee': order.get('transaction_fee', 0.0)}
        cursor.execute("""
            SELECT COALESCE(SUM(oi.quantity * i.product_cost), 0) as cogs
            FROM order_items oi
            JOIN inventory i ON oi.product_id = i.product_id
            WHERE oi.order_id = %s
        """, (order_id,))
        cogs_row = cursor.fetchone()
        cogs = float(cogs_row['cogs'] or 0) if cogs_row else 0.0
        conn.close()

        cash_account = _payment_account_for_order(order)
        tip_amount = float(order.get('tip', 0) or 0)
        net_and_tip = float(payment['net_amount'] or 0) + tip_amount
        fee = float(payment.get('transaction_fee', 0) or 0)
        if fee > 0:
            gross = float(order['total'] or 0)
            net_and_tip = gross + tip_amount

        # Reversing: swap debits and credits from the original sale
        line_items = [
            {'account_number': cash_account, 'debit_amount': 0, 'credit_amount': net_and_tip, 'description': 'Void – payment reversed'},
            {'account_number': '4000', 'debit_amount': float(order['subtotal'] or 0), 'credit_amount': 0, 'description': 'Void – sales revenue reversed'},
            {'account_number': '2040', 'debit_amount': float(order['tax_amount'] or 0), 'credit_amount': 0, 'description': 'Void – sales tax reversed'},
            {'account_number': '5000', 'debit_amount': 0, 'credit_amount': cogs, 'description': 'Void – COGS reversed'},
            {'account_number': '1200', 'debit_amount': cogs, 'credit_amount': 0, 'description': 'Void – inventory restored'},
        ]
        if tip_amount > 0:
            line_items.append({'account_number': '4100', 'debit_amount': tip_amount, 'credit_amount': 0, 'description': 'Void – tip reversed'})
        if fee > 0:
            line_items.append({'account_number': '5100', 'debit_amount': 0, 'credit_amount': fee, 'description': 'Void – fee reversed'})

        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'refund',
            'description': f'Void – Order #{order_id}',
            'source_document_id': order_id,
            'source_document_type': 'order_void',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        if conn and not conn.closed:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return {'success': False, 'message': str(e)}


def journalize_return_to_accounting(
    return_id: int, order_id: int, return_amount: float, employee_id: int,
    payment_method: Optional[str] = None,
    return_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create and post a return in accounting.transactions.
    Refund: Debit 4100, Credit Cash or A/R.
    Exchange (store credit): Debit 4100, Credit 2110 Store Credit Liability.
    Idempotent: skips if a posted transaction already exists for this return.
    """
    if return_amount <= 0:
        return {'success': False, 'message': 'Return amount must be positive'}
    existing = TransactionRepository.find_by_source_document('return', return_id)
    if existing and existing.get('transaction', {}).get('is_posted'):
        return {'success': True, 'transaction_id': existing['transaction']['id'], 'skipped': True}
    is_exchange = (return_type or '').lower() == 'exchange'
    if is_exchange:
        credit_account = '2110'  # Store Credit Liability (run migrations/add_store_credit_account.sql if missing)
    else:
        credit_account = '1000'
        if payment_method and str(payment_method).lower() in ('credit_card', 'debit_card', 'mobile_payment', 'card'):
            credit_account = '1100'
    line_items = [
        {'account_number': '4100', 'debit_amount': return_amount, 'credit_amount': 0, 'description': 'Customer return'},
        {'account_number': credit_account, 'debit_amount': 0, 'credit_amount': return_amount,
         'description': 'Store credit issued' if is_exchange else 'Refund issued'},
    ]
    try:
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'refund',
            'description': f'Return #{return_id} – Order #{order_id}',
            'source_document_id': return_id,
            'source_document_type': 'return',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        return {'success': False, 'message': str(e)}


def journalize_register_close_to_accounting(
    session_id: int, employee_id: int, expected_cash: float, ending_cash: float, discrepancy: float
) -> Dict[str, Any]:
    """Post cash over/short when closing register. Only posts if |discrepancy| > 0.01."""
    if abs(discrepancy) < 0.01:
        return {'success': True, 'transaction_id': None}
    amt = abs(discrepancy)
    if discrepancy > 0:
        line_items = [
            {'account_number': '1000', 'debit_amount': amt, 'credit_amount': 0, 'description': 'Cash over'},
            {'account_number': '4100', 'debit_amount': 0, 'credit_amount': amt, 'description': 'Cash over (register close)'},
        ]
    else:
        line_items = [
            {'account_number': '5100', 'debit_amount': amt, 'credit_amount': 0, 'description': 'Cash short (register close)'},
            {'account_number': '1000', 'debit_amount': 0, 'credit_amount': amt, 'description': 'Cash short'},
        ]
    try:
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'adjustment',
            'description': f'Register close – session {session_id}',
            'source_document_id': session_id,
            'source_document_type': 'register_close',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        return {'success': False, 'message': str(e)}


def journalize_cash_transaction_to_accounting(
    session_id: Optional[int], employee_id: int, transaction_type: str, amount: float,
    reason: Optional[str], cash_transaction_id: Optional[int] = None
) -> Dict[str, Any]:
    """Post cash in/out: Cash + Owner's Equity (3000)."""
    amount = float(amount)
    if amount <= 0:
        return {'success': False, 'message': 'Amount must be positive'}
    typ = (transaction_type or '').lower()
    if typ in ('cash_in', 'deposit'):
        line_items = [
            {'account_number': '1000', 'debit_amount': amount, 'credit_amount': 0, 'description': reason or 'Cash in'},
            {'account_number': '3000', 'debit_amount': 0, 'credit_amount': amount, 'description': reason or 'Owner deposit'},
        ]
    elif typ in ('cash_out', 'withdrawal'):
        line_items = [
            {'account_number': '3000', 'debit_amount': amount, 'credit_amount': 0, 'description': reason or 'Owner withdrawal'},
            {'account_number': '1000', 'debit_amount': 0, 'credit_amount': amount, 'description': reason or 'Cash out'},
        ]
    else:
        line_items = [
            {'account_number': '1000', 'debit_amount': amount, 'credit_amount': 0, 'description': reason or 'Adjustment'},
            {'account_number': '3000', 'debit_amount': 0, 'credit_amount': amount, 'description': reason or 'Adjustment'},
        ]
    try:
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'transfer' if typ in ('cash_in', 'cash_out', 'deposit', 'withdrawal') else 'adjustment',
            'description': f'Register: {transaction_type} – {reason or "N/A"}',
            'source_document_id': cash_transaction_id or session_id,
            'source_document_type': 'cash_transaction',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        return {'success': False, 'message': str(e)}


def journalize_damaged_goods_to_accounting(discrepancy_id: int, amount: float, employee_id: int) -> Dict[str, Any]:
    """Post damaged goods: Debit 5100, Credit 1200 Inventory."""
    amount = float(amount)
    if amount <= 0:
        return {'success': False, 'message': 'Amount must be positive'}
    line_items = [
        {'account_number': '5100', 'debit_amount': amount, 'credit_amount': 0, 'description': 'Damaged goods write-off'},
        {'account_number': '1200', 'debit_amount': 0, 'credit_amount': amount, 'description': 'Inventory reduction'},
    ]
    try:
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'adjustment',
            'description': f'Damaged goods – Discrepancy #{discrepancy_id}',
            'source_document_id': discrepancy_id,
            'source_document_type': 'discrepancy',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        return {'success': False, 'message': str(e)}


def journalize_vendor_credit_to_accounting(discrepancy_id: int, amount: float, employee_id: int) -> Dict[str, Any]:
    """
    Post vendor credit for a discrepancy: reduce A/P and expense.
    Dr 2000 A/P, Cr 5100 Expense (vendor credit for discrepancy).
    Idempotent: skips if a posted transaction already exists for this discrepancy_vendor_credit.
    """
    amount = float(amount)
    if amount <= 0:
        return {'success': False, 'message': 'Amount must be positive'}
    existing = TransactionRepository.find_by_source_document('discrepancy_vendor_credit', discrepancy_id)
    if existing and existing.get('transaction', {}).get('is_posted'):
        return {'success': True, 'transaction_id': existing['transaction']['id'], 'skipped': True}
    line_items = [
        {'account_number': '2000', 'debit_amount': amount, 'credit_amount': 0, 'description': 'Vendor credit – A/P reduced'},
        {'account_number': '5100', 'debit_amount': 0, 'credit_amount': amount, 'description': 'Vendor credit – Discrepancy #' + str(discrepancy_id)},
    ]
    try:
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'adjustment',
            'description': f'Vendor credit – Discrepancy #{discrepancy_id}',
            'source_document_id': discrepancy_id,
            'source_document_type': 'discrepancy_vendor_credit',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        return {'success': False, 'message': str(e)}


def journalize_cash_drop_to_accounting(
    count_id: int, amount: float, employee_id: int, reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Post cash drop to accounting: transfer from register.
    Dr 3000 Owner's Equity, Cr 1000 Cash (cash drop from register).
    Idempotent: skips if a posted transaction already exists for this daily_cash_count.
    """
    amount = float(amount)
    if amount <= 0:
        return {'success': False, 'message': 'Amount must be positive'}
    existing = TransactionRepository.find_by_source_document('daily_cash_count', count_id)
    if existing and existing.get('transaction', {}).get('is_posted'):
        return {'success': True, 'transaction_id': existing['transaction']['id'], 'skipped': True}
    desc = reason or 'Daily cash drop'
    line_items = [
        {'account_number': '3000', 'debit_amount': amount, 'credit_amount': 0, 'description': desc},
        {'account_number': '1000', 'debit_amount': 0, 'credit_amount': amount, 'description': 'Cash drop from register'},
    ]
    try:
        lines = _resolve_lines_to_account_ids(line_items)
        data = {
            'transaction_date': datetime.now().date().isoformat(),
            'transaction_type': 'transfer',
            'description': f'Cash drop – Count #{count_id}',
            'source_document_id': count_id,
            'source_document_type': 'daily_cash_count',
            'lines': lines,
        }
        result = TransactionRepository.create(data, employee_id)
        txn_id = result['transaction']['id']
        TransactionRepository.post_transaction(txn_id, employee_id)
        return {'success': True, 'transaction_id': txn_id}
    except Exception as e:
        return {'success': False, 'message': str(e)}
