#!/usr/bin/env python3
"""
Receipt generation module with PDF and barcode support
"""

import re
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

def get_receipt_settings() -> Dict[str, Any]:
    """Get receipt settings from database (PostgreSQL)"""
    from database import get_connection
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM receipt_settings ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            return dict(row)
    finally:
        conn.close()
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
            'show_signature': 1  # Default to enabled
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
        if isinstance(order_date_str, str):
            # Parse PostgreSQL datetime format (YYYY-MM-DD HH:MM:SS) as local time
            # Use regex to extract just the date and time parts, ignoring timezone info
            # Pattern to match YYYY-MM-DD HH:MM:SS format (with optional microseconds/timezone)
            # This will match: "2026-01-16 23:19:00" or "2026-01-16T23:19:00" or "2026-01-16 23:19:00.123" or "2026-01-16 23:19:00+05:00"
            match = re.match(r'(\d{4}-\d{2}-\d{2})[T\s]+(\d{2}:\d{2}:\d{2})', order_date_str)
            if match:
                date_part = match.group(1)  # YYYY-MM-DD
                time_part = match.group(2)  # HH:MM:SS
                
                # Parse components
                year, month, day = map(int, date_part.split('-'))
                hour, minute, second = map(int, time_part.split(':'))
                
                # Create datetime explicitly with local time components (naive datetime = local time)
                # This avoids any timezone conversion - we treat the stored date/time as-is
                order_date = datetime(year, month, day, hour, minute, second)
                formatted_date = order_date.strftime('%m/%d/%Y %I:%M %p')
            else:
                # Fallback to manual parsing
                # Clean the string: remove T, microseconds, Z, timezone offset
                clean_str = order_date_str.replace('T', ' ').split('.')[0].replace('Z', '')
                # Remove timezone offset if present
                if '+' in clean_str:
                    clean_str = clean_str.split('+')[0].strip()
                # Handle negative timezone offset (e.g., "-05:00")
                if ' ' in clean_str:
                    parts = clean_str.split(' ')
                    if len(parts) >= 2:
                        date_part = parts[0]
                        time_part = parts[1]
                        # Check if time part has timezone offset (e.g., "23:19:00-05:00")
                        if '-' in time_part:
                            # Split by dash and check if last part looks like timezone (has colon and 2 parts)
                            time_parts = time_part.rsplit('-', 1)
                            if len(time_parts) == 2:
                                last_part = time_parts[1]
                                if ':' in last_part and len(last_part.split(':')) == 2:
                                    # It's a timezone offset, remove it
                                    time_part = time_parts[0]
                        clean_str = date_part + ' ' + time_part
                
                try:
                    order_date = datetime.strptime(clean_str, '%Y-%m-%d %H:%M:%S')
                    formatted_date = order_date.strftime('%m/%d/%Y %I:%M %p')
                except:
                    formatted_date = str(order_date_str)
        else:
            formatted_date = str(order_date_str) if order_date_str else ''
    except Exception as e:
        print(f"Error parsing order_date '{order_data.get('order_date')}': {e}")
        import traceback
        traceback.print_exc()
        formatted_date = str(order_data.get('order_date', ''))
    
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
            # Get customer phone and address from database if available (PostgreSQL)
            try:
                from database import get_connection
                from psycopg2.extras import RealDictCursor
                customer_id = order_data.get('customer_id')
                if customer_id:
                    conn = get_connection()
                    cursor = conn.cursor(cursor_factory=RealDictCursor)
                    try:
                        cursor.execute("SELECT phone, address FROM customers WHERE customer_id = %s", (customer_id,))
                        customer_row = cursor.fetchone()
                        if customer_row:
                            customer_phone = customer_row.get('phone')
                            customer_address = customer_row.get('address')
                            if customer_phone:
                                story.append(Paragraph(f"Phone: {customer_phone}", small_style))
                            if customer_address and order_type == 'delivery':
                                story.append(Paragraph(f"Delivery Address: {customer_address}", small_style))
                    finally:
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
    
    # Signature - always show if available (regardless of setting)
    signature = order_data.get('signature')
    show_signature_setting = settings.get('show_signature', 1)  # Default to enabled
    print(f"Signature check - setting: {show_signature_setting}, signature exists: {signature is not None}, signature length: {len(signature) if signature else 0}")
    
    # Always show signature if it exists
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
        print(f"No signature data found in order_data")
    
    # Footer - Custom Footer Message
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("-" * 40, header_style))
    story.append(Spacer(1, 0.05*inch))
    
    # Get footer message - ensure it always has content
    footer_text = settings.get('footer_message', '').strip()
    if not footer_text:
        footer_text = 'Thank you for your business!'
    
    footer_style = ParagraphStyle(
        'CustomFooter',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceBefore=6,
        spaceAfter=4,
        fontName='Helvetica'
    )
    story.append(Paragraph(footer_text, footer_style))
    
    # Return Policy - Display if set
    return_policy = settings.get('return_policy', '').strip()
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
            spaceAfter=4,
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
    from database import get_connection
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT o.*,
                   e.first_name || ' ' || e.last_name as employee_name,
                   c.customer_name,
                   c.customer_id
            FROM orders o
            LEFT JOIN employees e ON o.employee_id = e.employee_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            WHERE o.order_id = %s
        """, (order_id,))
        order_row = cursor.fetchone()
        if not order_row:
            return None
        order_data = dict(order_row)
        cursor.execute("""
            SELECT oi.*, i.product_name
            FROM order_items oi
            LEFT JOIN inventory i ON oi.product_id = i.product_id
            WHERE oi.order_id = %s
            ORDER BY oi.order_item_id
        """, (order_id,))
        order_items = [dict(r) for r in cursor.fetchall()]
        amount_paid = None
        payment_method = order_data.get('payment_method', 'Unknown')
        payment_method_type = ''
        change = 0
        signature = None
        try:
            cursor.execute("SELECT signature FROM transactions WHERE order_id = %s LIMIT 1", (order_id,))
            sig_row = cursor.fetchone()
            if sig_row and sig_row.get('signature'):
                signature = sig_row['signature']
        except Exception:
            pass
        try:
            cursor.execute("""
                SELECT pm.method_name, pm.method_type, p.amount
                FROM payments p
                JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                WHERE p.transaction_id IN (SELECT transaction_id FROM transactions WHERE order_id = %s)
                ORDER BY p.payment_id DESC LIMIT 1
            """, (order_id,))
            payment_row = cursor.fetchone()
            if payment_row:
                payment_method = payment_row.get('method_name', payment_method)
                payment_method_type = payment_row.get('method_type') or ''
                amount_paid = payment_row.get('amount')
        except Exception:
            pass
        if amount_paid and (payment_method_type == 'cash' or (payment_method and 'cash' in (payment_method or '').lower())):
            change = float(amount_paid) - float(order_data.get('total', 0))
        order_data['payment_method'] = payment_method
        order_data['payment_method_type'] = payment_method_type
        order_data['amount_paid'] = amount_paid
        order_data['change'] = change if change > 0 else 0
        order_data['signature'] = signature
        return generate_receipt_pdf(order_data, order_items)
    except Exception as e:
        print(f"Error generating receipt: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        conn.close()

def generate_transaction_receipt(transaction_id: int) -> Optional[bytes]:
    """
    Generate receipt PDF for a transaction
    
    Args:
        transaction_id: Transaction ID
    
    Returns:
        PDF bytes or None if error
    """
    from database import get_connection
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT t.*,
                   e.first_name || ' ' || e.last_name as employee_name,
                   c.customer_name,
                   o.order_number,
                   o.order_id,
                   t.signature
            FROM transactions t
            LEFT JOIN employees e ON t.employee_id = e.employee_id
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            LEFT JOIN orders o ON t.order_id = o.order_id
            WHERE t.transaction_id = %s
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
            WHERE ti.transaction_id = %s
            ORDER BY ti.transaction_item_id
        """, (transaction_id,))
        transaction_items = [dict(r) for r in cursor.fetchall()]
        
        # Get payment method and order number from linked order
        payment_method = 'Cash'  # Default
        order_number = transaction.get('order_number')  # Get from joined query
        order_id = transaction.get('order_id')  # Get order_id from transaction
        
        # Ensure we have order_number - it should come from the JOIN, but verify
        if not order_number:
            if order_id:
                # Fallback: if no order_number from join, try direct query
                try:
                    cursor.execute("""
                        SELECT order_number FROM orders WHERE order_id = %s
                    """, (order_id,))
                    order_row = cursor.fetchone()
                    if order_row:
                        order_number = order_row.get('order_number') if isinstance(order_row, dict) else order_row[0]
                        print(f"Retrieved order_number {order_number} from direct query for order_id {order_id}")
                except Exception as e:
                    print(f"Error querying order_number: {e}")
            else:
                print(f"Warning: No order_id found for transaction {transaction_id}")
        
        # Final fallback - should not happen if order is created properly
        if not order_number:
            print(f"Warning: No order_number found for transaction {transaction_id}, using fallback")
            order_number = f"ORD-{transaction_id}"
        
        # Log the order number being used for receipt
        print(f"Using order_number '{order_number}' for receipt generation (transaction_id: {transaction_id}, order_id: {order_id})")
        
        # Try to get payment method from payments table
        try:
            if transaction.get('order_id'):
                cursor.execute("""
                    SELECT pm.method_name, pm.method_type
                    FROM payments p
                    JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                    WHERE p.transaction_id = %s
                    LIMIT 1
                """, (transaction_id,))
                payment_row = cursor.fetchone()
                if payment_row:
                    payment_method = payment_row.get('method_name') if isinstance(payment_row, dict) else payment_row[0]
                    if payment_method:
                        payment_method = payment_method
        except Exception as e:
            # If payment lookup fails, continue with defaults
            pass
        
        # Get payment method and amount paid
        amount_paid = None
        payment_method_type = None
        change = 0
        signature = transaction.get('signature')  # Get signature from transaction (should be in SELECT)
        
        # Log signature retrieval for debugging
        if signature:
            print(f"Signature found in transaction query: {len(signature)} characters")
        else:
            print(f"No signature found in transaction query for transaction_id {transaction_id}")
        
        # First try to get amount_paid from transactions table (if columns exist)
        try:
            cursor.execute("""
                SELECT amount_paid, change_amount, signature FROM transactions WHERE transaction_id = %s
            """, (transaction_id,))
            txn_row = cursor.fetchone()
            if txn_row:
                if txn_row.get('amount_paid') is not None:
                    amount_paid = txn_row['amount_paid']
                if txn_row.get('change_amount') is not None:
                    change = txn_row['change_amount']
                # Override signature if found in this query (should already be in transaction dict, but double-check)
                if txn_row.get('signature') and not signature:
                    signature = txn_row['signature']
                    print(f"Signature retrieved from separate query: {len(signature)} characters")
        except Exception:
            pass
        except Exception as e:
            print(f"Note: Could not get amount_paid from transactions: {e}")
        
        # Get payment method info from payments table
        try:
            cursor.execute("""
                SELECT pm.method_name, pm.method_type, p.amount
                FROM payments p
                JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                WHERE p.transaction_id = %s
                ORDER BY p.payment_id DESC LIMIT 1
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
            'order_id': transaction.get('order_id') or transaction['transaction_id'],  # Use order_id if available, fallback to transaction_id
            'order_number': order_number,  # Always use order number (from linked order)
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
        
        return generate_receipt_pdf(order_data, order_items)
    except Exception as e:
        print(f"Error generating transaction receipt: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        conn.close()

def generate_return_receipt(return_id: int) -> Optional[bytes]:
    """Generate return receipt PDF"""
    from database import get_connection
    from psycopg2.extras import RealDictCursor
    
    if not REPORTLAB_AVAILABLE:
        print("ReportLab not available. Cannot generate return receipt.")
        return None
    
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get return details
        cursor.execute("""
            SELECT pr.*, o.order_number, o.order_date, o.payment_method,
                   e.first_name || ' ' || e.last_name as employee_name
            FROM pending_returns pr
            JOIN orders o ON pr.order_id = o.order_id
            JOIN employees e ON pr.employee_id = e.employee_id
            WHERE pr.return_id = %s
        """, (return_id,))
        
        return_data = cursor.fetchone()
        if not return_data:
            return None
        
        return_data = dict(return_data)
        
        # Get return items
        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            WHERE pri.return_id = %s
        """, (return_id,))
        
        return_items = [dict(row) for row in cursor.fetchall()]
        
        # Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                                rightMargin=0.5*inch, leftMargin=0.5*inch,
                                topMargin=0.5*inch, bottomMargin=0.5*inch)
        
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#d32f2f'),
            spaceAfter=12,
            alignment=TA_CENTER
        )
        story.append(Paragraph("RETURN RECEIPT", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Return details
        story.append(Paragraph(f"<b>Return Number:</b> {return_data['return_number']}", styles['Normal']))
        story.append(Paragraph(f"<b>Original Order:</b> {return_data['order_number']}", styles['Normal']))
        story.append(Paragraph(f"<b>Date:</b> {return_data['return_date'].strftime('%Y-%m-%d %H:%M:%S') if return_data.get('return_date') else 'N/A'}", styles['Normal']))
        story.append(Paragraph(f"<b>Processed by:</b> {return_data.get('employee_name', 'N/A')}", styles['Normal']))
        if return_data.get('reason'):
            story.append(Paragraph(f"<b>Reason:</b> {return_data['reason']}", styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Items table
        items_data = [['Product', 'Qty', 'Price', 'Refund']]
        for item in return_items:
            items_data.append([
                item.get('product_name', item.get('sku', 'N/A')),
                str(item['quantity']),
                f"${float(item['unit_price']):.2f}",
                f"${float(item['refund_amount']):.2f}"
            ])
        
        items_table = Table(items_data, colWidths=[3*inch, 0.8*inch, 1*inch, 1*inch])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(items_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Total
        total_style = ParagraphStyle(
            'TotalStyle',
            parent=styles['Normal'],
            fontSize=14,
            fontName='Helvetica-Bold',
            alignment=TA_RIGHT
        )
        story.append(Paragraph(f"<b>Total Refund: ${float(return_data['total_refund_amount']):.2f}</b>", total_style))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.read()
        
    except Exception as e:
        print(f"Error generating return receipt: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        conn.close()

def generate_exchange_receipt(exchange_credit_id: int, exchange_credit_number: str, credit_amount: float) -> Optional[bytes]:
    """Generate exchange receipt (store credit) PDF with barcode"""
    if not REPORTLAB_AVAILABLE:
        print("ReportLab not available. Cannot generate exchange receipt.")
        return None
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, 
                            rightMargin=0.5*inch, leftMargin=0.5*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#1976d2'),
        spaceAfter=12,
        alignment=TA_CENTER
    )
    story.append(Paragraph("EXCHANGE CREDIT", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    # Credit details
    story.append(Paragraph(f"<b>Credit Number:</b> {exchange_credit_number}", styles['Normal']))
    story.append(Paragraph(f"<b>Credit Amount:</b> ${credit_amount:.2f}", styles['Normal']))
    story.append(Paragraph(f"<b>Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
    story.append(Spacer(1, 0.2*inch))
    
    # Barcode
    if BARCODE_AVAILABLE and exchange_credit_number:
        try:
            from barcode import Code128
            from barcode.writer import ImageWriter
            from reportlab.platypus import Image
            
            barcode_obj = Code128(exchange_credit_number, writer=ImageWriter())
            barcode_buffer = io.BytesIO()
            barcode_obj.write(barcode_buffer)
            barcode_buffer.seek(0)
            
            # Create image from barcode
            img = Image(barcode_buffer, width=3*inch, height=0.8*inch)
            story.append(Spacer(1, 0.2*inch))
            story.append(img)
            story.append(Paragraph(f"<b>Scan at checkout to use credit</b>", styles['Normal']))
        except Exception as e:
            print(f"Error generating barcode: {e}")
            story.append(Paragraph(f"<b>Credit Number:</b> {exchange_credit_number} (scan this number at checkout)", styles['Normal']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("<i>This credit can be used for future purchases. Present this receipt at checkout.</i>", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.read()
