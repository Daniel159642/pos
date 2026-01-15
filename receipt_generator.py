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
    print("Warning: qrcode not installed. Barcode generation will be limited.")

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
            'store_name': 'Store',
            'store_address': '',
            'store_city': '',
            'store_state': '',
            'store_zip': '',
            'store_phone': '',
            'store_email': '',
            'store_website': '',
            'footer_message': 'Thank you for your business!',
            'show_tax_breakdown': 1,
            'show_payment_method': 1
        }

def generate_barcode_data(order_number: str) -> bytes:
    """Generate barcode image data for order number"""
    if not QRCODE_AVAILABLE:
        # Fallback: return empty bytes
        return b''
    
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
        
        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()
    except Exception as e:
        print(f"Error generating barcode: {e}")
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
    if order_number and QRCODE_AVAILABLE:
        try:
            barcode_data = generate_barcode_data(order_number)
        except Exception as e:
            print(f"Error generating barcode: {e}")
    
    doc = SimpleDocTemplate(buffer, pagesize=letter, 
                           rightMargin=0.5*inch, leftMargin=0.5*inch,
                           topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    # Get receipt settings
    settings = get_receipt_settings()
    
    # Build story (content)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceAfter=12
    )
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.black,
        alignment=TA_LEFT
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
    
    story.append(Spacer(1, 0.2*inch))
    
    # Order information
    order_date = datetime.fromisoformat(order_data['order_date'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')
    story.append(Paragraph(f"<b>Order Number:</b> {order_data['order_number']}", normal_style))
    story.append(Paragraph(f"<b>Date:</b> {order_date}", normal_style))
    story.append(Spacer(1, 0.1*inch))
    
    # Items table
    table_data = [['Item', 'Qty', 'Price', 'Total']]
    
    for item in order_items:
        product_name = item.get('product_name', 'Unknown')
        quantity = item.get('quantity', 0)
        unit_price = item.get('unit_price', 0.0)
        item_total = quantity * unit_price
        
        # Truncate long product names
        if len(product_name) > 30:
            product_name = product_name[:27] + '...'
        
        table_data.append([
            product_name,
            str(quantity),
            f"${unit_price:.2f}",
            f"${item_total:.2f}"
        ])
    
    # Create table
    item_table = Table(table_data, colWidths=[3*inch, 0.8*inch, 1*inch, 1*inch])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ]))
    
    story.append(item_table)
    story.append(Spacer(1, 0.2*inch))
    
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
    
    totals_table = Table(totals_data, colWidths=[4*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (1, -1), 12),
        ('TOPPADDING', (0, -1), (1, -1), 6),
    ]))
    
    story.append(totals_table)
    story.append(Spacer(1, 0.2*inch))
    
    # Payment method
    if settings.get('show_payment_method', 1):
        payment_method = order_data.get('payment_method', 'Unknown')
        payment_method_display = payment_method.replace('_', ' ').title()
        story.append(Paragraph(f"<b>Payment Method:</b> {payment_method_display}", normal_style))
        story.append(Spacer(1, 0.1*inch))
    
    # Barcode
    if barcode_data:
        try:
            from reportlab.platypus import Image
            from reportlab.lib.utils import ImageReader
            barcode_img = ImageReader(io.BytesIO(barcode_data))
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("<b>Order Barcode:</b>", normal_style))
            story.append(Spacer(1, 0.05*inch))
            # Add barcode image
            img = Image(barcode_img, width=1.5*inch, height=1.5*inch)
            story.append(img)
            story.append(Spacer(1, 0.1*inch))
        except Exception as e:
            print(f"Error adding barcode to receipt: {e}")
    
    # Footer
    story.append(Spacer(1, 0.2*inch))
    footer_text = settings.get('footer_message', 'Thank you for your business!')
    footer_style = ParagraphStyle(
        'CustomFooter',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.grey,
        alignment=TA_CENTER,
        spaceBefore=12
    )
    story.append(Paragraph(footer_text, footer_style))
    
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
                   c.customer_name
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
