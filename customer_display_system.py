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
    
    def start_transaction(self, employee_id, items, customer_id=None):
        """Start a new transaction"""
        from database_postgres import get_current_establishment
        conn, cursor = self.get_connection()
        try:
            # Ensure we start with a clean transaction state
            try:
                conn.rollback()
            except:
                pass
            
            establishment_id = get_current_establishment()
            
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
            
            total = subtotal + total_tax
            
            # Generate order number (format: ORD-YYYYMMDD-HHMMSS)
            order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{datetime.now().strftime('%H%M%S')}"
            
            # Create order first to get order_id and order_number
            # Check if tip and order_type columns exist
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND table_schema = 'public'")
            columns_result = cursor.fetchall()
            order_columns = [col['column_name'] if isinstance(col, dict) else col[0] for col in columns_result]
            has_tip = 'tip' in order_columns
            has_order_type = 'order_type' in order_columns
            has_tax_rate = 'tax_rate' in order_columns
            
            if has_tip and has_order_type and has_tax_rate:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, total_tax, total))
            elif has_tax_rate:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, tax_amount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, tax_rate, total_tax, total))
            else:
                cursor.execute("""
                    INSERT INTO orders
                    (establishment_id, order_number, employee_id, customer_id, subtotal, tax_amount, total, payment_method, payment_status, order_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'cash', 'pending', 'completed')
                    RETURNING order_id, order_number
                """, (establishment_id, order_number, employee_id, customer_id, subtotal, total_tax, total))
            order_result = cursor.fetchone()
            if isinstance(order_result, dict):
                order_id = order_result['order_id']
                order_number = order_result['order_number']
            else:
                order_id = order_result[0]
                order_number = order_result[1] if len(order_result) > 1 else order_number
            
            # Now create transaction linked to order
            cursor.execute("""
                INSERT INTO transactions
                (establishment_id, order_id, employee_id, customer_id, subtotal, tax, total, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING transaction_id
            """, (establishment_id, order_id, employee_id, customer_id, subtotal, total_tax, total))
            result = cursor.fetchone()
            transaction_id = result['transaction_id'] if isinstance(result, dict) else result[0]
            
            # Calculate tax rate (8% default, or from items if provided)
            tax_rate = 0.08
            if items and len(items) > 0:
                # Check if items have tax_rate
                first_item_tax = items[0].get('tax_rate')
                if first_item_tax is not None:
                    tax_rate = float(first_item_tax)
            
            # Create order_items for the order (required for returns and order history)
            print(f"Creating order_items for order_id {order_id}, {len(items)} items")
            for idx, item in enumerate(items):
                product_id = item['product_id']
                quantity = int(item['quantity'])
                unit_price = float(item['unit_price'])
                item_discount = float(item.get('discount', 0.0))
                item_tax_rate = float(item.get('tax_rate', tax_rate))
                item_subtotal = (quantity * unit_price) - item_discount
                item_tax = item_subtotal * item_tax_rate
                
                # Verify product exists
                cursor.execute("SELECT product_id FROM inventory WHERE product_id = %s", (product_id,))
                product_check = cursor.fetchone()
                if not product_check:
                    raise Exception(f'Product ID {product_id} does not exist in inventory')
                
                try:
                    # Insert order_item
                    cursor.execute("""
                        INSERT INTO order_items (
                            establishment_id, order_id, product_id, quantity, unit_price, discount, subtotal,
                            tax_rate, tax_amount
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (establishment_id, order_id, product_id, quantity, unit_price, item_discount, item_subtotal,
                          item_tax_rate, item_tax))
                    
                    print(f"Successfully inserted order_item: order_id={order_id}, product_id={product_id}, quantity={quantity}")
                    
                    # Update inventory quantity
                    cursor.execute("""
                        UPDATE inventory
                        SET current_quantity = current_quantity - %s,
                            updated_at = NOW()
                        WHERE product_id = %s AND establishment_id = %s
                    """, (quantity, product_id, establishment_id))
                    
                except Exception as item_error:
                    import traceback
                    print(f"Error inserting order_item for product_id {product_id}: {str(item_error)}")
                    traceback.print_exc()
                    raise Exception(f'Error inserting order item for product_id {product_id}: {str(item_error)}')
            
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
                'total': float(total),
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
                if has_tip:
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
            
            # Note: Inventory is already updated when order_items are created in start_transaction
            # No need to update again here to avoid double deduction
            
            conn.commit()
            
            return {
                'success': True,
                'payment_id': payment_id,
                'payment_status': transaction_payment_status,
                'transaction_status': transaction_status,
                'change': max(0, change)
            }
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
            # Parse JSON fields
            if settings.get('tip_suggestions'):
                try:
                    settings['tip_suggestions'] = json.loads(settings['tip_suggestions'])
                except:
                    settings['tip_suggestions'] = [15, 18, 20, 25]
        else:
            # Return defaults if no settings exist
            settings = {
                'tip_enabled': 0,
                'tip_after_payment': 0,
                'tip_suggestions': [15, 18, 20, 25],
                'theme_color': '#4CAF50'
            }
        
        conn.close()
        return settings
    
    def update_display_settings(self, **kwargs):
        """Update customer display settings"""
        conn, cursor = self.get_connection()
        
        try:
            # Check if settings exist
            cursor.execute("SELECT setting_id FROM customer_display_settings ORDER BY setting_id DESC LIMIT 1")
            existing = cursor.fetchone()
            
            allowed_fields = [
                'store_location', 'show_promotions', 'show_survey_prompt',
                'show_loyalty_signup', 'tip_enabled', 'tip_after_payment',
                'tip_suggestions', 'idle_screen_content', 'branding_logo_path',
                'theme_color'
            ]
            
            if existing:
                # Update existing settings
                setting_id = existing[0]
                updates = []
                values = []
                
                for field, value in kwargs.items():
                    if field in allowed_fields:
                        if field == 'tip_suggestions' and isinstance(value, list):
                            value = json.dumps(value)
                        updates.append(f"{field} = %s")
                        values.append(value)
                
                if updates:
                    values.append(setting_id)
                    cursor.execute(f"""
                        UPDATE customer_display_settings
                        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                        WHERE setting_id = %s
                    """, values)
                    conn.commit()
            else:
                # Insert new settings
                fields = []
                placeholders = []
                values = []
                
                defaults = {
                    'show_promotions': 1,
                    'show_survey_prompt': 1,
                    'show_loyalty_signup': 1,
                    'tip_enabled': 0,
                    'tip_after_payment': 0,
                    'tip_suggestions': json.dumps([15, 18, 20, 25]),
                    'theme_color': '#4CAF50'
                }
                
                defaults.update(kwargs)
                
                for field in allowed_fields:
                    if field in defaults:
                        fields.append(field)
                        placeholders.append('%s')
                        value = defaults[field]
                        if field == 'tip_suggestions' and isinstance(value, list):
                            value = json.dumps(value)
                        values.append(value)
                
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

