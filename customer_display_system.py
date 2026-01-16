"""
Customer Display System Backend
Handles transactions, payments, and customer display interactions
"""

import sqlite3
import json
from datetime import datetime
from decimal import Decimal

class CustomerDisplaySystem:
    
    def __init__(self, db_path='inventory.db'):
        self.db_path = db_path
    
    def get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def start_transaction(self, employee_id, items):
        """Start a new transaction"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Generate transaction number
            transaction_number = f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # Calculate totals
            subtotal = sum(item['quantity'] * item['unit_price'] for item in items)
            tax = subtotal * 0.08  # 8% tax rate - adjust as needed
            total = subtotal + tax
            
            # Create transaction
            cursor.execute("""
                INSERT INTO transactions 
                (transaction_number, employee_id, subtotal, tax, total, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            """, (transaction_number, employee_id, subtotal, tax, total))
            
            transaction_id = cursor.lastrowid
            
            # Add transaction items
            for item in items:
                item_subtotal = item['quantity'] * item['unit_price']
                cursor.execute("""
                    INSERT INTO transaction_items
                    (transaction_id, product_id, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                """, (transaction_id, item['product_id'], item['quantity'],
                      item['unit_price'], item_subtotal))
            
            # Create customer display session
            cursor.execute("""
                INSERT INTO customer_display_sessions (transaction_id)
                VALUES (?)
            """, (transaction_id,))
            
            session_id = cursor.lastrowid
            
            conn.commit()
            
            return {
                'transaction_id': transaction_id,
                'transaction_number': transaction_number,
                'session_id': session_id,
                'subtotal': float(subtotal),
                'tax': float(tax),
                'total': float(total),
                'items': items
            }
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_payment_methods(self):
        """Get available payment methods"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM payment_methods
            WHERE is_active = 1
            ORDER BY display_order
        """)
        
        methods = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return methods
    
    def process_payment(self, transaction_id, payment_method_id, amount, 
                       card_info=None, tip=0):
        """Process payment for transaction"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get transaction
            cursor.execute("""
                SELECT * FROM transactions WHERE transaction_id = ?
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
                    SET tip = ?, total = ?
                    WHERE transaction_id = ?
                """, (tip, new_total, transaction_id))
            
            # Create payment record
            cursor.execute("""
                INSERT INTO payments
                (transaction_id, payment_method_id, amount, card_last_four, 
                 card_type, authorization_code, payment_status, processed_at)
                VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))
            """, (transaction_id, payment_method_id, amount,
                  card_info.get('last_four') if card_info else None,
                  card_info.get('card_type') if card_info else None,
                  card_info.get('auth_code') if card_info else None))
            
            payment_id = cursor.lastrowid
            
            # Update transaction status
            total_paid = amount
            expected_total = float(transaction['total']) + tip
            
            if total_paid >= expected_total:
                payment_status = 'paid'
                transaction_status = 'completed'
                change = total_paid - expected_total
            else:
                payment_status = 'partial'
                transaction_status = 'pending'
                change = 0
            
            # Get payment method type to check if cash
            cursor.execute("""
                SELECT method_type FROM payment_methods WHERE payment_method_id = ?
            """, (payment_method_id,))
            method_row = cursor.fetchone()
            is_cash = method_row and method_row[0] == 'cash' if method_row else False
            
            # Update transaction with payment info
            # Try to add amount_paid and change columns if they don't exist (for backward compatibility)
            try:
                cursor.execute("""
                    UPDATE transactions
                    SET payment_status = ?,
                        status = ?,
                        completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END,
                        amount_paid = ?,
                        change_amount = ?
                    WHERE transaction_id = ?
                """, (payment_status, transaction_status, transaction_status, total_paid if is_cash else None, change if is_cash and change > 0 else 0, transaction_id))
            except sqlite3.OperationalError:
                # Columns don't exist, update without them
                cursor.execute("""
                    UPDATE transactions
                    SET payment_status = ?,
                        status = ?,
                        completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END
                    WHERE transaction_id = ?
                """, (payment_status, transaction_status, transaction_status, transaction_id))
            
            # Update inventory
            if transaction_status == 'completed':
                # Get all transaction items
                cursor.execute("""
                    SELECT product_id, quantity
                    FROM transaction_items
                    WHERE transaction_id = ?
                """, (transaction_id,))
                
                items = cursor.fetchall()
                
                # Update inventory for each item
                for item in items:
                    # sqlite3.Row supports dictionary-style access
                    product_id = item['product_id']
                    quantity = item['quantity']
                    cursor.execute("""
                        UPDATE inventory
                        SET current_quantity = current_quantity - ?
                        WHERE product_id = ?
                    """, (quantity, product_id))
            
            conn.commit()
            
            return {
                'success': True,
                'payment_id': payment_id,
                'payment_status': payment_status,
                'transaction_status': transaction_status,
                'change': max(0, change)
            }
        except Exception as e:
            conn.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            conn.close()
    
    def save_receipt_preference(self, transaction_id, receipt_type, 
                               email=None, phone=None):
        """Save customer's receipt preference"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO receipt_preferences
                (transaction_id, receipt_type, email_address, phone_number)
                VALUES (?, ?, ?, ?)
            """, (transaction_id, receipt_type, email, phone))
            
            preference_id = cursor.lastrowid
            
            conn.commit()
            return preference_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_transaction_details(self, transaction_id):
        """Get complete transaction details"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get transaction
            cursor.execute("""
                SELECT t.*, e.first_name as cashier_first_name, 
                       e.last_name as cashier_last_name
                FROM transactions t
                JOIN employees e ON t.employee_id = e.employee_id
                WHERE t.transaction_id = ?
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
                WHERE ti.transaction_id = ?
            """, (transaction_id,))
            
            items = [dict(row) for row in cursor.fetchall()]
            
            # Get payments
            cursor.execute("""
                SELECT p.*, pm.method_name
                FROM payments p
                JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                WHERE p.transaction_id = ?
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
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM customer_display_settings
            ORDER BY setting_id DESC
            LIMIT 1
        """)
        
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
        conn = self.get_connection()
        cursor = conn.cursor()
        
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
                        updates.append(f"{field} = ?")
                        values.append(value)
                
                if updates:
                    values.append(setting_id)
                    cursor.execute(f"""
                        UPDATE customer_display_settings
                        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                        WHERE setting_id = ?
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
                        placeholders.append('?')
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
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def log_customer_action(self, session_id, action):
        """Log customer interaction on display"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get existing actions
            cursor.execute("""
                SELECT actions_taken FROM customer_display_sessions
                WHERE session_id = ?
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
                    SET actions_taken = ?
                    WHERE session_id = ?
                """, (json.dumps(actions), session_id))
                
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

