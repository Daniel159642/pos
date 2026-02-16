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
    """Get receipt settings from database (PostgreSQL). Merges in store_location_settings
    for store name/address/contact so printed receipts always use the latest store info."""
    from database import get_connection, get_store_location_settings
    from psycopg2.extras import RealDictCursor
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM receipt_settings ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            settings = dict(row)
        else:
            settings = {
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
                'show_signature': 1,
                'show_tip': 1
            }
    finally:
        conn.close()
    # Overlay store_location_settings so printed receipts always use current store info
    try:
        loc = get_store_location_settings()
        if loc:
            if loc.get('store_name'):
                settings['store_name'] = loc['store_name']
            if loc.get('address') is not None:
                settings['store_address'] = loc['address'] or ''
            if loc.get('city') is not None:
                settings['store_city'] = loc['city'] or ''
            if loc.get('state') is not None:
                settings['store_state'] = loc['state'] or ''
            if loc.get('zip') is not None:
                settings['store_zip'] = loc['zip'] or ''
            if loc.get('store_phone') is not None:
                settings['store_phone'] = loc['store_phone'] or ''
            if loc.get('store_email') is not None:
                settings['store_email'] = loc['store_email'] or ''
            if loc.get('store_website') is not None:
                settings['store_website'] = loc['store_website'] or ''
    except Exception:
        pass
    # Ensure template_styles is a dict (from JSONB)
    ts = settings.get('template_styles')
    if ts is not None and not isinstance(ts, dict):
        settings['template_styles'] = {}
    return settings


def _to_reportlab_font(font_name: str, bold: bool = False, italic: bool = False) -> str:
    """Map frontend font names to ReportLab font names."""
    fn = (font_name or '').lower().strip()
    if not fn or fn in ('monospace', 'courier', 'courier new', 'courier new, monospace', 'consolas'):
        base = 'Courier'
    elif fn in ('helvetica', 'sans-serif', 'sans serif', 'arial'):
        base = 'Helvetica'
    elif fn in ('times', 'times new roman', 'serif', 'times-roman'):
        base = 'Times-Roman'
    else:
        base = 'Helvetica'
    if bold and italic:
        return f'{base}-BoldOblique' if base != 'Times-Roman' else 'Times-BoldItalic'
    if bold:
        return f'{base}-Bold'
    if italic:
        return f'{base}-Oblique' if base != 'Times-Roman' else 'Times-Italic'
    return base


def _to_reportlab_align(align: str):
    """Map frontend alignment to ReportLab constant."""
    a = (align or 'left').lower().strip()
    if a == 'center':
        return TA_CENTER
    if a == 'right':
        return TA_RIGHT
    return TA_LEFT


def _build_style(ts: dict, prefix: str, default_font_size: float, parent_style, default_bold: bool = False, align_fallback: str = None) -> ParagraphStyle:
    """Build a ParagraphStyle from template_styles using prefix (e.g. store_name, item_name)."""
    bold_default = default_bold if prefix == 'store_name' else ts.get('bold_item_names', False)
    font = _to_reportlab_font(
        ts.get(f'{prefix}_font') or ts.get('font_family'),
        bold=bool(ts.get(f'{prefix}_bold', bold_default)),
        italic=bool(ts.get(f'{prefix}_italic', False))
    )
    size = float(ts.get(f'{prefix}_font_size') or ts.get('font_size') or default_font_size)
    line_spacing = float(ts.get('line_spacing') or 1.2)
    leading = size * line_spacing
    align = _to_reportlab_align(
        ts.get(f'{prefix}_align') or (align_fallback or ts.get('header_alignment', 'center'))
    )
    return ParagraphStyle(
        f'Custom{prefix}',
        parent=parent_style,
        fontSize=size,
        leading=leading,
        textColor=colors.black,
        alignment=align,
        spaceAfter=4,
        fontName=font
    )


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

def generate_receipt_pdf(order_data: Dict[str, Any], order_items: list, settings_override: dict = None, original_order_items: list = None) -> bytes:
    """
    Generate receipt PDF with barcode
    
    Args:
        order_data: Order information (order_id, order_number, order_date, etc.)
        order_items: List of order items with product details (or returned items for return receipts)
        settings_override: Optional dict to override receipt_settings (e.g. for test receipt from Settings)
        original_order_items: For partial return receipts only: full order line items (what was bought) to show above returned items
    
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
    
    # Get receipt settings (includes template_styles from Settings receipt editor)
    settings = get_receipt_settings()
    store_keys = ('store_name', 'store_address', 'store_phone', 'store_city', 'store_state', 'store_zip', 'store_email', 'store_website', 'footer_message', 'return_policy', 'show_signature', 'store_logo')
    if settings_override:
        for k in store_keys:
            if k in settings_override and settings_override[k] is not None:
                settings[k] = settings_override[k]
        base_ts = settings.get('template_styles') or {}
        override_ts = settings_override.get('template_styles')
        if isinstance(override_ts, dict):
            ts = {**base_ts, **override_ts}
        else:
            ts = {**base_ts, **{k: v for k, v in settings_override.items() if k not in store_keys and k != 'template_styles' and v is not None}}
        settings['template_styles'] = ts
    else:
        ts = settings.get('template_styles') or {}
    
    # Receipt width from template: 58mm or 80mm (matches Settings preview)
    width_mm = 58 if (ts.get('receipt_width') == 58 or ts.get('receipt_width') == '58') else 80
    receipt_width = (width_mm / 25.4) * inch  # mm to inches
    receipt_height = 11 * inch  # Standard letter height, will cut at content
    
    doc = SimpleDocTemplate(buffer, 
                           pagesize=(receipt_width, receipt_height),
                           rightMargin=0.15*inch, 
                           leftMargin=0.15*inch,
                           topMargin=0.2*inch, 
                           bottomMargin=0.2*inch)
    
    # Build story (content)
    story = []
    styles = getSampleStyleSheet()
    
    # Styles driven by template_styles - order data plugged in with template styling
    divider_style = ts.get('divider_style', 'dashed')  # solid, dashed, none
    show_item_descriptions = bool(ts.get('show_item_descriptions', False))
    show_item_skus = bool(ts.get('show_item_skus', True))
    tax_line_display = ts.get('tax_line_display', 'breakdown')  # breakdown, single_line, none
    fs = float(ts.get('font_size', 12))
    
    title_style = _build_style(ts, 'store_name', 14, styles['Heading1'], default_bold=True)
    title_style.alignment = _to_reportlab_align(ts.get('store_name_align') or ts.get('header_alignment', 'center'))
    title_style.spaceAfter = 8
    
    store_address_style = _build_style(ts, 'store_address', int(fs) or 9, styles['Normal'])
    store_address_style.alignment = _to_reportlab_align(ts.get('store_address_align') or ts.get('header_alignment', 'center'))
    
    store_phone_style = _build_style(ts, 'store_phone', int(fs) or 9, styles['Normal'])
    store_phone_style.alignment = _to_reportlab_align(ts.get('store_phone_align') or ts.get('header_alignment', 'center'))
    
    header_style = store_address_style  # used for dividers
    
    item_name_style = _build_style(ts, 'item_name', int(fs) or 8, styles['Normal'], align_fallback='left')
    item_name_style.alignment = _to_reportlab_align(ts.get('item_name_align', 'left'))
    item_desc_style = _build_style(ts, 'item_desc', int(fs) - 2 if fs else 8, styles['Normal'], align_fallback='left')
    item_desc_style.alignment = _to_reportlab_align(ts.get('item_desc_align', 'left'))
    item_sku_style = _build_style(ts, 'item_sku', int(fs) - 2 if fs else 7, styles['Normal'], align_fallback='left')
    item_sku_style.alignment = _to_reportlab_align(ts.get('item_sku_align', 'left'))
    item_price_style = _build_style(ts, 'item_price', int(fs) or 8, styles['Normal'], align_fallback='right')
    item_price_style.alignment = _to_reportlab_align(ts.get('item_price_align', 'right'))
    
    # Shorter divider lengths to avoid wrapping; 58mm subtract 7 chars, 80mm subtract 6
    _base = int((width_mm / 80) * 35)
    _sub = 7 if width_mm == 58 else 6
    _div_chars = max(18, min(36, _base - _sub))
    # Solid (underscore) line is 3 chars shorter on 80mm so it doesn't wrap
    _div_chars_solid = max(18, _div_chars - (3 if width_mm == 80 else 0))
    def _divider(hstyle):
        if divider_style == 'none':
            return Spacer(1, 0.05*inch)
        if divider_style == 'solid':
            return Paragraph('_' * _div_chars_solid, hstyle)
        return Paragraph('- ' * (_div_chars // 2), hstyle)  # dashed
    
    subtotal_style = _build_style(ts, 'subtotal', int(fs) or 8, styles['Normal'], align_fallback='right')
    subtotal_style.alignment = _to_reportlab_align(ts.get('subtotal_align', 'right'))
    
    tax_style = _build_style(ts, 'tax', int(fs) or 8, styles['Normal'], align_fallback='right')
    tax_style.alignment = _to_reportlab_align(ts.get('tax_align', 'right'))
    
    tip_style = _build_style(ts, 'tip', int(fs) or 8, styles['Normal'], align_fallback='right')
    tip_style.alignment = _to_reportlab_align(ts.get('tip_align', ts.get('subtotal_align', 'right')))
    
    total_style = _build_style(ts, 'total', int(fs) + 2 if fs else 10, styles['Normal'], align_fallback='right')
    total_style.alignment = _to_reportlab_align(ts.get('total_align', 'right'))
    
    payment_style = _build_style(ts, 'payment_method', int(fs) - 1 if fs else 9, styles['Normal'], align_fallback='center')
    payment_style.alignment = _to_reportlab_align(ts.get('payment_method_align', 'center'))
    
    date_style = _build_style(ts, 'date_line', 7, styles['Normal'])
    date_style.alignment = _to_reportlab_align(ts.get('date_line_align', 'center'))
    barcode_number_style = _build_style(ts, 'barcode_number', 7, styles['Normal'])
    barcode_number_style.alignment = _to_reportlab_align(ts.get('barcode_number_align', 'center'))
    
    footer_style = _build_style(ts, 'footer_message', 8, styles['Normal'])
    footer_style.alignment = _to_reportlab_align(ts.get('footer_message_align', 'center'))
    footer_style.spaceBefore = 6
    
    return_policy_style = _build_style(ts, 'return_policy', 7, styles['Normal'])
    return_policy_style.alignment = _to_reportlab_align(ts.get('return_policy_align', 'center'))
    store_website_style = _build_style(ts, 'store_website', 7, styles['Normal'])
    store_website_style.alignment = _to_reportlab_align(ts.get('store_website_align', 'center'))
    store_email_style = _build_style(ts, 'store_email', 7, styles['Normal'])
    store_email_style.alignment = _to_reportlab_align(ts.get('store_email_align', 'center'))
    
    signature_label_style = _build_style(ts, 'signature_title', 8, styles['Normal'])
    
    customer_order_style = _build_style(ts, 'customer_order', 8, styles['Normal'], align_fallback='left')
    order_type_style = _build_style(ts, 'order_type', int(fs) or 8, styles['Normal'], align_fallback='left')
    customer_name_style = _build_style(ts, 'customer_name', int(fs) or 8, styles['Normal'], align_fallback='left')
    customer_phone_style = _build_style(ts, 'customer_phone', int(fs) or 8, styles['Normal'], align_fallback='left')
    customer_address_style = _build_style(ts, 'customer_address', int(fs) or 8, styles['Normal'], align_fallback='left')
    
    # Return receipt section heading and "RETURNED" label (same template styling as other headings)
    return_section_title_style = ParagraphStyle(
        'ReturnSectionTitle',
        parent=styles['Normal'],
        fontSize=int(fs) or 10,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
        spaceAfter=6,
        spaceBefore=4
    )
    return_label_style = ParagraphStyle(
        'ReturnLabel',
        parent=styles['Normal'],
        fontSize=int(fs) + 2 if fs else 12,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
        spaceAfter=8,
        spaceBefore=6
    )
    
    # Store header - matches edit modal: logo, store name, address (multi-line), phone, header alignment
    store_logo = ts.get('store_logo') or settings.get('store_logo', '')
    if store_logo and isinstance(store_logo, str) and store_logo.startswith('data:image'):
        try:
            from reportlab.platypus import Image
            import base64
            _b64 = store_logo.split(',', 1)[1] if ',' in store_logo else ''
            if _b64:
                logo_bytes = base64.b64decode(_b64)
                logo_io = io.BytesIO(logo_bytes)
                logo_img = Image(logo_io, width=min(2*inch, receipt_width - 0.3*inch), height=0.5*inch)
                logo_table = Table([[logo_img]], colWidths=[receipt_width - 0.3*inch])
                logo_table.setStyle(TableStyle([('ALIGN', (0, 0), (0, 0), 'CENTER')]))
                story.append(logo_table)
                story.append(Spacer(1, 0.05*inch))
        except Exception as e:
            print(f"Note: Could not embed store logo: {e}")
    
    story.append(Paragraph(settings.get('store_name', 'Store'), title_style))
    
    # Store address - multiple lines (textarea), each line with store_address styling
    store_address = settings.get('store_address', '') or ''
    if store_address:
        for line in store_address.strip().split('\n'):
            if line.strip():
                story.append(Paragraph(line.strip(), store_address_style))
    
    # City, State, ZIP - one line with store_address styling
    city_state_zip = ', '.join(filter(None, [
        settings.get('store_city', ''),
        settings.get('store_state', ''),
        settings.get('store_zip', '')
    ]))
    if city_state_zip.strip():
        story.append(Paragraph(city_state_zip.strip(), store_address_style))
    
    # Phone - with store_phone styling (no "Phone:" prefix, matches preview)
    store_phone = settings.get('store_phone', '') or ''
    if store_phone:
        story.append(Paragraph(store_phone, store_phone_style))
    
    story.append(Spacer(1, 0.1*inch))
    
    # Divider (from template: solid, dashed, none)
    story.append(_divider(header_style))
    
    # Customer & Order Type section (for pickup/delivery) - between header and line items
    order_type = (order_data.get('order_type') or '').strip().lower()
    if order_type in ('pickup', 'delivery'):
        customer_name = order_data.get('customer_name') or order_data.get('profile_customer_name')
        customer_phone = order_data.get('customer_phone')
        customer_address = order_data.get('customer_address') if order_type == 'delivery' else None
        if (not customer_name or customer_phone is None or (order_type == 'delivery' and customer_address is None)) and order_data.get('customer_id'):
            try:
                from database import get_connection
                from psycopg2.extras import RealDictCursor
                conn = get_connection()
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                try:
                    cursor.execute("SELECT customer_name, phone FROM customers WHERE customer_id = %s", (order_data.get('customer_id'),))
                    customer_row = cursor.fetchone()
                    if customer_row:
                        if not customer_name:
                            customer_name = customer_row.get('customer_name')
                        if customer_phone is None:
                            customer_phone = customer_row.get('phone')
                    if order_type == 'delivery' and customer_address is None:
                        cursor.execute("""
                            SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'address'
                        """)
                        if cursor.fetchone():
                            cursor.execute("SELECT address FROM customers WHERE customer_id = %s", (order_data.get('customer_id'),))
                            arow = cursor.fetchone()
                            if arow:
                                customer_address = arow.get('address') if isinstance(arow, dict) else (arow[0] if arow else None)
                finally:
                    conn.close()
            except Exception as e:
                print(f"Note: Could not get customer details: {e}")
        story.append(Paragraph(f"Order Type: {order_type.title()}", order_type_style))
        if customer_name:
            story.append(Paragraph(f"Customer: {customer_name}", customer_name_style))
        if customer_phone:
            story.append(Paragraph(f"Phone: {customer_phone}", customer_phone_style))
        if order_type == 'delivery':
            if customer_address:
                story.append(Paragraph(f"Address: {customer_address}", customer_address_style))
            else:
                story.append(Paragraph("Address: —", customer_address_style))
        story.append(_divider(header_style))
    
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
                _dm = ts.get('date_display_mode', 'both')
                if _dm == 'date_only':
                    formatted_date = order_date.strftime('%m/%d/%Y')
                elif _dm == 'time_only':
                    formatted_date = order_date.strftime('%I:%M %p')
                else:
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
                    _dm = ts.get('date_display_mode', 'both')
                    if _dm == 'date_only':
                        formatted_date = order_date.strftime('%m/%d/%Y')
                    elif _dm == 'time_only':
                        formatted_date = order_date.strftime('%I:%M %p')
                    else:
                        formatted_date = order_date.strftime('%m/%d/%Y %I:%M %p')
                except:
                    formatted_date = str(order_date_str).split('.')[0] if order_date_str else ''
        else:
            raw = str(order_date_str) if order_date_str else ''
            formatted_date = raw.split('.')[0] if raw else ''
    except Exception as e:
        print(f"Error parsing order_date '{order_data.get('order_date')}': {e}")
        import traceback
        traceback.print_exc()
        raw = str(order_data.get('order_date', ''))
        formatted_date = raw.split('.')[0] if raw else ''
    
    # Line items - layout matches Settings preview (Order/Date are in barcode section, not here)
    # For partial return receipts: show original order (what was bought) first, then "Returned items" section
    is_return_receipt = bool(order_data.get('is_return_receipt'))
    is_store_credit_receipt = bool(order_data.get('is_store_credit_receipt'))
    is_exchange_completion = bool(order_data.get('is_exchange_completion'))
    has_original_section = (is_return_receipt or is_exchange_completion) and original_order_items and len(original_order_items) > 0

    def _append_line_item(story, item, name_style, desc_style, sku_style, price_style, show_descriptions, show_skus):
        product_name = item.get('product_name', 'Unknown')
        quantity = item.get('quantity', 0)
        unit_price = item.get('unit_price', 0.0)
        item_total = float(item.get('subtotal') or item.get('refund_amount') or 0) or (quantity * unit_price)
        desc = item.get('description') or item.get('product_description', '')
        sku = item.get('sku', '')
        if len(product_name) > 32:
            product_name = product_name[:29] + '...'
        name_line = f"{product_name}{' x' + str(quantity) if quantity > 1 else ''}"
        story.append(Paragraph(name_line, name_style))
        if show_descriptions and desc:
            story.append(Paragraph(desc[:60] + ('...' if len(desc) > 60 else ''), desc_style))
        if show_skus and sku:
            story.append(Paragraph(sku, sku_style))
        story.append(Paragraph(f"${item_total:.2f}", price_style))

    if has_original_section:
        # Exchange completion: "Returned items" then "New items". Partial return: "Items purchased" then "Returned items"
        first_section_title = "Returned items" if is_exchange_completion else "Items purchased"
        second_section_title = "New items" if is_exchange_completion else "Returned items"
        story.append(Paragraph(first_section_title, return_section_title_style))
        story.append(Spacer(1, 0.06*inch))
        for item in original_order_items:
            _append_line_item(story, item, item_name_style, item_desc_style, item_sku_style, item_price_style, show_item_descriptions, show_item_skus)
        story.append(_divider(header_style))
        story.append(Paragraph(second_section_title, return_section_title_style))
        story.append(Spacer(1, 0.06*inch))
    elif is_return_receipt:
        # Full return: no extra divider here; store header already has one below it
        story.append(Paragraph("Returned items", return_section_title_style))
        story.append(Spacer(1, 0.06*inch))

    for item in order_items:
        _append_line_item(story, item, item_name_style, item_desc_style, item_sku_style, item_price_style, show_item_descriptions, show_item_skus)

    story.append(_divider(header_style))
    
    # Totals (return receipt / store credit receipt / exchange completion / normal)
    totals_data = []
    subtotal = float(order_data.get('subtotal', 0) or 0)
    if is_store_credit_receipt:
        totals_data.append(['Store Credit Subtotal:', f"${subtotal:.2f}"])
    elif is_return_receipt and not is_exchange_completion:
        totals_data.append(['Return Subtotal:', f"${subtotal:.2f}"])
    else:
        totals_data.append(['Subtotal:', f"${subtotal:.2f}"])
    
    discount = float(order_data.get('discount', 0) or 0)
    tax_amount_val = float(order_data.get('tax_amount', 0) or 0)
    if discount > 0:
        before_discount = subtotal + tax_amount_val
        pct = (100.0 * discount / before_discount) if before_discount > 0 else 0
        label = f"Discount ({pct:.0f}%):" if pct >= 1 else f"Discount ({pct:.1f}%):"
        if is_store_credit_receipt or (is_return_receipt and not is_exchange_completion):
            label = "Discount (proportional):"
        if is_exchange_completion and discount > 0:
            label = "Discount (incl. exchange credit):"
        totals_data.append([label, f"-${discount:.2f}"])
    if tax_line_display != 'none' and settings.get('show_tax_breakdown', 1):
        tax_rate = float(order_data.get('tax_rate', 0) or 0) * 100
        if tax_line_display == 'breakdown':
            totals_data.append([f'Store Credit Tax:' if is_store_credit_receipt else (f'Return Tax:' if (is_return_receipt and not is_exchange_completion) else f'Tax ({tax_rate:.1f}%):'), f"${tax_amount_val:.2f}"])
        else:
            totals_data.append(['Store Credit Tax:' if is_store_credit_receipt else ('Return Tax:' if (is_return_receipt and not is_exchange_completion) else 'Tax:'), f"${tax_amount_val:.2f}"])
    
    transaction_fee = order_data.get('transaction_fee', 0.0)
    if transaction_fee > 0:
        totals_data.append(['Transaction fee:' if (is_return_receipt or is_store_credit_receipt) and not is_exchange_completion else 'Transaction Fee:', f"${transaction_fee:.2f}"])
    
    tip = float(order_data.get('tip', 0) or 0)
    show_tip = settings.get('show_tip', 1) not in (0, '0', False)
    if tip > 0 and show_tip:
        totals_data.append(['Tip:', f"${tip:.2f}"])
    total = float(order_data.get('total', 0) or 0)
    # Transaction receipts: total already includes tip. Order receipts: add tip if shown.
    total_includes_tip = order_data.get('total_includes_tip', False)
    if tip > 0 and show_tip and not total_includes_tip:
        total = total + tip
    if is_store_credit_receipt:
        totals_data.append(['<b>Total Store Credit:</b>', f"<b>${total:.2f}</b>"])
    elif is_return_receipt and not is_exchange_completion:
        totals_data.append(['<b>Refund Amount:</b>', f"<b>${total:.2f}</b>"])
    else:
        totals_data.append(['<b>TOTAL:</b>', f"<b>${total:.2f}</b>"])
    
    # Totals - each line uses its template style (subtotal, tax, tip, total)
    for label, value in totals_data:
        clean_label = label.replace('<b>', '').replace('</b>', '')
        clean_value = value.replace('<b>', '').replace('</b>', '')
        line = f"{clean_label:<20} {clean_value}"
        if '<b>' in label or '<b>' in value:
            story.append(Paragraph(f"<b>{line}</b>", total_style))
        elif 'Tax' in clean_label:
            story.append(Paragraph(line, tax_style))
        elif 'Tip' in clean_label:
            story.append(Paragraph(line, tip_style))
        else:
            story.append(Paragraph(line, subtotal_style))
    
    # For return receipts: "RETURNED"; store credit: "STORE CREDIT"; exchange completion: "EXCHANGE"
    if is_exchange_completion:
        story.append(Paragraph("EXCHANGE", return_label_style))
    elif is_store_credit_receipt:
        story.append(Paragraph("STORE CREDIT", return_label_style))
    elif is_return_receipt:
        story.append(Paragraph("RETURNED", return_label_style))
    
    story.append(_divider(header_style))
    
    # Payment status: all options - cash, card, store credit, check, mobile, not paid pickup, not paid delivery
    payment_status = (order_data.get('payment_status') or 'completed').lower()
    order_type_payment = (order_data.get('order_type') or '').lower()
    if payment_status == 'pending':
        if order_type_payment == 'delivery':
            not_paid_phrase = "Pay at delivery"
        elif order_type_payment == 'pickup':
            not_paid_phrase = "Pay at pickup"
        else:
            not_paid_phrase = "Pay at counter"
        story.append(Paragraph(f"<b>Not paid - {not_paid_phrase}</b>", payment_style))
        if order_type_payment == 'delivery':
            story.append(Paragraph("Pay on delivery", payment_style))
        elif order_type_payment == 'pickup':
            story.append(Paragraph("Customer will pay when they pick up", payment_style))
        else:
            story.append(Paragraph("Customer will pay at counter", payment_style))
        story.append(Spacer(1, 0.05*inch))
    elif settings.get('show_payment_method', 1):
        payment_method = (order_data.get('payment_method') or 'Unknown').strip().lower()
        payment_method_type = (order_data.get('payment_method_type') or '').lower()
        is_cash = payment_method_type == 'cash' or 'cash' in payment_method
        if is_cash:
            payment_display = "Paid with Cash"
        elif 'card' in payment_method or payment_method in ('credit_card', 'debit_card', 'credit', 'debit'):
            payment_display = "Paid by Card"
        elif 'store_credit' in payment_method or 'store credit' in payment_method:
            payment_display = "Paid with Store Credit"
        elif 'check' in payment_method:
            payment_display = "Paid by Check"
        elif 'mobile' in payment_method or 'apple' in payment_method or 'google' in payment_method:
            payment_display = "Paid by Mobile"
        else:
            payment_display = (order_data.get('payment_method') or 'Unknown').replace('_', ' ').title()
            if payment_display and payment_display != 'Unknown':
                payment_display = f"Payment: {payment_display}"
            else:
                payment_display = "Paid by Card"
        story.append(Paragraph(payment_display, payment_style))
        amount_paid = order_data.get('amount_paid')
        change = order_data.get('change', 0)
        if amount_paid and is_cash:
            story.append(Paragraph(f"Amount Paid: ${float(amount_paid):.2f}", payment_style))
            if change > 0:
                story.append(Paragraph(f"Change: ${change:.2f}", payment_style))
        story.append(Spacer(1, 0.05*inch))
        if is_exchange_completion:
            story.append(Paragraph("Exchange", payment_style))
            story.append(Spacer(1, 0.05*inch))
        elif is_store_credit_receipt:
            story.append(Paragraph("Store Credit Receipt", payment_style))
            story.append(Spacer(1, 0.05*inch))
        elif is_return_receipt:
            story.append(Paragraph("Return Receipt", payment_style))
            story.append(Spacer(1, 0.05*inch))
    
    # Barcode section - Date/time above barcode, Order # below barcode only (matches Settings preview; no order number above date)
    story.append(Spacer(1, 0.1*inch))
    # Above barcode: date/time only (order number appears only below barcode when show_order_number_below_barcode is true)
    story.append(Paragraph(formatted_date, date_style))
    story.append(Spacer(1, 0.05*inch))
    show_barcode = ts.get('show_barcode', True)
    if show_barcode and barcode_data and len(barcode_data) > 0:
        try:
            from reportlab.platypus import Image
            
            # Create BytesIO from barcode data
            barcode_bytes_io = io.BytesIO(barcode_data)
            
            # For Code128 barcodes, the image is wider than tall
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
            show_num_below = ts.get('show_order_number_below_barcode', True)
            if show_num_below:
                story.append(Paragraph(f"Order #: {order_number}", barcode_number_style))
            story.append(Spacer(1, 0.05*inch))
            print(f"Successfully added barcode to receipt for order {order_number}")
        except Exception as e:
            print(f"Error adding barcode to receipt: {e}")
            import traceback
            traceback.print_exc()
            # Fallback: show order number if barcode fails
            pass  # Order/Date already shown above
    # If no barcode, Order and Date are already shown above
    
    if not is_return_receipt and not is_store_credit_receipt and not is_exchange_completion:
        story.append(_divider(header_style))
    
    # Signature - show if signature data exists and show_signature is enabled
    signature = order_data.get('signature')
    show_signature_setting = settings.get('show_signature', 1)  # Default to enabled
    print(f"Signature check - setting: {show_signature_setting}, signature exists: {signature is not None}, signature length: {len(signature) if signature else 0}")
    if show_signature_setting and signature:
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
            story.append(Paragraph("Signature:", signature_label_style))
            story.append(signature_table)
            story.append(Spacer(1, 0.05*inch))
            # No divider here - single line before footer is added below
            print(f"Successfully added signature to receipt")
        except Exception as e:
            print(f"Error adding signature to receipt: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"No signature data found in order_data")
    
    # Footer - Custom Footer Message
    story.append(Spacer(1, 0.1*inch))
    story.append(_divider(header_style))
    
    # Get footer message - ensure it always has content (uses footer_style from template)
    footer_text = settings.get('footer_message', '').strip()
    if not footer_text:
        footer_text = 'Thank you for your business!'
    story.append(Paragraph(footer_text, footer_style))
    
    # Return Policy - Display if set (uses return_policy_style from template)
    return_policy = settings.get('return_policy', '').strip()
    if return_policy:
        story.append(Spacer(1, 0.05*inch))
        story.append(Paragraph(return_policy, return_policy_style))
    store_website = settings.get('store_website', '').strip()
    if store_website:
        story.append(Spacer(1, 0.05*inch))
        story.append(Paragraph(store_website, store_website_style))
    store_email = settings.get('store_email', '').strip()
    if store_email:
        story.append(Spacer(1, 0.05*inch))
        story.append(Paragraph(store_email, store_email_style))
    story.append(Spacer(1, 0.1*inch))
    
    # Build PDF
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


def generate_test_receipt_pdf(settings_override: dict = None) -> bytes:
    """
    Generate a test receipt PDF with sample data (for Settings Print test).
    Uses settings_override (full receiptSettings from frontend) when provided.
    """
    from datetime import datetime
    order_data = {
        'order_id': 99999,
        'order_number': 'ORD-TEST-001',
        'order_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'order_type': 'pickup',
        'customer_name': 'Jane Doe',
        'customer_phone': '(555) 123-4567',
        'customer_address': '123 Main St, City',
        'subtotal': 25.47,
        'tax_rate': 0.08,
        'tax_amount': 2.04,
        'discount': 0,
        'total': 27.51,
        'payment_method': 'card',
        'payment_status': 'completed',
    }
    order_items = [
        {'product_name': 'Organic Coffee Beans', 'sku': 'SKU-001', 'quantity': 2, 'unit_price': 12.99, 'description': 'Medium roast'},
        {'product_name': 'Almond Milk', 'sku': 'SKU-002', 'quantity': 1, 'unit_price': 4.49, 'description': None},
        {'product_name': 'Croissant', 'sku': 'SKU-003', 'quantity': 3, 'unit_price': 3.50, 'description': 'Butter'},
    ]
    return generate_receipt_pdf(order_data, order_items, settings_override=settings_override)


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
                   c.customer_name AS profile_customer_name,
                   c.customer_id AS profile_customer_id
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
            SELECT oi.*, i.product_name, i.sku
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
        # Order total includes tip when process_payment ran with tip > 0
        order_data['total_includes_tip'] = True
        # If we found a payment record, always show as paid (normal receipt). Only show NOT PAID when no payment and order is pay-later.
        if amount_paid is not None:
            order_data['payment_status'] = 'completed'
        else:
            current_status = (order_data.get('payment_status') or 'completed').lower()
            if current_status != 'completed' and (order_data.get('order_type') or '').lower() in ('pickup', 'delivery'):
                order_data['payment_status'] = 'pending'
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
            SELECT ti.*, i.product_name, i.sku
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
        
        # Get discount, discount_type, order_type, tip from the linked order
        order_discount = 0
        order_discount_type = None
        order_type = None
        order_tip = 0
        order_id = transaction.get('order_id')
        if order_id:
            try:
                cursor.execute("""
                    SELECT discount, discount_type, order_type FROM orders WHERE order_id = %s
                """, (order_id,))
                order_row = cursor.fetchone()
                if order_row:
                    order_discount = float(order_row.get('discount', 0) or 0)
                    order_discount_type = order_row.get('discount_type')
                    order_type = order_row.get('order_type')
                # Fallback: get tip from orders when transactions.tip is 0 (e.g. different payment path)
                try:
                    cursor.execute("SELECT tip FROM orders WHERE order_id = %s", (order_id,))
                    ot_row = cursor.fetchone()
                    if ot_row and (ot_row.get('tip') or 0):
                        order_tip = float(ot_row.get('tip') or 0)
                except Exception:
                    pass
            except Exception as e:
                print(f"Note: Could not get order details: {e}")

        # Get customer phone and address for pickup/delivery receipts
        customer_phone = None
        customer_address = None
        customer_id = transaction.get('customer_id')
        if customer_id:
            try:
                cursor.execute("""
                    SELECT phone FROM customers WHERE customer_id = %s
                """, (customer_id,))
                cust_row = cursor.fetchone()
                if cust_row:
                    customer_phone = cust_row.get('phone')
                cursor.execute("""
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'address'
                """)
                if cursor.fetchone():
                    cursor.execute("SELECT address FROM customers WHERE customer_id = %s", (customer_id,))
                    addr_row = cursor.fetchone()
                    if addr_row:
                        customer_address = addr_row.get('address') if isinstance(addr_row, dict) else addr_row[0]
            except Exception:
                pass

        # Payment status: pending if no payment and order is pickup/delivery
        payment_status = 'completed'
        if amount_paid is None and order_type and str(order_type).lower() in ('pickup', 'delivery'):
            payment_status = 'pending'

        # Convert transaction data to order-like format for receipt generation
        order_data = {
            'order_id': order_id or transaction['transaction_id'],
            'order_number': order_number,
            'order_date': transaction['created_at'],
            'employee_name': transaction.get('employee_name', ''),
            'customer_name': transaction.get('customer_name', ''),
            'customer_phone': customer_phone,
            'customer_address': customer_address,
            'order_type': order_type or '',
            'customer_id': customer_id,
            'payment_status': payment_status,
            'subtotal': transaction['subtotal'],
            'tax_amount': transaction['tax'],
            'tax_rate': transaction['tax'] / transaction['subtotal'] if transaction['subtotal'] > 0 else 0,
            'discount': order_discount,
            'discount_type': order_discount_type or '',
            'tip': float(transaction.get('tip') or 0) or order_tip,
            'total': transaction['total'],
            'total_includes_tip': True,
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
                'discount': item.get('discount', 0),
                'sku': item.get('sku', '')
            })
        
        return generate_receipt_pdf(order_data, order_items)
    except Exception as e:
        print(f"Error generating transaction receipt: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        conn.close()


def get_receipt_data_for_email(
    transaction_id: Optional[int] = None,
    order_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch receipt data (order_data, order_items, barcode, signature) using the SAME backend
    logic as printed receipts. Use for email receipts so barcode and signature match.
    Prefer transaction_id when available (same as /api/receipt/transaction/<id>).
    Returns dict with: order_data, order_items, barcode_base64, signature
    or None if not found.
    """
    import base64
    order_data = None
    order_items = []
    signature = None

    if transaction_id:
        # Same data path as generate_transaction_receipt (printed receipt)
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
                       o.order_date,
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
            order_id = transaction.get('order_id')
            order_number = transaction.get('order_number') or (f"ORD-{transaction_id}" if not order_id else None)
            signature = transaction.get('signature')
            if not order_number and order_id:
                cursor.execute("SELECT order_number FROM orders WHERE order_id = %s", (order_id,))
                r = cursor.fetchone()
                if r:
                    order_number = r.get('order_number') if isinstance(r, dict) else r[0]
            if not order_number:
                order_number = f"ORD-{transaction_id}"

            cursor.execute("""
                SELECT ti.*, i.product_name, i.sku
                FROM transaction_items ti
                LEFT JOIN inventory i ON ti.product_id = i.product_id
                WHERE ti.transaction_id = %s
                ORDER BY ti.transaction_item_id
            """, (transaction_id,))
            transaction_items = [dict(r) for r in cursor.fetchall()]
            amount_paid = None
            payment_method = transaction.get('payment_method') or 'Unknown'
            payment_method_type = ''
            change = 0
            try:
                cursor.execute("SELECT amount_paid, change_amount FROM transactions WHERE transaction_id = %s", (transaction_id,))
                txn_row = cursor.fetchone()
                if txn_row:
                    amount_paid = txn_row.get('amount_paid')
                    change = txn_row.get('change_amount') or 0
            except Exception:
                pass
            try:
                cursor.execute("""
                    SELECT pm.method_name, pm.method_type, p.amount
                    FROM payments p
                    JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                    WHERE p.transaction_id = %s
                    ORDER BY p.payment_id DESC LIMIT 1
                """, (transaction_id,))
                pm_row = cursor.fetchone()
                if pm_row:
                    payment_method = pm_row.get('method_name') or payment_method
                    payment_method_type = (pm_row.get('method_type') or '').lower()
                    if amount_paid is None:
                        amount_paid = pm_row.get('amount')
                    if change == 0 and amount_paid and ('cash' in (payment_method or '').lower() or payment_method_type == 'cash'):
                        change = float(amount_paid) - float(transaction.get('total', 0))
            except Exception:
                pass
            order_type = None
            order_discount = 0
            order_tip = float(transaction.get('tip') or 0)
            if order_id:
                try:
                    cursor.execute("SELECT discount, discount_type, order_type, tip FROM orders WHERE order_id = %s", (order_id,))
                    o_row = cursor.fetchone()
                    if o_row:
                        order_discount = float(o_row.get('discount') or 0)
                        order_type = o_row.get('order_type') or ''
                        if o_row.get('tip'):
                            order_tip = float(o_row.get('tip') or 0)
                except Exception:
                    pass
            customer_phone = None
            customer_address = None
            cust_id = transaction.get('customer_id')
            if cust_id:
                try:
                    cursor.execute("SELECT phone FROM customers WHERE customer_id = %s", (cust_id,))
                    cr = cursor.fetchone()
                    if cr:
                        customer_phone = cr.get('phone')
                except Exception:
                    pass
            payment_status = 'completed'
            if amount_paid is None and order_type and str(order_type).lower() in ('pickup', 'delivery'):
                payment_status = 'pending'
            order_data = {
                'order_id': order_id or transaction_id,
                'order_number': order_number,
                'order_date': transaction.get('order_date') or transaction.get('created_at'),
                'employee_name': transaction.get('employee_name', ''),
                'customer_name': transaction.get('customer_name', ''),
                'customer_phone': customer_phone,
                'customer_address': customer_address,
                'order_type': order_type or '',
                'payment_status': payment_status,
                'subtotal': transaction.get('subtotal', 0),
                'tax_amount': transaction.get('tax', 0),
                'tax_rate': (transaction.get('tax') or 0) / (transaction.get('subtotal') or 1) if transaction.get('subtotal') else 0,
                'discount': order_discount,
                'tip': order_tip,
                'total': transaction.get('total', 0),
                'total_includes_tip': True,
                'payment_method': payment_method,
                'payment_method_type': payment_method_type,
                'amount_paid': amount_paid,
                'change': change if change > 0 else 0,
                'signature': signature,
                'transaction_fee': 0,
                'profile_customer_name': transaction.get('customer_name', ''),
                'profile_customer_phone': customer_phone,
            }
            order_items = [
                {
                    'product_name': it.get('product_name', 'Unknown Product'),
                    'quantity': it.get('quantity', 1),
                    'unit_price': it.get('unit_price', 0),
                    'subtotal': it.get('subtotal', 0),
                    'discount': it.get('discount', 0),
                    'sku': it.get('sku', ''),
                }
                for it in transaction_items
            ]
        finally:
            conn.close()
    elif order_id:
        # Same data path as generate_receipt_with_barcode (printed receipt)
        from database import get_connection
        from psycopg2.extras import RealDictCursor
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT o.*,
                       e.first_name || ' ' || e.last_name as employee_name,
                       c.customer_name AS profile_customer_name,
                       c.phone AS profile_customer_phone
                FROM orders o
                LEFT JOIN employees e ON o.employee_id = e.employee_id
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                WHERE o.order_id = %s
            """, (order_id,))
            order_row = cursor.fetchone()
            if not order_row:
                return None
            order_data = dict(order_row)
            if not order_data.get('customer_name') and order_data.get('profile_customer_name'):
                order_data['customer_name'] = order_data['profile_customer_name']
            if not order_data.get('customer_phone') and order_data.get('profile_customer_phone'):
                order_data['customer_phone'] = order_data['profile_customer_phone']
            cursor.execute("""
                SELECT oi.*, i.product_name, i.sku
                FROM order_items oi
                LEFT JOIN inventory i ON oi.product_id = i.product_id
                WHERE oi.order_id = %s
                ORDER BY oi.order_item_id
            """, (order_id,))
            order_items = [dict(r) for r in cursor.fetchall()]
            cursor.execute(
                "SELECT signature FROM transactions WHERE order_id = %s AND signature IS NOT NULL AND TRIM(signature) != '' ORDER BY transaction_id DESC LIMIT 1",
                (order_id,),
            )
            sig_row = cursor.fetchone()
            if sig_row and sig_row.get('signature'):
                signature = sig_row['signature']
                order_data['signature'] = signature
            amount_paid = None
            payment_method = order_data.get('payment_method', 'Unknown')
            payment_method_type = ''
            change = 0
            try:
                cursor.execute("""
                    SELECT pm.method_name, pm.method_type, p.amount
                    FROM payments p
                    JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
                    WHERE p.transaction_id IN (SELECT transaction_id FROM transactions WHERE order_id = %s)
                    ORDER BY p.payment_id DESC LIMIT 1
                """, (order_id,))
                pm_row = cursor.fetchone()
                if pm_row:
                    payment_method = pm_row.get('method_name', payment_method)
                    payment_method_type = (pm_row.get('method_type') or '').lower()
                    amount_paid = pm_row.get('amount')
            except Exception:
                pass
            if amount_paid and ('cash' in (payment_method or '').lower() or payment_method_type == 'cash'):
                change = float(amount_paid) - float(order_data.get('total', 0))
            order_data['payment_method'] = payment_method
            order_data['payment_method_type'] = payment_method_type
            order_data['amount_paid'] = amount_paid
            order_data['change'] = change if change > 0 else 0
            order_data['signature'] = signature
            order_data['total_includes_tip'] = True
        finally:
            conn.close()
    else:
        return None

    if not order_data:
        return None

    order_number = order_data.get('order_number', '')
    barcode_base64 = ''
    try:
        barcode_bytes = generate_barcode_data(order_number)
        if barcode_bytes and len(barcode_bytes) > 0:
            barcode_base64 = base64.b64encode(barcode_bytes).decode('ascii')
    except Exception:
        pass

    return {
        'order_data': order_data,
        'order_items': order_items,
        'barcode_base64': barcode_base64,
        'signature': signature,
    }


def generate_return_receipt(return_id: int) -> Optional[bytes]:
    """Generate return receipt PDF using the same receipt template as POS (Settings)."""
    from database import get_connection
    from psycopg2.extras import RealDictCursor
    
    if not REPORTLAB_AVAILABLE:
        print("ReportLab not available. Cannot generate return receipt.")
        return None
    
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get return with receipt totals and order info
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
        
        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            WHERE pri.return_id = %s
        """, (return_id,))
        return_items = [dict(row) for row in cursor.fetchall()]
        
        order_id = return_data.get('order_id')
        order_number = return_data.get('order_number') or ''
        return_date = return_data.get('return_date') or return_data.get('approved_date')
        if hasattr(return_date, 'strftime'):
            order_date_str = return_date.strftime('%Y-%m-%d %H:%M:%S')
        else:
            order_date_str = str(return_date) if return_date else ''
        
        # Signature from pending_returns (when "Require signature for return" was used)
        return_signature = return_data.get('signature')
        # Store credit return (use later): same format as refund but labels say "Store Credit"
        is_store_credit = bool(return_data.get('exchange_transaction_id'))

        order_data = {
            'order_id': order_id,
            'order_number': order_number,
            'order_date': order_date_str,
            'payment_method': return_data.get('payment_method') or 'card',
            'payment_status': 'completed',
            'subtotal': float(return_data.get('return_subtotal') or 0),
            'discount': float(return_data.get('return_discount') or 0),
            'tax_amount': float(return_data.get('return_tax') or 0),
            'tax_rate': 0,
            'transaction_fee': float(return_data.get('return_processing_fee') or 0),
            'tip': float(return_data.get('return_tip') or 0),
            'total': float(return_data.get('total_refund_amount') or 0),
            'is_return_receipt': True,
            'is_store_credit_receipt': is_store_credit,
            'signature': return_signature,
        }
        
        return_items_payload = [
            {
                'product_name': item.get('product_name', ''),
                'sku': item.get('sku', ''),
                'quantity': int(item.get('quantity', 0)),
                'unit_price': float(item.get('unit_price', 0)),
                'refund_amount': float(item.get('refund_amount', 0)),
            }
            for item in return_items
        ]
        
        # For partial returns only: build original order items (what was bought) so receipt shows both
        original_order_items = []
        cursor.execute("""
            SELECT oi.order_item_id, oi.product_id, oi.quantity, oi.unit_price, oi.discount, oi.subtotal,
                   i.product_name, i.sku
            FROM order_items oi
            JOIN inventory i ON oi.product_id = i.product_id
            WHERE oi.order_id = %s
        """, (order_id,))
        current_order_items = [dict(row) for row in cursor.fetchall()]
        return_qty_by_oi_id = {}
        for r in return_items:
            oi_id = r.get('order_item_id')
            if oi_id is not None:
                return_qty_by_oi_id[oi_id] = return_qty_by_oi_id.get(oi_id, 0) + int(r.get('quantity', 0))
        for oi in current_order_items:
            oi_id = oi.get('order_item_id')
            current_qty = int(oi.get('quantity', 0))
            returned_qty = return_qty_by_oi_id.get(oi_id, 0)
            original_qty = current_qty + returned_qty
            if original_qty <= 0:
                continue
            unit_price = float(oi.get('unit_price', 0))
            discount = float(oi.get('discount', 0))
            if current_qty > 0:
                original_subtotal = (unit_price * original_qty) - (discount * original_qty / current_qty)
            else:
                original_subtotal = unit_price * original_qty
            original_order_items.append({
                'product_name': oi.get('product_name', ''),
                'sku': oi.get('sku', ''),
                'quantity': original_qty,
                'unit_price': unit_price,
                'subtotal': original_subtotal,
            })
        for r in return_items:
            if r.get('order_item_id') is None:
                original_order_items.append({
                    'product_name': r.get('product_name', ''),
                    'sku': r.get('sku', ''),
                    'quantity': int(r.get('quantity', 0)),
                    'unit_price': float(r.get('unit_price', 0)),
                    'subtotal': float(r.get('refund_amount', 0)),
                })
        # Only show "Items purchased" section when this is a partial return (some items left on the order)
        if not current_order_items:
            original_order_items = []
        
        return generate_receipt_pdf(
            order_data,
            return_items_payload,
            original_order_items=original_order_items if original_order_items else None
        )
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


def generate_exchange_completion_receipt(return_id: int, order_id: int) -> Optional[bytes]:
    """Generate combined exchange receipt: returned items + new items + new total (uses receipt UI template)."""
    from database import get_connection
    from psycopg2.extras import RealDictCursor

    if not REPORTLAB_AVAILABLE:
        return None

    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT pr.*, o_orig.order_number as original_order_number,
                   e.first_name || ' ' || e.last_name as employee_name
            FROM pending_returns pr
            JOIN orders o_orig ON pr.order_id = o_orig.order_id
            JOIN employees e ON pr.employee_id = e.employee_id
            WHERE pr.return_id = %s
        """, (return_id,))
        return_row = cursor.fetchone()
        if not return_row:
            return None
        return_row = dict(return_row)

        cursor.execute("""
            SELECT pri.*, i.product_name, i.sku
            FROM pending_return_items pri
            JOIN inventory i ON pri.product_id = i.product_id
            WHERE pri.return_id = %s
        """, (return_id,))
        return_items = [dict(r) for r in cursor.fetchall()]

        cursor.execute("""
            SELECT o.*, e.first_name || ' ' || e.last_name as employee_name
            FROM orders o
            JOIN employees e ON o.employee_id = e.employee_id
            WHERE o.order_id = %s
        """, (order_id,))
        order_row = cursor.fetchone()
        if not order_row:
            return None
        order_row = dict(order_row)

        cursor.execute("""
            SELECT oi.*, i.product_name, i.sku
            FROM order_items oi
            JOIN inventory i ON oi.product_id = i.product_id
            WHERE oi.order_id = %s
        """, (order_id,))
        order_items_rows = [dict(r) for r in cursor.fetchall()]

        order_number = order_row.get('order_number') or ''
        order_date = order_row.get('order_date')
        order_date_str = order_date.strftime('%Y-%m-%d %H:%M:%S') if hasattr(order_date, 'strftime') else str(order_date or '')

        returned_items_payload = [
            {
                'product_name': item.get('product_name', ''),
                'sku': item.get('sku', ''),
                'quantity': int(item.get('quantity', 0)),
                'unit_price': float(item.get('unit_price', 0)),
                'subtotal': float(item.get('refund_amount', 0)),
            }
            for item in return_items
        ]

        new_items_payload = []
        for row in order_items_rows:
            qty = int(row.get('quantity', 0))
            unit_price = float(row.get('unit_price', 0))
            discount = float(row.get('discount', 0))
            subtotal = float(row.get('subtotal', 0)) if row.get('subtotal') is not None else (unit_price * qty - discount)
            new_items_payload.append({
                'product_name': row.get('product_name', ''),
                'sku': row.get('sku', ''),
                'quantity': qty,
                'unit_price': unit_price,
                'subtotal': subtotal,
            })

        order_data = {
            'order_id': order_id,
            'order_number': order_number,
            'order_date': order_date_str,
            'payment_method': order_row.get('payment_method') or 'card',
            'payment_status': 'completed',
            'subtotal': float(order_row.get('subtotal', 0) or 0),
            'discount': float(order_row.get('discount', 0) or 0),
            'tax_amount': float(order_row.get('tax_amount', 0) or 0),
            'tax_rate': float(order_row.get('tax_rate', 0) or 0),
            'transaction_fee': float(order_row.get('transaction_fee', 0) or 0),
            'tip': float(order_row.get('tip', 0) or 0),
            'total': float(order_row.get('total', 0) or 0),
            'is_exchange_completion': True,
            'employee_name': order_row.get('employee_name', ''),
        }

        return generate_receipt_pdf(
            order_data,
            new_items_payload,
            original_order_items=returned_items_payload,
        )
    except Exception as e:
        print(f"Error generating exchange completion receipt: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        conn.close()
