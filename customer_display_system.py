"""
Customer Display System Backend
Handles transactions, payments, and customer display interactions (PostgreSQL)
"""

import json
from datetime import datetime
from decimal import Decimal

class CustomerDisplaySystem:
    
    def __init__(self, _db_path=None):
        pass

    def get_connection(self):
        """Get PostgreSQL connection with dict-like rows"""
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        conn = get_connection()
        return conn, conn.cursor(cursor_factory=RealDictCursor)
    
    def start_transaction(self, employee_id, items, customer_id=None, discount=0.0, discount_type=None):
        """Start a new transaction. discount is order-level discount amount; discount_type e.g. 'student', 'employee'."""
        from database_postgres import get_current_establishment
        conn, cursor = self.get_connection()
        try:
            # Ensure we start with a clean transaction state
            try:
                conn.rollback()
            except:
                pass
            
            establishment_id = get_current_establishment()
            if establishment_id is None:
                cursor.execute("SELECT establishment_id FROM establishments ORDER BY establishment_id LIMIT 1")
                row = cursor.fetchone()
                if row:
                    establishment_id = row['establishment_id'] if isinstance(row, dict) else row[0]
                if establishment_id is None:
                    raise Exception('No establishment found. Please ensure the database has at least one establishment.')
            
            # Calculate subtotal, tax, and total properly
            subtotal = 0.0
            total_tax = 0.0
            tax_rate = 0.08  # Default tax rate
            
            # Check if items have tax_rate
            if items and len(items) > 0:
                first_item_tax = items[0].get('tax_rate')
                if first_item_tax is not None:
                    tax_rate = float(first_item_tax)
            
            for item in items:
                item_qty = int(item['quantity'])
                item_price = float(item['unit_price'])
                item_discount = float(item.get('discount', 0.0))
                item_tax_rate = float(item.get('tax_rate', tax_rate))
                item_subtotal = (item_qty * item_price) - item_discount
                item_tax = item_subtotal * item_tax_rate
                subtotal += item_subtotal
                total_tax += item_tax
            
            order_discount = float(discount) if discount else 0.0
            order_total = max(0.0, float(subtotal) + float(total_tax) - float(order_discount))
            # Clamp for DB CHECK (total >= 0); use single var so every INSERT gets same value
            order_total = max(0.0, float(order_total))
            
            # Generate order number (format: ORD-YYYYMMDD-HHMMSS)
            order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{datetime.now().strftime('%H%M%S')}"
            
            # Create order first to get order_id and order_number
            # Check if tip, order_type, discount, discount_type columns exist
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND table_schema = 'public'")
            columns_result = cursor.fetchall()
            order_columns = [col['column_name'] if isinstance(col, dict) else col[0] for col in columns_result]
            has_tip = 'tip' in order_columns
            has_order_type = 'order_type' in order_columns
            has_tax_rate = 'tax_rate' in order_columns
            has_discount_col = 'discount' in order_columns
            has_discount_type_col = 'discount_type' in order_columns
            
            if has_tip and has_order_type and has_tax_rate and has_discount_col and has_discount_type_col:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, discount, discount_type, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, total_tax, order_discount, (discount_type or None), order_total))
            elif has_tip and has_order_type and has_tax_rate and has_discount_col:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, discount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, total_tax, order_discount, order_total))
            elif has_tip and has_order_type and has_tax_rate:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, total_tax, order_total))
            elif has_tax_rate:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, total_tax, order_total))
            else:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_amount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, total_tax, order_total))
            order_result = cursor.fetchone()
            if isinstance(order_result, dict):
                order_id = order_result['order_id']
                order_number = order_result['order_number']
            else:
                order_id = order_result[0]
                order_number = order_result[1] if len(order_result) > 1 else order_number
            
            # Ensure transactions table exists and has establishment_id (migrate if missing)
            cursor.execute("""
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'transactions'
            """)
            if cursor.fetchone() is None:
                cursor.execute("""
                    CREATE TABLE public.transactions (
                        transaction_id SERIAL PRIMARY KEY,
                        establishment_id INTEGER NOT NULL REFERENCES public.establishments(establishment_id) ON DELETE CASCADE,
                        order_id INTEGER REFERENCES public.orders(order_id) ON DELETE SET NULL,
                        employee_id INTEGER NOT NULL REFERENCES public.employees(employee_id),
                        customer_id INTEGER REFERENCES public.customers(customer_id),
                        subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
                        tax NUMERIC(10,2) NOT NULL DEFAULT 0,
                        total NUMERIC(10,2) NOT NULL DEFAULT 0,
                        tip NUMERIC(10,2) DEFAULT 0,
                        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
                        payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'partial', 'refunded')),
                        amount_paid NUMERIC(10,2),
                        change_amount NUMERIC(10,2) DEFAULT 0,
                        signature TEXT,
                        completed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_establishment ON public.transactions(establishment_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id)")
            else:
                # Ensure all columns required for INSERT exist (add any missing)
                required_columns = [
                    ('establishment_id', 'INTEGER'),
                    ('order_id', 'INTEGER'),
                    ('employee_id', 'INTEGER'),
                    ('customer_id', 'INTEGER'),
                    ('subtotal', 'NUMERIC(10,2) DEFAULT 0'),
                    ('tax', 'NUMERIC(10,2) DEFAULT 0'),
                    ('total', 'NUMERIC(10,2) DEFAULT 0'),
                    ('status', 'TEXT DEFAULT \'pending\''),
                ]
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'transactions'
                """)
                existing = {row['column_name'] if isinstance(row, dict) else row[0] for row in cursor.fetchall()}
                for col_name, col_type in required_columns:
                    if col_name not in existing:
                        cursor.execute(
                            "ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS %s %s" % (col_name, col_type)
                        )
                if 'establishment_id' not in existing:
                    cursor.execute("""
                        UPDATE public.transactions t
                        SET establishment_id = (SELECT establishment_id FROM public.establishments ORDER BY establishment_id LIMIT 1)
                        WHERE t.establishment_id IS NULL
                    """)
                    cursor.execute("ALTER TABLE public.transactions ALTER COLUMN establishment_id SET NOT NULL")
                    try:
                        cursor.execute("""
                            ALTER TABLE public.transactions
                            ADD CONSTRAINT transactions_establishment_id_fkey
                            FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE
                        """)
                    except Exception:
                        pass
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_establishment ON public.transactions(establishment_id)")
            
            # Now create transaction linked to order (use order_total so transaction total reflects discount)
            cursor.execute("""
                INSERT INTO transactions
                (establishment_id, order_id, employee_id, customer_id, subtotal, tax, total, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING transaction_id
            """, (establishment_id, order_id, employee_id, customer_id, subtotal, total_tax, order_total))
            result = cursor.fetchone()
            transaction_id = result['transaction_id'] if isinstance(result, dict) else result[0]
            
            # Calculate tax rate (8% default, or from items if provided)
            tax_rate = 0.08
            if items and len(items) > 0:
                # Check if items have tax_rate
                first_item_tax = items[0].get('tax_rate')
                if first_item_tax is not None:
                    tax_rate = float(first_item_tax)
            
            # Sum quantity per product (same product in multiple lines = one inventory decrement)
            product_totals = {}
            for item in items:
                pid = item['product_id']
                qty = int(item['quantity'])
                product_totals[pid] = product_totals.get(pid, 0) + qty
            # Check availability for current establishment (one check per product)
            for product_id, total_qty in product_totals.items():
                cursor.execute(
                    "SELECT current_quantity FROM inventory WHERE product_id = %s AND establishment_id = %s",
                    (product_id, establishment_id)
                )
                row = cursor.fetchone()
                if not row:
                    raise Exception(f'Product ID {product_id} does not exist in inventory')
                available = row['current_quantity'] if isinstance(row, dict) else row[0]
                if available < total_qty:
                    raise Exception(f'Insufficient inventory for product_id {product_id}. Available: {available}, Requested: {total_qty}')
            # Create order_items for the order (required for returns and order history)
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items'")
            oi_cols = [row['column_name'] if isinstance(row, dict) else row[0] for row in cursor.fetchall()]
            has_oi_variant = 'variant_id' in oi_cols
            has_oi_notes = 'notes' in oi_cols
            print(f"Creating order_items for order_id {order_id}, {len(items)} items")
            for idx, item in enumerate(items):
                product_id = item['product_id']
                quantity = int(item['quantity'])
                unit_price = float(item['unit_price'])
                item_discount = float(item.get('discount', 0.0))
                item_tax_rate = float(item.get('tax_rate', tax_rate))
                item_subtotal = (quantity * unit_price) - item_discount
                item_tax = item_subtotal * item_tax_rate
                variant_id = item.get('variant_id')
                item_notes = (item.get('notes') or '').strip() or None

                cursor.execute("SELECT product_id FROM inventory WHERE product_id = %s AND establishment_id = %s", (product_id, establishment_id))
                if not cursor.fetchone():
                    raise Exception(f'Product ID {product_id} does not exist in inventory')

                try:
                    if has_oi_variant and has_oi_notes:
                        cursor.execute("""
                            INSERT INTO order_items (
                                establishment_id, order_id, product_id, quantity, unit_price, discount, subtotal,
                                tax_rate, tax_amount, variant_id, notes
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (establishment_id, order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                              item_tax_rate, item_tax, variant_id, item_notes))
                    elif has_oi_variant:
                        cursor.execute("""
                            INSERT INTO order_items (
                                establishment_id, order_id, product_id, quantity, unit_price, discount, subtotal,
                                tax_rate, tax_amount, variant_id
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (establishment_id, order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                              item_tax_rate, item_tax, variant_id))
                    elif has_oi_notes:
                        cursor.execute("""
                            INSERT INTO order_items (
                                establishment_id, order_id, product_id, quantity, unit_price, discount, subtotal,
                                tax_rate, tax_amount, notes
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (establishment_id, order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                              item_tax_rate, item_tax, item_notes))
                    else:
                        cursor.execute("""
                            INSERT INTO order_items (
                                establishment_id, order_id, product_id, quantity, unit_price, discount, subtotal,
                                tax_rate, tax_amount
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (establishment_id, order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                              item_tax_rate, item_tax))
                    print(f"Successfully inserted order_item: order_id={order_id}, product_id={product_id}, quantity={quantity}")
                except Exception as item_error:
                    import traceback
                    print(f"Error inserting order_item for product_id {product_id}: {str(item_error)}")
                    traceback.print_exc()
                    raise Exception(f'Error inserting order item for product_id {product_id}: {str(item_error)}')
            # Update inventory once per product (total quantity) so same product in multiple lines doesn't go negative
            for product_id, total_qty in product_totals.items():
                cursor.execute("""
                    UPDATE inventory
                    SET current_quantity = current_quantity - %s,
                        updated_at = NOW()
                    WHERE product_id = %s AND establishment_id = %s
                """, (total_qty, product_id, establishment_id))
            # Award loyalty points when order has a customer (same as create_order / process_payment)
            if customer_id:
                try:
                    from database import award_rewards_for_purchase
                    amount_for_rewards = subtotal + total_tax
                    award_rewards_for_purchase(cursor, customer_id, amount_for_rewards, points_used=0)
                except Exception as rew_err:
                    print(f"Warning: Could not award rewards in start_transaction: {rew_err}")
            # Create transaction_items (for customer display)
            for item in items:
                item_subtotal = item['quantity'] * item['unit_price']
                cursor.execute("""
                    INSERT INTO transaction_items
                    (establishment_id, transaction_id, product_id, quantity, unit_price, subtotal)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (establishment_id, transaction_id, item['product_id'], item['quantity'],
                      item['unit_price'], item_subtotal))
            
            # Verify all order_items were inserted
            cursor.execute("SELECT COUNT(*) FROM order_items WHERE order_id = %s", (order_id,))
            items_count_result = cursor.fetchone()
            # RealDictCursor returns dict, regular cursor returns tuple
            if isinstance(items_count_result, dict):
                items_count = items_count_result.get('count', 0) if items_count_result else 0
            else:
                items_count = items_count_result[0] if items_count_result else 0
            
            if items_count != len(items):
                raise Exception(f'Only {items_count} of {len(items)} order_items were saved. Transaction rolled back.')
            
            print(f"Order {order_number} (ID: {order_id}) created successfully with {items_count} order_items")
            
            cursor.execute("""
                INSERT INTO customer_display_sessions (establishment_id, transaction_id)
                VALUES (%s, %s)
                RETURNING session_id
            """, (establishment_id, transaction_id))
            result = cursor.fetchone()
            session_id = result['session_id'] if isinstance(result, dict) else result[0]
            conn.commit()
            return {
                'transaction_id': transaction_id,
                'order_id': order_id,
                'order_number': order_number,
                'session_id': session_id,
                'subtotal': float(subtotal),
                'tax': float(total_tax),
                'total': float(order_total),
                'items': items
            }
        except Exception as e:
            try:
                conn.rollback()
            except:
                pass
            raise e
        finally:
            try:
                conn.close()
            except:
                pass
    
    def get_payment_methods(self):
        """Get available payment methods"""
        from database_postgres import get_current_establishment
        conn, cursor = self.get_connection()
        try:
            establishment_id = get_current_establishment()
            cursor.execute("""
                SELECT * FROM payment_methods
                WHERE establishment_id = %s AND is_active = 1
                ORDER BY display_order
            """, (establishment_id,))
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()
    
    def process_payment(self, transaction_id, payment_method_id, amount, 
                       card_info=None, tip=0):
        """Process payment for transaction"""
        print(f"[TIP DEBUG] process_payment called: tip={tip} (raw), type={type(tip).__name__}")
        tip = float(tip or 0)
        print(f"[TIP DEBUG] process_payment after float: tip={tip}")
        conn, cursor = self.get_connection()
        
        try:
            # Ensure we start with a clean transaction state
            try:
                conn.rollback()
            except:
                pass
            # Get transaction
            cursor.execute("""
                SELECT * FROM transactions WHERE transaction_id = %s
            """, (transaction_id,))
            
            transaction = cursor.fetchone()
            
            if not transaction:
                return {'success': False, 'error': 'Transaction not found'}
            
            transaction = dict(transaction)
            
            # Update transaction with tip if provided
            if tip > 0:
                new_total = float(transaction['total']) + tip
                cursor.execute("""
                    UPDATE transactions
                    SET tip = %s, total = %s
                    WHERE transaction_id = %s
                """, (tip, new_total, transaction_id))
            
            # Get payment method type to check if cash and resolve payment_method_id
            # Handle both integer IDs and string identifiers (e.g., 'cash_default', 'card_default')
            is_cash = False
            actual_payment_method_id = None
            original_payment_method_id = payment_method_id
            
            try:
                # If payment_method_id is a string, try to find the actual ID
                if isinstance(payment_method_id, str):
                    # Extract method_type from string like 'cash_default' -> 'cash'
                    method_type_from_id = payment_method_id.replace('_default', '').replace('_', '')
                    cursor.execute("""
                        SELECT payment_method_id, method_type FROM payment_methods 
                        WHERE method_type = %s AND is_active = 1
                        ORDER BY display_order
                        LIMIT 1
                    """, (method_type_from_id,))
                    method_row = cursor.fetchone()
                    if method_row:
                        if isinstance(method_row, dict):
                            actual_payment_method_id = method_row.get('payment_method_id')
                            method_type = method_row.get('method_type')
                        else:
                            actual_payment_method_id = method_row[0]
                            method_type = method_row[1]
                        is_cash = method_type == 'cash'
                        payment_method_id = actual_payment_method_id  # Use the actual ID
                    else:
                        # Couldn't find payment method, infer from string
                        is_cash = method_type_from_id == 'cash'
                        payment_method_id = None
                else:
                    # It's already an integer ID
                    cursor.execute("""
                        SELECT method_type FROM payment_methods WHERE payment_method_id = %s
                    """, (payment_method_id,))
                    method_row = cursor.fetchone()
                    if method_row:
                        method_type = method_row.get('method_type') if isinstance(method_row, dict) else method_row[0]
                        is_cash = method_type == 'cash'
            except Exception as e:
                # If payment_methods query fails, try to infer from payment_method_id string
                conn.rollback()
                if isinstance(original_payment_method_id, str):
                    method_type_guess = original_payment_method_id.replace('_default', '').replace('_', '')
                    is_cash = method_type_guess == 'cash'
                    payment_method_id = None
                else:
                    raise Exception(f"Error getting payment method: {str(e)}")
            
            # Update transaction status
            total_paid = amount
            expected_total = float(transaction['total']) + tip
            
            if total_paid >= expected_total:
                # For transactions table: use 'paid' (allowed: pending, paid, partial, refunded)
                # For orders table: use 'completed' (allowed: pending, completed, refunded, partially_refunded)
                transaction_payment_status = 'paid'
                order_payment_status = 'completed'
                transaction_status = 'completed'
                change = total_paid - expected_total
            else:
                # For transactions table: use 'partial'
                # For orders table: use 'pending'
                transaction_payment_status = 'partial'
                order_payment_status = 'pending'
                transaction_status = 'pending'
                change = 0
            
            # Create payment record
            from database_postgres import get_current_establishment
            payment_establishment_id = get_current_establishment()
            if payment_establishment_id is None:
                # Fallback to get or create default establishment
                from database import _get_or_create_default_establishment
                payment_establishment_id = _get_or_create_default_establishment(conn)
            
            # Only insert payment record if we have a valid payment_method_id
            payment_id = None
            if payment_method_id is not None:
                try:
                    cursor.execute("""
                        INSERT INTO payments
                        (establishment_id, transaction_id, payment_method_id, amount, card_last_four,
                         card_type, authorization_code, payment_status, processed_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 'approved', NOW())
                        RETURNING payment_id
                    """, (payment_establishment_id, transaction_id, payment_method_id, amount,
                          card_info.get('last_four') if card_info else None,
                          card_info.get('card_type') if card_info else None,
                          card_info.get('auth_code') if card_info else None))
                    result = cursor.fetchone()
                    payment_id = result['payment_id'] if isinstance(result, dict) else result[0]
                except Exception as pay_err:
                    # If payment insert fails, log but continue (payment might not be critical)
                    print(f"Warning: Could not create payment record: {str(pay_err)}")
                    conn.rollback()
                    # Try to continue without payment record
                    payment_id = None
            
            # Update transaction with payment info
            # Use transaction_payment_status for transactions table (allowed: pending, paid, partial, refunded)
            cursor.execute("""
                UPDATE transactions
                SET payment_status = %s,
                    status = %s,
                    completed_at = CASE WHEN %s = 'completed' THEN NOW() ELSE NULL END,
                    amount_paid = %s,
                    change_amount = %s
                WHERE transaction_id = %s
            """, (transaction_payment_status, transaction_status, transaction_status, total_paid if is_cash else None, change if is_cash and change > 0 else 0, transaction_id))
            
            # Update order with payment details
            order_id = transaction.get('order_id')
            print(f"[TIP DEBUG] Updating order {order_id} with tip={tip}")
            if order_id:
                # Get payment method name/type
                payment_method_name = 'cash'
                if payment_method_id:
                    try:
                        cursor.execute("SELECT method_type FROM payment_methods WHERE payment_method_id = %s", (payment_method_id,))
                        method_row = cursor.fetchone()
                        if method_row:
                            payment_method_name = method_row.get('method_type') if isinstance(method_row, dict) else method_row[0]
                    except:
                        pass
                
                # Check if order has tip column
                cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND table_schema = 'public'")
                columns_result = cursor.fetchall()
                order_columns = [col['column_name'] if isinstance(col, dict) else col[0] for col in columns_result]
                has_tip = 'tip' in order_columns
                
                # Use order_payment_status for orders table (allowed: pending, completed, refunded, partially_refunded)
                # When tip > 0: update tip AND add tip to order total so Recent Orders and receipts show correct amount
                if has_tip:
                    if tip > 0:
                        print(f"[TIP DEBUG] Executing UPDATE orders SET tip={tip}, total=total+{tip} WHERE order_id={order_id}")
                        cursor.execute("""
                            UPDATE orders
                            SET payment_method = %s,
                                payment_status = %s,
                                tip = %s,
                                total = COALESCE(total, 0) + %s
                            WHERE order_id = %s
                        """, (payment_method_name, order_payment_status, tip, tip, order_id))
                    else:
                        cursor.execute("""
                            UPDATE orders
                            SET payment_method = %s,
                                payment_status = %s,
                                tip = %s
                            WHERE order_id = %s
                        """, (payment_method_name, order_payment_status, tip, order_id))
                else:
                    cursor.execute("""
                        UPDATE orders
                        SET payment_method = %s,
                            payment_status = %s
                        WHERE order_id = %s
                    """, (payment_method_name, order_payment_status, order_id))
            
            # Award loyalty points when payment succeeds and transaction has a customer
            customer_id = transaction.get('customer_id')
            if customer_id and order_payment_status == 'completed':
                try:
                    from database import award_rewards_for_purchase
                    subtotal = float(transaction.get('subtotal', 0) or 0)
                    tax = float(transaction.get('tax', 0) or 0)
                    amount_for_rewards = subtotal + tax
                    award_rewards_for_purchase(cursor, customer_id, amount_for_rewards, points_used=0)
                except Exception as rew_err:
                    print(f"Warning: Could not award rewards: {rew_err}")
                    import traceback
                    traceback.print_exc()
            
            # Note: Inventory is already updated when order_items are created in start_transaction
            # No need to update again here to avoid double deduction
            
            conn.commit()
            
            out = {
                'success': True,
                'payment_id': payment_id,
                'payment_status': transaction_payment_status,
                'transaction_status': transaction_status,
                'change': max(0, change)
            }
            if order_id and order_payment_status == 'completed':
                out['order_id'] = order_id
            return out
        except Exception as e:
            try:
                conn.rollback()
            except:
                pass  # Ignore rollback errors if connection is already closed
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
        finally:
            try:
                conn.close()
            except:
                pass  # Ignore close errors
    
    def save_receipt_preference(self, transaction_id, receipt_type, 
                               email=None, phone=None):
        """Save customer's receipt preference"""
        conn, cursor = self.get_connection()
        
        try:
            cursor.execute("""
                INSERT INTO receipt_preferences
                (transaction_id, receipt_type, email_address, phone_number)
                VALUES (%s, %s, %s, %s)
                RETURNING preference_id
            """, (transaction_id, receipt_type, email, phone))
            preference_id = cursor.fetchone()['preference_id']
            
            conn.commit()
            return preference_id
        except Exception as e:
            try:
                conn.rollback()
            except:
                pass
            raise e
        finally:
            try:
                conn.close()
            except:
                pass
    
    def get_transaction_details(self, transaction_id):
        """Get complete transaction details"""
        conn, cursor = self.get_connection()
        
        try:
            # Get transaction
            cursor.execute("""
                SELECT t.*, e.first_name as cashier_first_name, 
                       e.last_name as cashier_last_name
                FROM transactions t
                JOIN employees e ON t.employee_id = e.employee_id
                WHERE t.transaction_id = %s
            """, (transaction_id,))
            
            transaction = cursor.fetchone()
            if not transaction:
                return None
            
            transaction = dict(transaction)
            
            # Get items
            cursor.execute("""
                SELECT ti.*, i.product_name, i.sku
                FROM transaction_items ti
                JOIN inventory i ON ti.product_id = i.product_id
                WHERE ti.transaction_id = %s
            """, (transaction_id,))
            
            items = [dict(row) for row in cursor.fetchall()]
            
            # Get payments
            cursor.execute("""
                SELECT p.*, pm.method_name
                FROM payments p
                JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                WHERE p.transaction_id = %s
            """, (transaction_id,))
            
            payments = [dict(row) for row in cursor.fetchall()]
            
            return {
                'transaction': transaction,
                'items': items,
                'payments': payments
            }
        finally:
            conn.close()
    
    def get_display_settings(self):
        """Get customer display settings"""
        from database_postgres import get_current_establishment
        conn, cursor = self.get_connection()
        
        establishment_id = get_current_establishment()
        
        cursor.execute("""
            SELECT * FROM customer_display_settings
            WHERE establishment_id = %s
            ORDER BY setting_id DESC
            LIMIT 1
        """, (establishment_id,))
        
        settings = cursor.fetchone()
        
        if settings:
            settings = dict(settings)
            # Ensure signature_required is always present (0 or 1)
            if 'signature_required' not in settings:
                settings['signature_required'] = 0
            # Parse JSON fields
            if settings.get('tip_suggestions'):
                try:
                    settings['tip_suggestions'] = json.loads(settings['tip_suggestions'])
                except:
                    settings['tip_suggestions'] = [15, 18, 20]
            # Always parse and include checkout_ui when column exists so API response is consistent
            raw_checkout_ui = settings.get('checkout_ui')
            if raw_checkout_ui is not None:
                try:
                    settings['checkout_ui'] = json.loads(raw_checkout_ui) if isinstance(raw_checkout_ui, str) else raw_checkout_ui
                    if not isinstance(settings['checkout_ui'], dict):
                        settings['checkout_ui'] = None
                except Exception:
                    settings['checkout_ui'] = None
            else:
                settings['checkout_ui'] = None
            # Tip display options (columns may not exist before migration)
            if 'tip_custom_in_checkout' not in settings:
                settings['tip_custom_in_checkout'] = 0
            if 'tip_allocation' not in settings or settings.get('tip_allocation') not in ('logged_in_employee', 'split_all'):
                settings['tip_allocation'] = settings.get('tip_allocation') or 'logged_in_employee'
            if 'tip_refund_from' not in settings or settings.get('tip_refund_from') not in ('employee', 'store'):
                settings['tip_refund_from'] = settings.get('tip_refund_from') or 'store'
        else:
            # Return defaults if no settings exist
            settings = {
                'tip_enabled': 0,
                'tip_after_payment': 0,
                'tip_suggestions': [15, 18, 20],
                'signature_required': 0,
                'theme_color': '#4CAF50',
                'tip_custom_in_checkout': 0,
                'tip_allocation': 'logged_in_employee',
                'tip_refund_from': 'store'
            }
        
        conn.close()
        return settings
    
    def update_display_settings(self, **kwargs):
        """Update customer display settings for the current establishment."""
        from database_postgres import get_current_establishment
        conn, cursor = self.get_connection()
        
        try:
            establishment_id = get_current_establishment()
            if establishment_id is None:
                cursor.execute("SELECT establishment_id FROM establishments ORDER BY establishment_id LIMIT 1")
                row = cursor.fetchone()
                establishment_id = row['establishment_id'] if row and isinstance(row, dict) else (row[0] if row else None)
            if establishment_id is None:
                raise ValueError('No establishment found')
            
            # Only update columns that exist in the table (schema may vary)
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'customer_display_settings'
            """)
            existing_columns = {r['column_name'] if isinstance(r, dict) else r[0] for r in cursor.fetchall()}
            
            allowed_fields = [
                'store_location', 'show_promotions', 'show_survey_prompt',
                'show_loyalty_signup', 'tip_enabled', 'tip_after_payment',
                'tip_suggestions', 'signature_required', 'idle_screen_content',
                'branding_logo_path', 'theme_color', 'checkout_ui',
                'tip_custom_in_checkout', 'tip_allocation', 'tip_refund_from'
            ]
            
            cursor.execute("""
                SELECT setting_id FROM customer_display_settings
                WHERE establishment_id = %s
                ORDER BY setting_id DESC LIMIT 1
            """, (establishment_id,))
            existing = cursor.fetchone()
            
            if existing:
                setting_id = existing['setting_id'] if isinstance(existing, dict) else existing[0]
                updates = []
                values = []
                for field, value in kwargs.items():
                    if field in allowed_fields and field in existing_columns:
                        if field == 'tip_suggestions' and isinstance(value, list):
                            value = json.dumps(value)
                        elif field == 'checkout_ui' and (isinstance(value, dict) or isinstance(value, list)):
                            value = json.dumps(value)
                        elif field == 'tip_custom_in_checkout':
                            value = 1 if value else 0
                        updates.append(f"{field} = %s")
                        values.append(value)
                if 'checkout_ui' in kwargs and 'checkout_ui' not in existing_columns:
                    raise ValueError(
                        'checkout_ui column missing. Run migration: migrations/add_checkout_ui_settings_postgres.sql'
                    )
                if updates:
                    values.append(setting_id)
                    cursor.execute(f"""
                        UPDATE customer_display_settings
                        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                        WHERE setting_id = %s
                    """, values)
                    conn.commit()
            else:
                # Insert new row for this establishment. Include base columns plus any allowed fields from kwargs
                # (e.g. checkout_ui) so they are saved on first insert.
                base_insert_columns = ['establishment_id', 'tip_enabled', 'tip_suggestions', 'receipt_enabled', 'signature_required']
                insert_fields = set(base_insert_columns)
                # Add any allowed fields from kwargs so checkout_ui etc. are saved on first save
                for k in kwargs:
                    if k in allowed_fields and k in existing_columns:
                        insert_fields.add(k)
                fields = []
                placeholders = []
                values = []
                defaults = {
                    'tip_enabled': kwargs.get('tip_enabled', 0),
                    'tip_suggestions': kwargs.get('tip_suggestions', [15, 18, 20]),
                    'signature_required': kwargs.get('signature_required', 0),
                    'receipt_enabled': 1,
                    'tip_custom_in_checkout': 1 if kwargs.get('tip_custom_in_checkout') else 0,
                    'tip_allocation': kwargs.get('tip_allocation', 'logged_in_employee'),
                    'tip_refund_from': kwargs.get('tip_refund_from', 'store'),
                }
                for field in insert_fields:
                    if field not in existing_columns:
                        continue
                    if field == 'establishment_id':
                        fields.append(field)
                        placeholders.append('%s')
                        values.append(establishment_id)
                        continue
                    # Prefer kwargs value if provided, else use default
                    value = kwargs.get(field) if field in kwargs else defaults.get(field)
                    if value is None and field == 'tip_suggestions':
                        value = [15, 18, 20]
                    if field == 'tip_suggestions' and isinstance(value, list):
                        value = json.dumps(value)
                    elif field == 'checkout_ui' and (isinstance(value, dict) or isinstance(value, list)):
                        value = json.dumps(value)
                    elif field == 'tip_custom_in_checkout':
                        value = 1 if value else 0
                    fields.append(field)
                    placeholders.append('%s')
                    values.append(value)
                if not fields:
                    raise ValueError('customer_display_settings has no insertable columns')
                cursor.execute(f"""
                    INSERT INTO customer_display_settings ({', '.join(fields)})
                    VALUES ({', '.join(placeholders)})
                """, values)
                conn.commit()
            
            return True
        except Exception as e:
            try:
                conn.rollback()
            except:
                pass
            raise e
        finally:
            try:
                conn.close()
            except:
                pass
    
    def log_customer_action(self, session_id, action):
        """Log customer interaction on display"""
        conn, cursor = self.get_connection()
        
        try:
            # Get existing actions
            cursor.execute("""
                SELECT actions_taken FROM customer_display_sessions
                WHERE session_id = %s
            """, (session_id,))
            
            result = cursor.fetchone()
            
            if result:
                actions = json.loads(result['actions_taken']) if result['actions_taken'] else []
                actions.append({
                    'action': action,
                    'timestamp': datetime.now().isoformat()
                })
                
                cursor.execute("""
                    UPDATE customer_display_sessions
                    SET actions_taken = %s
                    WHERE session_id = %s
                """, (json.dumps(actions), session_id))
                
                conn.commit()
        except Exception as e:
            try:
                conn.rollback()
            except:
                pass
            raise e
        finally:
            try:
                conn.close()
            except:
                pass

