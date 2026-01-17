#!/usr/bin/env python3
"""
Receipt generation module with PDF and barcode support
"""

import sqlite3
from typing import Dict, Any, Optional
from datetime import datetime
import io

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("Warning: reportlab not installed. Receipt generation will be limited.")

try:
    import qrcode
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False
    print("Warning: qrcode not installed. QR code generation will be limited.")

try:
    import barcode
    from barcode.writer import ImageWriter
    BARCODE_AVAILABLE = True
except ImportError:
    BARCODE_AVAILABLE = False
    print("Warning: python-barcode not installed. Barcode generation will be limited.")

DB_NAME = 'inventory.db'

def get_receipt_settings() -> Dict[str, Any]:
    """Get receipt settings from database"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM receipt_settings ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    else:
        # Return default settings
        return {
            'receipt_type': 'traditional',
            'store_name': 'Store',
            'store_address': '',
            'store_city': '',
            'store_state': '',
            'store_zip': '',
            'store_phone': '',
            'store_email': '',
            'store_website': '',
            'footer_message': 'Thank you for your business!',
            'return_policy': '',
            'show_tax_breakdown': 1,
            'show_payment_method': 1,
            'show_signature': 0
        }

def generate_barcode_data(order_number: str) -> bytes:
    """Generate Code128 barcode image data for order number"""
    if not BARCODE_AVAILABLE:
        # Fallback to QR code if barcode library not available
        if QRCODE_AVAILABLE:
            try:
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=4,
                    border=2,
                )
                qr.add_data(order_number)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                img_bytes = io.BytesIO()
                img.save(img_bytes, format='PNG')
                return img_bytes.getvalue()
            except Exception as e:
                print(f"Error generating QR code fallback: {e}")
        return b''
    
    try:
        # Generate Code128 barcode
        code128 = barcode.get_barcode_class('code128')
        barcode_instance = code128(order_number, writer=ImageWriter())
        
        # Create image with custom options for receipt printing
        # Optimized for fast scanning: wider bars, taller height, larger quiet zone
        options = {
            'module_width': 0.4,  # Slightly wider bars for easier scanning (was 0.3)
            'module_height': 20.0,  # Taller barcode for better alignment (was 15.0)
            'quiet_zone': 6.0,  # Larger quiet zone - critical for scanner detection (was 2.0)
            'font_size': 8,  # Font size for text below barcode
            'text_distance': 3.0,  # Distance between barcode and text
            'write_text': False,  # Don't show order number below barcode (we display it separately)
        }
        
        # Generate barcode image using render() method which returns a PIL Image
        img = barcode_instance.render(options)
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        barcode_bytes = img_bytes.getvalue()
        img_bytes.close()
        
        if len(barcode_bytes) > 0:
            return barcode_bytes
        else:
            print("Warning: Generated barcode is empty")
            return b''
    except Exception as e:
        print(f"Error generating Code128 barcode: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to QR code if Code128 fails
        if QRCODE_AVAILABLE:
            try:
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=4,
                    border=2,
                )
                qr.add_data(order_number)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                img_bytes = io.BytesIO()
                img.save(img_bytes, format='PNG')
                return img_bytes.getvalue()
            except Exception as e2:
                print(f"Error generating QR code fallback: {e2}")
        return b''

def generate_receipt_pdf(order_data: Dict[str, Any], order_items: list) -> bytes:
    """
    Generate receipt PDF with barcode
    
    Args:
        order_data: Order information (order_id, order_number, order_date, etc.)
        order_items: List of order items with product details
    
    Returns:
        PDF bytes
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError("reportlab is required for receipt generation. Install with: pip install reportlab")
    
    buffer = io.BytesIO()
    
    # Generate barcode first if available
    order_number = order_data.get('order_number', '')
    barcode_data = None
    if order_number and (BARCODE_AVAILABLE or QRCODE_AVAILABLE):
        try:
            barcode_data = generate_barcode_data(order_number)
            if barcode_data and len(barcode_data) > 0:
                print(f"Successfully generated barcode for order {order_number}, size: {len(barcode_data)} bytes")
            else:
                print(f"Warning: Barcode data is empty for order {order_number}")
        except Exception as e:
            print(f"Error generating barcode: {e}")
            import traceback
            traceback.print_exc()
    
    # Thermal receipt format: 80mm wide (3.15 inches) - standard receipt printer size
    receipt_width = 3.15 * inch
    receipt_height = 11 * inch  # Standard letter height, but will cut at content
    
    doc = SimpleDocTemplate(buffer, 
                           pagesize=(receipt_width, receipt_height),
                           rightMargin=0.15*inch, 
                           leftMargin=0.15*inch,
                           topMargin=0.2*inch, 
                           bottomMargin=0.2*inch)
    
    # Get receipt settings
    settings = get_receipt_settings()
    
    # Build story (content)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles for thermal receipt printer (smaller fonts, black and white)
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceAfter=8,
        fontName='Helvetica-Bold'
    )
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceAfter=4,
        fontName='Helvetica'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.black,
        alignment=TA_LEFT,
        fontName='Helvetica'
    )
    
    small_style = ParagraphStyle(
        'CustomSmall',
        parent=styles['Normal'],
        fontSize=7,
        textColor=colors.black,
        alignment=TA_LEFT,
        fontName='Helvetica'
    )
    
    # Store header
    story.append(Paragraph(settings.get('store_name', 'Store'), title_style))
    
    # Store address
    address_parts = []
    if settings.get('store_address'):
        address_parts.append(settings['store_address'])
    if settings.get('store_city') or settings.get('store_state') or settings.get('store_zip'):
        city_state_zip = ', '.join(filter(None, [
            settings.get('store_city', ''),
            settings.get('store_state', ''),
            settings.get('store_zip', '')
        ]))
        if city_state_zip:
            address_parts.append(city_state_zip)
    if settings.get('store_phone'):
        address_parts.append(f"Phone: {settings['store_phone']}")
    if settings.get('store_email'):
        address_parts.append(settings['store_email'])
    if settings.get('store_website'):
        address_parts.append(settings['store_website'])
    
    for part in address_parts:
        if part:
            story.append(Paragraph(part, header_style))
    
    story.append(Spacer(1, 0.1*inch))
    
    # Divider line
    story.append(Paragraph("-" * 40, header_style))
    story.append(Spacer(1, 0.05*inch))
    
    # Order information
    try:
        order_date_str = order_data['order_date']
        if 'T' in order_date_str:
            order_date = datetime.fromisoformat(order_date_str.replace('Z', '+00:00'))
        else:
            order_date = datetime.strptime(order_date_str, '%Y-%m-%d %H:%M:%S')
        formatted_date = order_date.strftime('%m/%d/%Y %I:%M %p')
    except:
        formatted_date = order_data.get('order_date', '')
    
    story.append(Paragraph(f"Order: {order_data['order_number']}", normal_style))
    story.append(Paragraph(f"Date: {formatted_date}", normal_style))
    
    # Show order type and customer info if available
    order_type = order_data.get('order_type')
    customer_name = order_data.get('customer_name')
    if order_type or customer_name:
        story.append(Spacer(1, 0.05*inch))
        if order_type:
            story.append(Paragraph(f"Order Type: {order_type.title()}", normal_style))
        if customer_name:
            story.append(Paragraph(f"Customer: {customer_name}", normal_style))
            # Get customer phone and address from database if available
            try:
                conn = sqlite3.connect(DB_NAME)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Try to get customer details from order
                customer_id = order_data.get('customer_id')
                if customer_id:
                    cursor.execute("SELECT phone, address FROM customers WHERE customer_id = ?", (customer_id,))
                    customer_row = cursor.fetchone()
                    if customer_row:
                        customer_phone = customer_row.get('phone')
                        customer_address = customer_row.get('address')
                        if customer_phone:
                            story.append(Paragraph(f"Phone: {customer_phone}", small_style))
                        if customer_address and order_type == 'delivery':
                            story.append(Paragraph(f"Delivery Address: {customer_address}", small_style))
                
                conn.close()
            except Exception as e:
                print(f"Note: Could not get customer details: {e}")
    
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph("-" * 40, header_style))
    story.append(Spacer(1, 0.05*inch))
    
    # Items table - compact format for receipt
    for item in order_items:
        product_name = item.get('product_name', 'Unknown')
        quantity = item.get('quantity', 0)
        unit_price = item.get('unit_price', 0.0)
        item_total = quantity * unit_price
        
        # Truncate long product names for receipt
        if len(product_name) > 25:
            product_name = product_name[:22] + '...'
        
        # Format as receipt line: "Product Name         2 x $10.00 = $20.00"
        line = f"{product_name:<20} {quantity} x ${unit_price:.2f} = ${item_total:.2f}"
        story.append(Paragraph(line, small_style))
    
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph("-" * 40, header_style))
    story.append(Spacer(1, 0.05*inch))
    
    # Totals
    totals_data = []
    subtotal = order_data.get('subtotal', 0.0)
    totals_data.append(['Subtotal:', f"${subtotal:.2f}"])
    
    if settings.get('show_tax_breakdown', 1):
        tax_rate = order_data.get('tax_rate', 0.0) * 100
        tax_amount = order_data.get('tax_amount', 0.0)
        totals_data.append([f'Tax ({tax_rate:.1f}%):', f"${tax_amount:.2f}"])
    
    discount = order_data.get('discount', 0.0)
    if discount > 0:
        totals_data.append(['Discount:', f"-${discount:.2f}"])
    
    transaction_fee = order_data.get('transaction_fee', 0.0)
    if transaction_fee > 0:
        totals_data.append(['Transaction Fee:', f"${transaction_fee:.2f}"])
    
    tip = order_data.get('tip', 0.0)
    if tip > 0:
        totals_data.append(['Tip:', f"${tip:.2f}"])
    
    total = order_data.get('total', 0.0)
    totals_data.append(['<b>TOTAL:</b>', f"<b>${total:.2f}</b>"])
    
    # Totals - simple format for receipt
    for label, value in totals_data:
        if '<b>' in label or '<b>' in value:
            # Total line - bold
            line = f"{label.replace('<b>', '').replace('</b>', ''):<20} {value.replace('<b>', '').replace('</b>', '')}"
            story.append(Paragraph(f"<b>{line}</b>", normal_style))
        else:
            line = f"{label:<20} {value}"
            story.append(Paragraph(line, small_style))
    
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph("-" * 40, header_style))
    story.append(Spacer(1, 0.05*inch))
    
    # Payment method
    if settings.get('show_payment_method', 1):
        payment_method = order_data.get('payment_method', 'Unknown')
        payment_method_display = payment_method.replace('_', ' ').title()
        story.append(Paragraph(f"Payment: {payment_method_display}", small_style))
        
        # Show amount paid and change for cash payments
        amount_paid = order_data.get('amount_paid')
        change = order_data.get('change', 0)
        payment_method_type = order_data.get('payment_method_type', '')
        if amount_paid and (payment_method_type == 'cash' or (payment_method and 'cash' in payment_method.lower())):
            story.append(Paragraph(f"Amount Paid: ${float(amount_paid):.2f}", small_style))
            if change > 0:
                story.append(Paragraph(f"Change: ${change:.2f}", small_style))
        
        story.append(Spacer(1, 0.05*inch))
    
    # Barcode - always try to show
    story.append(Spacer(1, 0.1*inch))
    if barcode_data and len(barcode_data) > 0:
        try:
            from reportlab.platypus import Image
            
            # Create BytesIO from barcode data
            barcode_bytes_io = io.BytesIO(barcode_data)
            
            # For Code128 barcodes, the image is wider than tall
            # Calculate appropriate size for receipt (80mm width = 3.15 inches)
            # Leave margins, so max width is about 2.8 inches
            # For Code128, typical aspect ratio is about 3:1 (width:height)
            barcode_width = min(2.5*inch, receipt_width - 0.3*inch)
            barcode_height = 0.5*inch  # Standard barcode height for receipts
            
            # Create Image from BytesIO - reportlab can handle BytesIO directly
            img = Image(barcode_bytes_io, width=barcode_width, height=barcode_height)
            
            # Center the barcode using a table
            barcode_table = Table([[img]], colWidths=[receipt_width - 0.3*inch])
            barcode_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ]))
            story.append(barcode_table)
            story.append(Spacer(1, 0.05*inch))
            
            # Order number is already included in the barcode image, but add it below for clarity
            story.append(Paragraph(f"Order #: {order_number}", ParagraphStyle(
                'BarcodeLabel',
                parent=styles['Normal'],
                fontSize=7,
                textColor=colors.black,
                alignment=TA_CENTER,
                fontName='Helvetica'
            )))
            story.append(Spacer(1, 0.05*inch))
            print(f"Successfully added barcode to receipt for order {order_number}")
        except Exception as e:
            print(f"Error adding barcode to receipt: {e}")
            import traceback
            traceback.print_exc()
            # Fallback: show order number if barcode fails
            story.append(Paragraph(f"Order #: {order_number}", small_style))
    else:
        # Show order number if barcode not available
        if order_number:
            print(f"Warning: No barcode data available for order {order_number}, showing text only")
            story.append(Paragraph(f"Order #: {order_number}", small_style))
    
    story.append(Spacer(1, 0.05*inch))
    story.append(Paragraph("-" * 40, header_style))
    
    # Signature (if enabled and available)
    show_signature_setting = settings.get('show_signature', 0)
    if show_signature_setting == 1 or show_signature_setting == True:
        signature = order_data.get('signature')
        print(f"Signature setting enabled: {show_signature_setting}, Signature available: {signature is not None}")
        if signature:
            try:
                from reportlab.platypus import Image
                import base64
                
                # Decode base64 signature
                if signature.startswith('data:image'):
                    # Remove data URL prefix if present
                    signature = signature.split(',')[1]
                
                signature_bytes = base64.b64decode(signature)
                signature_bytes_io = io.BytesIO(signature_bytes)
                
                # Size signature appropriately for receipt
                signature_width = min(2.5*inch, receipt_width - 0.3*inch)
                signature_height = 0.8*inch  # Standard signature height
                
                # Create Image from BytesIO
                sig_img = Image(signature_bytes_io, width=signature_width, height=signature_height)
                
                # Center the signature using a table
                signature_table = Table([[sig_img]], colWidths=[receipt_width - 0.3*inch])
                signature_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ]))
                
                story.append(Spacer(1, 0.1*inch))
                story.append(Paragraph("Signature:", small_style))
                story.append(signature_table)
                story.append(Spacer(1, 0.05*inch))
                story.append(Paragraph("-" * 40, header_style))
                print(f"Successfully added signature to receipt")
            except Exception as e:
                print(f"Error adding signature to receipt: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"Signature setting is enabled but no signature data found in order_data")
    
    # Footer
    story.append(Spacer(1, 0.1*inch))
    footer_text = settings.get('footer_message', 'Thank you for your business!')
    footer_style = ParagraphStyle(
        'CustomFooter',
        parent=styles['Normal'],
        fontSize=7,
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceBefore=6,
        fontName='Helvetica'
    )
    story.append(Paragraph(footer_text, footer_style))
    
    # Return Policy (if set)
    return_policy = settings.get('return_policy', '')
    if return_policy:
        story.append(Spacer(1, 0.05*inch))
        story.append(Paragraph("-" * 40, header_style))
        story.append(Spacer(1, 0.05*inch))
        return_policy_style = ParagraphStyle(
            'ReturnPolicy',
            parent=styles['Normal'],
            fontSize=7,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceBefore=4,
            fontName='Helvetica'
        )
        story.append(Paragraph(f"Return Policy: {return_policy}", return_policy_style))
    
    story.append(Spacer(1, 0.1*inch))
    
    # Build PDF
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes

def generate_receipt_with_barcode(order_id: int) -> Optional[bytes]:
    """
    Generate receipt PDF for an order
    
    Args:
        order_id: Order ID
    
    Returns:
        PDF bytes or None if error
    """
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get order data
        cursor.execute("""
            SELECT o.*, 
                   e.first_name || ' ' || e.last_name as employee_name,
                   c.customer_name,
                   c.customer_id
            FROM orders o
            LEFT JOIN employees e ON o.employee_id = e.employee_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            WHERE o.order_id = ?
        """, (order_id,))
        
        order_row = cursor.fetchone()
        if not order_row:
            return None
        
        order_data = dict(order_row)
        
        # Get order items
        cursor.execute("""
            SELECT oi.*, i.product_name
            FROM order_items oi
            LEFT JOIN inventory i ON oi.product_id = i.product_id
            WHERE oi.order_id = ?
            ORDER BY oi.order_item_id
        """, (order_id,))
        
        order_items = [dict(row) for row in cursor.fetchall()]
        
        # Get payment method and amount paid for orders
        amount_paid = None
        payment_method = order_data.get('payment_method', 'Unknown')
        change = 0
        
        # Get signature from transactions table if available
        signature = None
        try:
            cursor.execute("""
                SELECT signature FROM transactions WHERE order_id = ? LIMIT 1
            """, (order_id,))
            sig_row = cursor.fetchone()
            if sig_row and sig_row[0]:
                signature = sig_row[0]
        except Exception as e:
            print(f"Note: Could not get signature: {e}")
        
        try:
            # Try to get payment info from payments table if it exists
            cursor.execute("""
                SELECT pm.method_name, pm.method_type, p.amount
                FROM payments p
                JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                WHERE p.transaction_id IN (
                    SELECT transaction_id FROM transactions WHERE order_id = ?
                )
                ORDER BY p.payment_id DESC
                LIMIT 1
            """, (order_id,))
            
            payment_row = cursor.fetchone()
            if payment_row:
                payment_method = payment_row['method_name']
                payment_method_type = payment_row.get('method_type', '')
                amount_paid = payment_row.get('amount')
        except Exception as e:
            # If payments table doesn't exist or query fails, use order data
            print(f"Note: Could not lookup payment for order: {e}")
            pass
        
        # Calculate change if cash payment
        if amount_paid and (payment_method_type == 'cash' or (payment_method and 'cash' in payment_method.lower())):
            total = order_data.get('total', 0)
            change = float(amount_paid) - float(total)
        
        # Add payment info to order_data
        order_data['payment_method'] = payment_method
        order_data['payment_method_type'] = payment_method_type
        order_data['amount_paid'] = amount_paid
        order_data['change'] = change if change > 0 else 0
        order_data['signature'] = signature
        
        conn.close()
        
        # Generate PDF
        return generate_receipt_pdf(order_data, order_items)
        
    except Exception as e:
        print(f"Error generating receipt: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.close()
        return None

def generate_transaction_receipt(transaction_id: int) -> Optional[bytes]:
    """
    Generate receipt PDF for a transaction
    
    Args:
        transaction_id: Transaction ID
    
    Returns:
        PDF bytes or None if error
    """
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get transaction data
        cursor.execute("""
            SELECT t.*, 
                   e.first_name || ' ' || e.last_name as employee_name,
                   c.customer_name
            FROM transactions t
            LEFT JOIN employees e ON t.employee_id = e.employee_id
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            WHERE t.transaction_id = ?
        """, (transaction_id,))
        
        transaction_row = cursor.fetchone()
        if not transaction_row:
            return None
        
        transaction = dict(transaction_row)
        
        # Get transaction items
        cursor.execute("""
            SELECT ti.*, i.product_name
            FROM transaction_items ti
            LEFT JOIN inventory i ON ti.product_id = i.product_id
            WHERE ti.transaction_id = ?
            ORDER BY ti.item_id
        """, (transaction_id,))
        
        transaction_items = [dict(row) for row in cursor.fetchall()]
        
        # Get payment method and try to find associated order number
        payment_method = 'Cash'  # Default
        order_number = transaction['transaction_number']  # Default to transaction number
        
        # Try to find the order that matches this transaction
        # Since transactions and orders are separate, try multiple matching strategies
        try:
            employee_id = transaction.get('employee_id')
            customer_id = transaction.get('customer_id')
            transaction_date = transaction.get('created_at', '')
            
            if employee_id and transaction_date:
                # Strategy 1: Match by employee and closest time (within 1 hour)
                query = """
                    SELECT o.order_number, o.order_id
                    FROM orders o
                    WHERE o.employee_id = ?
                      AND ABS(julianday(o.order_date) - julianday(?)) < 0.042  -- Within 1 hour
                    ORDER BY ABS(julianday(o.order_date) - julianday(?))
                    LIMIT 1
                """
                cursor.execute(query, (employee_id, transaction_date, transaction_date))
                order_row = cursor.fetchone()
                
                # Strategy 2: If no match within 1 hour, try same day
                if not order_row or not order_row['order_number']:
                    query = """
                        SELECT o.order_number, o.order_id
                        FROM orders o
                        WHERE o.employee_id = ?
                          AND DATE(o.order_date) = DATE(?)
                        ORDER BY ABS(julianday(o.order_date) - julianday(?))
                        LIMIT 1
                    """
                    cursor.execute(query, (employee_id, transaction_date, transaction_date))
                    order_row = cursor.fetchone()
                
                # Strategy 3: If still no match, get most recent order for this employee
                if not order_row or not order_row['order_number']:
                    query = """
                        SELECT o.order_number, o.order_id
                        FROM orders o
                        WHERE o.employee_id = ?
                        ORDER BY o.order_date DESC
                        LIMIT 1
                    """
                    cursor.execute(query, (employee_id,))
                    order_row = cursor.fetchone()
                
                if order_row and order_row['order_number']:
                    order_number = order_row['order_number']
                    print(f"Found order number {order_number} for transaction {transaction_id}")
                else:
                    print(f"Could not find matching order for transaction {transaction_id}, using transaction number")
        except Exception as e:
            # If matching fails, use transaction number
            print(f"Note: Could not find order for transaction: {e}")
            import traceback
            traceback.print_exc()
        
        # Get payment method and amount paid
        amount_paid = None
        payment_method_type = None
        change = 0
        signature = transaction.get('signature')  # Get signature from transaction
        
        # First try to get amount_paid from transactions table (if columns exist)
        try:
            cursor.execute("""
                SELECT amount_paid, change_amount, signature FROM transactions WHERE transaction_id = ?
            """, (transaction_id,))
            txn_row = cursor.fetchone()
            if txn_row:
                if txn_row[0]:  # amount_paid exists and is not None
                    amount_paid = txn_row[0]
                if txn_row[1]:
                    change = txn_row[1]
                if txn_row[2]:
                    signature = txn_row[2]
        except sqlite3.OperationalError:
            # Columns don't exist, will get from payments table
            pass
        except Exception as e:
            print(f"Note: Could not get amount_paid from transactions: {e}")
        
        # Get payment method info from payments table
        try:
            cursor.execute("""
                SELECT pm.method_name, pm.method_type, p.amount
                FROM payments p
                JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                WHERE p.transaction_id = ?
                ORDER BY p.payment_id DESC
                LIMIT 1
            """, (transaction_id,))
            
            payment_row = cursor.fetchone()
            if payment_row:
                payment_method = payment_row['method_name']
                payment_method_type = payment_row['method_type'] if 'method_type' in payment_row.keys() else ''
                # Use amount from payments table if not already set from transactions table
                if amount_paid is None:
                    amount_paid = payment_row['amount'] if 'amount' in payment_row.keys() else None
                # Calculate change if not already set and it's a cash payment
                if change == 0 and amount_paid and (payment_method_type == 'cash' or (payment_method and 'cash' in payment_method.lower())):
                    change = float(amount_paid) - float(transaction['total'])
        except Exception as e:
            # If payments table doesn't exist or query fails, use default
            print(f"Note: Could not lookup payment method: {e}")
            pass
        
        # Change already calculated above, but recalculate if needed
        if change == 0 and amount_paid and (payment_method_type == 'cash' or (payment_method and 'cash' in payment_method.lower())):
            change = float(amount_paid) - float(transaction['total'])
        
        # Convert transaction data to order-like format for receipt generation
        order_data = {
            'order_id': transaction['transaction_id'],
            'order_number': order_number,  # Use order number if found, otherwise transaction number
            'order_date': transaction['created_at'],
            'employee_name': transaction.get('employee_name', ''),
            'customer_name': transaction.get('customer_name', ''),
            'subtotal': transaction['subtotal'],
            'tax_amount': transaction['tax'],
            'tax_rate': transaction['tax'] / transaction['subtotal'] if transaction['subtotal'] > 0 else 0,
            'discount': transaction.get('discount', 0),
            'tip': transaction.get('tip', 0),
            'total': transaction['total'],
            'payment_method': payment_method,
            'payment_method_type': payment_method_type,
            'amount_paid': amount_paid,
            'change': change if change > 0 else 0,
            'signature': signature,
            'transaction_fee': 0  # Transactions don't have transaction fees in this system
        }
        
        # Convert transaction items to order items format
        order_items = []
        for item in transaction_items:
            order_items.append({
                'product_name': item.get('product_name', 'Unknown Product'),
                'quantity': item['quantity'],
                'unit_price': item['unit_price'],
                'subtotal': item['subtotal'],
                'discount': item.get('discount', 0)
            })
        
        conn.close()
        
        # Generate PDF using existing function
        return generate_receipt_pdf(order_data, order_items)
        
    except Exception as e:
        print(f"Error generating transaction receipt: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.close()
        return None
