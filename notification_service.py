#!/usr/bin/env python3
"""
Unified notification service for POS: Email (Gmail for testing, AWS SES for production) and SMS (AWS SNS).
Configure in Settings > Notifications > Email & SMS.
"""

import base64
import io
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Email notification order source logos – use inline base64 for reliable display in emails
_EMAIL_LOGO_FILES = {
    "doordash": "doordash-email-logo.svg",
    "shopify": "shopify-email-logo.svg",
    "uber_eats": "uber-eats-logo.svg",
}


_EMAIL_LOGO_CID = "orderlogo"  # CID used for img src="cid:orderlogo"


def _get_email_logo_png_bytes(logo_key: str) -> Optional[bytes]:
    """Load SVG, convert to PNG, return bytes for CID attachment. Gmail blocks SVG/data URIs."""
    fname = _EMAIL_LOGO_FILES.get(logo_key)
    if not fname:
        return None
    try:
        _dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(_dir, "frontend", "public", fname)
        if not os.path.isfile(path):
            return None
        try:
            import cairosvg
            png_bytes = cairosvg.svg2png(url=path, output_width=308, output_height=36)
            return png_bytes
        except ImportError:
            logger.debug("cairosvg not installed; logo will not display in email")
        except Exception as e:
            logger.debug("cairosvg conversion failed for %s: %s", logo_key, e)
    except Exception as e:
        logger.debug("Could not load email logo %s: %s", logo_key, e)
    return None

# Default preferences when none configured
DEFAULT_PREFS = {
    "orders": {"email": False, "sms": False},
    "reports": {"email": False, "sms": False},
    "scheduling": {"email": True, "sms": True},
    "clockins": {"email": False, "sms": False},
    "receipts": {"email": True, "sms": False},
}


def _get_sms_settings(store_id: int = 1):
    """Load sms_settings for store. Returns None if not found. Tolerates missing email_* columns."""
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        base_cols = """setting_id, store_id, sms_provider, smtp_server, smtp_port, smtp_user, smtp_password,
                      smtp_use_tls, business_name, store_phone_number,
                      aws_access_key_id, aws_secret_access_key, aws_region"""
        try:
            cur.execute(
                f"""SELECT {base_cols}, email_provider, email_from_address, notification_preferences
                   FROM sms_settings WHERE store_id = %s AND is_active = 1 LIMIT 1""",
                (store_id,)
            )
            extended = True
        except Exception:
            cur.execute(
                f"""SELECT {base_cols} FROM sms_settings WHERE store_id = %s AND is_active = 1 LIMIT 1""",
                (store_id,)
            )
            extended = False
        row = cur.fetchone()
        conn.close()
        if row:
            d = dict(row) if hasattr(row, 'keys') else None
            if d is None:
                d = {c: row[i] for i, c in enumerate([
                    'setting_id', 'store_id', 'sms_provider', 'smtp_server', 'smtp_port', 'smtp_user',
                    'smtp_password', 'smtp_use_tls', 'business_name', 'store_phone_number',
                    'aws_access_key_id', 'aws_secret_access_key', 'aws_region'
                ])}
                if extended and len(row) > 13:
                    d['email_provider'] = row[13] if len(row) > 13 else 'gmail'
                    d['email_from_address'] = row[14] if len(row) > 14 else None
                    d['notification_preferences'] = row[15] if len(row) > 15 else {}
                else:
                    d.setdefault('email_provider', 'gmail')
                    d.setdefault('email_from_address', None)
                    d.setdefault('notification_preferences', {})
            return d
    except Exception as e:
        logger.warning("notification_service: could not load sms_settings: %s", e)
    return None


def get_notification_preferences(store_id: int = 1) -> Dict[str, Any]:
    """Return merged preferences (DB + defaults).
    
    Boolean fields (email/sms toggles) are coerced to bool.
    Extended fields (source_filter, recipient_employee_ids, email_enabled, etc.)
    are passed through as-is so they are not destroyed.
    """
    s = _get_sms_settings(store_id)
    prefs: Dict[str, Any] = {k: dict(v) for k, v in DEFAULT_PREFS.items()}
    if s and s.get('notification_preferences'):
        np = s['notification_preferences']
        if isinstance(np, str):
            try:
                np_dict = json.loads(np) if np else {}
            except json.JSONDecodeError:
                np_dict = {}
        elif np is None:
            np_dict = {}
        else:
            np_dict = np
            
        for cat, chans in np_dict.items():
            if not isinstance(chans, dict):
                continue
            cat_prefs = prefs.setdefault(cat, {})
            for k, v in chans.items():
                # Only coerce to bool for the two standard channel keys
                if k in ('email', 'sms'):
                    cat_prefs[k] = bool(v)
                else:
                    # Preserve lists, ints, strings as-is (e.g. source_filter, recipient_employee_ids)
                    cat_prefs[k] = v
    return prefs


def should_send(store_id: int, category: str, channel: str) -> bool:
    """Check if we should send this type of notification."""
    prefs = get_notification_preferences(store_id)
    return prefs.get(category, {}).get(channel, False)


def get_order_email_recipients(store_id: int, order_source: str = '') -> List[str]:
    """Return the list of email addresses to notify for a new order.

    Honors the notification_preferences.orders extended settings:
      - email_enabled (bool): overall kill-switch
      - source_filter (list[str]): ['all'] or ['doordash', 'shopify', ...]; empty => all
      - recipient_employee_ids (list[int]): specific employees to email; [] => use store email
    Returns [] if email notifications are disabled or the source is filtered out.
    """
    s = _get_sms_settings(store_id)
    if not s:
        return []
    np_raw = s.get('notification_preferences') or {}
    if isinstance(np_raw, str):
        try:
            np_raw = json.loads(np_raw) if np_raw else {}
        except json.JSONDecodeError:
            np_raw = {}
    order_prefs = np_raw.get('orders') or {}
    if not isinstance(order_prefs, dict):
        order_prefs = {}

    # Check kill-switch (email_enabled in the extended prefs; fall back to legacy 'email' bool)
    email_enabled = order_prefs.get('email_enabled')
    if email_enabled is None:
        email_enabled = order_prefs.get('email', False)
        
    if not email_enabled:
        return []

    # Source filter: ['all'] or specific sources
    source_filter0 = order_prefs.get('source_filter')
    source_filter = source_filter0 if isinstance(source_filter0, list) else ['all']
    if 'all' not in source_filter and source_filter:
        normalized_source = (order_source or '').strip().lower()
        if normalized_source not in [str(f).lower() for f in source_filter]:
            return []  # This source is filtered out

    # Build recipient list from selected employees
    employee_ids = order_prefs.get('recipient_employee_ids') or []
    emails: List[str] = []
    if employee_ids:
        try:
            from database_postgres import get_connection
            conn = get_connection()
            cur = conn.cursor()
            # Fetch email for each selected employee id
            placeholders = ','.join(['%s'] * len(employee_ids))
            cur.execute(
                f"SELECT email FROM employees WHERE employee_id IN ({placeholders}) AND email IS NOT NULL AND email <> ''",
                employee_ids
            )
            rows = cur.fetchall()
            conn.close()
            for row in rows:
                em = (row['email'] if hasattr(row, 'keys') else row[0] or '').strip()
                if em and em not in emails:
                    emails.append(em)
        except Exception as e:
            logger.warning("get_order_email_recipients: could not query employees: %s", e)

    # Fall back to store email if no employees configured
    if not emails:
        try:
            from database_postgres import get_connection
            conn = get_connection()
            cur = conn.cursor()
            cur.execute(
                "SELECT store_email FROM store_location_settings WHERE store_id = %s LIMIT 1",
                (store_id,)
            )
            row = cur.fetchone()
            conn.close()
            if row:
                em = (row['store_email'] if hasattr(row, 'keys') else row[0] or '').strip()
                if em:
                    emails.append(em)
        except Exception as e:
            logger.warning("get_order_email_recipients: could not query store email: %s", e)

    return emails



def send_email(
    to_address: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    store_id: int = 1,
    from_name: Optional[str] = None,
    settings_override: Optional[Dict[str, Any]] = None,
    inline_images: Optional[List[tuple]] = None,
) -> Dict[str, Any]:
    """
    Send email via Gmail SMTP (testing) or AWS SES (production).
    Returns {success: bool, message: str, provider: str}.
    inline_images: optional list of (cid, png_bytes) for CID attachments (avoids data URL blocking).
    """
    s = settings_override if settings_override else _get_sms_settings(store_id)
    if not s:
        return {"success": False, "message": "No notification settings configured. Save your Gmail/credentials first, or provide them for testing.", "provider": None}

    provider = (s.get("email_provider") or "gmail").lower()
    from_addr = s.get("email_from_address") or s.get("smtp_user") or "noreply@localhost"
    from_display = from_name or s.get("business_name") or "POS"
    if from_display:
        from_header = f"{from_display} <{from_addr}>"
    else:
        from_header = from_addr

    if provider == "gmail":
        return _send_email_gmail(s, to_address, from_header, subject, body_html, body_text, inline_images=inline_images)
    if provider == "aws_ses":
        return _send_email_aws_ses(s, to_address, from_header, subject, body_html, body_text, inline_images=inline_images)
    return {"success": False, "message": f"Unknown email provider: {provider}", "provider": provider}


def _send_email_gmail(
    s: Dict, to_addr: str, from_header: str, subject: str, body_html: str, body_text: Optional[str],
    inline_images: Optional[List[tuple]] = None,
) -> Dict[str, Any]:
    smtp_server = s.get("smtp_server") or "smtp.gmail.com"
    smtp_port = int(s.get("smtp_port") or 587)
    smtp_user = (s.get("smtp_user") or "").replace("\xa0", " ").strip()
    smtp_password = (s.get("smtp_password") or "").replace("\xa0", "").replace("\u00a0", "").strip()
    use_tls = s.get("smtp_use_tls", 1)

    if not smtp_user or not smtp_password or smtp_password == "***":
        return {"success": False, "message": "Gmail: SMTP user and app password required", "provider": "gmail"}

    try:
        if inline_images:
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to_addr
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(body_text or body_html, "plain"))
            alt.attach(MIMEText(body_html, "html"))
            msg.attach(alt)
            for cid, img_bytes in inline_images:
                if img_bytes:
                    img_part = MIMEImage(img_bytes, _subtype="png")
                    img_part.add_header("Content-ID", f"<{cid}>")
                    img_part.add_header("Content-Disposition", "inline", filename=f"{cid}.png")
                    msg.attach(img_part)
        else:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to_addr
            msg.attach(MIMEText(body_text or body_html, "plain"))
            if body_html and body_html != (body_text or ""):
                msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_addr, msg.as_string())
        return {"success": True, "message": "Email sent via Gmail", "provider": "gmail"}
    except Exception as e:
        logger.exception("Gmail send failed")
        return {"success": False, "message": str(e), "provider": "gmail"}


def _send_email_aws_ses(
    s: Dict, to_addr: str, from_header: str, subject: str, body_html: str, body_text: Optional[str],
    inline_images: Optional[List[tuple]] = None,
) -> Dict[str, Any]:
    try:
        import boto3
    except ImportError:
        return {"success": False, "message": "boto3 not installed. pip install boto3", "provider": "aws_ses"}

    ak = s.get("aws_access_key_id")
    sk = s.get("aws_secret_access_key")
    region = s.get("aws_region") or "us-east-1"
    if not ak or not sk or sk == "***":
        return {"success": False, "message": "AWS SES: Access key and secret required", "provider": "aws_ses"}

    try:
        client = boto3.client("ses", region_name=region, aws_access_key_id=ak, aws_secret_access_key=sk)
        if inline_images:
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to_addr
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(body_text or body_html, "plain"))
            alt.attach(MIMEText(body_html, "html"))
            msg.attach(alt)
            for cid, img_bytes in inline_images:
                if img_bytes:
                    img_part = MIMEImage(img_bytes, _subtype="png")
                    img_part.add_header("Content-ID", f"<{cid}>")
                    img_part.add_header("Content-Disposition", "inline", filename=f"{cid}.png")
                    msg.attach(img_part)
            raw = msg.as_string()
            raw_bytes = raw.encode("utf-8") if isinstance(raw, str) else raw
            client.send_raw_email(
                Source=from_header,
                Destinations=[to_addr],
                RawMessage={"Data": raw_bytes},
            )
        else:
            body = {"Html": {"Data": body_html, "Charset": "UTF-8"}}
            if body_text:
                body["Text"] = {"Data": body_text, "Charset": "UTF-8"}
            client.send_email(
                Source=from_header,
                Destination={"ToAddresses": [to_addr]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": body,
                },
            )
        return {"success": True, "message": "Email sent via AWS SES", "provider": "aws_ses"}
    except Exception as e:
        logger.exception("AWS SES send failed")
        return {"success": False, "message": str(e), "provider": "aws_ses"}


def send_sms(
    phone_number: str,
    message_text: str,
    store_id: int = 1,
    message_type: str = "manual",
    customer_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Send SMS via Email-to-SMS (Gmail) or AWS SNS.
    Returns {success: bool, message: str, provider: str, message_id: Optional[int]}.
    """
    s = _get_sms_settings(store_id)
    if not s:
        return {"success": False, "message": "No notification settings configured", "provider": None, "message_id": None}

    provider = (s.get("sms_provider") or "aws_sns").lower()
    text = (message_text or "")[:160]

    if provider == "email":
        return _send_sms_email(s, store_id, phone_number, text, message_type, customer_id)
    if provider == "aws_sns":
        return _send_sms_aws_sns(s, store_id, phone_number, text, message_type, customer_id)
    return {"success": False, "message": f"Unknown SMS provider: {provider}", "provider": provider, "message_id": None}


def _normalize_phone(phone: str) -> str:
    """Normalize to 10-digit US format."""
    digits = "".join(c for c in str(phone) if c.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        return digits[1:]
    return digits[:10] if len(digits) >= 10 else digits


def _send_sms_email(
    s: Dict, store_id: int, phone: str, text: str, message_type: str, customer_id: Optional[int]
) -> Dict[str, Any]:
    """Send via SMTP to carrier gateway (e.g. number@txt.att.net)."""
    smtp_server = s.get("smtp_server") or "smtp.gmail.com"
    smtp_port = int(s.get("smtp_port") or 587)
    smtp_user = s.get("smtp_user")
    smtp_password = s.get("smtp_password")
    use_tls = s.get("smtp_use_tls", 1)

    if not smtp_user or not smtp_password or smtp_password == "***":
        return {"success": False, "message": "Gmail: SMTP credentials required for email-to-SMS", "provider": "email", "message_id": None}

    normalized = _normalize_phone(phone)
    if len(normalized) != 10:
        return {"success": False, "message": "US 10-digit phone required for email-to-SMS", "provider": "email", "message_id": None}

    # Verizon gateway (others largely discontinued per SMS_TESTING.md)
    gateway = f"{normalized}@vtext.com"
    try:
        msg = MIMEText(text, "plain")
        msg["Subject"] = ""
        msg["From"] = smtp_user
        msg["To"] = gateway

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, gateway, msg.as_string())

        msg_id = _log_sms_message(store_id, phone, text, "sent", "email", customer_id)
        return {"success": True, "message": "SMS sent via email gateway", "provider": "email", "message_id": msg_id}
    except Exception as e:
        _log_sms_message(store_id, phone, text, "failed", "email", customer_id, error=str(e))
        logger.exception("Email-to-SMS failed")
        return {"success": False, "message": str(e), "provider": "email", "message_id": None}


def _send_sms_aws_sns(
    s: Dict, store_id: int, phone: str, text: str, message_type: str, customer_id: Optional[int]
) -> Dict[str, Any]:
    try:
        import boto3
    except ImportError:
        return {"success": False, "message": "boto3 not installed. pip install boto3", "provider": "aws_sns", "message_id": None}

    ak = s.get("aws_access_key_id")
    sk = s.get("aws_secret_access_key")
    region = s.get("aws_region") or "us-east-1"
    if not ak or not sk or sk == "***":
        return {"success": False, "message": "AWS SNS: Access key and secret required", "provider": "aws_sns", "message_id": None}

    normalized = _normalize_phone(phone)
    if len(normalized) < 10:
        return {"success": False, "message": "Valid phone number required", "provider": "aws_sns", "message_id": None}
    e164 = f"+1{normalized}" if len(normalized) == 10 else f"+{normalized}"

    try:
        client = boto3.client("sns", region_name=region, aws_access_key_id=ak, aws_secret_access_key=sk)
        r = client.publish(PhoneNumber=e164, Message=text)
        msg_id = _log_sms_message(store_id, phone, text, "sent", "aws_sns", customer_id, provider_sid=r.get("MessageId"))
        return {"success": True, "message": "SMS sent via AWS SNS", "provider": "aws_sns", "message_id": msg_id}
    except Exception as e:
        _log_sms_message(store_id, phone, text, "failed", "aws_sns", customer_id, error=str(e))
        logger.exception("AWS SNS send failed")
        return {"success": False, "message": str(e), "provider": "aws_sns", "message_id": None}


def _log_sms_message(
    store_id: int,
    phone: str,
    text: str,
    status: str,
    provider: str,
    customer_id: Optional[int] = None,
    provider_sid: Optional[str] = None,
    error: Optional[str] = None,
) -> Optional[int]:
    try:
        from database_postgres import get_connection
        from datetime import datetime
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO sms_messages (store_id, customer_id, phone_number, message_text, direction, status, provider, provider_sid, sent_at, error_message)
               VALUES (%s, %s, %s, %s, 'outbound', %s, %s, %s, %s, %s) RETURNING message_id""",
            (store_id, customer_id, phone, text, status, provider, provider_sid, datetime.utcnow() if status == "sent" else None, error),
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        logger.warning("Could not log sms_message: %s", e)
        return None


def get_email_template(store_id: int, category: str) -> Optional[Dict[str, Any]]:
    """Load the default email template for a category. Falls back to first template if no default."""
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, store_id, category, name, subject_template, body_html_template, body_text_template, variables
               FROM email_templates WHERE store_id = %s AND category = %s ORDER BY is_default DESC, id DESC LIMIT 1""",
            (store_id, category),
        )
        row = cur.fetchone()
        conn.close()
        if row:
            cols = ['id', 'store_id', 'category', 'name', 'subject_template', 'body_html_template', 'body_text_template', 'variables']
            return dict(zip(cols, row)) if hasattr(row, '__iter__') and not hasattr(row, 'keys') else dict(row)
    except Exception as e:
        logger.warning("get_email_template: %s", e)
    return None


def render_template(template_str: str, variables: Dict[str, Any]) -> str:
    """Replace {{variable}} placeholders. Escapes HTML for safety (use body_html with pre-escaped content)."""
    if not template_str:
        return ""
    result = template_str
    for k, v in (variables or {}).items():
        placeholder = "{{" + str(k) + "}}"
        result = result.replace(placeholder, str(v) if v is not None else "")
    return result


def build_receipt_email_html(order_data: Dict[str, Any], order_items: List[Dict], store_settings: Dict[str, Any], barcode_base64: Optional[str] = None, use_cid_barcode: bool = False, use_cid_signature: bool = False) -> tuple:
    """
    Build receipt HTML and text from order data. Returns (body_html, body_text).
    Used when no custom template exists or as fallback.
    """
    store_name = store_settings.get('store_name') or order_data.get('store_name') or 'Store'
    order_number = order_data.get('order_number', '')
    order_date = order_data.get('order_date', '')
    subtotal = order_data.get('subtotal', 0)
    tax = order_data.get('tax_amount', order_data.get('tax', 0))
    total = order_data.get('total', 0)
    footer = store_settings.get('footer_message', '') or ''

    def _fmt(x):
        try:
            return f"{float(x):.2f}"
        except (TypeError, ValueError):
            return str(x)

    items_html_parts = []
    items_text_parts = []
    for it in (order_items or []):
        name = it.get('product_name', it.get('name', ''))
        qty = it.get('quantity', 1)
        up = float(it.get('unit_price', 0) or 0)
        st = float(it.get('subtotal', qty * up) or qty * up)
        items_html_parts.append(f"<tr><td>{name} x {qty}</td><td style='text-align:right'>${_fmt(st)}</td></tr>")
        items_text_parts.append(f"{name} x {qty} ${_fmt(st)}")

    items_html = "<table style='width:100%;border-collapse:collapse'>" + "".join(items_html_parts) + "</table>"
    items_text = "\n".join(items_text_parts)

    barcode_html = ''
    if order_number and store_settings.get('show_barcode', 1):
        if use_cid_barcode and barcode_base64:
            barcode_html = f'<div style="text-align:center;margin:24px 0"><img src="cid:receiptbarcode" alt="Order barcode" style="max-width:280px;height:auto" /><div style="font-size:13px;margin-top:8px">Order # {order_number}</div></div>'
        elif barcode_base64:
            barcode_html = f'<div style="text-align:center;margin:24px 0"><img src="data:image/png;base64,{barcode_base64}" alt="Order barcode" style="max-width:280px;height:auto" /><div style="font-size:13px;margin-top:8px">Order # {order_number}</div></div>'
        else:
            barcode_html = f'<div style="text-align:center;margin:24px 0"><div style="font-size:13px">Order # {order_number}</div></div>'
    signature_html = ''
    if store_settings.get('show_signature', 1) and order_data.get('signature'):
        try:
            if use_cid_signature:
                signature_html = '<div style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px">Signature</div><img src="cid:receiptsignature" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd" /></div>'
            else:
                import base64
                sig_raw = str(order_data['signature']).strip()
                if sig_raw.startswith('data:image'):
                    sig_src = sig_raw
                else:
                    decoded = base64.b64decode(sig_raw)
                    sig_src = 'data:image/png;base64,' + base64.b64encode(decoded).decode('ascii')
                signature_html = f'<div style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px">Signature</div><img src="{sig_src}" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd" /></div>'
        except Exception:
            pass

    vars_ = {
        "store_name": store_name,
        "order_number": order_number,
        "order_date": order_date,
        "items_html": items_html,
        "items_text": items_text,
        "subtotal": _fmt(subtotal),
        "tax": _fmt(tax),
        "total": _fmt(total),
        "footer_message": footer,
        "barcode_html": barcode_html,
        "signature_html": signature_html,
    }
    default_html = """<div style="font-family:sans-serif;max-width:400px;margin:0 auto">
<h2 style="text-align:center">{{store_name}}</h2>
<p style="text-align:center;color:#666">Order #{{order_number}} · {{order_date}}</p>
<hr/>
<div>{{items_html}}</div>
<hr/>
<p style="text-align:right">Subtotal: ${{subtotal}}<br/>Tax: ${{tax}}<br/><strong>Total: ${{total}}</strong></p>
{{barcode_html}}
{{signature_html}}
<p style="text-align:center;font-size:12px;color:#999">{{footer_message}}</p>
</div>"""
    default_text = f"Receipt for Order {order_number}\n{store_name}\nOrder #{{order_number}} {{order_date}}\n{{items_text}}\nSubtotal: ${{subtotal}} Tax: ${{tax}} Total: ${{total}}\n{{footer_message}}"
    html_out = render_template(default_html, vars_)
    text_out = render_template(default_text, vars_)
    return (html_out, text_out)


def send_order_notification(store_id: int, order_info: Dict, emails: List[str], phones: List[str]) -> Dict[str, List[Dict]]:
    """Send order notifications (email + SMS) if enabled. Uses email template when available."""
    results = {"email": [], "sms": []}
    if not should_send(store_id, "orders", "email") and not should_send(store_id, "orders", "sms"):
        return results

    subj = f"New Order #{order_info.get('order_number', order_info.get('order_id', '?'))}"
    body = f"Order received: {order_info.get('order_number', '')} Total: ${order_info.get('total', '0')}"
    body_html = f"<p>{body}</p>"
    order_logo_png = None

    tpl = get_email_template(store_id, "order")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        order_source = (order_info.get('order_source') or '').strip().lower()
        logo_html = order_info.get('order_source_logo_html', '')
        order_logo_png = None

        # Known third-party source labels for dynamic email title
        _SOURCE_LABELS = {
            'doordash': 'DoorDash',
            'shopify': 'Shopify',
            'uber_eats': 'Uber Eats',
            'ubereats': 'Uber Eats',
            'grubhub': 'Grubhub',
            'square': 'Square',
            'clover': 'Clover',
        }

        # Determine a user-friendly order title
        fulfillment = (order_info.get('fulfillment_type') or order_info.get('order_type') or '').strip().lower()
        if order_source in _SOURCE_LABELS:
            order_title = f"New {_SOURCE_LABELS[order_source]} Order"
        elif fulfillment in ('pickup', 'pick up', 'carry out', 'carryout', 'take out', 'takeout'):
            order_title = 'New Pickup Order'
        elif fulfillment in ('delivery', 'deliver'):
            order_title = 'New Delivery Order'
        elif order_source in ('inhouse', 'in_house', 'in-house', 'pos', 'walk_in', 'walkin', 'dine_in', 'dinein', '') or not order_source:
            order_title = 'New In-House Order'
        else:
            order_title = f"New {order_source.replace('_', ' ').title()} Order"

        if not logo_html and order_source and order_source in _EMAIL_LOGO_FILES:
            # No logo HTML yet — generate one from the known order source
            order_logo_png = _get_email_logo_png_bytes(order_source)
            if order_logo_png:
                alt = _SOURCE_LABELS.get(order_source, order_source.replace("_", " ").title())
                logo_html = f'<img src="cid:{_EMAIL_LOGO_CID}" alt="{alt}" style="height:40px;width:auto;display:block;margin:0 auto" />'
        elif logo_html:
            # logo_html was pre-supplied but may contain a relative SVG path (e.g. src="/doordash-email-logo.svg")
            # that email clients can't load. Detect and convert to inline CID PNG.
            import re as _re
            for _lk, _fn in _EMAIL_LOGO_FILES.items():
                if _re.search(r'src=[\'"]/?' + _re.escape(_fn) + r'[\'"]', logo_html):
                    order_logo_png = _get_email_logo_png_bytes(_lk)
                    if order_logo_png:
                        logo_html = _re.sub(
                            r'(src=[\'"])/?(?:[^"]*/)?' + _re.escape(_fn) + r'([\'"])',
                            r'\g<1>cid:' + _EMAIL_LOGO_CID + r'\g<2>',
                            logo_html
                        )
                    break

        # For in-house / POS orders with no third-party logo, show Lucide Home SVG
        if not logo_html and (not order_source or order_source in ('inhouse', 'in_house', 'in-house', 'pos', 'walk_in', 'walkin', 'dine_in', 'dinein')):
            logo_html = (
                '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" '
                'fill="none" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                'style="display:block;margin:0 auto">'
                '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
                '<polyline points="9 22 9 12 15 12 15 22"/>'
                '</svg>'
            )

        txn_fee = float(order_info.get('transaction_fee', 0) or 0)
        txn_fee_str = f"${txn_fee:.2f}" if txn_fee else ""
        txn_fee_display = "" if txn_fee else "display:none"
        vars_.update({
            "order_number":           order_info.get('order_number', order_info.get('order_id', '?')),
            "total":                  f"{float(order_info.get('total', 0) or 0):.2f}",
            "subtotal":               f"{float(order_info.get('subtotal', order_info.get('total', 0)) or 0):.2f}",
            "tax":                    f"{float(order_info.get('tax', 0) or 0):.2f}",
            "tip":                    f"{float(order_info.get('tip', 0) or 0):.2f}",
            "transaction_fee":        txn_fee_str,
            "transaction_fee_raw":    f"{txn_fee:.2f}",
            "transaction_fee_display": txn_fee_display,
            "employee_name":          order_info.get('employee_name', ''),
            "order_date":             order_info.get('order_date', ''),
            "order_time":             order_info.get('order_time', ''),
            "meta_line":              order_info.get('meta_line', ''),
            "customer_info_html":     order_info.get('customer_info_html', ''),
            "payment_method":         (order_info.get('payment_method') or '').replace('_', ' ').title(),
            "items_html":             order_info.get('items_html', ''),
            "barcode_html":           order_info.get('barcode_html', ''),
            "order_url":              order_info.get('order_url', '#'),
            "order_source_logo_html":  logo_html,
            "order_details_html":     order_info.get('order_details_html', ''),
            "order_title":            order_title,
        })

        subj = render_template(tpl.get('subject_template', ''), vars_) or subj
        body_html = render_template(tpl.get('body_html_template', ''), vars_) or body_html
        body = render_template(tpl.get('body_text_template', ''), vars_) or body

    inline_images = []
    if order_logo_png:
        inline_images.append((_EMAIL_LOGO_CID, order_logo_png))
    # Attach order barcode as CID so it renders in all email clients (data: URLs are blocked)
    barcode_bytes = order_info.get('barcode_png_bytes')
    if barcode_bytes:
        inline_images.append(('orderbarcode', barcode_bytes))
    if not inline_images:
        inline_images = None
    if should_send(store_id, "orders", "email") and emails:
        for addr in emails:
            r = send_email(addr, subj, body_html, body, store_id, inline_images=inline_images)
            results["email"].append({"to": addr, **r})
    if should_send(store_id, "orders", "sms") and phones:
        for p in phones:
            r = send_sms(p, body[:160], store_id, "order")
            results["sms"].append({"to": p, **r})
    return results


def _get_store_settings(store_id: int = 1) -> Dict[str, Any]:
    """Load store location + receipt settings for template variables. Same sources as receipt."""
    out = {}
    try:
        from database import get_store_location_settings
        s = get_store_location_settings() or {}
        if s:
            out.update(dict(s))
            out['store_name'] = out.get('store_name') or out.get('address', '') or 'Store'
            if out.get('address'):
                out['store_address'] = out['address']
    except Exception as e:
        logger.warning("_get_store_settings: %s", e)
    try:
        from receipt_generator import get_receipt_settings
        rs = get_receipt_settings() or {}
        if rs:
            out['footer_message'] = rs.get('footer_message', '') or out.get('footer_message', '')
            out.setdefault('store_name', rs.get('store_name', 'Store'))
            out.setdefault('store_tagline', rs.get('store_tagline', ''))
            out.setdefault('store_phone', rs.get('store_phone', ''))
            out.setdefault('store_city', rs.get('store_city', '') or out.get('city', ''))
            out.setdefault('store_state', rs.get('store_state', '') or out.get('state', ''))
            out.setdefault('store_zip', rs.get('store_zip', '') or out.get('zip', ''))
            out.setdefault('store_email', rs.get('store_email', ''))
            out.setdefault('store_website', rs.get('store_website', ''))
            out.setdefault('return_policy', rs.get('return_policy', ''))
            out.setdefault('show_signature', 1 if rs.get('show_signature', 1) else 0)
            ts = rs.get('template_styles') or {}
            out.setdefault('show_barcode', 1 if ts.get('show_barcode', True) is not False else 0)
    except Exception:
        pass
    # Build full formatted address (same as receipt) from address + city + state + zip
    addr = out.get('address', '') or out.get('store_address', '')
    city = out.get('store_city', '') or out.get('city', '')
    state = out.get('store_state', '') or out.get('state', '')
    zip_ = out.get('store_zip', '') or out.get('zip', '')
    full_addr = ' '.join(x for x in [addr, city, state, zip_] if x).strip()
    if full_addr:
        out['store_address'] = full_addr
    # Formatted phone (same as receipt)
    store_phone_raw = out.get('store_phone', '')
    out['formatted_store_phone'] = _format_phone(store_phone_raw) if store_phone_raw else store_phone_raw
    return out


def send_receipt_email(store_id: int, to_address: str, subject: str, body_html: str, body_text: Optional[str] = None, inline_images: Optional[List[tuple]] = None) -> Dict[str, Any]:
    """Send receipt email if receipts email is enabled. inline_images: [(cid, png_bytes), ...] for barcode/signature."""
    if not should_send(store_id, "receipts", "email"):
        return {"success": False, "message": "Receipts email disabled", "provider": None}
    return send_email(to_address, subject, body_html, body_text, store_id, inline_images=inline_images)


def send_receipt_email_for_order(
    store_id: int, order_id: int, to_address: str,
    order_data: Optional[Dict] = None, order_items: Optional[List[Dict]] = None,
    transaction_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Build receipt email from template (or default) and send. If order_data/order_items not provided,
    fetches from DB. Use when customer opts for email receipt after payment.
    transaction_id: When provided, used to fetch signature directly (more reliable than order_id).
    """
    if not should_send(store_id, "receipts", "email"):
        return {"success": False, "message": "Receipts email disabled", "provider": None}

    barcode_base64 = None
    if order_data is None or order_items is None:
        # Use same backend as printed receipts (/api/receipt/transaction, /api/receipt/<order_id>)
        from receipt_generator import get_receipt_data_for_email
        rd = get_receipt_data_for_email(transaction_id=transaction_id, order_id=order_id)
        if rd is None:
            return {"success": False, "message": "Order not found", "provider": None}
        order_data = rd['order_data']
        order_items = rd['order_items']
        barcode_base64 = rd.get('barcode_base64', '')
        # order_data already has signature from receipt_generator

    store_settings = _get_store_settings(store_id)
    inline_images = []
    use_cid_barcode = bool(barcode_base64)
    use_cid_signature = False
    if barcode_base64:
        try:
            import base64
            inline_images.append(('receiptbarcode', base64.b64decode(barcode_base64)))
        except Exception:
            use_cid_barcode = False
    sig = order_data.get('signature')
    if sig and store_settings.get('show_signature', 1):
        try:
            import base64
            sig_raw = str(sig).strip()
            if sig_raw.startswith('data:image'):
                b64_part = sig_raw.split(',', 1)[-1] if ',' in sig_raw else ''
            else:
                b64_part = sig_raw
            if b64_part:
                inline_images.append(('receiptsignature', base64.b64decode(b64_part)))
                use_cid_signature = True
        except Exception:
            pass

    tpl = get_email_template(store_id, "receipt")
    if tpl:
        vars_ = _build_receipt_variables(order_data, order_items, store_settings, barcode_base64=barcode_base64, use_cid_barcode=use_cid_barcode, use_cid_signature=use_cid_signature)
        subj = render_template(tpl.get('subject_template', ''), vars_)
        body_html = render_template(tpl.get('body_html_template', ''), vars_)
        body_text = render_template(tpl.get('body_text_template', '') or '', vars_)
    else:
        body_html, body_text = build_receipt_email_html(order_data, order_items, store_settings, barcode_base64=barcode_base64, use_cid_barcode=use_cid_barcode, use_cid_signature=use_cid_signature)
        subj = f"Receipt for Order {order_data.get('order_number', order_id)}"

    return send_receipt_email(store_id, to_address, subj, body_html, body_text, inline_images=inline_images if inline_images else None)


def _format_phone(phone: str) -> str:
    """Format phone number for display, e.g. (555) 123-4567 or +1 (555) 123-4567."""
    if not phone or not isinstance(phone, str):
        return ''
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"({digits[0:3]}) {digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits[0] == '1':
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    if len(digits) >= 10:
        return f"({digits[-10:-7]}) {digits[-7:-4]}-{digits[-4:]}"
    return phone.strip()


def _build_store_header_vars(store_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Build header/footer variables from receipt settings + store location (same as receipt)."""
    return {
        "store_name": store_settings.get('store_name', 'Store'),
        "store_tagline": store_settings.get('store_tagline', ''),
        "store_address": store_settings.get('store_address', ''),
        "store_phone": store_settings.get('store_phone', ''),
        "formatted_store_phone": store_settings.get('formatted_store_phone', '') or store_settings.get('store_phone', ''),
        "store_email": store_settings.get('store_email', ''),
        "store_website": store_settings.get('store_website', ''),
        "footer_message": store_settings.get('footer_message', 'Thank you for your business!'),
    }


def _merge_order_design_into_vars(vars_: Dict[str, Any], template: Optional[Dict]) -> None:
    """Merge template variables.orderDesign into vars_ (modifies in place). Used for order, schedule, clockin, report."""
    if not template:
        return
    design = (template.get('variables') or {}).get('orderDesign')
    if not design or not isinstance(design, dict):
        return
    for k in ('store_name', 'store_tagline', 'store_address', 'store_phone', 'store_email', 'footer_message'):
        if k in design:
            vars_[k] = str(design[k]) if design[k] is not None else ''
    if 'store_phone' in design and design.get('store_phone'):
        vars_['formatted_store_phone'] = _format_phone(str(design['store_phone']))


def _build_receipt_variables(order_data: Dict, order_items: List[Dict], store_settings: Dict, barcode_base64: Optional[str] = None, use_cid_barcode: bool = False, use_cid_signature: bool = False) -> Dict:
    def _fmt(x):
        try:
            return f"{float(x):.2f}"
        except (TypeError, ValueError):
            return str(x)

    store_name = store_settings.get('store_name') or order_data.get('store_name') or 'Store'
    order_date_raw = order_data.get('order_date', '')
    order_date_str = str(order_date_raw) if order_date_raw else ''
    # Parse date/time for formatted output
    receipt_date = order_date_str
    receipt_time = ''
    try:
        from datetime import datetime
        if order_date_raw:
            if hasattr(order_date_raw, 'strftime'):
                dt = order_date_raw
            else:
                dt = datetime.fromisoformat(str(order_date_raw).replace('Z', '+00:00'))
                dt = dt.replace(tzinfo=None) if dt.tzinfo else dt
            receipt_date = dt.strftime('%B %d, %Y')
            t = dt.strftime('%I:%M %p')
            receipt_time = t[1:] if len(t) > 0 and t[0] == '0' else t
    except (ValueError, TypeError):
        pass

    addr = store_settings.get('address', '') or store_settings.get('store_address', '')
    city = store_settings.get('store_city', '') or store_settings.get('city', '')
    state = store_settings.get('store_state', '') or store_settings.get('state', '')
    zip_ = store_settings.get('store_zip', '') or store_settings.get('zip', '')
    location = ' '.join(x for x in [addr, city, state, zip_] if x).strip() or store_name

    # Receipt type support (exchange, return, store credit)
    is_return_receipt = bool(order_data.get('is_return_receipt'))
    is_store_credit_receipt = bool(order_data.get('is_store_credit_receipt'))
    is_exchange_completion = bool(order_data.get('is_exchange_completion'))
    if is_exchange_completion:
        receipt_type_label = 'Exchange'
    elif is_store_credit_receipt:
        receipt_type_label = 'Store Credit Receipt'
    elif is_return_receipt:
        receipt_type_label = 'Return Receipt'
    else:
        receipt_type_label = 'Receipt'

    # Totals labels for different receipt types (matches receipt_generator)
    if is_store_credit_receipt:
        subtotal_label, tax_label, total_label = 'Store Credit Subtotal', 'Store Credit Tax', 'Total Store Credit'
    elif is_return_receipt and not is_exchange_completion:
        subtotal_label, tax_label, total_label = 'Return Subtotal', 'Return Tax', 'Refund Amount'
    else:
        subtotal_label, tax_label, total_label = 'Subtotal', 'Tax', 'Total'

    items_html_parts = []
    items_text_parts = []
    for it in (order_items or []):
        name = it.get('product_name', it.get('name', ''))
        desc = it.get('notes', it.get('description', '')) or ''
        qty = int(it.get('quantity', 1) or 1)
        up = float(it.get('unit_price', 0) or 0)
        st = float(it.get('subtotal', qty * up) or qty * up)
        # Item line: "Name x 2 @ $5.00" or "Name" for qty 1
        if qty != 1:
            item_line = f"{name} x {qty} @ ${_fmt(up)}"
        else:
            item_line = f"{name} @ ${_fmt(up)}"
        desc_html = f'<div class="item-description">{desc}</div>' if desc else ''
        items_html_parts.append(
            f"<tr><td><div class=\"item-name\">{item_line}</div>{desc_html}</td>"
            f"<td>${_fmt(st)}</td></tr>"
        )
        items_text_parts.append(f"{item_line} ${_fmt(st)}")

    subtotal_val = float(order_data.get('subtotal', 0) or 0)
    tax_val = float(order_data.get('tax_amount', order_data.get('tax', 0)) or 0)
    tip_val = order_data.get('tip', 0)
    tip_str = _fmt(tip_val) if tip_val else '0.00'
    discount_val = float(order_data.get('discount', 0) or 0)
    transaction_fee_val = float(order_data.get('transaction_fee', 0) or 0)
    total_val = float(order_data.get('total', 0) or 0)

    # Payment method: align with receipt_generator (lines 676-722)
    payment_status = (order_data.get('payment_status') or 'completed').lower()
    order_type_payment = (order_data.get('order_type') or '').lower()
    payment_method_raw = (order_data.get('payment_method') or 'Unknown').strip().lower()
    payment_method_type = (order_data.get('payment_method_type') or payment_method_raw or '').lower()
    is_cash = payment_method_type == 'cash' or 'cash' in payment_method_raw

    if payment_status == 'pending':
        if order_type_payment == 'delivery':
            not_paid_phrase = 'Pay at delivery'
        elif order_type_payment == 'pickup':
            not_paid_phrase = 'Pay at pickup'
        else:
            not_paid_phrase = 'Pay at counter'
        payment_display = f'Not paid - {not_paid_phrase}'
        payment_extra_lines = ''
    else:
        if is_cash:
            payment_display = 'Paid with Cash'
        elif 'card' in payment_method_raw or payment_method_raw in ('credit_card', 'debit_card', 'credit', 'debit'):
            payment_display = 'Paid by Card'
        elif 'store_credit' in payment_method_raw or 'store credit' in payment_method_raw:
            payment_display = 'Paid with Store Credit'
        elif 'check' in payment_method_raw:
            payment_display = 'Paid by Check'
        elif 'mobile' in payment_method_raw or 'apple' in payment_method_raw or 'google' in payment_method_raw:
            payment_display = 'Paid by Mobile'
        else:
            pm_title = (order_data.get('payment_method') or 'Unknown').replace('_', ' ').title()
            payment_display = f'Payment: {pm_title}' if pm_title and pm_title != 'Unknown' else 'Paid by Card'

        amount_paid = order_data.get('amount_paid')
        change = order_data.get('change', 0)
        payment_extra_lines = ''
        if amount_paid and is_cash:
            payment_extra_lines = f'<div class="payment-value">Amount Paid: ${float(amount_paid):.2f}</div>'
            if change and float(change) > 0:
                payment_extra_lines += f'<div class="payment-value">Change: ${float(change):.2f}</div>'

    store_phone_raw = store_settings.get('store_phone', '')
    formatted_store_phone = _format_phone(store_phone_raw) if store_phone_raw else store_phone_raw
    footer = store_settings.get('footer_message', '') or 'Thank you for your business!'

    # Order barcode and order number - use cid: for email (many clients block data URLs)
    order_number = order_data.get('order_number', '')
    barcode_img = ''
    show_barcode = store_settings.get('show_barcode', 1)
    if show_barcode and order_number:
        if use_cid_barcode and barcode_base64:
            barcode_img = '<img src="cid:receiptbarcode" alt="Order barcode" style="max-width:280px;height:auto" />'
        elif barcode_base64:
            barcode_img = f'<img src="data:image/png;base64,{barcode_base64}" alt="Order barcode" style="max-width:280px;height:auto" />'
        else:
            import base64
            try:
                from receipt_generator import generate_barcode_data
                barcode_bytes = generate_barcode_data(order_number)
                if barcode_bytes and len(barcode_bytes) > 0:
                    b64 = base64.b64encode(barcode_bytes).decode('ascii')
                    barcode_img = f'<img src="data:image/png;base64,{b64}" alt="Order barcode" style="max-width:280px;height:auto" />'
            except Exception as e:
                logger.warning("Barcode generation for email (Code128): %s", e)
            if not barcode_img:
                try:
                    import qrcode
                    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=4, border=2)
                    qr.add_data(order_number)
                    qr.make(fit=True)
                    img = qr.make_image(fill_color="black", back_color="white")
                    buf = io.BytesIO()
                    img.save(buf, format='PNG')
                    buf.seek(0)
                    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
                    barcode_img = f'<img src="data:image/png;base64,{b64}" alt="Order barcode" style="max-width:180px;height:auto" />'
                except Exception as qr_err:
                    logger.warning("QR fallback for email barcode: %s", qr_err)
    # Always show barcode section with order number (barcode image when available)
    barcode_html = ''
    if order_number:
        barcode_html = f'<div class="barcode-section" style="text-align:center;margin:24px 0">{barcode_img}<div style="font-size:13px;font-weight:600;color:#2c2c2c;margin-top:8px;letter-spacing:1px">Order # {order_number}</div></div>'

    # Signature (optional) - use cid: for email when use_cid
    signature_html = ''
    show_signature = store_settings.get('show_signature', 1)
    signature = order_data.get('signature')
    if show_signature and signature:
        try:
            import base64
            sig_raw = str(signature).strip()
            if use_cid_signature:
                signature_html = '<div class="signature-section" style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px;letter-spacing:1px">Signature</div><img src="cid:receiptsignature" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd;padding-bottom:4px" /></div>'
            else:
                if sig_raw.startswith('data:image'):
                    sig_src = sig_raw
                else:
                    decoded = base64.b64decode(sig_raw)
                    sig_src = 'data:image/png;base64,' + base64.b64encode(decoded).decode('ascii')
                signature_html = f'<div class="signature-section" style="margin:24px 0;text-align:center"><div style="font-size:11px;color:#666;margin-bottom:8px;letter-spacing:1px">Signature</div><img src="{sig_src}" alt="Signature" style="max-width:200px;height:auto;border-bottom:1px solid #ddd;padding-bottom:4px" /></div>'
        except Exception as e:
            logger.debug("Signature for email: %s", e)

    # Optional customer info block (for pickup/delivery)
    customer_parts = []
    cname = order_data.get('customer_name') or order_data.get('profile_customer_name', '')
    cphone = order_data.get('customer_phone', '')
    caddr = order_data.get('customer_address', '')
    if cname:
        customer_parts.append(f'<div class="receipt-info-row"><div class="label">Customer</div><div class="value">{cname}</div></div>')
    if cphone:
        customer_parts.append(f'<div class="receipt-info-row"><div class="label">Phone</div><div class="value">{cphone}</div></div>')
    if caddr:
        customer_parts.append(f'<div class="receipt-info-row"><div class="label">Address</div><div class="value">{caddr}</div></div>')
    customer_info_html = ''.join(customer_parts)

    return {
        "store_name": store_name,
        "store_tagline": store_settings.get('store_tagline', ''),
        "store_address": location,
        "store_city": city,
        "store_state": state,
        "store_zip": zip_,
        "store_phone": store_phone_raw,
        "formatted_store_phone": formatted_store_phone or store_phone_raw,
        "store_email": store_settings.get('store_email', ''),
        "store_website": store_settings.get('store_website', ''),
        "return_policy": store_settings.get('return_policy', ''),
        "footer_message": footer,
        "order_number": order_data.get('order_number', ''),
        "order_date": order_date_str,
        "order_type": order_data.get('order_type', ''),
        "receipt_date": receipt_date,
        "receipt_time": receipt_time,
        "receipt_type_label": receipt_type_label,
        "is_return_receipt": is_return_receipt,
        "is_store_credit_receipt": is_store_credit_receipt,
        "is_exchange_completion": is_exchange_completion,
        "location": location,
        "employee_name": order_data.get('employee_name', ''),
        "customer_name": order_data.get('customer_name') or order_data.get('profile_customer_name', ''),
        "customer_phone": order_data.get('customer_phone', ''),
        "customer_address": order_data.get('customer_address', ''),
        "items_html": "".join(items_html_parts),
        "items_text": "\n".join(items_text_parts),
        "subtotal": _fmt(subtotal_val),
        "subtotal_label": subtotal_label,
        "tax": _fmt(tax_val),
        "tax_label": tax_label,
        "tip": tip_str,
        "discount": _fmt(discount_val),
        "transaction_fee": _fmt(transaction_fee_val),
        "total": _fmt(total_val),
        "total_label": total_label,
        "payment_method": payment_display,
        "payment_extra_lines": payment_extra_lines,
        "payment_status": payment_status,
        "amount_paid": _fmt(order_data.get('amount_paid', 0)) if order_data.get('amount_paid') else '',
        "change": _fmt(order_data.get('change', 0)) if order_data.get('change') else '',
        "barcode_html": barcode_html,
        "signature_html": signature_html,
        "discount_row": f'<div class="total-row discount"><span>Discount</span><span>-${_fmt(discount_val)}</span></div>' if discount_val > 0 else '',
        "discount_line": f"Discount: -${_fmt(discount_val)}\n" if discount_val > 0 else "",
        "transaction_fee_row": f'<div class="total-row transaction-fee"><span>Processing Fee</span><span>${_fmt(transaction_fee_val)}</span></div>' if transaction_fee_val > 0 else '',
        "processing_fee": _fmt(transaction_fee_val),
        "transaction_fee_line": f"Processing Fee: ${_fmt(transaction_fee_val)}\n" if transaction_fee_val > 0 else "",
        "customer_info_html": customer_info_html,
    }


def _fetch_order_for_receipt(order_id: int, transaction_id: Optional[int] = None) -> tuple:
    """Fetch order and items for receipt. Returns (order_data, order_items) or (None, None).
    When transaction_id is provided, fetches signature by transaction_id for reliable lookup."""
    try:
        from database_postgres import get_connection
        from psycopg2.extras import RealDictCursor
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT o.*, e.first_name || ' ' || e.last_name as employee_name,
                      c.customer_name AS profile_customer_name,
                      c.phone AS profile_customer_phone
               FROM orders o
               LEFT JOIN employees e ON o.employee_id = e.employee_id
               LEFT JOIN customers c ON o.customer_id = c.customer_id
               WHERE o.order_id = %s""",
            (order_id,),
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return (None, None)
        order_data = dict(row)
        # Enrich customer fields from profile when order snapshot is empty
        if not order_data.get('customer_name') and order_data.get('profile_customer_name'):
            order_data['customer_name'] = order_data['profile_customer_name']
        if not order_data.get('customer_phone') and order_data.get('profile_customer_phone'):
            order_data['customer_phone'] = order_data['profile_customer_phone']
        cur.execute(
            """SELECT oi.*, i.product_name, i.sku FROM order_items oi
               LEFT JOIN inventory i ON oi.product_id = i.product_id
               WHERE oi.order_id = %s ORDER BY oi.order_item_id""",
            (order_id,),
        )
        order_items = [dict(r) for r in cur.fetchall()]
        # Fetch signature from transactions (customer display / checkout flow)
        try:
            if transaction_id:
                cur.execute(
                    """SELECT signature FROM public.transactions
                       WHERE transaction_id = %s AND signature IS NOT NULL AND TRIM(signature) != ''""",
                    (transaction_id,),
                )
            else:
                cur.execute(
                    """SELECT signature FROM public.transactions
                       WHERE order_id = %s AND signature IS NOT NULL AND TRIM(signature) != ''
                       ORDER BY transaction_id DESC LIMIT 1""",
                    (order_id,),
                )
            sig_row = cur.fetchone()
            if sig_row:
                sig_val = sig_row.get('signature') if isinstance(sig_row, dict) else sig_row[0]
                if sig_val and str(sig_val).strip():
                    order_data['signature'] = sig_val
        except Exception as sig_err:
            logger.debug("Fetch signature for order %s: %s", order_id, sig_err)
        conn.close()
        return (order_data, order_items)
    except Exception as e:
        logger.warning("_fetch_order_for_receipt: %s", e)
        return (None, None)


def send_schedule_notification(store_id: int, employee_emails: List[str], employee_phones: List[str], message: str) -> Dict[str, List[Dict]]:
    """Send schedule notifications if enabled. Uses email template when available."""
    results = {"email": [], "sms": []}
    if not should_send(store_id, "scheduling", "email") and not should_send(store_id, "scheduling", "sms"):
        return results

    subj = "Schedule Updated"
    body_html = f"<p>{message}</p>"
    body = message
    tpl = get_email_template(store_id, "schedule")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        vars_["message"] = message
        subj = render_template(tpl.get('subject_template', ''), vars_) or subj
        body_html = render_template(tpl.get('body_html_template', ''), vars_) or body_html
        body = render_template(tpl.get('body_text_template', ''), vars_) or body

    if should_send(store_id, "scheduling", "email") and employee_emails:
        for addr in employee_emails:
            r = send_email(addr, subj, body_html, body, store_id)
            results["email"].append({"to": addr, **r})
    if should_send(store_id, "scheduling", "sms") and employee_phones:
        for p in employee_phones:
            r = send_sms(p, message[:160], store_id, "schedule")
            results["sms"].append({"to": p, **r})
    return results


def send_clock_in_notification(store_id: int, employee_email: Optional[str], employee_phone: Optional[str], action: str, employee_name: str) -> Dict[str, List[Dict]]:
    """Send clock-in/out notification if enabled. Uses email template when available."""
    results = {"email": [], "sms": []}
    if not should_send(store_id, "clockins", "email") and not should_send(store_id, "clockins", "sms"):
        return results

    msg = f"{employee_name} {action}"
    subj = f"Clock {action}"
    body_html = f"<p>{msg}</p>"
    tpl = get_email_template(store_id, "clockin")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        vars_.update({"employee_name": employee_name, "action": action})
        subj = render_template(tpl.get('subject_template', ''), vars_) or subj
        body_html = render_template(tpl.get('body_html_template', ''), vars_) or body_html
        msg = render_template(tpl.get('body_text_template', ''), vars_) or msg

    if should_send(store_id, "clockins", "email") and employee_email:
        r = send_email(employee_email, subj, body_html, msg, store_id)
        results["email"].append({"to": employee_email, **r})
    if should_send(store_id, "clockins", "sms") and employee_phone:
        r = send_sms(employee_phone, msg[:160], store_id, "clockin")
        results["sms"].append({"to": employee_phone, **r})
    return results


def send_report_notification(store_id: int, to_emails: List[str], subject: str, body_html: str, body_text: Optional[str] = None) -> Dict[str, List[Dict]]:
    """Send report notification if enabled. Uses report template to wrap subject when available."""
    results = {"email": []}
    if not should_send(store_id, "reports", "email") or not to_emails:
        return results
    tpl = get_email_template(store_id, "report")
    if tpl:
        store_settings = _get_store_settings(store_id)
        vars_ = _build_store_header_vars(store_settings)
        _merge_order_design_into_vars(vars_, tpl)
        vars_.update({"report_name": subject, "report_date": ""})
        from datetime import date
        vars_["report_date"] = str(date.today())
        subj_rendered = render_template(tpl.get('subject_template', ''), vars_)
        if subj_rendered:
            subject = subj_rendered
    for addr in to_emails:
        r = send_email(addr, subject, body_html, body_text, store_id)
        results["email"].append({"to": addr, **r})
    return results


# ───────────────────────────────────────────────────────────────────────────────
# Clock-in / Clock-out Notification System
# ───────────────────────────────────────────────────────────────────────────────

def get_clockin_notification_settings(store_id: int = 1) -> Dict:
    """Return the clockin_notification_settings row for store_id as a plain dict."""
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM clockin_notification_settings WHERE store_id = %s", (store_id,))
        row = cur.fetchone()
        conn.close()
        if row:
            d = dict(row) if hasattr(row, 'keys') else {}
            if not d:
                cols = ['id','store_id','notify_admin_on_clockin','notify_admin_on_clockout',
                        'admin_email_ids','notify_employee_self','late_alert_enabled',
                        'late_alert_threshold_min','late_alert_to_employee','late_alert_to_admin',
                        'late_alert_delay_min','overtime_alert_enabled','overtime_threshold_hours','updated_at']
                d = dict(zip(cols, row))
            return d
    except Exception as e:
        logger.debug("clockin settings fetch error: %s", e)
    return {}


def save_clockin_notification_settings(store_id: int, settings: Dict) -> bool:
    """Upsert clockin_notification_settings for store_id."""
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO clockin_notification_settings
                (store_id, notify_admin_on_clockin, notify_admin_on_clockout, admin_email_ids,
                 notify_employee_self, late_alert_enabled, late_alert_threshold_min,
                 late_alert_to_employee, late_alert_to_admin, late_alert_delay_min,
                 overtime_alert_enabled, overtime_threshold_hours, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (store_id) DO UPDATE SET
                notify_admin_on_clockin  = EXCLUDED.notify_admin_on_clockin,
                notify_admin_on_clockout = EXCLUDED.notify_admin_on_clockout,
                admin_email_ids          = EXCLUDED.admin_email_ids,
                notify_employee_self     = EXCLUDED.notify_employee_self,
                late_alert_enabled       = EXCLUDED.late_alert_enabled,
                late_alert_threshold_min = EXCLUDED.late_alert_threshold_min,
                late_alert_to_employee   = EXCLUDED.late_alert_to_employee,
                late_alert_to_admin      = EXCLUDED.late_alert_to_admin,
                late_alert_delay_min     = EXCLUDED.late_alert_delay_min,
                overtime_alert_enabled   = EXCLUDED.overtime_alert_enabled,
                overtime_threshold_hours = EXCLUDED.overtime_threshold_hours,
                updated_at               = NOW()
        """, (
            store_id,
            settings.get('notify_admin_on_clockin', False),
            settings.get('notify_admin_on_clockout', False),
            settings.get('admin_email_ids', []),
            settings.get('notify_employee_self', False),
            settings.get('late_alert_enabled', False),
            settings.get('late_alert_threshold_min', 10),
            settings.get('late_alert_to_employee', False),
            settings.get('late_alert_to_admin', True),
            settings.get('late_alert_delay_min', 15),
            settings.get('overtime_alert_enabled', False),
            settings.get('overtime_threshold_hours', 8.0),
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("save_clockin_settings error: %s", e)
    return False


def _get_admin_emails_for_clockin(store_id: int, settings: Dict) -> List[str]:
    """Resolve admin_email_ids → email addresses."""
    ids = settings.get('admin_email_ids') or []
    if not ids:
        return []
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT email FROM employees WHERE employee_id = ANY(%s) AND email IS NOT NULL AND email != ''",
            (list(ids),)
        )
        emails = [r[0] if isinstance(r, (list, tuple)) else r.get('email','') for r in cur.fetchall()]
        conn.close()
        return [e for e in emails if e]
    except Exception as e:
        logger.debug("admin email lookup error: %s", e)
    return []


def _build_clockin_email_html(
    event_type: str,           # 'clock_in' | 'clock_out' | 'late_alert'
    employee_name: str,
    employee_email: str,
    event_time_str: str,
    store_name: str = "Your Store",
    scheduled_time_str: str = "",
    minutes_late: int = 0,
    hours_worked: Optional[float] = None,
    overtime_hours: Optional[float] = None,
    is_late: bool = False,
    is_early: bool = False,
    is_unscheduled: bool = False,
    notes: str = "",
) -> str:
    """Build a rich HTML email for clock events matching the order email design."""

    # ── Icon SVGs (Lucide) ────────────────────────────────────────────────────
    ICON_IN  = ('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" '
                'fill="none" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                'style="display:block;margin:0 auto">'
                '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>'
                '<polyline points="10 17 15 12 10 7"/>'
                '<line x1="15" y1="12" x2="3" y2="12"/>'
                '</svg>')
    ICON_OUT = ('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" '
                'fill="none" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                'style="display:block;margin:0 auto">'
                '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>'
                '<polyline points="16 17 21 12 16 7"/>'
                '<line x1="21" y1="12" x2="9" y2="12"/>'
                '</svg>')
    ICON_LATE = ('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" '
                 'fill="none" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                 'style="display:block;margin:0 auto">'
                 '<circle cx="12" cy="12" r="10"/>'
                 '<polyline points="12 6 12 12 16 14"/>'
                 '</svg>')

    icon_svg = ICON_LATE if event_type == 'late_alert' else (ICON_IN if event_type == 'clock_in' else ICON_OUT)

    # ── Title + subtitle ──────────────────────────────────────────────────────
    if event_type == 'clock_in':
        title = f"{employee_name} Clocked In"
        subtitle = "Clock-In Notification"
    elif event_type == 'clock_out':
        title = f"{employee_name} Clocked Out"
        subtitle = "Clock-Out Notification"
    else:
        title = f"Late Alert — {employee_name}"
        subtitle = "Employee Running Late"

    # ── Status badge ──────────────────────────────────────────────────────────
    if event_type == 'clock_in':
        if is_unscheduled:
            badge = '<div style="display:inline-block;background:#fff3e0;color:#e65100;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Unscheduled Shift</div>'
        elif is_late and minutes_late > 0:
            badge = f'<div style="display:inline-block;background:#fff3e0;color:#e65100;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">{minutes_late} min late</div>'
        elif is_early:
            badge = '<div style="display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Early ✓</div>'
        else:
            badge = '<div style="display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">On Time ✓</div>'
    elif event_type == 'clock_out':
        if overtime_hours and overtime_hours > 0:
            badge = f'<div style="display:inline-block;background:#fce4ec;color:#c62828;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">{overtime_hours:.1f}h overtime</div>'
        else:
            badge = '<div style="display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Shift Complete ✓</div>'
    else:
        badge = f'<div style="display:inline-block;background:#fff3e0;color:#e65100;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">{minutes_late} min past schedule</div>'

    # ── Card rows ─────────────────────────────────────────────────────────────
    _LBL = 'color:#90a4ae;font-size:10px;text-transform:uppercase;padding:5px 14px 5px 0;white-space:nowrap;vertical-align:middle'
    _VAL = 'color:#37474f;font-size:13px;font-weight:500;padding:5px 0;vertical-align:middle'
    _VALBOLD = 'color:#1565c0;font-size:13px;font-weight:700;padding:5px 0;vertical-align:middle'

    rows = f'<tr><td style="{_LBL}">Employee</td><td style="{_VAL}">{employee_name}</td></tr>'
    if employee_email:
        rows += f'<tr><td style="{_LBL}">Email</td><td style="{_VAL}"><a href="mailto:{employee_email}" style="color:#1976d2;text-decoration:none">{employee_email}</a></td></tr>'

    if event_type in ('clock_in', 'late_alert'):
        rows += f'<tr><td style="{_LBL}">Clocked In</td><td style="{_VALBOLD}">{event_time_str}</td></tr>'
        if scheduled_time_str:
            rows += f'<tr><td style="{_LBL}">Scheduled</td><td style="{_VAL}">{scheduled_time_str}</td></tr>'
        if is_unscheduled:
            rows += f'<tr><td style="{_LBL}">Status</td><td style="color:#e65100;font-size:13px;font-weight:600;padding:5px 0">Unscheduled shift</td></tr>'
        elif is_late and minutes_late > 0:
            rows += f'<tr><td style="{_LBL}">Late By</td><td style="color:#e65100;font-size:13px;font-weight:700;padding:5px 0">{minutes_late} minutes</td></tr>'
        elif is_early:
            rows += f'<tr><td style="{_LBL}">Status</td><td style="color:#2e7d32;font-size:13px;font-weight:600;padding:5px 0">Clocked in early</td></tr>'
        else:
            rows += f'<tr><td style="{_LBL}">Status</td><td style="color:#2e7d32;font-size:13px;font-weight:600;padding:5px 0">On time</td></tr>'
    else:
        rows += f'<tr><td style="{_LBL}">Clocked Out</td><td style="{_VALBOLD}">{event_time_str}</td></tr>'
        if hours_worked is not None:
            rows += f'<tr><td style="{_LBL}">Hours Worked</td><td style="{_VAL}">{hours_worked:.2f} hours</td></tr>'
        if overtime_hours and overtime_hours > 0:
            rows += f'<tr><td style="{_LBL}">Overtime</td><td style="color:#c62828;font-size:13px;font-weight:700;padding:5px 0">+{overtime_hours:.2f} hours</td></tr>'
        elif scheduled_time_str:
            rows += f'<tr><td style="{_LBL}">Scheduled End</td><td style="{_VAL}">{scheduled_time_str}</td></tr>'

    if notes:
        rows += f'<tr><td style="{_LBL};vertical-align:top">Notes</td><td style="{_VAL};font-style:italic">{notes}</td></tr>'

    # ── Assemble full email ───────────────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>{title}</title>
<style>
:root{{color-scheme:light only}}
html,body{{color-scheme:light only;margin:0;padding:0;background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 50%,#90caf9 100%)}}
@media(prefers-color-scheme:dark){{html,body{{background:linear-gradient(135deg,#e3f2fd,#bbdefb,#90caf9)!important;color:#333!important}}}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}}
</style>
</head>
<body>
<div style="width:100%;padding:32px 16px 20px;box-sizing:border-box">
  <div style="max-width:520px;margin:0 auto">
    <!-- Main card -->
    <div style="background:#fff;border-radius:22px;border:1px solid #e3f2fd;padding:28px 36px 36px;text-align:center;box-shadow:0 8px 32px rgba(33,150,243,.18);position:relative;overflow:hidden">
      <!-- Top accent bar -->
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#42a5f5,#2196f3,#1976d2)"></div>

      <!-- Icon -->
      <div style="margin:8px auto 14px">{icon_svg}</div>

      <!-- Title -->
      <h1 style="color:#1565c0;font-size:22px;margin:0 0 4px;font-weight:700">{title}</h1>
      <div style="color:#90a4ae;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">{store_name}</div>
      {badge}

      <!-- Detail card -->
      <div style="background:#f5faff;border-radius:12px;padding:14px 18px;margin-top:18px;text-align:left;border:1px solid rgba(33,150,243,.18)">
        <div style="font-size:11px;font-weight:600;color:#1565c0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">{subtitle}</div>
        <table style="width:100%;border-collapse:collapse">{rows}</table>
      </div>
    </div>

    <!-- Swftly footer -->
    <div style="text-align:center;padding:14px 16px 24px;margin-top:4px">
      <hr style="border:none;border-top:1px solid rgba(33,150,243,.15);margin:0 0 12px">
      <div style="font-size:15px;font-weight:700;color:#1565c0;letter-spacing:.5px">Swftly</div>
      <div style="font-size:11px;color:#90a4ae;letter-spacing:.3px">Point of Sale &amp; Business Management Platform</div>
    </div>
  </div>
</div>
</body>
</html>"""
    return html


def send_clockin_notification(
    store_id: int,
    employee_id: int,
    employee_name: str,
    employee_email: str,
    event_type: str,            # 'clock_in' | 'clock_out'
    event_time,                 # datetime object
    scheduled_start=None,       # time or str
    scheduled_end=None,
    minutes_late: int = 0,
    is_late: bool = False,
    is_early: bool = False,
    is_unscheduled: bool = False,
    hours_worked: Optional[float] = None,
    overtime_hours: Optional[float] = None,
    notes: str = "",
) -> Dict[str, List[Dict]]:
    """Send clock-in or clock-out email notification per store settings."""
    results: Dict[str, List[Dict]] = {"email": []}
    settings = get_clockin_notification_settings(store_id)
    if not settings:
        return results

    store_settings = _get_store_settings(store_id)
    store_name = (store_settings or {}).get('store_name') or (store_settings or {}).get('business_name') or 'Your Store'

    # Format times
    from datetime import datetime as _dt
    if hasattr(event_time, 'strftime'):
        event_time_str = event_time.strftime('%I:%M %p').lstrip('0') + '  ·  ' + event_time.strftime('%b %d, %Y')
    else:
        event_time_str = str(event_time)

    def _fmt_time(t):
        if t is None:
            return ''
        if hasattr(t, 'strftime'):
            return t.strftime('%I:%M %p').lstrip('0')
        s = str(t)
        try:
            from datetime import datetime as _dt2
            parsed = _dt2.strptime(s[:5], '%H:%M')
            return parsed.strftime('%I:%M %p').lstrip('0')
        except Exception:
            return s

    sched_str = _fmt_time(scheduled_start if event_type == 'clock_in' else scheduled_end)

    # Build HTML
    html = _build_clockin_email_html(
        event_type=event_type,
        employee_name=employee_name,
        employee_email=employee_email,
        event_time_str=event_time_str,
        store_name=store_name,
        scheduled_time_str=sched_str,
        minutes_late=minutes_late,
        hours_worked=hours_worked,
        overtime_hours=overtime_hours,
        is_late=is_late,
        is_early=is_early,
        is_unscheduled=is_unscheduled,
        notes=notes,
    )

    is_in = (event_type == 'clock_in')
    subject = (f"{'Clock-In' if is_in else 'Clock-Out'}: {employee_name}"
               + (f" — {minutes_late} min late" if is_late and minutes_late > 0 else "")
               + (f" — {overtime_hours:.1f}h overtime" if not is_in and overtime_hours and overtime_hours > 0 else ""))

    text = f"{subject}\n{store_name}\n\nEmployee: {employee_name}\nTime: {event_time_str}\n"
    if sched_str:
        text += f"Scheduled: {sched_str}\n"
    if is_unscheduled:
        text += f"Status: Unscheduled Shift\n"
    elif is_late:
        text += f"Late by: {minutes_late} minutes\n"
    if hours_worked is not None:
        text += f"Hours worked: {hours_worked:.2f}\n"

    to_send = set()

    # Notify admin employees
    notify_admin = settings.get('notify_admin_on_clockin' if is_in else 'notify_admin_on_clockout', False)
    if notify_admin:
        admin_emails = _get_admin_emails_for_clockin(store_id, settings)
        to_send.update(admin_emails)

    # Notify employee themselves
    if settings.get('notify_employee_self', False) and employee_email:
        to_send.add(employee_email)

    for addr in to_send:
        r = send_email(addr, subject, html, text, store_id)
        results["email"].append({"to": addr, **r})

    return results


def send_late_alert_notification(
    store_id: int,
    employee_id: int,
    employee_name: str,
    employee_email: str,
    scheduled_start_str: str,
    now_str: str,
    minutes_late: int,
) -> Dict[str, List[Dict]]:
    """Send a 'this employee hasn't clocked in yet' alert after late_alert_delay_min."""
    results: Dict[str, List[Dict]] = {"email": []}
    settings = get_clockin_notification_settings(store_id)
    if not settings or not settings.get('late_alert_enabled', False):
        return results

    store_settings = _get_store_settings(store_id)
    store_name = (store_settings or {}).get('store_name') or (store_settings or {}).get('business_name') or 'Your Store'

    html = _build_clockin_email_html(
        event_type='late_alert',
        employee_name=employee_name,
        employee_email=employee_email,
        event_time_str=now_str,
        store_name=store_name,
        scheduled_time_str=scheduled_start_str,
        minutes_late=minutes_late,
        is_late=True,
    )

    subject = f"Late Alert: {employee_name} has not clocked in ({minutes_late} min late)"
    text = f"{subject}\n{store_name}\n\nScheduled: {scheduled_start_str}\nCurrent time: {now_str}\nLate by: {minutes_late} minutes"

    to_send = set()
    if settings.get('late_alert_to_admin', True):
        to_send.update(_get_admin_emails_for_clockin(store_id, settings))
    if settings.get('late_alert_to_employee', False) and employee_email:
        to_send.add(employee_email)

    for addr in to_send:
        r = send_email(addr, subject, html, text, store_id)
        results["email"].append({"to": addr, **r})

    return results

# ── Schedule Notification Settings ───────────────────────────────────────────

def get_schedule_notification_settings(store_id: int = 1) -> Dict:
    conn = None
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM schedule_notification_settings WHERE store_id = %s", (store_id,))
        row = cur.fetchone()
        if not row:
            return {
                'store_id': store_id,
                'employee_schedule_view': 'shifts_only',
                'notify_on_edit': True,
                'admin_email_ids': []
            }
        d = dict(row) if hasattr(row, 'keys') else dict(zip([c[0] for c in cur.description], row))
        return d
    except Exception as e:
        print(f"Error getting schedule notif settings: {e}")
        return {}
    finally:
        if conn:
            conn.close()

def save_schedule_notification_settings(store_id: int, data: Dict) -> bool:
    conn = None
    try:
        from database_postgres import get_connection
        import json
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO schedule_notification_settings 
            (store_id, employee_schedule_view, notify_on_edit, admin_email_ids)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (store_id) DO UPDATE SET
                employee_schedule_view = EXCLUDED.employee_schedule_view,
                notify_on_edit = EXCLUDED.notify_on_edit,
                admin_email_ids = EXCLUDED.admin_email_ids
        """, (
            store_id,
            data.get('employee_schedule_view', 'shifts_only'),
            bool(data.get('notify_on_edit', True)),
            json.dumps(data.get('admin_email_ids', []))
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving schedule notif settings: {e}")
        return False
    finally:
        if conn:
            conn.close()


def send_schedule_notification_advanced(
    store_id: int,
    period_id: int,
    employees_data: List[Dict],
    is_edit: bool = False
) -> Dict[str, List[Dict]]:
    """
    Sends personalized schedule emails to employees.
    employees_data = [
      {
        'employee_id': 1,
        'name': 'John Doe',
        'email': 'john@example.com',
        'is_admin': False,
        'shifts': [ {'date_str':'Mon, Feb 20', 'time_str':'9:00 AM - 5:00 PM', 'start_dt':datetime, 'end_dt':datetime, 'position':'Bar'}, ... ],
        'changed_shifts': [ shift_id1, shift_id2 ]  # empty if publish
      }
    ]
    """
    results: Dict[str, List[Dict]] = {"email": []}
    if not should_send(store_id, "scheduling", "email"):
        return results

    settings = get_schedule_notification_settings(store_id)
    view_pref = settings.get('employee_schedule_view', 'shifts_only')
    admin_ids = settings.get('admin_email_ids', [])

    tpl = get_email_template(store_id, "schedule")
    store_settings = _get_store_settings(store_id)
    store_name = (store_settings or {}).get('store_name') or (store_settings or {}).get('business_name') or 'Your Store'
    base_vars = _build_store_header_vars(store_settings)
    if tpl: _merge_order_design_into_vars(base_vars, tpl)

    import urllib.parse

    # Pre-build "full schedule" table if needed
    full_schedule_html = ""
    # We can group by date, then print each shift
    all_shifts = []
    for ed in employees_data:
        for s in ed.get('shifts', []):
            all_shifts.append({**s, 'emp_name': ed['name']})
    all_shifts.sort(key=lambda x: x['start_dt'])

    if all_shifts:
        full_schedule_html += f'<table style="width:100%; border-collapse:collapse; margin-top:20px; font-family:Inter,-apple-system,sans-serif; font-size:14px;">'
        full_schedule_html += f'<tr style="background:#f1f5f9;"><th style="padding:10px;text-align:left;border-bottom:2px solid #cbd5e1;">Date</th>'
        full_schedule_html += f'<th style="padding:10px;text-align:left;border-bottom:2px solid #cbd5e1;">Time</th>'
        full_schedule_html += f'<th style="padding:10px;text-align:left;border-bottom:2px solid #cbd5e1;">Employee</th>'
        full_schedule_html += f'<th style="padding:10px;text-align:left;border-bottom:2px solid #cbd5e1;">Position</th></tr>'
        for s in all_shifts:
            full_schedule_html += f'<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;">{s["date_str"]}</td>'
            full_schedule_html += f'<td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#475569;">{s["time_str"]}</td>'
            full_schedule_html += f'<td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#475569;">{s["emp_name"]}</td>'
            full_schedule_html += f'<td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b;">{s.get("position","")}</td></tr>'
        full_schedule_html += '</table>'

    for ed in employees_data:
        email = (ed.get('email') or '').strip()
        if not email:
            continue
        
        # If this is an edit pass, skip employees who had no changed shifts (unless they are admin)
        is_admin = ed['employee_id'] in admin_ids
        if is_edit and not is_admin and not ed.get('changed_shifts'):
            continue

        vars_ = dict(base_vars)
        
        subj = f"Schedule {'Published' if not is_edit else 'Updated'}: {store_name}"
        
        # Build individual shift table
        shifts_html = ""
        if ed.get('shifts'):
            shifts_html += f'<table style="width:100%; border-collapse:collapse; margin-top:10px; font-family:Inter,-apple-system,sans-serif; font-size:14px; background:#fff; border-radius:8px; overflow:hidden;">'
            for s in ed['shifts']:
                is_changed = is_edit and (s.get('scheduled_shift_id') in ed.get('changed_shifts', []))
                row_bg = '#fef3c7' if is_changed else '#ffffff'
                shifts_html += f'<tr style="background:{row_bg};">'
                shifts_html += f'<td style="padding:12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;width:120px;">{s["date_str"]}</td>'
                shifts_html += f'<td style="padding:12px;border-bottom:1px solid #f1f5f9;color:#334155;">{s["time_str"]}<br/><span style="font-size:12px;color:#64748b;">{s.get("position","")}</span></td>'
                
                # Calendar links
                gcal = ""
                if s.get('start_dt') and s.get('end_dt'):
                    stz = s['start_dt'].strftime('%Y%m%dT%H%M%SZ')
                    etz = s['end_dt'].strftime('%Y%m%dT%H%M%SZ')
                    t_enc = urllib.parse.quote(f"Shift at {store_name}")
                    d_enc = urllib.parse.quote(f"Position: {s.get('position','')}")
                    
                    # Google
                    gcal_url = f"https://calendar.google.com/calendar/r/eventedit?text={t_enc}&dates={stz}/{etz}&details={d_enc}"
                    gcal += f'<a href="{gcal_url}" style="font-size:11px;color:#fff;background:#4285F4;text-decoration:none;display:inline-block;padding:4px 8px;border-radius:4px;margin-right:4px;margin-top:4px;">Google</a>'
                    
                    # Outlook
                    out_url = f"https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&startdt={stz}&enddt={etz}&subject={t_enc}&body={d_enc}"
                    gcal += f'<a href="{out_url}" style="font-size:11px;color:#fff;background:#0078D4;text-decoration:none;display:inline-block;padding:4px 8px;border-radius:4px;margin-right:4px;margin-top:4px;">Outlook</a>'
                    
                    # Office 365
                    o365_url = f"https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&startdt={stz}&enddt={etz}&subject={t_enc}&body={d_enc}"
                    gcal += f'<a href="{o365_url}" style="font-size:11px;color:#fff;background:#eb3c00;text-decoration:none;display:inline-block;padding:4px 8px;border-radius:4px;margin-top:4px;">Office 365</a>'
                
                shifts_html += f'<td style="padding:12px;border-bottom:1px solid #f1f5f9;text-align:right;">{gcal}</td>'
                shifts_html += f'</tr>'
            shifts_html += '</table>'
        else:
            shifts_html = "<p style='color:#64748b'>No shifts scheduled for this period.</p>"

        # Determine what to show
        show_full = is_admin or (view_pref == 'full_schedule')
        
        msg_html = f"<div style='margin-bottom:20px;'><strong style='font-size:16px;'>Hello {ed['name']},</strong><p style='color:#475569;'>Your schedule has been {'updated' if is_edit else 'published'} for the upcoming period.</p></div>"
        
        msg_html += f"<h3 style='margin:0 0 10px 0;font-size:14px;color:#334155;'>Your Shifts:</h3>{shifts_html}"
        
        if show_full and full_schedule_html:
            msg_html += f"<div style='margin-top:30px;padding-top:20px;border-top:2px dashed #e2e8f0;'><h3 style='margin:0 0 10px 0;font-size:14px;color:#334155;'>Full Team Schedule:</h3>{full_schedule_html}</div>"

        body_html = msg_html
        if tpl:
            vars_["message"] = msg_html
            subj = render_template(tpl.get('subject_template', ''), vars_) or subj
            # We inject our table directly into the body html template
            dtpl = tpl.get('body_html_template', '')
            body_html = render_template(dtpl, vars_) or body_html

        r = send_email(email, subj, body_html, "Your schedule has been updated. Please check the email HTML version.", store_id)
        results["email"].append({"to": email, **r})

    return results

# ── Register Notification Settings ───────────────────────────────────────────

def get_register_notification_settings(store_id: int = 1) -> Dict:
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM register_notification_settings WHERE store_id = %s", (store_id,))
        row = cur.fetchone()
        conn.close()
        if row:
            d = dict(row) if hasattr(row, 'keys') else {}
            if not d:
                cols = ['id','store_id','notify_admin_on_open','notify_admin_on_close',
                        'notify_admin_on_drop','notify_admin_on_withdraw','admin_email_ids',
                        'notify_employee_self','updated_at']
                d = dict(zip(cols, row))
            return d
    except Exception as e:
        logger.debug("register settings fetch error: %s", e)
    return {}

def save_register_notification_settings(store_id: int, settings: Dict) -> bool:
    try:
        from database_postgres import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO register_notification_settings
                (store_id, notify_admin_on_open, notify_admin_on_close, notify_admin_on_drop,
                 notify_admin_on_withdraw, admin_email_ids, notify_employee_self, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())
            ON CONFLICT (store_id) DO UPDATE SET
                notify_admin_on_open     = EXCLUDED.notify_admin_on_open,
                notify_admin_on_close    = EXCLUDED.notify_admin_on_close,
                notify_admin_on_drop     = EXCLUDED.notify_admin_on_drop,
                notify_admin_on_withdraw = EXCLUDED.notify_admin_on_withdraw,
                admin_email_ids          = EXCLUDED.admin_email_ids,
                notify_employee_self     = EXCLUDED.notify_employee_self,
                updated_at               = NOW()
        """, (
            store_id,
            settings.get('notify_admin_on_open', False),
            settings.get('notify_admin_on_close', False),
            settings.get('notify_admin_on_drop', False),
            settings.get('notify_admin_on_withdraw', False),
            settings.get('admin_email_ids', []),
            settings.get('notify_employee_self', False),
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("save_register_settings error: %s", e)
    return False

def _build_register_email_html(
    event_type: str,           # 'open' | 'close' | 'drop' | 'withdraw'
    employee_name: str,
    employee_email: str,
    event_time_str: str,
    store_name: str = "Your Store",
    amount: Optional[float] = None,
    notes: str = "",
) -> str:
    ICON_OPEN  = ('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" '
                  'fill="none" stroke="#2e7d32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                  'style="display:block;margin:0 auto">'
                  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>'
                  '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
                  '</svg>')
    ICON_CLOSE = ('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" '
                  'fill="none" stroke="#c62828" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                  'style="display:block;margin:0 auto">'
                  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>'
                  '<path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
                  '</svg>')
    ICON_MONEY = ('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" '
                  'fill="none" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" '
                  'style="display:block;margin:0 auto">'
                  '<line x1="12" y1="1" x2="12" y2="23"/>'
                  '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
                  '</svg>')

    if event_type == 'open':
        icon_svg = ICON_OPEN
        title = "Register Opened"
        subtitle = "Cash Register Opened"
        badge = '<div style="display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Register Open</div>'
    elif event_type == 'close':
        icon_svg = ICON_CLOSE
        title = "Register Closed"
        subtitle = "Cash Register Closed"
        badge = '<div style="display:inline-block;background:#fce4ec;color:#c62828;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Register Closed</div>'
    elif event_type == 'drop':
        icon_svg = ICON_MONEY
        title = "Cash Drop"
        subtitle = "Register Cash Drop"
        badge = '<div style="display:inline-block;background:#e3f2fd;color:#1565c0;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Deposit</div>'
    else:
        icon_svg = ICON_MONEY
        title = "Cash Withdrawn"
        subtitle = "Register Payout"
        badge = '<div style="display:inline-block;background:#fff3e0;color:#e65100;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:600;margin-top:6px;letter-spacing:.3px">Withdrawal</div>'

    _LBL = 'color:#90a4ae;font-size:10px;text-transform:uppercase;padding:5px 14px 5px 0;white-space:nowrap;vertical-align:middle'
    _VAL = 'color:#37474f;font-size:13px;font-weight:500;padding:5px 0;vertical-align:middle'
    _VALBOLD = 'color:#1565c0;font-size:13px;font-weight:700;padding:5px 0;vertical-align:middle'

    rows = f'<tr><td style="{_LBL}">Employee</td><td style="{_VAL}">{employee_name}</td></tr>'
    if employee_email:
        rows += f'<tr><td style="{_LBL}">Email</td><td style="{_VAL}"><a href="mailto:{employee_email}" style="color:#1976d2;text-decoration:none">{employee_email}</a></td></tr>'

    rows += f'<tr><td style="{_LBL}">Time</td><td style="{_VALBOLD}">{event_time_str}</td></tr>'
    
    if amount is not None:
        try:
            amt_float = float(amount)
            rows += f'<tr><td style="{_LBL}">Amount</td><td style="{_VALBOLD}">${amt_float:.2f}</td></tr>'
        except (ValueError, TypeError):
            rows += f'<tr><td style="{_LBL}">Amount</td><td style="{_VALBOLD}">${amount}</td></tr>'

    if notes:
        rows += f'<tr><td style="{_LBL};vertical-align:top">Notes</td><td style="{_VAL};font-style:italic">{notes}</td></tr>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>{title}</title>
<style>
:root{{color-scheme:light only}}
html,body{{color-scheme:light only;margin:0;padding:0;background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 50%,#90caf9 100%)}}
@media(prefers-color-scheme:dark){{html,body{{background:linear-gradient(135deg,#e3f2fd,#bbdefb,#90caf9)!important;color:#333!important}}}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}}
</style>
</head>
<body>
<div style="width:100%;padding:32px 16px 20px;box-sizing:border-box">
  <div style="max-width:520px;margin:0 auto">
    <!-- Main card -->
    <div style="background:#fff;border-radius:22px;border:1px solid #e3f2fd;padding:28px 36px 36px;text-align:center;box-shadow:0 8px 32px rgba(33,150,243,.18);position:relative;overflow:hidden">
      <!-- Top accent bar -->
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#42a5f5,#2196f3,#1976d2)"></div>

      <!-- Icon -->
      <div style="margin:8px auto 14px">{icon_svg}</div>

      <!-- Title -->
      <h1 style="color:#1565c0;font-size:22px;margin:0 0 4px;font-weight:700">{title}</h1>
      <div style="color:#90a4ae;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">{store_name}</div>
      {badge}

      <!-- Detail card -->
      <div style="background:#f5faff;border-radius:12px;padding:14px 18px;margin-top:18px;text-align:left;border:1px solid rgba(33,150,243,.18)">
        <div style="font-size:11px;font-weight:600;color:#1565c0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">{subtitle}</div>
        <table style="width:100%;border-collapse:collapse">{rows}</table>
      </div>
    </div>

    <!-- Swftly footer -->
    <div style="text-align:center;padding:14px 16px 24px;margin-top:4px">
      <hr style="border:none;border-top:1px solid rgba(33,150,243,.15);margin:0 0 12px">
      <div style="font-size:15px;font-weight:700;color:#1565c0;letter-spacing:.5px">Swftly</div>
      <div style="font-size:11px;color:#90a4ae;letter-spacing:.3px">Point of Sale &amp; Business Management Platform</div>
    </div>
  </div>
</div>
</body>
</html>"""
    return html

def send_register_notification(
    store_id: int,
    employee_id: int,
    employee_name: str,
    employee_email: str,
    event_type: str,            # 'open' | 'close' | 'drop' | 'withdraw'
    amount: Optional[float] = None,
    notes: str = "",
) -> Dict[str, List[Dict]]:
    results: Dict[str, List[Dict]] = {"email": []}
    settings = get_register_notification_settings(store_id)
    if not settings:
        return results

    # Determine if we should notify admin
    notify_admin = False
    if event_type == 'open' and settings.get('notify_admin_on_open'): notify_admin = True
    if event_type == 'close' and settings.get('notify_admin_on_close'): notify_admin = True
    if event_type == 'drop' and settings.get('notify_admin_on_drop'): notify_admin = True
    if event_type == 'withdraw' and settings.get('notify_admin_on_withdraw'): notify_admin = True

    notify_self = settings.get('notify_employee_self', False)

    if not notify_admin and not notify_self:
        return results

    store_settings = _get_store_settings(store_id)
    store_name = (store_settings or {}).get('store_name') or (store_settings or {}).get('business_name') or 'Your Store'

    from datetime import datetime
    now = datetime.now()
    event_time_str = now.strftime('%I:%M %p').lstrip('0') + '  ·  ' + now.strftime('%b %d, %Y')

    html = _build_register_email_html(
        event_type=event_type,
        employee_name=employee_name,
        employee_email=employee_email,
        event_time_str=event_time_str,
        store_name=store_name,
        amount=amount,
        notes=notes,
    )

    action_label = {
        'open': 'Register Opened',
        'close': 'Register Closed',
        'drop': 'Cash Drop',
        'withdraw': 'Cash Withdrawn'
    }.get(event_type, 'Register Event')

    subject = f"{action_label}: {employee_name}"
    text = f"{subject}\n{store_name}\n\nEmployee: {employee_name}\nTime: {event_time_str}\n"
    if amount is not None:
        try:
            text += f"Amount: ${float(amount):.2f}\n"
        except (ValueError, TypeError):
            text += f"Amount: {amount}\n"

    to_send = set()

    if notify_admin:
        admin_emails = _get_admin_emails_for_clockin(store_id, settings)
        to_send.update(admin_emails)

    if notify_self and employee_email:
        to_send.add(employee_email)

    for addr in to_send:
        r = send_email(addr, subject, html, text, store_id)
        results["email"].append({"to": addr, **r})

    return results
